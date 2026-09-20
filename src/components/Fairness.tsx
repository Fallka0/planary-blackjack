"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Dices, Lock, LockOpen } from "lucide-react";
import { type ClientMessage, type Fairness as FairState, VERIFY_URL } from "../../shared/protocol";

/** Long hex is unreadable and nobody checks it by eye; the ends are enough to recognise. */
function short(hex: string) {
  return hex.length > 20 ? `${hex.slice(0, 8)}…${hex.slice(-8)}` : hex;
}

/**
 * What the table promised about this shoe, and what it proved about the last.
 *
 * Blackjack is committed a shoe at a time, which changes what this can honestly
 * show. Mid-shoe there is only the hash: publishing the seed now would hand you
 * the rest of the cards. When the dealer shuffles, the finished shoe is opened
 * and every hand dealt out of it becomes checkable at once — including where
 * the cut card sat, which the same seed decided.
 */
export function Fairness({ fair, mySeed, send }: { fair: FairState; mySeed: string | null; send: (msg: ClientMessage) => void }) {
  const [draft, setDraft] = useState("");
  const [saved, setSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const last = fair.lastShoe;

  useEffect(() => {
    setDraft("");
    setSaved(Boolean(mySeed));
  }, [mySeed, fair.nonce]);

  function contribute(event: React.FormEvent) {
    event.preventDefault();
    const value = draft.trim();
    if (!value) return;
    send({ type: "seed", value });
    setSaved(true);
    inputRef.current?.blur();
  }

  return (
    <section className="fair" aria-label="Provable fairness">
      <header className="fair-head">
        <Lock size={14} aria-hidden="true" />
        <h2>This shoe, sealed</h2>
        <span className="fair-nonce num">#{fair.nonce}</span>
      </header>

      <p className="fair-hash mono" title={fair.hash ?? undefined}>
        {fair.hash ? short(fair.hash) : "shuffling…"}
      </p>
      <p className="fair-note">
        All 312 cards were shuffled from a seed behind this hash, before the first one was dealt. It stays sealed until the
        dealer shuffles again — opening it now would show you the rest of the shoe.
      </p>

      <form className="fair-seed" onSubmit={contribute}>
        <label htmlFor="client-seed" className="sr-only">
          Add your own seed to the next shoe
        </label>
        <input
          id="client-seed"
          ref={inputRef}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setSaved(false);
          }}
          placeholder={mySeed ?? "Your seed for the next shoe"}
          maxLength={64}
          autoComplete="off"
          spellCheck={false}
        />
        <button type="submit" className="icon-btn" disabled={!draft.trim()} aria-label="Contribute this seed">
          {saved && mySeed ? <Check size={15} /> : <Dices size={15} />}
        </button>
      </form>

      {last ? (
        <details className="fair-last">
          <summary>
            <LockOpen size={13} aria-hidden="true" /> Shoe #{last.nonce} is open
          </summary>
          <dl className="fair-proof">
            <div>
              <dt>Server seed</dt>
              <dd className="mono">{short(last.serverSeed)}</dd>
            </div>
            <div>
              <dt>Its hash, shown while it was dealt</dt>
              <dd className="mono">{short(last.hash)}</dd>
            </div>
            <div>
              <dt>Player seeds</dt>
              <dd className="mono">{last.clientSeed || "none offered"}</dd>
            </div>
            <div>
              <dt>Cut card</dt>
              <dd className="num">{last.cutCard} from the back</dd>
            </div>
          </dl>
        </details>
      ) : null}

      <a className="fair-link" href={VERIFY_URL} target="_blank" rel="noreferrer">
        How this works, and how to check it
      </a>
    </section>
  );
}
