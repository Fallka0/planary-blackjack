/**
 * What a table is: its limit, and whether the lobby lists it.
 *
 * "Limit" means the most one player may bet on one round at this table: the
 * stake placed before the cards come out. Doubling and splitting may take a
 * hand past it, as at a real casino, because they match a bet the limit
 * already allowed. To make the limit cover those too, check it in
 * party/table.ts where a double or split takes its extra stake.
 *
 * A limit of `null` means no limit: the check is skipped, and only the
 * player's chips (and their own loss limit in the casino) bound the bet.
 * Never write 0 for "no limit" — `withinLimit` would read it as a table that
 * takes nothing.
 */

import { CHIP_VALUES, formatChips, MIN_BET } from "./protocol";

export type Limit = number | null;

export interface HouseTable {
  /** A table id like any other, so casino presence and invites can point at it. */
  id: string;
  name: string;
  limit: Limit;
}

/**
 * The house tables: always in the lobby, never closed. Each is one table of
 * five seats; when it is full, players watch or pick another.
 *
 * The ids keep the `t-` plus six characters every table id has. They contain
 * an "o", which the random table ids never use, so no player's table can ever
 * be given one of these by chance.
 */
export const HOUSE_TABLES: readonly HouseTable[] = [
  { id: "t-house1", name: "Table 1", limit: 5_000 },
  { id: "t-house2", name: "Table 2", limit: 20_000 },
  { id: "t-house3", name: "Table 3", limit: null },
];

/**
 * Tables that predate limits, and the private tables the casino opens for
 * invites, have no stored limit. They keep the one every table used to have.
 */
export const DEFAULT_LIMIT = 2_500;

/** Bounds for a limit a player sets on their own table. */
export const LIMIT_MIN = MIN_BET;
export const LIMIT_MAX = 1_000_000;

export function houseTable(id: string): HouseTable | null {
  return HOUSE_TABLES.find((t) => t.id === id) ?? null;
}

/** Whether `amount` may be bet on one round at a table with this limit. */
export function withinLimit(limit: Limit, amount: number) {
  return limit === null || amount <= limit;
}

/** Checks a limit a player asked for. Returns the problem, or null if it's fine. */
export function limitProblem(limit: unknown): string | null {
  if (limit === null) return null;
  if (typeof limit !== "number" || !Number.isInteger(limit)) return "The limit has to be a whole number of chips.";
  if (limit < LIMIT_MIN) return `The limit has to be at least ${LIMIT_MIN}, the smallest bet.`;
  if (limit > LIMIT_MAX) return `The limit can be at most ${formatChips(LIMIT_MAX)}. For more, choose no limit.`;
  return null;
}

/**
 * The chips a table offers. Every table has 10 to 500; from a limit of
 * 20'000 there is a 1'000 chip too, and a table without a limit adds 5'000,
 * so a big bet isn't forty taps on the 500.
 */
export function chipValues(limit: Limit): readonly number[] {
  if (limit === null) return [...CHIP_VALUES, 1_000, 5_000];
  if (limit >= 20_000) return [...CHIP_VALUES, 1_000];
  return CHIP_VALUES;
}

/** "Limit 5'000" or "No limit". */
export function describeLimit(limit: Limit) {
  if (limit === null) return "No limit";
  return `Limit ${formatChips(limit)}`;
}
