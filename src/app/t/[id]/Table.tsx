"use client";

import { useEffect, useRef, useState } from "react";
import { Check, CircleHelp, Copy, Link2, LogOut, MessageCircle, WifiOff } from "lucide-react";
import { canSplitCards, formatTotal, handValue } from "../../../../shared/cards";
import {
  CHIP_VALUES,
  formatChips,
  type Hand,
  MAX_HANDS,
  MIN_BET,
  type Seat,
  type TableState,
} from "../../../../shared/protocol";
import { describeLimit } from "../../../../shared/tables";
import { Chat } from "@/components/Chat";
import { ChipIcon, chipBreakdown } from "@/components/ChipIcon";
import { PlayingCard } from "@/components/PlayingCard";
import { Fairness } from "@/components/Fairness";
import { Shoe, ShuffleShow } from "@/components/Shoe";
import { TopBar } from "@/components/TopBar";
import { Tutorial, useTutorial } from "@/components/Tutorial";
import { BLACKJACK_TOUR } from "@/lib/tutorial";
import { CASINO_API, useWallet } from "@/components/WalletProvider";
import { CASINO_URL } from "@/lib/auth";
import { tableCode } from "@/lib/party";
import { useTable } from "@/lib/useTable";

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [active]);
  return now;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const RESULT_LABEL: Record<NonNullable<Hand["result"]>, string> = {
  blackjack: "Blackjack",
  win: "Win",
  push: "Push",
  lose: "Lose",
  bust: "Bust",
};

function ChipStack({ amount, set }: { amount: number; set: string | null }) {
  if (amount <= 0) return null;
  const chips = chipBreakdown(amount);
  return (
    <span className="bet" aria-label={`Bet ${formatChips(amount)}`}>
      <span className="bet-stack" aria-hidden="true">
        {chips.map((value, i) => (
          <span key={i} className="bet-chip" style={{ bottom: `${i * 4}px` }}>
            <ChipIcon size={30} value={value} set={set} />
          </span>
        ))}
      </span>
      <span className="bet-amount">{formatChips(amount)}</span>
    </span>
  );
}

function HandView({ hand, active, seatOrder }: { hand: Hand; active: boolean; seatOrder: number }) {
  const bust = handValue(hand.cards).total > 21;
  return (
    <div className={`hand${active ? " is-active" : ""}`}>
      <div className="cards" style={{ "--count": hand.cards.length } as React.CSSProperties}>
        {hand.cards.map((card, i) => (
          <PlayingCard key={i} card={card} delay={i < 2 ? i * 520 + seatOrder * 110 : 0} />
        ))}
      </div>
      {hand.cards.length ? <span className={`total${bust ? " is-bust" : ""}`}>{formatTotal(hand.cards)}</span> : null}
      {hand.result ? (
        <span className={`stamp stamp-${hand.result}`}>
          {RESULT_LABEL[hand.result]}
          {hand.net ? ` ${hand.net > 0 ? "+" : ""}${formatChips(hand.net)}` : ""}
        </span>
      ) : null}
    </div>
  );
}

