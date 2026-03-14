import { createServerClient as createSupabaseServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * Cookie-based auth client for verifying user sessions.
 * Use in Server Components, API routes, and middleware.
 */
export async function createAuthClient() {
  const cookieStore = await cookies();
  return createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // setAll can fail in Server Components (read-only).
            // This is expected — middleware handles the refresh.
          }
        },
      },
    }
  );
}

/**
 * Service-role admin client for data operations.
 * Bypasses RLS — use for sync, analytics queries, admin operations.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Legacy export — maps to admin client (all existing API routes used service role)
export const createServerClient = createAdminClient;
