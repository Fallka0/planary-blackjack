"use client";

import usePartySocket from "partysocket/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Users } from "lucide-react";
import { formatChips, type LobbyMessage, type LobbyTable, MIN_BET, SEATS } from "../../shared/protocol";
import { describeLimit, HOUSE_TABLES } from "../../shared/tables";
import { useAuth } from "@/components/AuthProvider";
import { CreateTable } from "@/components/CreateTable";
import { Poster } from "@/components/Poster";
import { TopBar } from "@/components/TopBar";
import { Tutorial, useTutorial } from "@/components/Tutorial";
import { BLACKJACK_TOUR } from "@/lib/tutorial";
import { useWallet } from "@/components/WalletProvider";
import { CASINO_URL } from "@/lib/auth";
import { LobbyError, PARTY_HOST, parseTableInput, resolveCode, tableCode } from "@/lib/party";

const PHASE_LABEL: Record<LobbyTable["phase"], string> = {
  waiting: "Waiting",
  shuffle: "Shuffling",
  betting: "Taking bets",
  insurance: "Insurance",
  playing: "Hand in play",
  dealer: "Dealer drawing",
  settle: "Paying out",
};

function SeatDots({ seated }: { seated: number }) {
  return (
    <span className="table-seats" aria-hidden="true">
      {Array.from({ length: SEATS }, (_, i) => (
        <span key={i} className={i < seated ? "dot is-taken" : "dot"} />
      ))}
    </span>
  );
}

