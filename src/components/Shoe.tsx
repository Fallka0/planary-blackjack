import type { TableState } from "../../shared/protocol";

/** The shoe in the corner: how much is left, where the cut card sits, and whether it's out. */
export function Shoe({ state }: { state: TableState }) {
  const { shoeRemaining, shoeSize, cutCard, cutCardOut, phase } = state;
  const left = (shoeRemaining / shoeSize) * 100;
  const cut = (cutCard / shoeSize) * 100;
  const label =
    phase === "shuffle" ? "Shuffling" : cutCardOut ? "Last round" : `${Math.round(((shoeSize - shoeRemaining) / shoeSize) * 100)}% dealt`;

  return (
    <div
      className={`shoe${cutCardOut ? " is-cut" : ""}${phase === "shuffle" ? " is-shuffling" : ""}`}
      role="img"
      aria-label={
        phase === "shuffle"
          ? "Shoe: the dealer is shuffling a new shoe"
          : `Shoe: ${shoeRemaining} of ${shoeSize} cards left${cutCardOut ? ", the cut card is out, new shoe after this round" : ""}`
      }
    >
      <span className="shoe-cards" aria-hidden="true">
        <span />
        <span />
        <span />
        <i className="shoe-cut" />
      </span>
      <span className="shoe-meter" aria-hidden="true">
        <span className="shoe-fill" style={{ width: `${left}%` }} />
        <span className="shoe-mark" style={{ left: `${cut}%` }} />
      </span>
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
