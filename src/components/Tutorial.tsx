"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";

export interface TourStep {
  title: string;
  body: React.ReactNode;
  /** CSS selector of the part of the page this step points at. Missing or hidden → the card sits in the middle. */
  target?: string;
  visual?: React.ReactNode;
}

type Rect = { top: number; left: number; width: number; height: number };

const PAD = 8;
const GAP = 14;

/**
 * Opens by itself the first time someone visits (per game), or when the URL has `?tutorial=1`.
 * `auto` is false on pages where the guided parts aren't on screen yet.
 */
export function useTutorial(game: string, auto = true) {
  const key = `planary:tutorial:${game}:v1`;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const asked = new URLSearchParams(window.location.search).get("tutorial") === "1";
    let seen = true;
    try {
      seen = window.localStorage.getItem(key) === "seen";
    } catch {
      // Private mode: don't nag every visit.
    }
    if (asked || (auto && !seen)) setOpen(true);
  }, [key, auto]);

  const close = useCallback(() => {
    setOpen(false);
    try {
      window.localStorage.setItem(key, "seen");
    } catch {}
    const url = new URL(window.location.href);
    if (url.searchParams.has("tutorial")) {
      url.searchParams.delete("tutorial");
      window.history.replaceState(null, "", url);
    }
  }, [key]);

  return { open, show: () => setOpen(true), close };
}

function measure(selector: string | undefined): Rect | null {
  if (!selector) return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return null;
  const top = Math.max(4, r.top - PAD);
  const left = Math.max(4, r.left - PAD);
  return {
    top,
    left,
    width: Math.min(window.innerWidth - 4, r.right + PAD) - left,
    height: Math.min(window.innerHeight - 4, r.bottom + PAD) - top,
  };
}

export function Tutorial({ steps, onClose }: { steps: TourStep[]; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [cardSize, setCardSize] = useState({ width: 360, height: 220 });
  const [narrow, setNarrow] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const step = steps[index];
  const last = index === steps.length - 1;

  // Follow the target while the table moves underneath (cards dealt, chat opened, window resized).
  useLayoutEffect(() => {
    const update = () => {
      setRect(measure(step.target));
      setNarrow(window.innerWidth < 640);
      if (cardRef.current) setCardSize({ width: cardRef.current.offsetWidth, height: cardRef.current.offsetHeight });
    };
    update();
    const timer = window.setInterval(update, 400);
    window.addEventListener("resize", update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("resize", update);
    };
  }, [step.target, index]);

  useEffect(() => {
    cardRef.current?.focus();
  }, [index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") setIndex((i) => Math.min(steps.length - 1, i + 1));
      else if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, steps.length]);

  // Put the card next to the spotlight: below if it fits, else above, else over the middle of the screen.
  let placement: React.CSSProperties;
  if (narrow || !rect) {
    placement = {};
  } else {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const left = Math.min(Math.max(16, rect.left + rect.width / 2 - cardSize.width / 2), vw - cardSize.width - 16);
    const below = rect.top + rect.height + GAP;
    const above = rect.top - GAP - cardSize.height;
    if (below + cardSize.height < vh - 12) placement = { top: below, left };
    else if (above > 12) placement = { top: above, left };
    else placement = { top: Math.max(12, vh / 2 - cardSize.height / 2), left: Math.max(16, rect.left - cardSize.width - GAP) };
  }
  const floating = !narrow && rect !== null;
  // On phones the card docks to the bottom, or to the top when the spotlight is in the lower half.
  const atTop = narrow && rect !== null && rect.top + rect.height / 2 > window.innerHeight / 2;

  return (
    <div className="tour" role="presentation">
      {rect ? (
        <div className="tour-spot" style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }} aria-hidden="true" />
      ) : (
        <div className="tour-dim" aria-hidden="true" onClick={onClose} />
      )}
      <div
        ref={cardRef}
        key={index}
        className={`tour-card${floating ? " is-floating" : ""}${atTop ? " at-top" : ""}`}
        style={placement}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="tour-top">
          <span className="tour-count">
            {index + 1} / {steps.length}
          </span>
          <button className="tour-x" onClick={onClose} aria-label="Close the guide">
            <X size={17} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>
        <h2 id={titleId} className="tour-title">
          {step.title}
        </h2>
        {step.visual ? <div className="tour-visual">{step.visual}</div> : null}
        <div className="tour-body">{step.body}</div>
        <div className="tour-actions">
          <span className="tour-dots" aria-hidden="true">
            {steps.map((_, i) => (
              <i key={i} className={i === index ? "is-on" : undefined} />
            ))}
          </span>
          {index > 0 ? (
            <button className="btn btn-sm tour-ghost" onClick={() => setIndex(index - 1)} aria-label="Previous step">
              <ArrowLeft size={15} strokeWidth={2.2} aria-hidden="true" />
            </button>
          ) : (
            <button className="btn btn-sm tour-ghost" onClick={onClose}>
              Skip
            </button>
          )}
          <button className="btn btn-ink btn-sm tour-next" onClick={() => (last ? onClose() : setIndex(index + 1))}>
            {last ? "Start playing" : "Next"}
            {last ? null : <ArrowRight size={15} strokeWidth={2.2} aria-hidden="true" />}
          </button>
        </div>
      </div>
    </div>
  );
}
