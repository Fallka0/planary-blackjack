import { useId } from "react";
export type GameId = "blackjack" | "poker" | "baccarat" | "roulette" | "slots";

/*
  Key art for each table, drawn as screen-printed game covers:
  one flat field colour, two or three inks, a halftone and a grain pass,
  and one slightly mis-registered ink layer so it reads printed, not rendered.
  Canvas is 600 × 800. The subject sits in the right two thirds so the
  lobby spotlight can lay text over the left side of the same art.
*/

type SuitName = "heart" | "diamond" | "spade" | "club";

const SUIT_PATHS: Record<SuitName, string> = {
  heart: "M50 90C22 68 6 50 6 31 6 16 17 6 31 6c9 0 16 5 19 12 3-7 10-12 19-12 14 0 25 10 25 25 0 19-16 37-44 59z",
  diamond: "M50 3 88 50 50 97 12 50z",
  spade:
    "M50 4C36 24 8 39 8 60c0 13 10 22 22 22 7 0 13-3 16-8l-5 22h18l-5-22c3 5 9 8 16 8 12 0 22-9 22-22C92 39 64 24 50 4z",
  club: "M50 8a19 19 0 0 1 17 28 19 19 0 1 1-8 36l5 24H36l5-24a19 19 0 1 1-8-36A19 19 0 0 1 50 8z",
};

function Suit({ suit, x, y, size, fill }: { suit: SuitName; x: number; y: number; size: number; fill: string }) {
  return <path d={SUIT_PATHS[suit]} fill={fill} transform={`translate(${x} ${y}) scale(${size / 100})`} />;
}

function Card({
  x,
  y,
  rotate,
  rank,
  suit,
  ink,
  paper = "#f6eee4",
  w = 170,
}: {
  x: number;
  y: number;
  rotate: number;
  rank: string;
  suit: SuitName;
  ink: string;
  paper?: string;
  w?: number;
}) {
  const h = w * 1.4;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate} ${w / 2} ${h / 2})`}>
      <rect width={w} height={h} rx={w * 0.08} fill={paper} />
      <text x={w * 0.1} y={w * 0.3} fill={ink} fontSize={w * 0.26} fontWeight="800" fontFamily="var(--font-poster)">
        {rank}
      </text>
      <Suit suit={suit} x={w * 0.1} y={w * 0.36} size={w * 0.16} fill={ink} />
      <Suit suit={suit} x={w * 0.3} y={h * 0.38} size={w * 0.46} fill={ink} />
    </g>
  );
}

/** Shared print defs: paper grain and a halftone dot screen in the given ink. */
function PrintDefs({ id, dot }: { id: string; dot: string }) {
  return (
    <defs>
      <filter id={`${id}-grain`} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
        <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.55 0" />
        <feComposite in2="SourceGraphic" operator="in" />
      </filter>
      <pattern id={`${id}-dots`} width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(22)">
        <circle cx="7" cy="7" r="3.2" fill={dot} />
      </pattern>
      <linearGradient id={`${id}-fade`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity="0" />
        <stop offset="1" stopColor="#fff" stopOpacity="1" />
      </linearGradient>
      <mask id={`${id}-fadeMask`}>
        <rect width="600" height="800" fill={`url(#${id}-fade)`} />
      </mask>
    </defs>
  );
}

function Grain({ id }: { id: string }) {
  return <rect width="600" height="800" fill="#000" filter={`url(#${id}-grain)`} opacity="0.35" style={{ mixBlendMode: "multiply" }} />;
}

function Blackjack({ id }: { id: string }) {
  return (
    <>
      <rect width="600" height="800" fill="#b3122e" />
      <rect width="600" height="800" fill={`url(#${id}-dots)`} mask={`url(#${id}-fadeMask)`} />
      {/* The "21" in two inks, the pink plate printed 10px off register under the oxblood one. */}
      <text x="620" y="570" textAnchor="end" fontSize="560" fontWeight="900" fontFamily="var(--font-poster)" fill="#ff5a78" letterSpacing="-20">
        21
      </text>
      <text x="608" y="556" textAnchor="end" fontSize="560" fontWeight="900" fontFamily="var(--font-poster)" fill="#6d0a1d" letterSpacing="-20" style={{ mixBlendMode: "multiply" }}>
        21
      </text>
      <Card x={250} y={330} rotate={-14} rank="A" suit="spade" ink="#22060e" w={180} />
      <Card x={370} y={300} rotate={9} rank="K" suit="heart" ink="#b3122e" w={180} />
    </>
  );
}

function Poker({ id }: { id: string }) {
  const fan: { rank: string; suit: SuitName }[] = [
    { rank: "10", suit: "heart" },
    { rank: "J", suit: "heart" },
    { rank: "Q", suit: "heart" },
    { rank: "K", suit: "heart" },
    { rank: "A", suit: "heart" },
  ];
  return (
    <>
      <rect width="600" height="800" fill="#1d1846" />
      <rect width="600" height="800" fill={`url(#${id}-dots)`} mask={`url(#${id}-fadeMask)`} />
      <circle cx="454" cy="318" r="230" fill="#f6eee4" />
      <circle cx="440" cy="330" r="230" fill="#ff3d6e" />
      {fan.map((card, i) => (
        <Card key={card.rank} x={300 + i * 8} y={250} rotate={-36 + i * 18} rank={card.rank} suit={card.suit} ink="#1d1846" w={150} />
      ))}
      {/* Chip stacks, flat and graphic. */}
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i}>
          <rect x="40" y={200 - i * 22} width="120" height="26" rx="13" fill={i % 2 ? "#f6eee4" : "#ff3d6e"} />
          {i < 3 ? <rect x="120" y={228 - i * 22} width="120" height="26" rx="13" fill={i % 2 ? "#ff3d6e" : "#f6eee4"} /> : null}
        </g>
      ))}
    </>
  );
}

