import { readEnv } from "@/lib/env";

/** Supabase project address, without a trailing slash. */
export function supabaseUrl() {
  return readEnv("NEXT_PUBLIC_SUPABASE_URL")?.replace(/\/+$/, "");
}

/** Supabase's public key: the new "publishable" key, or the legacy "anon" key. */
export function supabasePublicKey() {
  return readEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") || readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
}
