"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

/**
 * Client-side auth confirmation page.
 * Handles hash-based tokens from Supabase invite/recovery emails.
 * Supabase puts tokens in the URL hash (#access_token=...&type=invite)
 * which server-side routes can't see.
 */
export default function AuthConfirmPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClient();

    // The Supabase client auto-detects hash tokens and establishes the session
    // We just need to check the session and redirect appropriately
    const handleAuth = async () => {
      // Give Supabase a moment to process the hash
      await new Promise((r) => setTimeout(r, 500));

      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        // Check if this is an invite or recovery (user needs to set password)
        const hash = window.location.hash;
        const isInvite = hash.includes("type=invite");
        const isRecovery = hash.includes("type=recovery");

        if (isInvite || isRecovery) {
          router.push("/login/set-password");
        } else {
          router.push("/dashboard");
        }
      } else {
        setError("Authentication failed. The link may have expired.");
      }
    };

    // Listen for auth state changes (Supabase processes hash tokens automatically)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === "SIGNED_IN" || event === "PASSWORD_RECOVERY") {
          const hash = window.location.hash;
          const isInvite = hash.includes("type=invite");
          const isRecovery = hash.includes("type=recovery") || event === "PASSWORD_RECOVERY";

          if (isInvite || isRecovery) {
            router.push("/login/set-password");
          } else {
            router.push("/dashboard");
          }
        }
      }
    );

    // Fallback: if no auth event fires within 3 seconds, check manually
    const timeout = setTimeout(handleAuth, 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [router]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 text-center shadow-xl">
          <p className="text-sm text-destructive">{error}</p>
          <a href="/login" className="mt-3 inline-block text-xs text-primary hover:underline">
            Back to sign in
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Verifying your account...</p>
      </div>
    </div>
  );
}
