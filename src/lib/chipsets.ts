// Chip designs from the shop: print colours per denomination. Mirrored in the game tables (same ids).

export type ChipInks = { fill: string; ink: string };

const CLASSIC: Record<number, ChipInks> = {
  10: { fill: "#f6eee4", ink: "#2a0710" },
  50: { fill: "#ff2e55", ink: "#f6eee4" },
  100: { fill: "#1d1846", ink: "#f6eee4" },
  500: { fill: "#e8c7a2", ink: "#5a0f22" },
  1000: { fill: "#1a7a52", ink: "#f6eee4" },
  5000: { fill: "#3b0f5c", ink: "#e8c7a2" },
};

export const CHIPSETS: Record<string, Record<number, ChipInks>> = {
  classic: CLASSIC,
  "chips-mono": {
    10: { fill: "#f6eee4", ink: "#22060e" },
    50: { fill: "#22060e", ink: "#f6eee4" },
    100: { fill: "#8a7f78", ink: "#f6eee4" },
    500: { fill: "#3d3533", ink: "#e8dccf" },
    1000: { fill: "#b9aea6", ink: "#22060e" },
    5000: { fill: "#0c0906", ink: "#b9aea6" },
  },
  "chips-midnight": {
    10: { fill: "#c9d6ff", ink: "#0f1b3d" },
    50: { fill: "#3b5bdb", ink: "#e7ecff" },
    100: { fill: "#0f1b3d", ink: "#9fb4ff" },
    500: { fill: "#6d28d9", ink: "#ede9fe" },
    1000: { fill: "#0ea5a4", ink: "#e7fffd" },
    5000: { fill: "#e7ecff", ink: "#6d28d9" },
  },
  "chips-sunset": {
    10: { fill: "#ffe3d3", ink: "#8a1c0a" },
    50: { fill: "#ff5b2e", ink: "#fff1e6" },
    100: { fill: "#ff2e8a", ink: "#fff0f6" },
    500: { fill: "#ffb199", ink: "#5a0f22" },
    1000: { fill: "#8a1c0a", ink: "#ffe3d3" },
    5000: { fill: "#ffd166", ink: "#8a1c0a" },
  },
  "chips-gold": {
    10: { fill: "#fbe7a6", ink: "#5a3a06" },
    50: { fill: "#e2a93b", ink: "#2a1a02" },
    100: { fill: "#b8761c", ink: "#fff3c4" },
    500: { fill: "#2a1a02", ink: "#f7d77e" },
    1000: { fill: "#f7d77e", ink: "#2a1a02" },
    5000: { fill: "#5a3a06", ink: "#fbe7a6" },
  },
  "chips-taffy": {
    10: { fill: "#f6eee4", ink: "#d94f7a" },
    50: { fill: "#ff9ec0", ink: "#5a0f22" },
    100: { fill: "#ff7a3d", ink: "#fff1e6" },
    500: { fill: "#136f6f", ink: "#ffd9c4" },
    1000: { fill: "#ffd166", ink: "#5a0f22" },
    5000: { fill: "#5a0f22", ink: "#ff9ec0" },
  },
  // Midnight Macau. Drawn from their own art (src/lib/chipArt.ts); these two inks are the fallback.
  "chips-mochi": {
    10: { fill: "#f2a7b8", ink: "#8e2c48" },
    50: { fill: "#f6efe6", ink: "#6b5a48" },
    100: { fill: "#9cc48a", ink: "#2f4a22" },
    500: { fill: "#ecc77a", ink: "#6b4a12" },
    1000: { fill: "#c7b6e8", ink: "#4a3577" },
    5000: { fill: "#9fc9e8", ink: "#23476b" },
  },
  "chips-tea": {
    10: { fill: "#efe6d2", ink: "#6b5a3e" },
    50: { fill: "#5f8f3a", ink: "#eef4df" },
    100: { fill: "#a8642a", ink: "#fbeedb" },
    500: { fill: "#17100f", ink: "#f3e6cf" },
    1000: { fill: "#8a3a26", ink: "#fbece4" },
    5000: { fill: "#c9a24a", ink: "#2a2010" },
  },
  "chips-jade": {
    10: { fill: "#b8c9ad", ink: "#3f5a35" },
    50: { fill: "#7d68b6", ink: "#f6f0ff" },
    100: { fill: "#1f5e4b", ink: "#effbe8" },
    500: { fill: "#0c3a2d", ink: "#e9c46a" },
    1000: { fill: "#b8455a", ink: "#fff0f2" },
    5000: { fill: "#c9a03a", ink: "#4a3208" },
  },
  "chips-lucky-cat": {
    10: { fill: "#efe5cf", ink: "#8e1420" },
    50: { fill: "#8e1420", ink: "#efe5cf" },
    100: { fill: "#141014", ink: "#e8b84a" },
    500: { fill: "#e8b84a", ink: "#141014" },
    1000: { fill: "#16583c", ink: "#e8b84a" },
    5000: { fill: "#3b0f5c", ink: "#e8b84a" },
  },
};

export function chipInks(set: string | null | undefined, value: number): ChipInks {
  return (CHIPSETS[set ?? "classic"] ?? CLASSIC)[value] ?? CLASSIC[value] ?? { fill: "var(--cherry)", ink: "var(--paper)" };
}
