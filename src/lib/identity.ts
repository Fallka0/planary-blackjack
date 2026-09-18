import { STARTER_CHIPS } from "../../shared/protocol";

// Chips live in this browser until the Planary wallet exists (wallet logic comes later).

const CHIPS_PREFIX = "pbj.chips.";

function read(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private mode or blocked storage: chips simply won't persist.
  }
}

export function readChips(playerId: string) {
  const raw = Number(read(CHIPS_PREFIX + playerId));
  return Number.isFinite(raw) && read(CHIPS_PREFIX + playerId) !== null ? raw : STARTER_CHIPS;
}

export function writeChips(playerId: string, chips: number) {
  write(CHIPS_PREFIX + playerId, String(Math.max(0, Math.floor(chips))));
  window.dispatchEvent(new CustomEvent("pbj:chips"));
}
