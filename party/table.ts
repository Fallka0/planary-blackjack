import { type Connection, type ConnectionContext, getServerByName, Server, type WSMessage } from "partyserver";
import type { Env } from "./env";
import { type Card, canSplitCards, handValue, isBlackjack, RANKS, SUITS } from "../shared/cards";
import {
  BETTING_MS,
  CHAT_HISTORY,
  CHAT_MAX_LENGTH,
  type ChatMessage,
  CHIP_VALUES,
  type ClientMessage,
  type Hand,
  isPrivateTableId,
  MAX_BET,
  MIN_BET,
  RECONNECT_GRACE_MS,
  type Seat,
  SEATS,
  type ServerMessage,
  SETTLE_MS,
  type TableState,
  TURN_MS,
} from "../shared/protocol";

const DECKS = 6;
const RESHUFFLE_BELOW = 0.25;
const DEALER_STEP_MS = 750;

interface Identity {
  playerId: string;
  name: string;
  verified: boolean;
}

function freshShoe(): Card[] {
  const cards: Card[] = [];
  for (let d = 0; d < DECKS; d++) for (const suit of SUITS) for (const rank of RANKS) cards.push({ rank, suit });
  // Fisher–Yates with a cryptographic source.
  const rand = new Uint32Array(cards.length);
  crypto.getRandomValues(rand);
  for (let i = cards.length - 1; i > 0; i--) {
    const j = rand[i] % (i + 1);
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

function cleanName(raw: unknown) {
  const name = String(raw ?? "")
    .replace(/[\u0000-\u001f\u007f<>]/g, "")
    .trim()
    .slice(0, 18);
  return name || "Player";
}

export class Table extends Server<Env> {
  state!: TableState;
  shoe: Card[] = freshShoe();
  timer: ReturnType<typeof setTimeout> | null = null;
  graceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  /** Players who asked to leave (or dropped) mid-round; removed at the end of it. */
  pendingLeave = new Set<string>();
  chat: ChatMessage[] = [];
  /** True while bets are being taken from the wallet at round start. */
  starting = false;
  /** True while a double/split is waiting on the wallet. */
  busy = false;
  lastChatAt = new Map<string, number>();

  onStart() {
    this.state = {
      id: this.name,
      isPrivate: isPrivateTableId(this.name),
      phase: "waiting",
      seats: Array.from({ length: SEATS }, () => null),
      dealer: { cards: [], holeHidden: false },
      turn: null,
      deadline: null,
      shoeRemaining: this.shoe.length,
      shoeSize: DECKS * 52,
      round: 1,
    };
  }

  // ── Connections ───────────────────────────────

  async onConnect(conn: Connection, ctx: ConnectionContext) {
    const url = new URL(ctx.request.url);
    const identity = await this.identify(url.searchParams.get("token"));
    conn.setState(identity);
    conn.send(JSON.stringify({ type: "chat", messages: this.chat, replace: true } satisfies ServerMessage));

    const seat = this.seatOf(identity.playerId);
    if (seat !== null) {
      const s = this.state.seats[seat]!;
      s.connected = true;
      const grace = this.graceTimers.get(identity.playerId);
      if (grace) clearTimeout(grace);
      this.graceTimers.delete(identity.playerId);
    }
    this.broadcastState();
  }

  onClose(conn: Connection) {
    const identity = conn.state as Identity | null;
    if (!identity) return;
    const stillHere = [...this.getConnections<Identity>()].some(
      (c) => c.id !== conn.id && c.state?.playerId === identity.playerId,
    );
    if (stillHere) return;
    const seat = this.seatOf(identity.playerId);
    if (seat === null) return;
    this.state.seats[seat]!.connected = false;
    this.graceTimers.set(
      identity.playerId,
      setTimeout(() => {
        this.graceTimers.delete(identity.playerId);
        this.leave(identity.playerId);
      }, RECONNECT_GRACE_MS),
    );
    this.broadcastState();
  }

  /** Only Planary accounts can play; a connection without a valid token may only watch. */
  async identify(token: string | null): Promise<Identity> {
    if (token) {
      try {
        const res = await fetch(`${this.env.AUTH_API_URL || "https://auth.planary.ch"}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const { user } = (await res.json()) as { user?: { id: string; email?: string; name?: string } };
          if (user?.id) {
            return { playerId: `u-${user.id}`, name: cleanName(user.name || user.email?.split("@")[0]), verified: true };
          }
        }
      } catch {
        // Auth unreachable: treat as a spectator.
      }
    }
    return { playerId: `s-${crypto.randomUUID()}`, name: "Spectator", verified: false };
  }

  // ── Wallet (planary-casino-api) ───────────────

  /** Chips live in the casino wallet; the table only moves them, worker to worker. */
  async wallet(path: string, body: Record<string, unknown>): Promise<{ ok?: boolean; balance: number }> {
    const res = await this.env.CASINO.fetch(
      new Request(`https://casino.internal${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-internal-key": this.env.INTERNAL_KEY },
        body: JSON.stringify(body),
      }),
    );
    if (!res.ok) throw new Error(`wallet ${path} → ${res.status}`);
    return res.json();
  }

  userId(playerId: string) {
    return playerId.replace(/^u-/, "");
  }

  /** Sends a message to one player's open connections. */
  tell(playerId: string, message: string) {
    for (const conn of this.getConnections<Identity>()) {
      if (conn.state?.playerId === playerId) conn.send(JSON.stringify({ type: "error", message } satisfies ServerMessage));
    }
  }

  // ── Messages ──────────────────────────────────

  async onMessage(sender: Connection, raw: WSMessage) {
    const identity = sender.state as Identity | null;
    if (!identity || typeof raw !== "string") return;
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    const error = await this.handle(msg, identity);
    if (error) sender.send(JSON.stringify({ type: "error", message: error } satisfies ServerMessage));
    this.broadcastState();
  }

  async handle(msg: ClientMessage, who: Identity): Promise<string | void> {
    const seatIndex = this.seatOf(who.playerId);
    const seat = seatIndex === null ? null : this.state.seats[seatIndex]!;

    // Watching is open, playing and chatting need a Planary account.
    if (!who.verified && msg.type !== "leave") return "Sign in with your Planary account to play.";

    switch (msg.type) {
      case "chat": {
        const text = String(msg.text ?? "")
          .replace(/[\u0000-\u001f\u007f]/g, " ")
          .trim()
          .slice(0, CHAT_MAX_LENGTH);
        if (!text) return;
        const last = this.lastChatAt.get(who.playerId) ?? 0;
        if (Date.now() - last < 700) return "Slow down a little.";
        this.lastChatAt.set(who.playerId, Date.now());
        this.postChat({ name: seat?.name ?? who.name, playerId: who.playerId, text });
        return;
      }
      case "sit": {
        if (seat) return "You're already seated.";
        const index = Number(msg.seat);
        if (!Number.isInteger(index) || index < 0 || index >= SEATS) return "That seat doesn't exist.";
        if (this.state.seats[index]) return "That seat is taken.";
        let stack: number;
        try {
          ({ balance: stack } = await this.wallet("/internal/wallet", { userId: this.userId(who.playerId), name: who.name }));
        } catch {
          return "Chips are unavailable right now. Try again in a moment.";
        }
        if (stack < MIN_BET) return "You're out of chips. Claim your daily bonus in the casino.";
        // The seat may have been taken while we asked the wallet.
        if (this.state.seats[index] || this.seatOf(who.playerId) !== null) return "That seat is taken.";
        this.state.seats[index] = {
          playerId: who.playerId,
          name: who.name,
          stack,
          bet: 0,
          lastBet: 0,
          ready: false,
          hands: [],
          activeHand: 0,
          connected: true,
        };
        if (this.state.phase === "waiting") this.state.phase = "betting";
        this.postChat({ name: null, playerId: null, text: `${this.state.seats[index]!.name} sat down at seat ${index + 1}.` });
        this.notifyLobby();
        return;
      }
      case "leave":
        if (!seat) return;
        this.leave(who.playerId);
        return;
      case "bet": {
        if (!seat) return "Take a seat first.";
        if (this.state.phase !== "betting" || this.starting) return "Bets are closed for this round.";
        if (!CHIP_VALUES.includes(msg.amount as (typeof CHIP_VALUES)[number])) return "Unknown chip.";
        const next = seat.bet + msg.amount;
        if (next > MAX_BET) return `Table maximum is ${MAX_BET}.`;
        if (next > seat.stack) return "Not enough chips.";
        seat.bet = next;
        seat.ready = false;
        this.startBettingClock();
        return;
      }
      case "clearBet":
        if (!seat || this.state.phase !== "betting" || this.starting) return;
        seat.bet = 0;
        seat.ready = false;
        return;
      case "rebet": {
        if (!seat || this.state.phase !== "betting" || this.starting) return;
        const amount = Math.min(seat.lastBet, seat.stack, MAX_BET);
        if (amount < MIN_BET) return "No previous bet to repeat.";
        seat.bet = amount;
        seat.ready = false;
        this.startBettingClock();
        return;
      }
      case "deal": {
        if (!seat || this.state.phase !== "betting" || this.starting) return;
        if (seat.bet < MIN_BET) return `Minimum bet is ${MIN_BET}.`;
        seat.ready = true;
        this.startBettingClock();
        const seated = this.state.seats.filter((s): s is Seat => !!s && s.connected);
        if (seated.every((s) => s.ready)) void this.startRound();
        return;
      }
      case "hit":
      case "stand":
      case "double":
      case "split":
        return this.play(msg.type, seatIndex);
    }
  }

  // ── Round flow ────────────────────────────────

  startBettingClock() {
    if (this.state.deadline !== null) return;
    this.state.deadline = Date.now() + BETTING_MS;
    this.setTimer(BETTING_MS, () => void this.startRound());
  }

  draw(): Card {
    if (this.shoe.length === 0) this.shoe = freshShoe();
    const card = this.shoe.pop()!;
    this.state.shoeRemaining = this.shoe.length;
    return card;
  }

  async startRound() {
    if (this.starting || this.state.phase !== "betting") return;
    this.starting = true;
    this.clearTimer();
    try {
      // Take every bet from the wallet first; a bet the wallet can't cover sits the round out.
      const candidates = this.state.seats.filter((s): s is Seat => !!s && s.bet >= MIN_BET);
      const players: Seat[] = [];
      await Promise.all(
        candidates.map(async (seat) => {
          try {
            const res = await this.wallet("/internal/debit", {
              userId: this.userId(seat.playerId),
              amount: seat.bet,
              game: "blackjack",
              ref: this.name,
            });
            seat.stack = res.balance;
            if (res.ok) players.push(seat);
            else this.tell(seat.playerId, "Not enough chips for that bet, so you sit this round out.");
          } catch {
            this.tell(seat.playerId, "Chips are unavailable right now, so you sit this round out.");
          }
        }),
      );
      // Someone who left while we were at the wallet gets their bet back.
      for (const seat of players.filter((p) => !this.state.seats.includes(p))) {
        void this.wallet("/internal/credit", { userId: this.userId(seat.playerId), amount: seat.bet, game: "blackjack", ref: this.name }).catch(
          (error) => console.error("refund failed", error),
        );
      }
      const seated = players.filter((p) => this.state.seats.includes(p));
      if (seated.length === 0) {
        for (const seat of this.state.seats) if (seat) seat.ready = false;
        this.state.deadline = null;
        this.broadcastState();
        return;
      }
      this.deal(seated);
    } finally {
      this.starting = false;
      this.broadcastState();
    }
  }

  deal(players: Seat[]) {
    if (this.shoe.length < DECKS * 52 * RESHUFFLE_BELOW) {
      this.shoe = freshShoe();
      this.state.shoeRemaining = this.shoe.length;
    }

    for (const seat of this.state.seats) {
      if (!seat) continue;
      if (players.includes(seat)) {
        seat.lastBet = seat.bet;
        seat.hands = [{ cards: [], bet: seat.bet, doubled: false, done: false, fromSplit: false }];
      } else {
        seat.hands = [];
      }
      seat.bet = 0;
      seat.ready = false;
      seat.activeHand = 0;
    }

    const dealer = this.state.dealer;
    dealer.cards = [];
    dealer.holeHidden = true;
    for (let round = 0; round < 2; round++) {
      for (const seat of players) seat.hands[0].cards.push(this.draw());
      dealer.cards.push(this.draw());
    }

    for (const seat of players) {
      if (isBlackjack(seat.hands[0].cards)) seat.hands[0].done = true;
    }

    // Dealer peeks for blackjack when showing an ace or a ten.
    const up = handValue([dealer.cards[0]]).total;
    if ((up === 10 || up === 11) && isBlackjack(dealer.cards)) {
      dealer.holeHidden = false;
      void this.settle();
      return;
    }

    this.state.phase = "playing";
    this.state.turn = null;
    this.state.deadline = null;
    this.advanceTurn();
  }

  /** Moves to the next hand that still needs a decision, or hands over to the dealer. */
  advanceTurn() {
    this.clearTimer();
    const seats = this.state.seats;
    for (let s = 0; s < SEATS; s++) {
      const seat = seats[s];
      if (!seat) continue;
      for (let h = 0; h < seat.hands.length; h++) {
        const hand = seat.hands[h];
        if (hand.done) continue;
        if (this.pendingLeave.has(seat.playerId)) {
          hand.done = true;
          continue;
        }
        seat.activeHand = h;
        this.state.turn = { seat: s, hand: h };
        this.state.deadline = Date.now() + TURN_MS;
        this.setTimer(TURN_MS, () => {
          hand.done = true;
          this.advanceTurn();
          this.broadcastState();
        });
        return;
      }
    }
    this.state.turn = null;
    this.dealerPlay();
  }

  /** Takes the extra stake for a double or split. False if the wallet can't cover it or the turn moved on meanwhile. */
  async extraStake(seat: Seat, amount: number, turn: { seat: number; hand: number }): Promise<string | null> {
    this.busy = true;
    try {
      const res = await this.wallet("/internal/debit", { userId: this.userId(seat.playerId), amount, game: "blackjack", ref: this.name });
      seat.stack = res.balance;
      if (!res.ok) return "Not enough chips.";
      const still = this.state.phase === "playing" && this.state.turn?.seat === turn.seat && this.state.turn.hand === turn.hand;
      if (!still) {
        const back = await this.wallet("/internal/credit", { userId: this.userId(seat.playerId), amount, game: "blackjack", ref: this.name });
        seat.stack = back.balance;
        return "Too late, your turn ran out.";
      }
      return null;
    } catch {
      return "Chips are unavailable right now. Try again.";
    } finally {
      this.busy = false;
    }
  }

  async play(action: "hit" | "stand" | "double" | "split", seatIndex: number | null): Promise<string | void> {
    const turn = this.state.turn;
    if (this.state.phase !== "playing" || !turn || turn.seat !== seatIndex) return "It's not your turn.";
    if (this.busy) return "One moment…";
    const seat = this.state.seats[turn.seat]!;
    const hand = seat.hands[turn.hand];

    if (action === "hit") {
      hand.cards.push(this.draw());
      const { total } = handValue(hand.cards);
      if (total > 21) {
        hand.done = true;
        hand.result = "bust";
      } else if (total === 21) {
        hand.done = true;
      }
    } else if (action === "stand") {
      hand.done = true;
    } else if (action === "double") {
      if (hand.cards.length !== 2) return "You can only double on your first two cards.";
      if (seat.stack < hand.bet) return "Not enough chips to double.";
      const problem = await this.extraStake(seat, hand.bet, turn);
      if (problem) return problem;
      hand.bet *= 2;
      hand.doubled = true;
      hand.cards.push(this.draw());
      hand.done = true;
      if (handValue(hand.cards).total > 21) hand.result = "bust";
    } else if (action === "split") {
      if (seat.hands.length > 1) return "You can split once per round.";
      if (!canSplitCards(hand.cards)) return "Only pairs can be split.";
      if (seat.stack < hand.bet) return "Not enough chips to split.";
      const problem = await this.extraStake(seat, hand.bet, turn);
      if (problem) return problem;
      const aces = hand.cards[0].rank === "A";
      const second: Hand = { cards: [hand.cards.pop()!], bet: hand.bet, doubled: false, done: false, fromSplit: true };
      hand.fromSplit = true;
      hand.cards.push(this.draw());
      second.cards.push(this.draw());
      seat.hands.push(second);
      for (const h of seat.hands) {
        // Split aces get one card each; any split hand on 21 is finished.
        if (aces || handValue(h.cards).total === 21) h.done = true;
      }
    }

    if (hand.done) this.advanceTurn();
  }

  dealerPlay() {
    this.clearTimer();
    this.state.phase = "dealer";
    this.state.deadline = null;
    const dealer = this.state.dealer;
    dealer.holeHidden = false;

    const live = this.state.seats.some((s) => s?.hands.some((h) => h.result !== "bust" && !(isBlackjack(h.cards) && !h.fromSplit)));
    const step = () => {
      if (live && handValue(dealer.cards).total < 17) {
        dealer.cards.push(this.draw());
        this.broadcastState();
        this.setTimer(DEALER_STEP_MS, step);
      } else {
        void this.settle();
      }
    };
    this.broadcastState();
    this.setTimer(DEALER_STEP_MS, step);
  }

  async settle() {
    this.clearTimer();
    const dealerCards = this.state.dealer.cards;
    const dealerTotal = handValue(dealerCards).total;
    const dealerBJ = isBlackjack(dealerCards);
    const payouts = new Map<Seat, number>();

    for (const seat of this.state.seats) {
      if (!seat) continue;
      let payout = 0;
      for (const hand of seat.hands) {
        const total = handValue(hand.cards).total;
        const natural = isBlackjack(hand.cards) && !hand.fromSplit;
        if (hand.result === "bust" || total > 21) hand.result = "bust";
        else if (natural && !dealerBJ) hand.result = "blackjack";
        else if (dealerBJ) hand.result = natural ? "push" : "lose";
        else if (dealerTotal > 21 || total > dealerTotal) hand.result = "win";
        else if (total === dealerTotal) hand.result = "push";
        else hand.result = "lose";

        // Payout returns the stake plus winnings: 3:2 for blackjack, 1:1 for a win, the stake for a push.
        const handPayout =
          hand.result === "blackjack"
            ? hand.bet + Math.floor(hand.bet * 1.5)
            : hand.result === "win"
              ? hand.bet * 2
              : hand.result === "push"
                ? hand.bet
                : 0;
        payout += handPayout;
        hand.net = handPayout - hand.bet;
        hand.done = true;
      }
      if (payout > 0) payouts.set(seat, payout);
    }

    this.state.phase = "settle";
    this.state.turn = null;
    this.state.dealer.holeHidden = false;
    this.state.deadline = Date.now() + SETTLE_MS;
    this.setTimer(SETTLE_MS, () => {
      this.nextRound();
      this.broadcastState();
    });
    this.broadcastState();

    // Pay winners from the wallet; one retry, then log so it can be fixed by hand.
    await Promise.all(
      [...payouts].map(async ([seat, amount]) => {
        const body = { userId: this.userId(seat.playerId), amount, game: "blackjack", ref: this.name };
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            seat.stack = (await this.wallet("/internal/credit", body)).balance;
            return;
          } catch (error) {
            if (attempt === 1) console.error("payout failed", body, error);
          }
        }
      }),
    );
    this.broadcastState();
  }

  nextRound() {
    for (const playerId of this.pendingLeave) this.removeSeat(playerId);
    this.pendingLeave.clear();
    for (const seat of this.state.seats) {
      if (!seat) continue;
      seat.hands = [];
      seat.activeHand = 0;
      seat.bet = 0;
      seat.ready = false;
    }
    this.state.dealer = { cards: [], holeHidden: false };
    this.state.turn = null;
    this.state.deadline = null;
    this.state.round += 1;
    this.state.phase = this.state.seats.some(Boolean) ? "betting" : "waiting";
  }

  leave(playerId: string) {
    const seat = this.seatOf(playerId);
    if (seat === null) return;
    const inRound = this.starting || (this.state.seats[seat]!.hands.length > 0 && (this.state.phase === "playing" || this.state.phase === "dealer" || this.state.phase === "settle"));
    if (inRound) {
      this.pendingLeave.add(playerId);
      if (this.state.turn?.seat === seat) {
        for (const hand of this.state.seats[seat]!.hands) hand.done = true;
        this.advanceTurn();
      }
    } else {
      this.removeSeat(playerId);
    }
    this.broadcastState();
  }

  removeSeat(playerId: string) {
    const seat = this.seatOf(playerId);
    if (seat === null) return;
    this.postChat({ name: null, playerId: null, text: `${this.state.seats[seat]!.name} left the table.` });
    this.state.seats[seat] = null;
    if (!this.state.seats.some(Boolean)) {
      this.clearTimer();
      this.state.phase = "waiting";
      this.state.deadline = null;
    } else if (this.state.phase === "betting") {
      const seated = this.state.seats.filter((s): s is Seat => !!s && s.connected);
      if (seated.length > 0 && seated.every((s) => s.ready)) void this.startRound();
    }
    this.notifyLobby();
  }

  // ── Helpers ───────────────────────────────────

  postChat(entry: Omit<ChatMessage, "id" | "at">) {
    const message: ChatMessage = { id: crypto.randomUUID(), at: Date.now(), ...entry };
    this.chat.push(message);
    if (this.chat.length > CHAT_HISTORY) this.chat.splice(0, this.chat.length - CHAT_HISTORY);
    this.broadcast(JSON.stringify({ type: "chat", messages: [message], replace: false } satisfies ServerMessage));
  }

  seatOf(playerId: string): number | null {
    const index = this.state.seats.findIndex((s) => s?.playerId === playerId);
    return index === -1 ? null : index;
  }

  setTimer(ms: number, fn: () => void) {
    this.clearTimer();
    this.timer = setTimeout(() => {
      this.timer = null;
      fn();
      this.broadcastState();
    }, ms);
  }

  clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  broadcastState() {
    for (const conn of this.getConnections<Identity>()) {
      const id = conn.state;
      if (!id) continue;
      const message: ServerMessage = {
        type: "state",
        state: this.publicState(),
        you: { playerId: id.playerId, seat: this.seatOf(id.playerId), verified: id.verified },
        now: Date.now(),
      };
      conn.send(JSON.stringify(message));
    }
  }

  /** The hole card never leaves the server while it's face down. */
  publicState(): TableState {
    const { dealer } = this.state;
    return {
      ...this.state,
      dealer: {
        holeHidden: dealer.holeHidden,
        cards: dealer.holeHidden ? dealer.cards.slice(0, 1) : dealer.cards,
      },
    };
  }

  notifyLobby() {
    if (this.state.isPrivate) return;
    const seated = this.state.seats.filter(Boolean).length;
    const body = JSON.stringify({ id: this.name, seated, phase: this.state.phase });
    void getServerByName(this.env.Lobby, "main")
      .then((lobby) => lobby.fetch(new Request("https://lobby.internal/", { method: "POST", body })))
      .catch(() => {});
  }
}
