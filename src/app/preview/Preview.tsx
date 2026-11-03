"use client";

import { useState } from "react";
import type { Card } from "../../../shared/cards";
import type { Seat, TableState } from "../../../shared/protocol";
import { ChipIcon } from "@/components/ChipIcon";
import { Shoe, ShuffleShow } from "@/components/Shoe";
import { Dealer, SeatView } from "../t/[id]/Table";

const CARDBACKS = ["", "cardback-navy", "cardback-felt", "cardback-deco", "cardback-holo", "cardback-postcard", "cardback-seaglass", "cardback-matcha", "cardback-mahjong", "cardback-fan", "cardback-hongbao", "cardback-koi", "cardback-red-dragon"];
const CHIPSETS = ["", "chips-mono", "chips-midnight", "chips-sunset", "chips-gold", "chips-taffy", "chips-mochi", "chips-tea", "chips-jade", "chips-lucky-cat"];
const BORDERS = ["", "border-paper", "border-gold", "border-holo", "border-ferris", "border-bamboo", "border-porcelain", "border-sakura", "border-onsen", "border-lacquer", "border-rising-tide", "border-night-sakura", "border-mother-of-pearl"];
const TITLES = ["", "Regular", "High Roller", "Lucky Eight", "Golden Koi", "Night Emperor", "Risk for Riches"];
const label = (id: string) => (id ? id.replace(/^(cardback|chips|border)-/, "").replace(/-/g, " ") : "default");

const c = (rank: Card["rank"], suit: Card["suit"]): Card => ({ rank, suit }) as Card;

function seat(name: string, cards: Card[], bet: number, look: Seat["look"]): Seat {
  return {
    playerId: name,
    name,
    look,
    stack: 48_000,
    bet,
    lastBet: bet,
    ready: true,
    hands: [{ cards, bet, doubled: false, done: false, fromSplit: false }],
    activeHand: 0,
    connected: true,
    insurance: 0,
  };
}

/** Pick a card back, a chip set, a ring and a title, and see them on a table mid-round. */
export function Preview() {
  const [cardback, setCardback] = useState("cardback-red-dragon");
  const [chipset, setChipset] = useState("chips-lucky-cat");
  const [border, setBorder] = useState("border-onsen");
  const [title, setTitle] = useState("Risk for Riches");
  const [shuffle, setShuffle] = useState(0);
  const [bet, setBet] = useState(6660);

  const look = { avatar: null, border: border || null, title: title || null, chipset: chipset || null };
  const state: TableState = {
    id: "t-previw",
    isPrivate: false,
    limit: null,
    name: "Preview",
    phase: "playing",
    seats: [
      seat("Mei", [c("K", "heart"), c("7", "club")], 500, { avatar: null, border: "border-lacquer", title: "Golden Koi", chipset: "chips-jade" }),
      null,
      seat("You", [c("A", "spade"), c("9", "diamond")], bet, look),
      seat("Kai", [c("10", "club"), c("10", "heart")], 1500, { avatar: null, border: "border-sakura", title: "Night Emperor", chipset: "chips-mochi" }),
      null,
    ],
    dealer: { cards: [c("Q", "spade")], holeHidden: true },
    turn: null,
    deadline: null,
    shoeRemaining: 220,
    shoeSize: 312,
    cutCard: 70,
    cutCardOut: false,
    round: shuffle,
    fair: { hash: null, seeds: [], nonce: 0, lastShoe: null },
  };

  const pick = (name: string, value: string, options: string[], set: (v: string) => void, show = label) => (
    <label className="pv-pick">
      <span>{name}</span>
      <select value={value} onChange={(e) => set(e.target.value)}>
        {options.map((o) => (
          <option key={o} value={o}>
            {show(o)}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className={`app app-table${cardback ? ` ${cardback}` : ""}`}>
      <div className="pv-bar">
        <strong>Table preview</strong>
        {pick("Card back", cardback, CARDBACKS, setCardback)}
        {pick("Chips", chipset, CHIPSETS, setChipset)}
        {pick("Ring", border, BORDERS, setBorder)}
        {pick("Title", title, TITLES, setTitle, (t) => t || "none")}
        <label className="pv-pick">
          <span>Your bet</span>
          <select value={bet} onChange={(e) => setBet(Number(e.target.value))}>
            {[60, 660, 6660, 16_160].map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
        <button className="btn btn-quiet btn-sm" onClick={() => setShuffle((n) => n + 1)}>
          Shuffle
        </button>
        <span className="pv-chips" aria-label="Every chip in the set">
          {[10, 50, 100, 500, 1000, 5000].map((v) => (
            <ChipIcon key={v} size={34} value={v} set={chipset || null} />
          ))}
        </span>
      </div>
      <main className="table-main">
        <div className="play">
          <section className="felt" aria-label="Blackjack table">
            <div className="felt-print" aria-hidden="true">
              <span className="print-21 plate-a">21</span>
              <span className="print-21 plate-b">21</span>
            </div>
            <div className="felt-top">
              <Dealer state={state} />
              <Shoe state={state} />
            </div>
            {shuffle ? <ShuffleShow key={shuffle} /> : null}
            <p className="status">Preview · nothing here is a real round</p>
            <div className="seats">
              {state.seats.map((s, i) => (
                <SeatView key={i} seat={s} index={i} state={state} mine={i === 2} canSit={false} now={0} onSit={() => {}} />
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
