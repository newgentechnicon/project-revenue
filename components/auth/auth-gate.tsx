"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { isSupabaseConfigured } from "@/lib/supabase/client";

interface AuthGateProps {
  children: React.ReactNode;
}

/**
 * AuthGate logic:
 * - Loading → spinner
 * - Supabase configured + no user → redirect to /login
 * - Supabase not configured (local-only mode) → render app
 * - User logged in → render app
 */
export function AuthGate({ children }: AuthGateProps) {
  const { loading, user, mode } = useAuth();
  const router = useRouter();

  const needsLogin = !loading && isSupabaseConfigured() && !user && mode !== "supabase";

  useEffect(() => {
    if (needsLogin) {
      router.replace("/login");
    }
  }, [needsLogin, router]);

  if (loading || needsLogin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground animate-bounce">
          <span className="text-xl font-bold">฿</span>
        </div>
        <div className="text-sm font-semibold tracking-wider animate-pulse">กำลังเชื่อมต่อระบบ...</div>
      </div>
    );
  }

  return <>{children}</>;
}
