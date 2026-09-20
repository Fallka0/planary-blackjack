import type { Card } from "./cards";

export const SEATS = 5;
export const MIN_BET = 10;
export const MAX_BET = 2500;
export const STARTER_CHIPS = 5000;
export const CHIP_VALUES = [10, 50, 100, 500] as const;

export const BETTING_MS = 15_000;
export const TURN_MS = 20_000;
export const INSURANCE_MS = 10_000;
/** Where a player is sent to check a shoe for themselves. */
export const VERIFY_URL = "https://casino.planary.ch/verify";

export const SHUFFLE_MS = 5_500;
/** Most hands a player can hold after re-splitting. */
export const MAX_HANDS = 4;
export const SETTLE_MS = 5_000;
export const RECONNECT_GRACE_MS = 30_000;
export const CHAT_MAX_LENGTH = 200;
export const CHAT_HISTORY = 60;

export type Phase = "waiting" | "shuffle" | "betting" | "insurance" | "playing" | "dealer" | "settle";

export type HandResult = "blackjack" | "win" | "push" | "lose" | "bust";

export interface Hand {
  cards: Card[];
  bet: number;
  doubled: boolean;
  /** No more actions on this hand. */
  done: boolean;
  fromSplit: boolean;
  result?: HandResult;
  /** Net chips won (+) or lost (−) on settle. */
  net?: number;
}

/** How a player looks at the table, from their Planary Casino profile and shop items. */
export interface PlayerLook {
  /** Path on the casino API, or null for initials. */
  avatar: string | null;
  border: string | null;
  title: string | null;
  chipset: string | null;
}

export interface Seat {
  playerId: string;
  name: string;
  look: PlayerLook;
  stack: number;
  /** Chips placed for the next round (betting phase). */
  bet: number;
  lastBet: number;
  ready: boolean;
  hands: Hand[];
  activeHand: number;
  connected: boolean;
  /** Insurance stake this round (half the bet), 0 if none. Null while still undecided in the insurance phase. */
  insurance: number | null;
}

/**
 * What the table has promised about this shoe, and what it proved about the last.
 *
 * Blackjack commits per shoe rather than per hand: the whole six-deck order is
 * fixed by a seed before the first card is dealt, so one reveal at the end
 * proves every hand that came out of it. Cards already dealt cannot be checked
 * mid-shoe — publishing the seed then would hand you the rest of the shoe.
 */
export interface Fairness {
  /** SHA-256 of the seed the current shoe was shuffled from. */
  hash: string | null;
  /** Seeds contributed by the players seated when this shoe was shuffled. */
  seeds: string[];
  /** Counts shoes at this table. */
  nonce: number;
  /** The shoe just retired, laid open. */
  lastShoe: {
    hash: string;
    serverSeed: string;
    clientSeed: string;
    nonce: number;
    /** Where the cut card sat, which the same seed decided. */
    cutCard: number;
  } | null;
}

export interface TableState {
  id: string;
  isPrivate: boolean;
  phase: Phase;
  seats: (Seat | null)[];
  dealer: { cards: Card[]; holeHidden: boolean };
  turn: { seat: number; hand: number } | null;
  /** Epoch ms when the current timer (betting or turn) runs out. */
  deadline: number | null;
  shoeRemaining: number;
  shoeSize: number;
  /** Cards left in the shoe where the cut card sits. When it comes out, the shoe is reshuffled after the round. */
  cutCard: number;
  cutCardOut: boolean;
  round: number;
  fair: Fairness;
}

export type ClientMessage =
  /** Your contribution to the next shoe's shuffle. Taken until the shoe is cut. */
  | { type: "seed"; value: string }
  | { type: "sit"; seat: number }
  | { type: "leave" }
  | { type: "bet"; amount: number }
  | { type: "clearBet" }
  | { type: "rebet" }
  | { type: "deal" }
  | { type: "hit" }
  | { type: "stand" }
  | { type: "double" }
  | { type: "split" }
  | { type: "insurance"; take: boolean }
  | { type: "chat"; text: string };

export interface ChatMessage {
  id: string;
  at: number;
  /** Null for table announcements (someone sat down, left, …). */
  name: string | null;
  playerId: string | null;
  text: string;
}

export type ServerMessage =
  | {
      type: "state";
      state: TableState;
      you: { playerId: string; seat: number | null; verified: boolean; /** The seed you have offered for the next shoe. */ seed: string | null };
      /** Server clock when sent, so clients can correct deadlines for clock skew. */
      now: number;
    }
  | { type: "chat"; messages: ChatMessage[]; replace: boolean }
  | { type: "error"; message: string };

export interface LobbyTable {
  id: string;
  seated: number;
  phase: Phase;
  updatedAt: number;
}

export type LobbyMessage = { type: "tables"; tables: LobbyTable[] };

/** Table ids: "t-xxxxx" public, "p-xxxxx" private. */
export function isPrivateTableId(id: string) {
  return id.startsWith("p-");
}

export function formatChips(value: number) {
  const sign = value < 0 ? "−" : "";
  return (
    sign +
    Math.abs(Math.round(value))
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, "'")
  );
}
