"use client";

import PartySocket from "partysocket";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage, ClientMessage, ServerMessage, TableState } from "../../shared/protocol";
import { useAuth } from "@/components/AuthProvider";
import { writeChips } from "./identity";
import { PARTY_HOST } from "./party";

export type ConnectionStatus = "connecting" | "open" | "closed";

export function useTable(tableId: string) {
  const { accessToken } = useAuth();
  const [state, setState] = useState<TableState | null>(null);
  const [you, setYou] = useState<{ playerId: string; seat: number | null; verified: boolean } | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const socketRef = useRef<PartySocket | null>(null);

  useEffect(() => {
    const socket = new PartySocket({
      host: PARTY_HOST,
      party: "table",
      room: tableId,
      query: () => ({ token: accessToken }),
    });
    socketRef.current = socket;
    setStatus("connecting");

    socket.addEventListener("open", () => setStatus("open"));
    socket.addEventListener("close", () => setStatus("closed"));
    socket.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data as string) as ServerMessage;
      if (msg.type === "error") {
        setError(msg.message);
        return;
      }
      if (msg.type === "chat") {
        setChat((current) => (msg.replace ? msg.messages : [...current, ...msg.messages].slice(-120)));
        return;
      }
      // Re-base the deadline on this browser's clock: server and client clocks rarely agree.
      const deadline = msg.state.deadline === null ? null : Date.now() + (msg.state.deadline - msg.now);
      setState({ ...msg.state, deadline });
      setYou(msg.you);
      // Keep this browser's chip balance in step with the table. Bets placed during betting are
      // still part of the stack; once dealt they sit in the hands until the round settles.
      if (msg.you.seat !== null) {
        const seat = msg.state.seats[msg.you.seat];
        if (seat) {
          const inPlay = msg.state.phase === "playing" || msg.state.phase === "dealer";
          writeChips(msg.you.playerId, seat.stack + (inPlay ? seat.hands.reduce((sum, h) => sum + h.bet, 0) : 0));
        }
      }
    });

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [tableId, accessToken]);

  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => setError(null), 3500);
    return () => window.clearTimeout(timer);
  }, [error]);

  const send = useCallback((msg: ClientMessage) => {
    socketRef.current?.send(JSON.stringify(msg));
  }, []);

  return { state, you, status, error, chat, send };
}
