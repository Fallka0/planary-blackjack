"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Lock, Plus, Users, X } from "lucide-react";
import { formatChips } from "../../shared/protocol";
import { LIMIT_MAX, LIMIT_MIN, limitProblem } from "../../shared/tables";
import { createTable, LobbyError } from "@/lib/party";

/** "5'000", "5 000" and "5000" all mean five thousand. */
function readLimit(text: string): number | null {
  const digits = text.replace(/['’\s]/g, "");
  return /^\d+$/.test(digits) ? Number(digits) : null;
}

/** The "Create a table" button and the dialog it opens. */
export function CreateTable({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const limitId = useId();
  const hintId = useId();
  const [limitText, setLimitText] = useState("1'000");
  const [noLimit, setNoLimit] = useState(false);
  const [visibility, setVisibility] = useState<"public" | "private">("private");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Closing by Escape or the backdrop goes through the dialog's own close event.
  useEffect(() => {
    const el = dialog.current;
    const reset = () => {
      setError(null);
      setBusy(false);
    };
    el?.addEventListener("close", reset);
    return () => el?.removeEventListener("close", reset);
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    let limit: number | null = null;
    if (!noLimit) {
      limit = readLimit(limitText);
      if (limit === null) {
        setError("The limit has to be a whole number of chips, like 5'000.");
        return;
      }
    }
    const wrong = limitProblem(limit);
    if (wrong) {
      setError(wrong);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const id = await createTable({ limit, visibility });
      router.push(`/t/${id}?new=1`);
    } catch (e) {
      setError(e instanceof LobbyError ? e.message : "Couldn't open a table. Try again.");
      setBusy(false);
    }
  }

  return (
    <>
      <button className="btn btn-paper btn-lg" onClick={() => dialog.current?.showModal()} disabled={disabled}>
        <Plus size={18} strokeWidth={2.4} aria-hidden="true" />
        Create a table
      </button>

      <dialog
        ref={dialog}
        className="sheet"
        aria-labelledby={titleId}
        onClick={(event) => {
          // A click on the backdrop lands on the dialog itself.
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
      >
        <form className="sheet-card" onSubmit={submit} noValidate>
          <div className="sheet-top">
            <h2 id={titleId} className="sheet-title">
              Your own table
            </h2>
            <button type="button" className="tour-x" onClick={() => dialog.current?.close()} aria-label="Close">
              <X size={18} strokeWidth={2.2} aria-hidden="true" />
            </button>
          </div>

          <div className="field">
            <label htmlFor={limitId}>Limit</label>
            <p id={hintId} className="field-hint">
              The most one player can bet on a round. Fixed once the table is open.
            </p>
            <input
              id={limitId}
              inputMode="numeric"
              autoComplete="off"
              value={noLimit ? "" : limitText}
              placeholder={noLimit ? "No limit" : undefined}
              onChange={(event) => setLimitText(event.target.value)}
              disabled={noLimit}
              aria-describedby={hintId}
              aria-invalid={error !== null && !noLimit}
            />
            <span className="field-range">
              {formatChips(LIMIT_MIN)} to {formatChips(LIMIT_MAX)}
            </span>
            <label className="check">
              <input type="checkbox" checked={noLimit} onChange={(event) => setNoLimit(event.target.checked)} />
              No limit
            </label>
          </div>

          <fieldset className="field">
            <legend>Who can join</legend>
            <div className="choice-row">
              <label className={`choice${visibility === "private" ? " is-on" : ""}`}>
                <input type="radio" name="visibility" value="private" checked={visibility === "private"} onChange={() => setVisibility("private")} />
                <Lock size={16} strokeWidth={2.2} aria-hidden="true" />
                <span>
                  <strong>Private</strong>
                  <small>Only with the code or link</small>
                </span>
              </label>
              <label className={`choice${visibility === "public" ? " is-on" : ""}`}>
                <input type="radio" name="visibility" value="public" checked={visibility === "public"} onChange={() => setVisibility("public")} />
                <Users size={16} strokeWidth={2.2} aria-hidden="true" />
                <span>
                  <strong>Public</strong>
                  <small>Listed in the lobby too</small>
                </span>
              </label>
            </div>
          </fieldset>

          {error ? (
            <p className="sheet-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="sheet-actions">
            <button type="button" className="btn btn-sm tour-ghost" onClick={() => dialog.current?.close()}>
              Cancel
            </button>
            <button type="submit" className="btn btn-ink" disabled={busy}>
              {busy ? "Opening…" : "Open table and sit down"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
