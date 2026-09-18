export const AUTH_BASE_URL = process.env.NEXT_PUBLIC_AUTH_BASE_URL || "https://auth.planary.ch";
export const CASINO_URL = process.env.NEXT_PUBLIC_CASINO_URL || "https://casino.planary.ch";

export function buildAuthUrl(mode: "login" | "signup", returnTo: string) {
  const target = new URL(mode === "signup" ? "/signup" : "/", AUTH_BASE_URL);
  target.searchParams.set("returnTo", returnTo);
  return target.toString();
}
