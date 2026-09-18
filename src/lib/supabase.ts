import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const AUTH_BASE_URL = process.env.NEXT_PUBLIC_AUTH_BASE_URL ?? "https://auth.planary.ch";
export const CASINO_URL = process.env.NEXT_PUBLIC_CASINO_URL ?? "https://casino.planary.ch";

// Null when env vars are missing: everyone plays as a guest until Supabase is configured.
export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export function buildAuthUrl(mode: "login" | "signup", returnTo: string) {
  const target = new URL(mode === "signup" ? "/signup" : "/", AUTH_BASE_URL);
  target.searchParams.set("returnTo", returnTo);
  return target.toString();
}
