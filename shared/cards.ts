export type Suit = "spade" | "heart" | "diamond" | "club";
export type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";

export interface Card {
  rank: Rank;
  suit: Suit;
}

export const SUITS: Suit[] = ["spade", "heart", "diamond", "club"];
export const RANKS: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

export function isRed(card: Card) {
  return card.suit === "heart" || card.suit === "diamond";
}

function rankValue(rank: Rank) {
  if (rank === "A") return 1;
  if (rank === "J" || rank === "Q" || rank === "K") return 10;
  return Number(rank);
}

/** Best blackjack total. `soft` means an ace is currently counted as 11. */
export function handValue(cards: Card[]): { total: number; soft: boolean } {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    total += rankValue(card.rank);
    if (card.rank === "A") aces += 1;
  }
  if (aces > 0 && total + 10 <= 21) return { total: total + 10, soft: true };
  return { total, soft: false };
}

export function isBlackjack(cards: Card[]) {
  return cards.length === 2 && handValue(cards).total === 21;
}

/** Pairs can be split when both cards have the same blackjack value (K + 10 counts). */
export function canSplitCards(cards: Card[]) {
  return cards.length === 2 && rankValue(cards[0].rank) === rankValue(cards[1].rank);
}

export function formatTotal(cards: Card[]) {
  if (cards.length === 0) return "";
  const { total, soft } = handValue(cards);
  if (isBlackjack(cards)) return "21";
  return soft && total < 21 ? `${total - 10}/${total}` : String(total);
}