export default function Lobby() {
  const router = useRouter();
  const { user } = useAuth();
  const { balance: chips } = useWallet();
  const [lobby, setLobby] = useState<LobbyMessage | null>(null);
  const [offline, setOffline] = useState(false);
  const [code, setCode] = useState("");
  const [finding, setFinding] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  usePartySocket({
    host: PARTY_HOST,
    party: "lobby",
    room: "main",
    onMessage(event) {
      const msg = JSON.parse(event.data as string) as LobbyMessage;
      if (msg.type === "tables") {
        setLobby(msg);
        setOffline(false);
      }
    },
    onError() {
      setOffline(true);
    },
  });

  function sitAt(id: string) {
    router.push(`/t/${id}?sit=1`);
  }

  async function join(event: React.FormEvent) {
    event.preventDefault();
    setProblem(null);
    const parsed = parseTableInput(code);
    if (!parsed) {
      setProblem("That doesn't look like a table code. Codes are six letters and numbers, like k7m2qx, or paste the table link.");
      return;
    }
    if ("id" in parsed) {
      sitAt(parsed.id);
      return;
    }
    setFinding(true);
    try {
      sitAt(await resolveCode(parsed.code));
    } catch (e) {
      setProblem(e instanceof LobbyError ? e.message : "Couldn't look up that code. Try again.");
      setFinding(false);
    }
  }

  const broke = chips !== null && chips < MIN_BET;
  const tour = useTutorial("blackjack", false);
  // The house tables are always there; until the lobby answers, their seat counts aren't.
  const house = HOUSE_TABLES.map((t) => ({ ...t, live: lobby?.house.find((h) => h.id === t.id) ?? null }));
  const playerTables = lobby?.tables ?? null;

  return (
    <div className="app">
      <TopBar />
      {tour.open ? <Tutorial steps={BLACKJACK_TOUR} onClose={tour.close} /> : null}
      <main className="lobby">
        <section className="lobby-hero" aria-labelledby="lobby-title">
          <div className="lobby-art" aria-hidden="true">
            <Poster game="blackjack" align="right" />
          </div>
          <div className="lobby-copy">
            <h1 id="lobby-title">Blackjack</h1>
            <p className="lobby-lead">
              Up to five players against one dealer. Six-deck shoe, dealer stands on soft 17, blackjack pays 3 to 2, insurance 2 to 1.
            </p>

            <p className="who">
              Playing as <strong>{user.name}</strong> ·{" "}
              <button className="link-btn" onClick={tour.show}>
                How to play
              </button>{" "}
              · <a href={`${CASINO_URL}/rules#blackjack`}>Rules &amp; odds</a>
            </p>

            {broke ? (
              <div className="broke">
                <p>You&apos;re out of chips. Claim your daily bonus in the casino or ask a friend to send you some. You can still watch.</p>
                <a className="btn btn-paper" href={`${CASINO_URL}/chips`}>
                  Get chips
                </a>
              </div>
            ) : null}
          </div>
        </section>

        <section className="house-tables" aria-labelledby="house-title">
          <div className="section-head">
            <h2 id="house-title">Tables</h2>
            <span className="section-meta">The limit is the most you can bet on one round</span>
          </div>
          <ul className="house-grid">
            {house.map((t) => {
              const seated = t.live?.seated ?? null;
              const full = seated !== null && seated >= SEATS;
              return (
                <li key={t.id} className="house-card">
                  <div className="house-top">
                    <span className="house-name">{t.name}</span>
                    <span className="house-code">{tableCode(t.id)}</span>
                  </div>
                  <p className="house-limit">
                    {t.limit === null ? (
                      <strong>No limit</strong>
                    ) : (
                      <>
                        <span>Limit</span>
                        <strong>{formatChips(t.limit)}</strong>
                      </>
                    )}
                  </p>
                  <p className="house-seats">
                    {seated === null ? (
                      <span className="muted">{offline ? "Seats unavailable" : "Counting seats…"}</span>
                    ) : (
                      <>
                        <SeatDots seated={seated} />
                        <span aria-label={`${seated} of ${SEATS} seats taken`}>
                          {seated}/{SEATS}
                          {seated > 0 && t.live ? ` · ${PHASE_LABEL[t.live.phase]}` : ""}
                        </span>
                      </>
                    )}
                  </p>
                  <button className="btn btn-paper house-join" onClick={() => sitAt(t.id)} disabled={full}>
                    {full ? "Full" : broke ? "Watch" : "Join"}
                    {full ? null : <ArrowRight size={17} strokeWidth={2.2} aria-hidden="true" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="lobby-tools" aria-label="Your own table">
          <div className="tool-card">
            <h2>Open your own</h2>
            <p>Pick the limit, public or private. You sit down at once and get a code and a link to share.</p>
            <CreateTable disabled={broke} />
          </div>

          <form className="tool-card code-form" onSubmit={join}>
            <h2>
              <label htmlFor="code">Have a code?</label>
            </h2>
            <p>Join a friend&apos;s table with its code or link.</p>
            <div className="code-row">
              <input
                id="code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="k7m2qx or table link"
                autoComplete="off"
                spellCheck={false}
                aria-invalid={problem !== null}
                aria-describedby={problem ? "code-problem" : undefined}
              />
              <button className="btn btn-ink" type="submit" disabled={finding}>
                {finding ? "Finding…" : "Join"}
              </button>
            </div>
            {problem ? (
              <p id="code-problem" className="problem" role="alert">
                {problem}
              </p>
            ) : null}
          </form>
        </section>

        <section className="open-tables" aria-labelledby="open-title">
          <div className="section-head">
            <h2 id="open-title">Players&apos; tables</h2>
            <span className="section-meta">Public tables with someone seated</span>
          </div>
          {playerTables === null ? (
            offline ? (
              <div className="empty">
                <p>
                  <strong>Can&apos;t reach the tables right now.</strong> Retrying… Codes and links still work.
                </p>
              </div>
            ) : (
              <div className="tables-skeleton" aria-hidden="true" />
            )
          ) : playerTables.length === 0 ? (
            <div className="empty">
              <p>
                <strong>No players&apos; tables open right now.</strong> Open a public one and it shows up here for others to join.
              </p>
            </div>
          ) : (
            <ul className="table-list">
              {playerTables.map((table) => {
                const full = table.seated >= SEATS;
                return (
                  <li key={table.id}>
                    <button className="table-row" onClick={() => sitAt(table.id)} disabled={full}>
                      <span className="table-code">{tableCode(table.id)}</span>
                      <span className="table-limit-label">{describeLimit(table.limit)}</span>
                      <SeatDots seated={table.seated} />
                      <span className="table-phase">
                        <Users size={15} strokeWidth={2} aria-hidden="true" />
                        {full ? `Full · ${PHASE_LABEL[table.phase]}` : `${table.seated}/${SEATS} · ${PHASE_LABEL[table.phase]}`}
                      </span>
                      <ArrowRight size={18} strokeWidth={2} aria-hidden="true" className="table-go" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
