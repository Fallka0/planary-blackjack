export const PARTY_HOST = process.env.NEXT_PUBLIC_PARTYKIT_HOST || "localhost:1999";

const protocol = PARTY_HOST.startsWith("localhost") || PARTY_HOST.startsWith("127.") ? "http" : "https";

export async function lobbyRequest(action: "quickseat" | "private"): Promise<string> {
  const res = await fetch(`${protocol}://${PARTY_HOST}/parties/lobby/main?action=${action}`);
  if (!res.ok) throw new Error("Lobby unavailable");
  const { id } = (await res.json()) as { id: string };
  return id;
}

/** Accepts a full table link, "p-abc123", or just "abc123" (treated as private). */
export function parseTableCode(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  const fromUrl = trimmed.match(/\/t\/([tp]-[a-z0-9]{6})/);
  if (fromUrl) return fromUrl[1];
  if (/^[tp]-[a-z0-9]{6}$/.test(trimmed)) return trimmed;
  if (/^[a-z0-9]{6}$/.test(trimmed)) return `p-${trimmed}`;
  return null;
}
