import type { TableState } from "../../shared/protocol";

const X0 = 22; // front of the stack (the mouth, where cards come out)
const X1 = 90; // back wall
const SPAN = X1 - X0;
const BODY = "M4 58 H96 V18 Q96 12 90 12 H42 L18 36 H4 Z";

/**
 * The shoe in the corner, seen from the side: the stack of cards drains toward the mouth,
 * and the yellow cut card sits in the stack at its depth until the dealer reaches it.
 */
export function Shoe({ state }: { state: TableState }) {
  const { shoeRemaining, shoeSize, cutCard, cutCardOut, phase } = state;
  const shuffling = phase === "shuffle";
  const stack = shuffling ? SPAN : (shoeRemaining / shoeSize) * SPAN;
  const front = X1 - stack;
  const cutX = X1 - (cutCard / shoeSize) * SPAN;
  const label = shuffling ? "Shuffling" : cutCardOut ? "Last round" : `${Math.round(((shoeSize - shoeRemaining) / shoeSize) * 100)}% dealt`;

  return (
    <div
      className={`shoe${cutCardOut && !shuffling ? " is-cut" : ""}${shuffling ? " is-shuffling" : ""}`}
      role="img"
      aria-label={
        shuffling
          ? "Shoe: the dealer is shuffling a new shoe"
          : `Shoe: ${shoeRemaining} of ${shoeSize} cards left${cutCardOut ? ", the cut card is out, new shoe after this round" : ""}`
      }
    >
      <svg viewBox="0 0 100 64" className="shoe-art" aria-hidden="true">
        <defs>
          {/* Card edges seen from the side. */}
          <pattern id="shoe-edges" width="1.8" height="4" patternUnits="userSpaceOnUse">
            <rect width="1.8" height="4" fill="var(--paper)" />
            <rect width="0.6" height="4" fill="var(--plate-oxblood)" opacity="0.35" />
          </pattern>
          <clipPath id="shoe-inside">
            <path d={BODY} />
          </clipPath>
        </defs>
        <path className="shoe-body" d={BODY} />
        <g clipPath="url(#shoe-inside)">
          <rect className="shoe-stack" x={front} y="30" width={Math.max(0, stack)} height="24" fill="url(#shoe-edges)" />
          {!cutCardOut || shuffling ? <rect className="shoe-cutcard" x={cutX - 1.5} y="24" width="3" height="30" rx="0.8" /> : null}
        </g>
        {/* The next card, leaning out of the mouth. */}
        {stack > 0.5 ? (
          <g transform={`rotate(-38 ${front} 54)`}>
            <rect className="shoe-next" x={front - 17} y="30" width="17" height="24" rx="2.5" />
            <circle cx={front - 8.5} cy="42" r="2.2" fill="var(--paper)" />
          </g>
        ) : null}
        <path className="shoe-rim" d={BODY} />
      </svg>
      {cutCardOut && !shuffling ? <span className="shoe-cut-out" aria-hidden="true" /> : null}
      <span className="shoe-label" aria-hidden="true">
        {label}
      </span>
    </div>
  );
}

const CARDS = 16;

/** The dealer riffles six decks, squares them, and loads the new shoe. */
export function ShuffleShow() {
  return (
    <div className="shuffle" role="status">
      <div className="shuffle-deck" aria-hidden="true">
        {Array.from({ length: CARDS }, (_, i) => (
          <span
            key={i}
            className="shuffle-card"
            style={{ "--i": i, "--side": i % 2 === 0 ? -1 : 1, "--h": Math.floor(i / 2) } as React.CSSProperties}
          />
        ))}
        <span className="shuffle-cutcard" />
      </div>
      <p className="shuffle-label">
        <strong>Shuffling</strong>
        <span>New shoe · 6 decks · 312 cards</span>
      </p>
    </div>
  );
}
