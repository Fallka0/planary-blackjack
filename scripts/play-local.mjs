/**
 * Real blackjack on your own computer, nothing online behind it: `npm run play:local`.
 *
 * Starts the table server (wrangler dev on 1999) and the site (Next on 3001), with
 * stand-ins on 8799 for the two things that normally live elsewhere: planary-auth
 * (sign in by typing a name, no password) and the casino wallet (everyone starts
 * with 100'000 chips). On the sign-in page you also pick what you wear at the
 * table: card back, chips, ring and title.
 *
 * Play alone against the dealer, or open a second window in private mode, sign
 * in under another name and sit at the same table. Nothing is saved: restart
 * and the wallets start over.
 */
import { spawn } from "node:child_process";
import http from "node:http";

const API_PORT = 8799;
const PARTY_PORT = 1999;
const SITE_PORT = 3001;
const API = `http://127.0.0.1:${API_PORT}`;
const SITE = `http://localhost:${SITE_PORT}`;
const START = 100_000;

const CARDBACKS = ["", "cardback-navy", "cardback-felt", "cardback-deco", "cardback-holo", "cardback-postcard", "cardback-seaglass", "cardback-matcha", "cardback-mahjong", "cardback-fan", "cardback-hongbao", "cardback-koi", "cardback-red-dragon"];
const CHIPSETS = ["", "chips-mono", "chips-midnight", "chips-sunset", "chips-gold", "chips-taffy", "chips-mochi", "chips-tea", "chips-jade", "chips-lucky-cat"];
const BORDERS = ["", "border-paper", "border-gold", "border-holo", "border-ferris", "border-bamboo", "border-porcelain", "border-sakura", "border-onsen", "border-lacquer", "border-rising-tide", "border-night-sakura", "border-mother-of-pearl"];
const TITLES = ["", "Risk for Riches", "Golden Koi", "Night Emperor", "Lucky Eight", "Dim Sum", "Red Envelope"];

/** Everyone who has signed in this run, by id: chips and what they wear. */
const players = new Map();
const player = (id, name) => {
  if (!players.has(id)) players.set(id, { name: name || id, balance: START, cardback: null, chipset: null, border: null, title: null });
  return players.get(id);
};

