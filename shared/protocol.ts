import type { Card } from "./cards";

export const SEATS = 5;
export const MIN_BET = 10;
export const MAX_BET = 2500;
export const STARTER_CHIPS = 5000;
export const CHIP_VALUES = [10, 50, 100, 500] as const;

export const BETTING_MS = 15_000;
export const TURN_MS = 20_000;
export const SETTLE_MS = 5_000;
export const RECONNECT_GRACE_MS = 30_000;
export const CHAT_MAX_LENGTH = 200;
export const CHAT_HISTORY = 60;

export type Phase = "waiting" | "betting" | "playing" | "dealer" | "settle";

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

export interface Seat {
  playerId: string;
  name: string;
  stack: number;
  /** Chips placed for the next round (betting phase). */
  bet: number;
  lastBet: number;
  ready: boolean;
  hands: Hand[];
  activeHand: number;
  connected: boolean;
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
  round: number;
}

export type ClientMessage =
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
      you: { playerId: string; seat: number | null; verified: boolean };
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
