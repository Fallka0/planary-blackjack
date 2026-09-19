import { chipInks } from "@/lib/chipsets";

/** Planary Chips, drawn flat in two inks. Each denomination has its own print colour, set by the player's chip set. */

export function ChipIcon({ size = 18, letter, value, set }: { size?: number; letter?: string; value?: number; set?: string | null }) {
  const colors = value ? chipInks(set, value) : { fill: "var(--cherry)", ink: "var(--paper)" };
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true" className="chip-icon">
      <circle cx="20" cy="20" r="19" fill={colors.fill} />
      <circle cx="20" cy="20" r="15.5" fill="none" stroke={colors.ink} strokeWidth="4" strokeDasharray="6.1 6.1" />
      <circle cx="20" cy="20" r="10.5" fill={colors.ink} />
      {letter || value ? (
        <text
          x="20"
          y={value && value >= 100 ? "24.6" : "26.2"}
          textAnchor="middle"
          fontSize={value && value >= 100 ? 11.5 : 17}
          fontWeight="900"
          fontFamily="var(--font-poster)"
          fill={colors.fill}
        >
          {letter ?? value}
        </text>
      ) : (
        <circle cx="20" cy="20" r="6.5" fill={colors.fill} />
      )}
    </svg>
  );
}

/** Breaks an amount into a small stack of chips, largest first, for display. */
export function chipBreakdown(amount: number, max = 6) {
  const chips: number[] = [];
  let rest = amount;
  for (const value of [500, 100, 50, 10]) {
    while (rest >= value && chips.length < max) {
      chips.push(value);
      rest -= value;
    }
  }
  return chips;
}
