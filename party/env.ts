import type { Lobby } from "./lobby";
import type { Table } from "./table";

export interface Env {
  Table: DurableObjectNamespace<Table>;
  Lobby: DurableObjectNamespace<Lobby>;
  /** Optional: lets tables verify Planary (Supabase) logins. Set with `wrangler secret put`. */
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
}
