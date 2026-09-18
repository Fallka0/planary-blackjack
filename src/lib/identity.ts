import { STARTER_CHIPS } from "../../shared/protocol";

// Chips live in this browser until the Planary wallet exists (wallet logic comes later).

const PID_KEY = "pbj.pid";
const NAME_KEY = "pbj.name";
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

export function guestId() {
  let id = read(PID_KEY);
  if (!id || !/^g-[a-z0-9-]{8,40}$/i.test(id)) {
    id = `g-${crypto.randomUUID()}`;
    write(PID_KEY, id);
  }
  return id;
}

export function storedName() {
  return read(NAME_KEY) ?? "";
}

export function storeName(name: string) {
  write(NAME_KEY, name.trim().slice(0, 18));
}

export function readChips(playerId: string) {
  const raw = Number(read(CHIPS_PREFIX + playerId));
  return Number.isFinite(raw) && read(CHIPS_PREFIX + playerId) !== null ? raw : STARTER_CHIPS;
}

export function writeChips(playerId: string, chips: number) {
  write(CHIPS_PREFIX + playerId, String(Math.max(0, Math.floor(chips))));
  window.dispatchEvent(new CustomEvent("pbj:chips"));
}
