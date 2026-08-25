"use client";

import {
  createClient,
  type RealtimeChannel,
  type SupabaseClient,
} from "@supabase/supabase-js";

import { env } from "~/env";

/**
 * Teleprompt does not use Supabase Auth — sign-in is Auth.js + Google, and the
 * Postgres tables are reached through tRPC on the server. The browser client
 * exists for exactly one job: Realtime.
 *
 * It therefore ships only the publishable anon key, and never reads or writes a
 * table from the browser. Access control for a room is the room's `channelKey`,
 * a 256-bit secret the server only hands to a signed-in device on the owning
 * account.
 */
let client: SupabaseClient | null = null;

export function getRealtimeClient(): SupabaseClient {
  client ??= createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      realtime: {
        params: {
          // Anchor updates run at ~15/s while scrolling; the default of 10/s
          // would throttle exactly the messages that must not be late.
          eventsPerSecond: 40,
        },
      },
    },
  );
  return client;
}

export type { RealtimeChannel };
