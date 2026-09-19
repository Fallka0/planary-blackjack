"use client";

import usePartySocket from "partysocket/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Lock, Users } from "lucide-react";
import { type LobbyMessage, type LobbyTable, MIN_BET, SEATS } from "../../shared/protocol";
import { useAuth } from "@/components/AuthProvider";
import { Poster } from "@/components/Poster";
import { TopBar } from "@/components/TopBar";
import { useWallet } from "@/components/WalletProvider";
import { CASINO_URL } from "@/lib/auth";
import { lobbyRequest, PARTY_HOST, parseTableCode } from "@/lib/party";

const PHASE_LABEL: Record<LobbyTable["phase"], string> = {
  waiting: "Waiting",
  betting: "Taking bets",
  insurance: "Insurance",
  playing: "Hand in play",
  dealer: "Dealer drawing",
  settle: "Paying out",
};

export default function Lobby() {
  const router = useRouter();
  const { user } = useAuth();
  const { balance: chips } = useWallet();
  const [tables, setTables] = useState<LobbyTable[] | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"quick" | "private" | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  usePartySocket({
    host: PARTY_HOST,
    party: "lobby",
    room: "main",
    onMessage(event) {
      const msg = JSON.parse(event.data as string) as LobbyMessage;
      if (msg.type === "tables") setTables(msg.tables);
    },
    onError() {
      setTables((current) => current ?? []);
    },
  });

  async function go(kind: "quick" | "private") {
    setProblem(null);
    setBusy(kind);
    try {
      const id = await lobbyRequest(kind === "quick" ? "quickseat" : "private");
      router.push(`/t/${id}`);
    } catch {
      setProblem("The tables aren't reachable right now. Try again in a moment.");
      setBusy(null);
    }
  }

  function join(event: React.FormEvent) {
    event.preventDefault();
    const id = parseTableCode(code);
    if (!id) {
      setProblem("That doesn't look like a table code. Codes are six letters and numbers, like k7m2qx.");
      return;
    }
    router.push(`/t/${id}`);
  }

  const broke = chips !== null && chips < MIN_BET;

  return (
    <div className="app">
      <TopBar />
      <main className="lobby">
        <section className="lobby-hero" aria-labelledby="lobby-title">
          <div className="lobby-art" aria-hidden="true">
            <Poster game="blackjack" align="right" />
          </div>
          <div className="lobby-copy">
            <h1 id="lobby-title">Blackjack</h1>
            <p className="lobby-lead">
              Up to five players against one dealer. Six-deck shoe, dealer stands on soft 17, blackjack pays 3 to 2.
            </p>

            <p className="who">
              Playing as <strong>{user.name}</strong>
            </p>

            {broke ? (
              <div className="broke">
                <p>You&apos;re out of chips. Claim your daily bonus in the casino or ask a friend to send you some.</p>
                <a className="btn btn-paper" href={`${CASINO_URL}/chips`}>
                  Get chips
                </a>
              </div>
            ) : (
              <div className="lobby-cta">
                <button className="btn btn-paper btn-lg" onClick={() => void go("quick")} disabled={busy !== null}>
                  {busy === "quick" ? "Finding a seat…" : "Quick seat"}
                  <ArrowRight size={18} strokeWidth={2.2} aria-hidden="true" />
                </button>
                <button className="btn btn-ink btn-lg" onClick={() => void go("private")} disabled={busy !== null}>
                  <Lock size={16} strokeWidth={2.2} aria-hidden="true" />
                  {busy === "private" ? "Opening…" : "Private table"}
                </button>
              </div>
            )}

            <form className="code-form" onSubmit={join}>
              <label htmlFor="code">Have a code?</label>
              <div className="code-row">
                <input
                  id="code"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="k7m2qx or table link"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button className="btn btn-ink" type="submit">
                  Join
                </button>
              </div>
            </form>

            {problem ? (
              <p className="problem" role="alert">
                {problem}
              </p>
            ) : null}
          </div>
        </section>

        <section className="open-tables" aria-labelledby="open-title">
          <div className="section-head">
            <h2 id="open-title">Open tables</h2>
            <span className="section-meta">Play money only</span>
          </div>
          {tables === null ? (
            <div className="tables-skeleton" aria-hidden="true" />
          ) : tables.length === 0 ? (
            <div className="empty">
              <p>
                <strong>No public tables right now.</strong> Quick seat opens a fresh one, and the next player to hit it
                lands at yours.
              </p>
            </div>
          ) : (
            <ul className="table-list">
              {tables.map((table) => (
                <li key={table.id}>
                  <button className="table-row" onClick={() => router.push(`/t/${table.id}`)}>
                    <span className="table-code">{table.id.slice(2)}</span>
                    <span className="table-seats" aria-label={`${table.seated} of ${SEATS} seats taken`}>
                      {Array.from({ length: SEATS }, (_, i) => (
                        <span key={i} className={i < table.seated ? "dot is-taken" : "dot"} />
                      ))}
                    </span>
                    <span className="table-phase">
                      <Users size={15} strokeWidth={2} aria-hidden="true" />
                      {table.seated}/{SEATS} · {PHASE_LABEL[table.phase]}
                    </span>
                    <ArrowRight size={18} strokeWidth={2} aria-hidden="true" className="table-go" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
