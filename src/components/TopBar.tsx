"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, LogOut } from "lucide-react";
import { formatChips } from "../../shared/protocol";
import { readChips } from "@/lib/identity";
import { CASINO_URL } from "@/lib/auth";
import { useAuth } from "./AuthProvider";
import { ChipIcon } from "./ChipIcon";

export function useChips() {
  const { playerId } = useAuth();
  const [chips, setChips] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setChips(readChips(playerId));
    update();
    window.addEventListener("pbj:chips", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("pbj:chips", update);
      window.removeEventListener("storage", update);
    };
  }, [playerId]);
  return chips;
}

export function TopBar({ children }: { children?: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const chips = useChips();

  return (
    <header className="topbar">
      <a href={CASINO_URL} className="back" aria-label="Back to Planary Casino">
        <ArrowLeft size={18} strokeWidth={2} aria-hidden="true" />
      </a>
      <Link href="/" className="brand" aria-label="Planary Blackjack lobby">
        <ChipIcon size={34} letter="21" />
        <span className="brand-copy">
          <span className="brand-name">Blackjack</span>
          <span className="brand-sub">Planary Casino</span>
        </span>
      </Link>

      <div className="topbar-middle">{children}</div>

      <div className="topbar-actions">
        {chips !== null ? (
          <span className="balance" title="Play money, kept in this browser for now">
            <ChipIcon size={20} />
            <strong>{formatChips(chips)}</strong>
            <span className="balance-label">chips</span>
          </span>
        ) : null}
        <span className="who-chip" title={user.email}>
          {user.name}
        </span>
        <button className="icon-btn" onClick={signOut} aria-label="Sign out" title="Sign out">
          <LogOut size={18} strokeWidth={1.9} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
