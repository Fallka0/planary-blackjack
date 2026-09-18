"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { absorbSessionFromHash, clearSession, loadSession, verifySession } from "@/lib/session";
import { buildAuthUrl } from "@/lib/auth";

export interface PlanaryUser {
  id: string;
  email: string;
}

interface AuthState {
  user: PlanaryUser | null;
  accessToken: string | null;
  loading: boolean;
  /** Sign-in is always available: it goes through planary-auth. */
  authAvailable: boolean;
  /** The id chips and seats are keyed by: the account when signed in, else the browser's guest id. */
  playerId: string | null;
  signIn: (mode?: "login" | "signup") => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PlanaryUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [guest, setGuest] = useState<string | null>(null);

  useEffect(() => {
    import("@/lib/identity").then(({ guestId }) => setGuest(guestId()));
    let active = true;
    const session = absorbSessionFromHash() ?? loadSession();
    if (!session) {
      setLoading(false);
      return;
    }
    // Show the player straight away, then drop the session if planary-auth rejects the token.
    setUser({ id: session.userId, email: session.email });
    setAccessToken(session.accessToken);
    setLoading(false);
    void verifySession(session).then((ok) => {
      if (!active || ok) return;
      clearSession();
      setUser(null);
      setAccessToken(null);
    });
    // Sign out locally when the token expires.
    const timer = window.setTimeout(() => {
      clearSession();
      setUser(null);
      setAccessToken(null);
    }, Math.max(0, session.expiresAt * 1000 - Date.now() - 60_000));
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, []);

  const signIn = useCallback((mode: "login" | "signup" = "login") => {
    window.location.assign(buildAuthUrl(mode, window.location.href.split("#")[0]));
  }, []);

  const signOut = useCallback(async () => {
    clearSession();
    setUser(null);
    setAccessToken(null);
  }, []);

  const playerId = user ? `u-${user.id}` : guest;

  return (
    <AuthContext.Provider value={{ user, accessToken, loading, authAvailable: true, playerId, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
