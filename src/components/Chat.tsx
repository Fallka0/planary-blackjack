"use client";

import { useEffect, useRef, useState } from "react";
import { SendHorizontal, X } from "lucide-react";
import { CHAT_MAX_LENGTH, type ChatMessage } from "../../shared/protocol";

function time(at: number) {
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function Chat({
  messages,
  myId,
  onSend,
  onClose,
}: {
  messages: ChatMessage[];
  myId: string | null;
  onSend: (text: string) => void;
  /** Present when the chat is shown as an overlay (narrow screens). */
  onClose?: () => void;
}) {
  const [text, setText] = useState("");
  const listRef = useRef<HTMLOListElement>(null);

  // Stick to the newest message unless the reader has scrolled up.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 120;
    if (nearBottom) list.scrollTop = list.scrollHeight;
  }, [messages]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
  }

  return (
    <aside className="chat" aria-label="Table chat">
      <div className="chat-head">
        <h2>Table talk</h2>
        {onClose ? (
          <button className="icon-btn" onClick={onClose} aria-label="Close chat">
            <X size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <ol className="chat-list" ref={listRef} aria-live="polite">
        {messages.length === 0 ? (
          <li className="chat-empty">Nobody has said anything yet. Say hi to the table.</li>
        ) : (
          messages.map((m) =>
            m.name === null ? (
              <li key={m.id} className="chat-system">
                {m.text}
              </li>
            ) : (
              <li key={m.id} className={`chat-msg${m.playerId === myId ? " is-mine" : ""}`}>
                <span className="chat-meta">
                  <strong>{m.playerId === myId ? "You" : m.name}</strong>
                  <time>{time(m.at)}</time>
                </span>
                <span className="chat-text">{m.text}</span>
              </li>
            ),
          )
        )}
      </ol>
      <form className="chat-form" onSubmit={submit}>
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={CHAT_MAX_LENGTH}
          placeholder="Message the table"
          aria-label="Message the table"
          autoComplete="off"
        />
        <button className="chat-send" type="submit" aria-label="Send" disabled={!text.trim()}>
          <SendHorizontal size={18} strokeWidth={2} aria-hidden="true" />
        </button>
      </form>
    </aside>
  );
}
