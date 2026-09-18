import { type Connection, Server } from "partyserver";
import type { Env } from "./env";
import { type LobbyMessage, type LobbyTable, SEATS } from "../shared/protocol";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function newTableId(prefix: "t" | "p") {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return `${prefix}-${Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("")}`;
}

/** One lobby room ("main") that tracks public tables and hands out quick seats. */
export class Lobby extends Server<Env> {
  tables = new Map<string, LobbyTable>();

  list(): LobbyTable[] {
    return [...this.tables.values()].sort((a, b) => b.seated - a.seated || b.updatedAt - a.updatedAt);
  }

  publish() {
    this.broadcast(JSON.stringify({ type: "tables", tables: this.list() } satisfies LobbyMessage));
  }

  onConnect(conn: Connection) {
    conn.send(JSON.stringify({ type: "tables", tables: this.list() } satisfies LobbyMessage));
  }

  async onRequest(req: Request) {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    const url = new URL(req.url);

    if (req.method === "POST") {
      const body = (await req.json()) as Partial<LobbyTable>;
      if (typeof body.id !== "string" || !body.id.startsWith("t-")) return new Response("bad table", { status: 400 });
      const seated = Math.max(0, Math.min(SEATS, Number(body.seated) || 0));
      if (seated === 0) this.tables.delete(body.id);
      else this.tables.set(body.id, { id: body.id, seated, phase: body.phase ?? "betting", updatedAt: Date.now() });
      this.publish();
      return new Response("ok", { headers: CORS });
    }

    if (url.searchParams.get("action") === "quickseat") {
      const open = this.list().find((t) => t.seated < SEATS);
      return Response.json({ id: open?.id ?? newTableId("t") }, { headers: CORS });
    }
    if (url.searchParams.get("action") === "private") {
      return Response.json({ id: newTableId("p") }, { headers: CORS });
    }
    return Response.json({ tables: this.list() }, { headers: CORS });
  }
}
