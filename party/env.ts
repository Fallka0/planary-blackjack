import type { Lobby } from "./lobby";
import type { Table } from "./table";

export interface Env {
  Table: DurableObjectNamespace<Table>;
  Lobby: DurableObjectNamespace<Lobby>;
  /** planary-auth base URL used to verify player tokens (defaults to https://auth.planary.ch). */
  AUTH_API_URL?: string;
}
