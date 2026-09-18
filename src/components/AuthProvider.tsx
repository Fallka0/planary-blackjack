"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { buildAuthUrl, supabase } from "@/lib/supabase";

export interface PlanaryUser {
  id: string;
  email: string;
}

interface AuthState {
  user: PlanaryUser | null;
  accessToken: string | null;
  loading: boolean;
  /** Supabase isn't configured yet, so sign-in is unavailable and everyone plays as a guest. */
  authAvailable: boolean;
  /** The id chips and seats are keyed by: the account when signed in, else the browser's guest id. */
  playerId: string | null;
  signIn: (mode?: "login" | "signup") => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

// planary-auth redirects back with the session in the URL hash (#access_token=…&refresh_token=…).
async function absorbSessionFromHash() {
  if (!supabase) return;
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) return;
  await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PlanaryUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [guest, setGuest] = useState<string | null>(null);

  useEffect(() => {
    import("@/lib/identity").then(({ guestId }) => setGuest(guestId()));
    const client = supabase;
    if (!client) {
      setLoading(false);
      return;
    }
    let active = true;

    void (async () => {
      try {
        await absorbSessionFromHash();
      } catch {
        // Expired tokens in the hash: fall back to any stored session.
      }
      const { data } = await client.auth.getSession();
      if (!active) return;
      const session = data.session;
      setUser(session?.user ? { id: session.user.id, email: session.user.email ?? "" } : null);
      setAccessToken(session?.access_token ?? null);
      setLoading(false);
    })();

    const { data } = client.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? { id: session.user.id, email: session.user.email ?? "" } : null);
      setAccessToken(session?.access_token ?? null);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback((mode: "login" | "signup" = "login") => {
    window.location.assign(buildAuthUrl(mode, window.location.href.split("#")[0]));
  }, []);

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
    setUser(null);
    setAccessToken(null);
  }, []);

  const playerId = user ? `u-${user.id}` : guest;

  return (
    <AuthContext.Provider
      value={{ user, accessToken, loading, authAvailable: Boolean(supabase), playerId, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
