/**
 * Checks the lobby: house tables, players' tables, limits, codes and links.
 *
 *   node scripts/tables-test.mjs          the rules in shared/tables.ts and src/lib/party.ts
 *   node scripts/tables-test.mjs --live   also plays against a running table server
 *
 * --live needs the whole stack running locally, with a stand-in for
 * planary-auth that treats the bearer token as the player:
 *
 *   planary-casino/worker:  npx wrangler dev --port 8788 --var INTERNAL_KEY:test-key
 *   planary-blackjack:      npx wrangler dev --port 1999 --var INTERNAL_KEY:test-key --var AUTH_API_URL:http://127.0.0.1:8799
 *   an auth stand-in on 127.0.0.1:8799 answering GET /api/auth/me with
 *   { user: { id, name } } for the token it was sent
 *
 * Every run uses fresh players, who start with the casino's 5'000 starter
 * chips. That is enough: a table checks its limit before the player's chips,
 * so 5'010 on a 5'000 table is refused for the limit, while the same bet at a
 * table without one is refused only for want of chips.
 */

import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

// The shared modules import each other without file extensions, as the
// bundler expects; plain node needs them written in. Test a copy, not the source.
const staging = mkdtempSync(join(tmpdir(), "planary-tables-"));
for (const name of ["tables.ts", "protocol.ts", "cards.ts"]) {
  const source = readFileSync(join(here, "..", "shared", name), "utf8");
  writeFileSync(join(staging, name), source.replace(/(from "\.\/[A-Za-z]+)"/g, '$1.ts"'));
}
const tables = await import(`file://${join(staging, "tables.ts")}`);
const protocol = await import(`file://${join(staging, "protocol.ts")}`);
const party = await import(`file://${join(here, "..", "src", "lib", "party.ts")}`);

let failures = 0;
function check(name, condition, detail = "") {
  if (condition) {
    console.log(`  ok   ${name}`);
  } else {
    failures++;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

// ── Rules ─────────────────────────────────────────

console.log("limits");
check("no limit takes any bet", tables.withinLimit(null, 1e12));
check("a limit takes a bet up to it", tables.withinLimit(5000, 5000));
check("a limit refuses a bet past it", !tables.withinLimit(5000, 5010));
check("null is accepted as no limit", tables.limitProblem(null) === null);
for (const bad of [0, -10, 5.5, Number.NaN, Infinity, "5000", undefined, tables.LIMIT_MAX + 1, tables.LIMIT_MIN - 1]) {
  check(`refuses ${String(bad)} as a limit`, tables.limitProblem(bad) !== null);
}
check("accepts the smallest limit", tables.limitProblem(tables.LIMIT_MIN) === null);
check("accepts the largest limit", tables.limitProblem(tables.LIMIT_MAX) === null);
check("the smallest limit is the smallest bet", tables.LIMIT_MIN === protocol.MIN_BET);
check("describes a limit", tables.describeLimit(20000) === "Limit 20'000");
check("describes no limit", tables.describeLimit(null) === "No limit");

console.log("house tables");
check("three of them", tables.HOUSE_TABLES.length === 3);
check(
  "limits 5'000, 20'000 and none",
  JSON.stringify(tables.HOUSE_TABLES.map((t) => t.limit)) === JSON.stringify([5000, 20000, null]),
);
// Random table ids are drawn from this alphabet; a house id must hold a
// character outside it, or a player's table could one day be given it.
const alphabet = /const alphabet = "([a-z0-9]+)"/.exec(readFileSync(join(here, "..", "party", "lobby.ts"), "utf8"))?.[1] ?? "";
check("found the alphabet random ids are drawn from", alphabet.length > 20);
for (const t of tables.HOUSE_TABLES) {
  // The casino checks table ids with this pattern for presence and invites.
  check(`${t.id} is a table id the casino accepts`, /^[tp]-[a-z0-9]{6}$/.test(t.id));
  check(`${t.id} is public`, !protocol.isPrivateTableId(t.id));
  check(`${t.id} can't be drawn at random`, [...t.id.slice(2)].some((ch) => !alphabet.includes(ch)));
  check(`${t.id} is found by id`, tables.houseTable(t.id) === t);
}
check("an ordinary id is no house table", tables.houseTable("t-abc234") === null);

console.log("codes and links");
const parse = party.parseTableInput;
check("a bare code needs looking up", JSON.stringify(parse("K7M2QX ")) === JSON.stringify({ code: "k7m2qx" }));
check("a private id goes straight there", JSON.stringify(parse("p-k7m2qx")) === JSON.stringify({ id: "p-k7m2qx" }));
check("a public id goes straight there", JSON.stringify(parse("t-k7m2qx")) === JSON.stringify({ id: "t-k7m2qx" }));
check("a table link goes straight there", JSON.stringify(parse("https://21.planary.ch/t/p-k7m2qx")) === JSON.stringify({ id: "p-k7m2qx" }));
check("a link with a query still works", JSON.stringify(parse("https://21.planary.ch/t/t-house1?sit=1")) === JSON.stringify({ id: "t-house1" }));
for (const bad of ["", "k7m2", "k7m2qx9", "x-k7m2qx", "k7m 2qx", "https://21.planary.ch/t/p-k7m2qx9"]) {
  check(`"${bad}" is no code`, parse(bad) === null);
}
check("a code is the id without its prefix", party.tableCode("p-k7m2qx") === "k7m2qx");

// ── Live ──────────────────────────────────────────

if (process.argv.includes("--live")) await live();

function live() {
  const HOST = process.env.PARTY_HOST || "127.0.0.1:1999";
  const LOBBY = `http://${HOST}/parties/lobby/main`;
  const run = Math.random().toString(36).slice(2, 8).replace(/[^a-z0-9]/g, "x");
  const player = (n) => `t${run}${n}`;

  async function lobbyList() {
    return (await fetch(LOBBY)).json();
  }
  async function create(body) {
    const res = await fetch(`${LOBBY}?action=create`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { status: res.status, ...(await res.json()) };
  }
  async function resolve(code) {
    const res = await fetch(`${LOBBY}?action=resolve&code=${encodeURIComponent(code)}`);
    return { status: res.status, ...(await res.json()) };
  }

  /** A player at a table, over the same socket the browser uses. */
  function seatAt(id, who) {
    const ws = new WebSocket(`ws://${HOST}/parties/table/${id}?token=${who}`);
    const client = { ws, state: null, you: null, errors: [], listeners: new Set() };
    ws.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "state") {
        client.state = msg.state;
        client.you = msg.you;
      }
      if (msg.type === "error") client.errors.push(msg.message);
      for (const fn of client.listeners) fn();
    });
    client.send = (msg) => ws.send(JSON.stringify(msg));
    client.until = (test, what, ms = 15000) =>
      new Promise((resolve, reject) => {
        const done = () => {
          if (!test(client)) return;
          client.listeners.delete(done);
          clearTimeout(timer);
          resolve(client);
        };
        const timer = setTimeout(() => {
          client.listeners.delete(done);
          reject(new Error(`timed out waiting for ${what}`));
        }, ms);
        client.listeners.add(done);
        done();
      });
    client.seat = () => (client.you && client.you.seat !== null ? client.state.seats[client.you.seat] : null);
    /** Sends, then waits for the error it should cause. */
    client.refused = async (msg) => {
      const before = client.errors.length;
      client.send(msg);
      await client.until((c) => c.errors.length > before, `an error for ${JSON.stringify(msg)}`, 5000);
      return client.errors.at(-1);
    };
    client.close = () => {
      if (client.you?.seat !== null && client.ws.readyState === WebSocket.OPEN) client.send({ type: "leave" });
      setTimeout(() => ws.close(), 100);
    };
    return client.until((c) => c.state !== null, `the table ${id}`);
  }

  /** Bets in chips of 500 and 10 until the seat has `amount` on it. */
  async function betUpTo(client, amount) {
    while (client.seat().bet + 500 <= amount) {
      const want = client.seat().bet + 500;
      client.send({ type: "bet", amount: 500 });
      await client.until((c) => c.seat().bet === want, `a bet of ${want}`, 5000);
    }
    while (client.seat().bet + 10 <= amount) {
      const want = client.seat().bet + 10;
      client.send({ type: "bet", amount: 10 });
      await client.until((c) => c.seat().bet === want, `a bet of ${want}`, 5000);
    }
  }

  const betting = (c) => c.state.phase === "betting";
  const opened = [];

  return (async () => {
    console.log(`live, against ${HOST}`);

    // The lobby always lists the three house tables.
    const list = await lobbyList();
    check(
      "the lobby lists the three house tables",
      JSON.stringify(list.house.map((t) => [t.id, t.limit])) === JSON.stringify([["t-house1", 5000], ["t-house2", 20000], ["t-house3", null]]),
      JSON.stringify(list.house),
    );
    check("house tables aren't listed again among players' tables", !list.tables.some((t) => t.id.includes("house")));

    // Join each house table, as the Join button does: sit without picking a seat.
    for (const [index, house] of tables.HOUSE_TABLES.entries()) {
      const p = await seatAt(house.id, player(`h${index}`));
      opened.push(p);
      check(`${house.name}: the table says its limit is ${house.limit}`, p.state.limit === house.limit, String(p.state.limit));
      check(`${house.name}: the table says its name`, p.state.name === house.name);
      p.send({ type: "sit" });
      await p.until((c) => c.you.seat !== null, "a seat");
      check(`${house.name}: joined and seated`, p.you.seat !== null);
      await p.until(betting, "betting to open");
      await betUpTo(p, 5000);
      check(`${house.name}: a 5'000 bet is taken`, p.seat().bet === 5000);
      const refusal = await p.refused({ type: "bet", amount: 10 });
      if (house.limit === 5000) check(`${house.name}: 5'010 is refused for the limit`, /limit is 5'000/.test(refusal), refusal);
      else check(`${house.name}: 5'010 is refused only for want of chips`, refusal === "Not enough chips.", refusal);
      p.send({ type: "clearBet" });
    }
    await new Promise((r) => setTimeout(r, 300));
    const seatedNow = await lobbyList();
    check("the lobby counts the players at the house tables", seatedNow.house.every((t) => t.seated >= 1), JSON.stringify(seatedNow.house.map((t) => t.seated)));

    // A full table: five seats, and a sixth player is told so.
    const full = [];
    for (let i = 0; i < protocol.SEATS; i++) {
      const p = await seatAt("t-house2", player(`f${i}`));
      if (p.you.seat === null && p.state.seats.some((s) => !s)) {
        p.send({ type: "sit" });
        await p.until((c) => c.you.seat !== null, "a seat");
      }
      full.push(p);
    }
    const sixth = await seatAt("t-house2", player("f9"));
    check("a full table is full", sixth.state.seats.every(Boolean));
    const fullRefusal = await sixth.refused({ type: "sit" });
    check("the sixth player is told it's full", /full/.test(fullRefusal), fullRefusal);
    check("…and can still watch", sixth.you.seat === null && sixth.state !== null);
    await new Promise((r) => setTimeout(r, 300));
    check("the lobby shows the house table as full", (await lobbyList()).house[1].seated === protocol.SEATS);
    for (const p of [...full, sixth]) p.close();

    // A player's public table with a limit of 100.
    const pub = await create({ limit: 100, visibility: "public" });
    check("a public table opens", pub.status === 200 && /^t-[a-z0-9]{6}$/.test(pub.id ?? ""), JSON.stringify(pub));
    const owner = await seatAt(pub.id, player("o"));
    opened.push(owner);
    check("it has the limit it was opened with", owner.state.limit === 100, String(owner.state.limit));
    owner.send({ type: "sit" });
    await owner.until((c) => c.you.seat !== null, "the creator's seat");
    await owner.until(betting, "betting to open");
    await betUpTo(owner, 100);
    check("a bet up to the limit is taken", owner.seat().bet === 100);
    const overLimit = await owner.refused({ type: "bet", amount: 10 });
    check("a bet past it is refused by the table", /limit is 100/.test(overLimit), overLimit);
    owner.send({ type: "deal" });
    await owner.until((c) => c.state.phase !== "betting", "the cards to come out");
    check("a round at the limit still deals", owner.seat().hands[0]?.bet === 100, JSON.stringify(owner.seat().hands[0]));
    await new Promise((r) => setTimeout(r, 300));
    const listed = (await lobbyList()).tables.find((t) => t.id === pub.id);
    check("it shows among players' tables, with its limit", listed?.limit === 100 && listed?.seated === 1, JSON.stringify(listed));
    const byPublicCode = await resolve(party.tableCode(pub.id));
    check("its code finds it", byPublicCode.id === pub.id, JSON.stringify(byPublicCode));
    const guest = await seatAt(byPublicCode.id, player("g"));
    opened.push(guest);
    guest.send({ type: "sit" });
    await guest.until((c) => c.you.seat !== null, "the guest's seat");
    check("a second player joins by code", guest.you.seat !== null && guest.you.seat !== owner.you.seat);

    // A private table with no limit.
    const priv = await create({ limit: null, visibility: "private" });
    check("a private table opens", priv.status === 200 && /^p-[a-z0-9]{6}$/.test(priv.id ?? ""), JSON.stringify(priv));
    const host = await seatAt(priv.id, player("p"));
    opened.push(host);
    check("no limit stays no limit, not 0", host.state.limit === null, String(host.state.limit));
    host.send({ type: "sit" });
    await host.until((c) => c.you.seat !== null, "the host's seat");
    await new Promise((r) => setTimeout(r, 300));
    check("it isn't in the lobby", !(await lobbyList()).tables.some((t) => t.id === priv.id));
    const byPrivateCode = await resolve(party.tableCode(priv.id).toUpperCase());
    check("its code finds it, whatever the case", byPrivateCode.id === priv.id, JSON.stringify(byPrivateCode));
    const friend = await seatAt(priv.id, player("q"));
    opened.push(friend);
    friend.send({ type: "sit" });
    await friend.until((c) => c.you.seat !== null, "the friend's seat");
    check("a friend joins by link", friend.you.seat !== null);

    // A house code works like any other.
    check("a house table's code finds it", (await resolve("house2")).id === "t-house2");

    // Bad codes.
    const malformed = await resolve("k7m2");
    check("a malformed code is refused", malformed.status === 400 && /doesn't look like/.test(malformed.error), JSON.stringify(malformed));
    const unknown = await resolve("zz9zz9");
    check("a code nobody opened is refused, not opened", unknown.status === 404 && /No table has that code/.test(unknown.error), JSON.stringify(unknown));

    // Bad tables.
    for (const [body, why] of [
      [{ limit: 0, visibility: "public" }, "a limit of 0"],
      [{ limit: -50, visibility: "public" }, "a negative limit"],
      [{ limit: 12.5, visibility: "public" }, "a fractional limit"],
      [{ limit: "500", visibility: "public" }, "a limit in quotes"],
      [{ limit: tables.LIMIT_MAX + 10, visibility: "public" }, "a limit past the maximum"],
      [{ visibility: "public" }, "no limit given at all"],
      [{ limit: 500, visibility: "friends" }, "an unknown visibility"],
    ]) {
      const res = await create(body);
      check(`refuses ${why}`, res.status === 400 && typeof res.error === "string", JSON.stringify(res));
    }

    // Links and codes from before limits: any valid id still opens a table, with the old limit.
    const legacyId = `p-${run.slice(0, 2)}x${run.slice(2, 5)}`.slice(0, 8);
    const legacy = await seatAt(legacyId, player("l"));
    opened.push(legacy);
    check("an old-style link opens a table", legacy.state.id === legacyId);
    check(`with the limit every table used to have (${tables.DEFAULT_LIMIT})`, legacy.state.limit === tables.DEFAULT_LIMIT, String(legacy.state.limit));
    legacy.send({ type: "sit" });
    await legacy.until((c) => c.you.seat !== null, "a seat at the old table");
    await legacy.until(betting, "betting to open");
    await betUpTo(legacy, 2500);
    const legacyRefusal = await legacy.refused({ type: "bet", amount: 10 });
    check("…and enforces it", /limit is 2'500/.test(legacyRefusal), legacyRefusal);
    legacy.send({ type: "clearBet" });
    check("once opened, its code finds it", (await resolve(party.tableCode(legacyId))).id === legacyId);

    // The limit can't be changed from outside: the table has no door for it.
    const poke = await fetch(`http://${HOST}/parties/table/${pub.id}`, { method: "POST", body: JSON.stringify({ limit: null }) });
    const after = await seatAt(pub.id, player("w"));
    check("a request to the table can't change its limit", after.state.limit === 100, `status ${poke.status}, limit ${after.state.limit}`);
    after.close();

    for (const p of opened) p.close();
    await new Promise((r) => setTimeout(r, 400));
  })();
}

console.log(failures === 0 ? "\nall good" : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
