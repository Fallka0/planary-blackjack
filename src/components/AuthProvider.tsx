"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { buildAuthUrl, signOutUrl } from "@/lib/auth";
import { absorbSessionFromHash, clearSession, loadSession, verifySession } from "@/lib/session";
import { ChipIcon } from "./ChipIcon";

export interface PlanaryUser {
  id: string;
  email: string;
  name: string;
}

interface AuthState {
  user: PlanaryUser;
  accessToken: string;
  /** Chips and seats are keyed by the Planary account. */
  playerId: string;
  signOut: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

/** Only signed-in players get in. Without a session we hop to planary-auth, which sends
 *  already-signed-in people straight back (single sign-on), so this is usually invisible. */
function goSignIn() {
  window.location.replace(buildAuthUrl("login", window.location.href.split("#")[0], true));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<{ user: PlanaryUser; accessToken: string } | null>(null);

  useEffect(() => {
    let active = true;
    const stored = absorbSessionFromHash() ?? loadSession();
    if (!stored) {
      goSignIn();
      return;
    }
    setSession({ user: { id: stored.userId, email: stored.email, name: stored.name }, accessToken: stored.accessToken });

    void verifySession(stored).then((ok) => {
      if (!active || ok) return;
      clearSession();
      goSignIn();
    });
    // Tokens last an hour; fetch a fresh one the same silent way shortly before that.
    const timer = window.setTimeout(() => {
      clearSession();
      goSignIn();
    }, Math.max(0, stored.expiresAt * 1000 - Date.now() - 60_000));
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, []);

  const signOut = useCallback(() => {
    clearSession();
    // End the Planary session too, or single sign-on would put the player straight back in.
    window.location.assign(signOutUrl());
  }, []);

  if (!session) {
    return (
      <div className="signing-in" role="status">
        <ChipIcon size={56} letter="21" />
        <p>Signing you in…</p>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ ...session, playerId: `u-${session.user.id}`, signOut }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
