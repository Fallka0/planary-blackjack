import type { Card, Suit } from "../../shared/cards";
import { isRed } from "../../shared/cards";

/*
  A card, screen-printed — the same card Grimoire and Hold'em deal.

  Cream paper, a halftone that fades in toward the foot, and the suit printed
  twice: once in a pale plate, once in ink, about six pixels off register.
  That misprint is the whole trick: it is what stops a flat SVG from reading
  as a flat SVG. Nothing here is glossy, bevelled or lit, because nothing
  anywhere in this casino is.

  The drawing is designed at 120 × 168, and every number the stylesheet uses
  for it is that drawing divided by 120 — so it is the same card at any
  `--cw`. The back is deliberately not shared: here it is a shop cosmetic,
  and every design a player can own has its own.
*/

const SUIT_PATHS: Record<Suit, string> = {
  heart: "M50 90C22 68 6 50 6 31 6 16 17 6 31 6c9 0 16 5 19 12 3-7 10-12 19-12 14 0 25 10 25 25 0 19-16 37-44 59z",
  diamond: "M50 3 88 50 50 97 12 50z",
  spade:
    "M50 4C36 24 8 39 8 60c0 13 10 22 22 22 7 0 13-3 16-8l-5 22h18l-5-22c3 5 9 8 16 8 12 0 22-9 22-22C92 39 64 24 50 4z",
  club: "M50 8a19 19 0 0 1 17 28 19 19 0 1 1-8 36l5 24H36l5-24a19 19 0 1 1-8-36A19 19 0 0 1 50 8z",
};

const SUIT_NAMES: Record<Suit, string> = { heart: "hearts", diamond: "diamonds", spade: "spades", club: "clubs" };
const RANK_NAMES: Record<string, string> = { A: "Ace", J: "Jack", Q: "Queen", K: "King" };

export function SuitMark({ suit, className }: { suit: Suit; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <path d={SUIT_PATHS[suit]} fill="currentColor" />
    </svg>
  );
}

/**
 * A printed card. `card === null` renders the back.
 * `delay` staggers the deal animation; `reveal` plays a flip instead (the dealer's hole card).
 */
export function PlayingCard({ card, delay = 0, reveal = false }: { card: Card | null; delay?: number; reveal?: boolean }) {
  const style = { animationDelay: `${delay}ms` } as React.CSSProperties;
  if (!card) {
    return <span className="card card-back is-dealt" style={style} role="img" aria-label="Face-down card" />;
  }
  const red = isRed(card);
  const ink = red ? "#b3122e" : "#22060e";
  const plate = red ? "#ff5a78" : "rgba(34,6,14,0.16)";

  return (
    <span
      className={`card card-play ${reveal ? "is-revealed" : "is-dealt"}`}
      style={style}
      role="img"
      aria-label={`${RANK_NAMES[card.rank] ?? card.rank} of ${SUIT_NAMES[card.suit]}`}
    >
      <span className="card-halftone" aria-hidden="true" />
      {/* The pale plate goes down first, six pixels out of line. */}
      <svg className="card-pip card-pip-plate" viewBox="0 0 100 100" aria-hidden="true">
        <path d={SUIT_PATHS[card.suit]} fill={plate} />
      </svg>
      <svg className="card-pip card-pip-ink" viewBox="0 0 100 100" aria-hidden="true">
        <path d={SUIT_PATHS[card.suit]} fill={ink} />
      </svg>
      <span className="card-corner" style={{ color: ink }} aria-hidden="true">
        <span className="card-rank">{card.rank}</span>
        <SuitMark suit={card.suit} />
      </span>
    </span>
  );
}