function Baccarat({ id }: { id: string }) {
  return (
    <>
      <rect width="600" height="800" fill="#e8c7a2" />
      <rect width="600" height="800" fill={`url(#${id}-dots)`} mask={`url(#${id}-fadeMask)`} />
      <text x="312" y="652" fontSize="640" fontWeight="900" fontFamily="var(--font-poster)" fill="#e0334f" letterSpacing="-30">
        9
      </text>
      <text x="300" y="640" fontSize="640" fontWeight="900" fontFamily="var(--font-poster)" fill="#5a0f22" letterSpacing="-30" style={{ mixBlendMode: "multiply" }}>
        9
      </text>
      <Card x={230} y={420} rotate={-8} rank="4" suit="diamond" ink="#b3122e" w={150} />
      <Card x={330} y={440} rotate={7} rank="5" suit="club" ink="#2a0710" w={150} />
    </>
  );
}

function Roulette({ id }: { id: string }) {
  const pockets = 24;
  const R = 330;
  return (
    <>
      <rect width="600" height="800" fill="#ff5b2e" />
      <rect width="600" height="800" fill={`url(#${id}-dots)`} mask={`url(#${id}-fadeMask)`} />
      <g transform="translate(560 470)">
        <circle r={R + 26} fill="#f6eee4" transform="translate(-12 -12)" />
        <circle r={R + 26} fill="#2a0710" />
        {Array.from({ length: pockets }, (_, i) => {
          const a0 = (i / pockets) * Math.PI * 2;
          const a1 = ((i + 1) / pockets) * Math.PI * 2;
          const d = `M0 0L${(Math.cos(a0) * R).toFixed(1)} ${(Math.sin(a0) * R).toFixed(1)}A${R} ${R} 0 0 1 ${(Math.cos(a1) * R).toFixed(1)} ${(Math.sin(a1) * R).toFixed(1)}z`;
          return <path key={i} d={d} fill={i === 0 ? "#f6eee4" : i % 2 ? "#b3122e" : "#2a0710"} />;
        })}
        <circle r={R * 0.58} fill="#ff5b2e" />
        <circle r={R * 0.58} fill={`url(#${id}-dots)`} />
        <circle r={R * 0.16} fill="#2a0710" />
      </g>
      <circle cx="300" cy="238" r="22" fill="#f6eee4" />
    </>
  );
}

function Slots({ id }: { id: string }) {
  return (
    <>
      <rect width="600" height="800" fill="#cc1259" />
      <rect width="600" height="800" fill={`url(#${id}-dots)`} mask={`url(#${id}-fadeMask)`} />
      <rect x="212" y="208" width="360" height="330" rx="36" fill="#ffb3cf" />
      <rect x="200" y="220" width="360" height="330" rx="36" fill="#2a0710" />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={226 + i * 110} y="250" width="92" height="270" rx="18" fill="#f6eee4" />
          <text
            x={272 + i * 110}
            y="448"
            textAnchor="middle"
            fontSize="170"
            fontWeight="900"
            fontFamily="var(--font-poster)"
            fill="#cc1259"
          >
            7
          </text>
        </g>
      ))}
      {/* Lever. */}
      <rect x="576" y="300" width="14" height="170" rx="7" fill="#2a0710" />
      <circle cx="583" cy="290" r="26" fill="#f6eee4" />
      {/* Cherries. */}
      <g transform="translate(250 600)">
        <path d="M40 10C60 40 50 80 30 110M40 10C70 30 100 70 105 110" stroke="#2a0710" strokeWidth="8" fill="none" strokeLinecap="round" />
        <circle cx="30" cy="130" r="36" fill="#b3122e" />
        <circle cx="108" cy="130" r="36" fill="#b3122e" />
        <circle cx="20" cy="118" r="8" fill="#f6eee4" />
        <circle cx="98" cy="118" r="8" fill="#f6eee4" />
      </g>
    </>
  );
}

const ART: Record<GameId, { draw: (p: { id: string }) => React.JSX.Element; dot: string; field: string; ink: string }> = {
  blackjack: { draw: Blackjack, dot: "#7e0c22", field: "#b3122e", ink: "#fbf1ea" },
  poker: { draw: Poker, dot: "#2d2766", field: "#1d1846", ink: "#fbf1ea" },
  baccarat: { draw: Baccarat, dot: "#d4a97c", field: "#e8c7a2", ink: "#2a0710" },
  roulette: { draw: Roulette, dot: "#e0421a", field: "#ff5b2e", ink: "#2a0710" },
  slots: { draw: Slots, dot: "#a90e4a", field: "#cc1259", ink: "#fbf1ea" },
};

/** The poster's flat field colour, so containers can extend the art edge to edge. */
export function posterField(game: GameId) {
  return ART[game].field;
}

/** Text colour that reads on the poster's field. */
export function posterInk(game: GameId) {
  return ART[game].ink;
}

export function Poster({
  game,
  className,
  align = "center",
}: {
  game: GameId;
  className?: string;
  /** "right" pins the subject to the right edge for wide spotlight frames. */
  align?: "center" | "right";
}) {
  const id = useId().replace(/:/g, "");
  const art = ART[game];
  const Draw = art.draw;
  return (
    <svg
      viewBox="0 0 600 800"
      className={className}
      preserveAspectRatio={align === "right" ? "xMaxYMid slice" : "xMidYMid slice"}
      aria-hidden="true"
    >
      <PrintDefs id={id} dot={art.dot} />
      <Draw id={id} />
      <Grain id={id} />
    </svg>
  );
}