function SeatView({
  seat,
  index,
  state,
  mine,
  canSit,
  now,
  onSit,
}: {
  seat: Seat | null;
  index: number;
  state: TableState;
  mine: boolean;
  canSit: boolean;
  now: number;
  onSit: (index: number) => void;
}) {
  if (!seat) {
    return (
      <div className="seat seat-empty">
        <button className="sit" onClick={() => onSit(index)} disabled={!canSit} aria-label={`Sit in seat ${index + 1}`}>
          <span className="sit-ring" aria-hidden="true">
            {index + 1}
          </span>
          <span>{canSit ? "Sit here" : "Open"}</span>
        </button>
      </div>
    );
  }

  const isTurn = state.turn?.seat === index;
  const progress =
    isTurn && state.deadline ? Math.max(0, Math.min(1, (state.deadline - now) / 20_000)) : 0;
  const betShown = state.phase === "betting" ? seat.bet : seat.hands.reduce((sum, h) => sum + h.bet, 0);

  return (
    <div className={`seat${mine ? " is-you" : ""}${isTurn ? " is-turn" : ""}${seat.connected ? "" : " is-away"}`}>
      <div className="hands">
        {seat.hands.map((hand, h) => (
          <HandView key={h} hand={hand} active={isTurn && state.turn?.hand === h && seat.hands.length > 1} seatOrder={index} />
        ))}
      </div>
      <ChipStack amount={betShown} set={seat.look?.chipset ?? null} />
      {state.phase === "betting" && seat.ready ? <span className="ready">Ready</span> : null}
      <div className="plate">
        <span className="avatar" style={{ "--p": progress } as React.CSSProperties} aria-hidden="true">
          <span className={seat.look?.border ? `ring ${seat.look.border}` : undefined}>
            {seat.look?.avatar ? <img src={CASINO_API + seat.look.avatar} alt="" width={34} height={34} /> : initials(seat.name)}
          </span>
        </span>
        <span className="plate-copy">
          {seat.look?.title ? <span className="plate-title">{seat.look.title}</span> : null}
          <span className="plate-name">
            {mine ? "You" : seat.name}
          </span>
          <span className="plate-stack">{seat.connected ? `${formatChips(seat.stack)} chips` : "Reconnecting…"}</span>
        </span>
      </div>
    </div>
  );
}

function Dealer({ state }: { state: TableState }) {
  const { cards, holeHidden } = state.dealer;
  const wasHidden = useRef(false);
  const reveal = wasHidden.current && !holeHidden;
  useEffect(() => {
    wasHidden.current = holeHidden;
  });
  const shown = holeHidden ? [...cards, null] : cards;
  const total = formatTotal(cards);

  return (
    <div className="dealer">
      <span className="dealer-label">Dealer</span>
      <div className="cards dealer-cards" style={{ "--count": shown.length } as React.CSSProperties}>
        {shown.map((card, i) =>
          card ? (
            <PlayingCard key={`d${i}-f`} card={card} reveal={reveal && i === 1} delay={i === 0 ? 400 : i === 1 && !reveal ? 1000 : 0} />
          ) : (
            <PlayingCard key={`d${i}-b`} card={null} delay={1000} />
          ),
        )}
      </div>
      {cards.length ? (
        <span className={`total${handValue(cards).total > 21 && !holeHidden ? " is-bust" : ""}`}>
          {holeHidden ? `${total} + ?` : total}
        </span>
      ) : null}
    </div>
  );
}

function statusLine(state: TableState, mySeat: number | null, now: number) {
  const secs = state.deadline ? Math.max(0, Math.ceil((state.deadline - now) / 1000)) : null;
  switch (state.phase) {
    case "waiting":
      return "Take a seat to start";
    case "shuffle":
      return "Shuffling a new shoe";
    case "betting":
      return secs !== null ? `Place your bets · ${secs}s` : "Place your bets";
    case "playing": {
      if (!state.turn) return "Dealing";
      const seat = state.seats[state.turn.seat];
      const who = state.turn.seat === mySeat ? "Your turn" : `${seat?.name ?? "Player"} is deciding`;
      return secs !== null ? `${who} · ${secs}s` : who;
    }
    case "insurance":
      return secs !== null ? `Dealer shows an ace · Insurance? ${secs}s` : "Dealer shows an ace";
    case "dealer":
      return "Dealer draws";
    case "settle":
      return "Paying out";
  }
}

