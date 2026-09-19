import { PlayingCard } from "@/components/PlayingCard";
import type { TourStep } from "@/components/Tutorial";
import { CASINO_URL } from "./auth";

function Cards({ cards, label }: { cards: [string, "spade" | "heart" | "diamond" | "club"][]; label: string }) {
  return (
    <figure className="tour-hand">
      <span className="cards">
        {cards.map(([rank, suit], i) => (
          <PlayingCard key={i} card={{ rank: rank as never, suit }} />
        ))}
      </span>
      <figcaption>{label}</figcaption>
    </figure>
  );
}

export const BLACKJACK_TOUR: TourStep[] = [
  {
    title: "Get closer to 21 than the dealer",
    body: (
      <p>
        You play against the dealer, not against the other players. Beat the dealer&apos;s total without going over 21. Go over and you&apos;re bust,
        which loses straight away.
      </p>
    ),
  },
  {
    title: "What the cards are worth",
    visual: (
      <div className="tour-hands">
        <Cards cards={[["7", "club"], ["9", "diamond"]]} label="16" />
        <Cards cards={[["K", "spade"], ["Q", "heart"]]} label="20" />
        <Cards cards={[["A", "heart"], ["6", "spade"]]} label="7 or 17" />
        <Cards cards={[["A", "spade"], ["K", "diamond"]]} label="Blackjack" />
      </div>
    ),
    body: (
      <p>
        2 to 10 count their number. Jack, queen and king count 10. An ace counts 11, or 1 when 11 would take you over 21. An ace plus a ten-value card as
        your first two cards is <strong>blackjack</strong> and pays 3:2.
      </p>
    ),
  },
  {
    title: "Take a seat",
    target: ".seats",
    body: <p>Pick any open seat. Up to five players share a table, and each of you plays your own hand against the dealer.</p>,
  },
  {
    title: "Bet, then deal",
    target: ".dock",
    body: (
      <p>
        Tap chips to build your bet, from 10 to 2&apos;500. Press <strong>Deal</strong> when you&apos;re ready. The round starts when everyone is ready or
        the timer runs out.
      </p>
    ),
  },
  {
    title: "Your turn",
    target: ".dock",
    body: (
      <ul>
        <li>
          <strong>Hit</strong> takes another card.
        </li>
        <li>
          <strong>Stand</strong> keeps your total.
        </li>
        <li>
          <strong>Double</strong> doubles your bet for exactly one more card.
        </li>
        <li>
          <strong>Split</strong> turns a pair into two hands with a bet each, up to four hands.
        </li>
      </ul>
    ),
  },
  {
    title: "The dealer's rules",
    target: ".dealer",
    body: (
      <p>
        The dealer has no choices: they draw until they have 17 or more, then stand. When the dealer shows an ace you can take <strong>insurance</strong>{" "}
        for half your bet. It pays 2:1 if the dealer has blackjack.
      </p>
    ),
  },
  {
    title: "The shoe and the cut card",
    target: ".shoe",
    body: (
      <p>
        The shoe holds six shuffled decks. The yellow mark is the <strong>cut card</strong>. When the dealer reaches it, that round is finished and the
        whole shoe is shuffled again. You&apos;ll see it happen on the table.
      </p>
    ),
  },
  {
    title: "Payouts",
    visual: (
      <table className="tour-table">
        <tbody>
          <tr>
            <td>Blackjack</td>
            <td>3:2</td>
          </tr>
          <tr>
            <td>Win</td>
            <td>1:1</td>
          </tr>
          <tr>
            <td>Tie</td>
            <td>Bet back</td>
          </tr>
          <tr>
            <td>Insurance</td>
            <td>2:1</td>
          </tr>
        </tbody>
      </table>
    ),
    body: (
      <p>
        The same rules and odds as a real casino. <a href={`${CASINO_URL}/rules#blackjack`}>Full rules and odds</a>. You can open this guide again with
        the ? button at the top.
      </p>
    ),
  },
];