const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "player";
const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
/** A token shaped like planary-auth's (the site only reads its claims); good for 12 hours. */
const token = (id, name) => `${b64({ alg: "none", typ: "JWT" })}.${b64({ sub: id, name, email: `${id}@planary.local`, exp: Math.floor(Date.now() / 1000) + 12 * 3600 })}.local`;
const fromToken = (header) => {
  try {
    const claims = JSON.parse(Buffer.from((header ?? "").replace(/^Bearer /, "").split(".")[1], "base64url").toString());
    return claims.sub && claims.exp * 1000 > Date.now() ? claims : null;
  } catch {
    return null;
  }
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const label = (id) => (id ? id.replace(/^(cardback|chips|border)-/, "").replace(/-/g, " ") : "default");
const select = (name, options, value) =>
  `<label>${name}<select name="${name}">${options.map((o) => `<option value="${esc(o)}"${o === value ? " selected" : ""}>${esc(name === "title" ? o || "none" : label(o))}</option>`).join("")}</select></label>`;

function signInPage(returnTo) {
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sign in (local)</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0f3b2c;font:15px system-ui,sans-serif;color:#f6eee4}
form{background:#16251f;padding:28px;border-radius:16px;display:grid;gap:14px;width:min(340px,90vw)}h1{margin:0;font-size:20px}p{margin:0;opacity:.7;font-size:13px}
label{display:grid;gap:4px;font-size:13px;text-transform:capitalize}input,select{font:inherit;padding:8px 10px;border-radius:8px;border:1px solid #3a4a42;background:#0b1712;color:inherit}
button{font:inherit;font-weight:600;padding:10px;border:0;border-radius:10px;background:#f2c14e;color:#2a1a02;cursor:pointer}</style>
<form method="post" action="/login"><h1>Sign in to the local table</h1><p>No password. Each name is its own player with ${START.toLocaleString("de-CH")} chips.</p>
<input type="hidden" name="returnTo" value="${esc(returnTo)}">
<label>Name<input name="name" required maxlength="20" autofocus placeholder="Mei"></label>
${select("cardback", CARDBACKS, "cardback-red-dragon")}${select("chipset", CHIPSETS, "chips-lucky-cat")}${select("border", BORDERS, "border-onsen")}${select("title", TITLES, "Risk for Riches")}
<button>Sit down</button></form>`;
}

const body = (req) =>
  new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data));
  });

const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, content-type", "access-control-allow-methods": "GET, POST, OPTIONS" };
const json = (res, status, data) => {
  res.writeHead(status, { "content-type": "application/json", ...cors });
  res.end(JSON.stringify(data));
};
const redirect = (res, to) => {
  res.writeHead(302, { location: to });
  res.end();
};

let commitments = 0;
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, API);
  const path = url.pathname;
  if (req.method === "OPTIONS") return json(res, 204, {});

  // planary-auth
  if (req.method === "GET" && (path === "/" || path === "/signup")) {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    return res.end(signInPage(url.searchParams.get("returnTo") || SITE));
  }
  if (req.method === "POST" && path === "/login") {
    const form = new URLSearchParams(await body(req));
    const name = (form.get("name") || "Player").trim().slice(0, 20);
    const id = slug(name);
    const p = player(id, name);
    p.name = name;
    for (const key of ["cardback", "chipset", "border", "title"]) p[key] = form.get(key) || null;
    return redirect(res, `${(form.get("returnTo") || SITE).split("#")[0]}#access_token=${token(id, name)}`);
  }
  if (path === "/logout") return redirect(res, SITE);
  if (path === "/api/auth/me") {
    const claims = fromToken(req.headers.authorization);
    return claims ? json(res, 200, { user: { id: claims.sub, name: claims.name, email: claims.email } }) : json(res, 401, { error: "not authenticated" });
  }

  // The casino's public API, as the site asks it
  if (path === "/v1/me") {
    const claims = fromToken(req.headers.authorization);
    if (!claims) return json(res, 401, { error: "not authenticated" });
    const p = player(claims.sub, claims.name);
    return json(res, 200, { balance: p.balance, cardback: p.cardback });
  }
  if (path.startsWith("/v1/")) return json(res, 200, {});

  // The casino's internal API, as the table asks it (through the stub worker)
  if (path.startsWith("/internal/")) {
    const b = JSON.parse((await body(req)) || "{}");
    const p = b.userId ? player(b.userId, b.name) : null;
    if (path === "/internal/wallet") return json(res, 200, { balance: p.balance, avatar: null, border: p.border, title: p.title, chipset: p.chipset, blocked: null, muted: false });
    if (path === "/internal/status") return json(res, 200, { balance: p.balance, muted: false });
    if (path === "/internal/debit") {
      if (p.balance < b.amount) return json(res, 200, { ok: false, balance: p.balance, reason: "Not enough chips." });
      p.balance -= b.amount;
      return json(res, 200, { ok: true, balance: p.balance });
    }
    if (path === "/internal/credit") {
      p.balance += b.amount;
      return json(res, 200, { ok: true, balance: p.balance });
    }
    if (path === "/internal/round") return json(res, 200, { unlocked: [] });
    if (path === "/internal/commitments") return json(res, 200, { id: `local-${++commitments}` });
    return json(res, 200, { ok: true });
  }
  json(res, 404, { error: "not here" });
});

const children = [];
const run = (args, env = {}) => {
  const child = spawn("npx", args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    detached: process.platform !== "win32",
    env: { ...process.env, ...env },
  });
  children.push(child);
  child.on("exit", stop);
  return child;
};

let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  console.log("\n  Stopping…");
  for (const child of children) {
    if (!child.pid || child.exitCode !== null) continue;
    if (process.platform === "win32") spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    else {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        // Already gone.
      }
    }
  }
  server.close();
  setTimeout(() => process.exit(0), 500);
}
for (const signal of ["SIGINT", "SIGTERM", "SIGBREAK", "SIGHUP"]) process.on(signal, stop);

server.listen(API_PORT, "127.0.0.1", () => {
  // The table, with the casino stand-in beside it in the same wrangler.
  run(["wrangler", "dev", "-c", "wrangler.jsonc", "-c", "scripts/local/casino-stub.jsonc", "--port", String(PARTY_PORT), "--var", "INTERNAL_KEY:local", "--var", `AUTH_API_URL:${API}`]);
  run(["next", "dev", "-p", String(SITE_PORT)], {
    NEXT_PUBLIC_PARTYKIT_HOST: `localhost:${PARTY_PORT}`,
    NEXT_PUBLIC_AUTH_BASE_URL: API,
    NEXT_PUBLIC_CASINO_API: API,
    NEXT_PUBLIC_CASINO_URL: SITE,
    AUTH_API_URL: API,
  });
  console.log(`\n  Local blackjack: open ${SITE} once Next says Ready, and sign in with any name.`);
  console.log("  A second player: a private window, another name, the same table.\n");
});
server.on("error", (error) => {
  console.error(error.code === "EADDRINUSE" ? `\n  Port ${API_PORT} is taken: is play:local already running in another window?\n` : error);
  process.exit(1);
});