function Dock({
  state,
  seat,
  mySeat,
  send,
  now,
}: {
  state: TableState;
  seat: Seat | null;
  mySeat: number | null;
  send: ReturnType<typeof useTable>["send"];
  now: number;
}) {
  if (!seat) {
    const open = state.seats.some((s) => !s);
    return (
      <div className="dock">
        <p className="dock-note">{open ? "Pick an open seat to play. You can watch until then." : "The table is full. You're watching."}</p>
      </div>
    );
  }

  if (state.phase === "shuffle") {
    return (
      <div className="dock">
        <p className="dock-note">The dealer is shuffling six decks into a new shoe. Betting opens in a moment.</p>
      </div>
    );
  }

  if (state.phase === "betting" || state.phase === "waiting") {
    const secs = state.deadline ? Math.max(0, Math.ceil((state.deadline - now) / 1000)) : null;
    return (
      <div className="dock">
        <div className="dock-chips" role="group" aria-label="Add chips to your bet">
          {CHIP_VALUES.map((value) => (
            <button
              key={value}
              className="chip-btn"
              onClick={() => send({ type: "bet", amount: value })}
              disabled={seat.ready || seat.bet + value > Math.min(seat.stack, state.limit ?? Infinity)}
              aria-label={`Add ${value}`}
            >
              <ChipIcon size={52} value={value} />
            </button>
          ))}
        </div>
        <div className="dock-actions">
          <span className="dock-bet">
            Bet <strong>{formatChips(seat.bet)}</strong>
          </span>
          {seat.bet === 0 && seat.lastBet >= MIN_BET && seat.stack >= MIN_BET ? (
            <button className="btn btn-ink" onClick={() => send({ type: "rebet" })}>
              Rebet {formatChips(Math.floor(Math.min(seat.lastBet, seat.stack, state.limit ?? Infinity) / 10) * 10)}
            </button>
          ) : (
            <button className="btn btn-ink" onClick={() => send({ type: "clearBet" })} disabled={seat.bet === 0 || seat.ready}>
              Clear
            </button>
          )}
          <button className="btn btn-paper btn-lg" onClick={() => send({ type: "deal" })} disabled={seat.bet < MIN_BET || seat.ready}>
            {seat.ready ? (secs !== null ? `Waiting · ${secs}s` : "Waiting for others") : "Deal"}
          </button>
        </div>
      </div>
    );
  }

  if (state.phase === "insurance" && seat.hands.length > 0) {
    const cost = seat.hands[0].bet / 2;
    const hasBlackjack = handValue(seat.hands[0].cards).total === 21;
    if (seat.insurance === null) {
      return (
        <div className="dock dock-turn">
          <p className="dock-note">
            {hasBlackjack ? "You have blackjack. Take even money?" : `Insurance costs ${formatChips(cost)} and pays 2:1 if the dealer has blackjack.`}
          </p>
          <div className="dock-actions">
            <button className="btn btn-paper btn-lg" onClick={() => send({ type: "insurance", take: true })} disabled={seat.stack < cost}>
              {hasBlackjack ? "Even money" : "Insure"}
            </button>
            <button className="btn btn-ink btn-lg" onClick={() => send({ type: "insurance", take: false })}>
              No thanks
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="dock">
        <p className="dock-note">{seat.insurance > 0 ? `Insured for ${formatChips(seat.insurance)}. Waiting for the others.` : "No insurance. Waiting for the others."}</p>
      </div>
    );
  }

  const myTurn = state.phase === "playing" && state.turn?.seat === mySeat;
  if (myTurn && state.turn) {
    const hand = seat.hands[state.turn.hand];
    const canDouble = hand.cards.length === 2 && seat.stack >= hand.bet;
    const canSplit =
      seat.hands.length < MAX_HANDS && canSplitCards(hand.cards) && !(hand.fromSplit && hand.cards[0].rank === "A") && seat.stack >= hand.bet;
    return (
      <div className="dock dock-turn">
        <div className="dock-actions">
          <button className="btn btn-paper btn-lg" onClick={() => send({ type: "hit" })}>
            Hit
          </button>
          <button className="btn btn-ink btn-lg" onClick={() => send({ type: "stand" })}>
            Stand
          </button>
          <button className="btn btn-ink btn-lg" onClick={() => send({ type: "double" })} disabled={!canDouble}>
            Double
          </button>
          <button className="btn btn-ink btn-lg" onClick={() => send({ type: "split" })} disabled={!canSplit}>
            Split
          </button>
        </div>
      </div>
    );
  }

  const inHand = seat.hands.length > 0;
  return (
    <div className="dock">
      <p className="dock-note">
        {state.phase === "settle"
          ? "Next round starts in a moment."
          : inHand
            ? "Hands are being played. Your turn comes in seat order."
            : "You're sitting this round out. Bet when the next round opens."}
      </p>
    </div>
  );
}

export function Table({ id, sitOnArrival, justCreated }: { id: string; sitOnArrival: boolean; justCreated: boolean }) {
  const { balance, cardback } = useWallet();
  const { state, you, status, error, chat, send } = useTable(id);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  // Shown once, over the table, to the player who just opened it.
  const createdDialog = useRef<HTMLDialogElement>(null);
  const wantsSeat = useRef(sitOnArrival);
  const [chatOpen, setChatOpen] = useState(false);
  const [seenChat, setSeenChat] = useState(0);
  const tour = useTutorial("blackjack");
  const unread = chatOpen ? 0 : chat.filter((m) => m.name !== null).length - seenChat;

  useEffect(() => {
    if (chatOpen) setSeenChat(chat.filter((m) => m.name !== null).length);
  }, [chatOpen, chat]);
  const now = useNow(Boolean(state?.deadline));

  const mySeat = you?.seat ?? null;
  const seat = state && mySeat !== null ? state.seats[mySeat] : null;
  const chips = balance ?? 0;

  // Arrived from a Join button or a table just opened: take the first free
  // seat once the table says who we are. Once only, and the query comes off
  // the address so a reload doesn't try again.
  useEffect(() => {
    if (!wantsSeat.current || !state || !you) return;
    wantsSeat.current = false;
    window.history.replaceState(null, "", `/t/${id}`);
    const broke = balance !== null && balance < MIN_BET;
    if (you.verified && you.seat === null && !broke) send({ type: "sit" });
  }, [state, you, balance, id, send]);

  useEffect(() => {
    if (justCreated) createdDialog.current?.showModal();
  }, [justCreated]);

  function sit(index: number) {
    send({ type: "sit", seat: index });
  }

  const code = tableCode(id);
  function copy(what: "code" | "link") {
    // The bare link, never the address bar: that may still carry ?sit.
    const text = what === "code" ? code : `${window.location.origin}/t/${id}`;
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(what);
      window.setTimeout(() => setCopied((current) => (current === what ? null : current)), 1800);
    });
  }

  const copyIcon = (what: "code" | "link") =>
    copied === what ? (
      <Check size={16} strokeWidth={2.4} aria-hidden="true" />
    ) : what === "code" ? (
      <Copy size={15} strokeWidth={2} aria-hidden="true" />
    ) : (
      <Link2 size={16} strokeWidth={2} aria-hidden="true" />
    );

  const tableInfo = (
    <div className="table-info">
      <span className="table-tag">{state?.name ?? (state?.isPrivate ?? id.startsWith("p-") ? "Private" : "Public")}</span>
      {state && state.limit !== undefined ? <span className="table-tag table-limit">{describeLimit(state.limit)}</span> : null}
      <button className="table-id" onClick={() => copy("code")} aria-label={`Copy table code ${code}`} title="Copy code">
        {code}
        {copyIcon("code")}
      </button>
      <button className="icon-btn" onClick={() => copy("link")} aria-label="Copy table link" title="Copy link">
        {copyIcon("link")}
      </button>
      <button className="icon-btn" onClick={tour.show} aria-label="How to play">
        <CircleHelp size={17} strokeWidth={2} aria-hidden="true" />
      </button>
      <button
        className="icon-btn chat-toggle"
        onClick={() => setChatOpen((v) => !v)}
        aria-label={unread > 0 ? `Open chat, ${unread} new` : "Open chat"}
        aria-expanded={chatOpen}
      >
        <MessageCircle size={17} strokeWidth={2} aria-hidden="true" />
        {unread > 0 ? <span className="badge">{unread > 9 ? "9+" : unread}</span> : null}
      </button>
      {seat ? (
        <button className="btn btn-quiet btn-sm leave-btn" onClick={() => send({ type: "leave" })} aria-label="Leave seat">
          <LogOut size={15} strokeWidth={2} aria-hidden="true" />
          <span className="leave-label">Leave seat</span>
        </button>
      ) : null}
    </div>
  );

  return (
    <div className={`app app-table${cardback ? ` ${cardback}` : ""}`}>
      <TopBar>{tableInfo}</TopBar>

      <main className={`table-main${chatOpen ? " chat-is-open" : ""}`}>
        <div className="play">
        <section className={`felt${state?.phase === "shuffle" ? " is-shuffling" : ""}`} aria-label="Blackjack table">
          <div className="felt-print" aria-hidden="true">
            <span className="print-21 plate-a">21</span>
            <span className="print-21 plate-b">21</span>
          </div>

          {state ? (
            <>
              <div className="felt-top">
                <Dealer state={state} />
                <Shoe state={state} />
              </div>

              <div className="felt-rules" aria-hidden="true">
                <svg viewBox="0 0 900 130" preserveAspectRatio="xMidYMid meet">
                  <defs>
                    <path id="arc" d="M10 18 Q450 150 890 18" />
                  </defs>
                  <text>
                    <textPath href="#arc" startOffset="50%" textAnchor="middle">
                      Blackjack pays 3 to 2 · Dealer stands on soft 17
                    </textPath>
                  </text>
                </svg>
              </div>

              {state.phase === "shuffle" ? <ShuffleShow key={state.round} /> : null}

              <p className="status" aria-live="polite">
                {statusLine(state, mySeat, now)}
              </p>

              <div className="seats">
                {state.seats.map((s, i) => (
                  <SeatView
                    key={i}
                    seat={s}
                    index={i}
                    state={state}
                    mine={i === mySeat}
                    canSit={mySeat === null && chips >= MIN_BET}
                    now={now}
                    onSit={sit}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="felt-loading">
              <p>{status === "closed" ? "Can't reach the table. Retrying…" : "Pulling up a chair…"}</p>
            </div>
          )}
        </section>

        {state ? <Fairness fair={state.fair} mySeed={you?.seed ?? null} send={send} /> : null}

        {state ? (
          <>
            {mySeat === null && balance !== null && balance < MIN_BET ? (
              <div className="dock">
                <p className="dock-note">You&apos;re out of chips. Claim your daily bonus in the casino, then come back.</p>
                <a className="btn btn-paper" href={`${CASINO_URL}/chips`}>
                  Get chips
                </a>
              </div>
            ) : (
              <Dock state={state} seat={seat} mySeat={mySeat} send={send} now={now} />
            )}
          </>
        ) : null}
        </div>

        <Chat
          messages={chat}
          myId={you?.playerId ?? null}
          onSend={(text) => send({ type: "chat", text })}
          onClose={() => setChatOpen(false)}
        />
      </main>

      {justCreated ? (
        <dialog
          ref={createdDialog}
          className="sheet"
          aria-labelledby="created-title"
          onClick={(event) => {
            if (event.target === event.currentTarget) createdDialog.current?.close();
          }}
        >
          <div className="sheet-card">
            <div className="sheet-top">
              <h2 id="created-title" className="sheet-title">
                Your table is open
              </h2>
            </div>
            <p className="field-hint">
              {state?.isPrivate ?? id.startsWith("p-")
                ? "It's private: only people with the code or the link can join. Both stay up in the bar above."
                : "It's public: it shows in the lobby while someone is seated. The code and link work too, and stay up in the bar above."}
            </p>
            <div className="created-share">
              <button className="share-chip" onClick={() => copy("code")} aria-label={`Copy table code ${code}`}>
                <span className="share-label">Code</span>
                <span className="share-value">{code}</span>
                {copyIcon("code")}
              </button>
              <button className="share-chip" onClick={() => copy("link")} aria-label="Copy table link">
                <span className="share-label">Link</span>
                <span className="share-value">/t/{id}</span>
                {copyIcon("link")}
              </button>
            </div>
            <div className="sheet-actions">
              <button className="btn btn-ink" onClick={() => createdDialog.current?.close()}>
                To the table
              </button>
            </div>
          </div>
        </dialog>
      ) : null}
      {tour.open && state ? <Tutorial steps={BLACKJACK_TOUR} onClose={tour.close} /> : null}
      {status === "closed" && state ? (
        <div className="toast toast-warn" role="status">
          <WifiOff size={16} strokeWidth={2} aria-hidden="true" /> Connection lost. Reconnecting…
        </div>
      ) : null}
      {error ? (
        <div className="toast" role="alert">
          {error}
        </div>
      ) : null}
    </div>
  );
}
