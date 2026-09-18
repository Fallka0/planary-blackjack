// Planary sessions without Supabase keys: planary-auth hands us its access token in the URL hash,
// we keep it in this browser and verify it through our own /api/me (which asks auth.planary.ch).

const KEY = "planary.session";

export interface StoredSession {
  accessToken: string;
  userId: string;
  email: string;
  /** Epoch seconds. */
  expiresAt: number;
}

function decodeJwt(token: string): { sub?: string; email?: string; exp?: number } | null {
  try {
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "="));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function fromToken(accessToken: string): StoredSession | null {
  const claims = decodeJwt(accessToken);
  if (!claims?.sub || !claims.exp) return null;
  return { accessToken, userId: claims.sub, email: claims.email ?? "", expiresAt: claims.exp };
}

/** Picks up `#access_token=…` after the redirect back from planary-auth and cleans the URL. */
export function absorbSessionFromHash(): StoredSession | null {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const accessToken = params.get("access_token");
  if (!accessToken) return null;
  window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
  const session = fromToken(accessToken);
  if (session) saveSession(session);
  return session;
}

export function loadSession(): StoredSession | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as StoredSession;
    // Treat tokens within a minute of expiry as expired.
    if (session.expiresAt * 1000 < Date.now() + 60_000) {
      clearSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function saveSession(session: StoredSession) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    // Storage blocked: the session lasts for this page view only.
  }
}

export function clearSession() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing stored.
  }
}

/** Confirms the token with planary-auth (via our own route, which avoids CORS). */
export async function verifySession(session: StoredSession): Promise<boolean> {
  try {
    const res = await fetch("/api/me", { headers: { Authorization: `Bearer ${session.accessToken}` }, cache: "no-store" });
    if (res.status === 401) return false;
    // Anything else (auth down, network) keeps the locally valid session rather than signing people out.
    return true;
  } catch {
    return true;
  }
}
