"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { SupabaseStorageRepository } from "@/lib/storage/supabase-storage-repository";
import { setStorageRepository, clearStorageRepository } from "@/lib/storage/storage-repository";

export type AuthMode = "supabase" | "anonymous" | "loading";

interface AuthState {
  mode: AuthMode;
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null; needsEmailConfirm: boolean }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<AuthMode>("loading");

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      // Supabase-only app — show config error via AuthGate
      clearStorageRepository();
      setMode("anonymous");
      setLoading(false);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    let cancelled = false;

    // เปิดใช้งาน session: ตั้ง storage repo → ตรวจ/สร้าง membership (auto-join org)
    // → แล้วค่อย setMode("supabase") เพื่อกัน race กับการ hydrate ข้อมูล
    const activateSession = async (newSession: Session) => {
      setSession(newSession);
      setUser(newSession.user);
      setStorageRepository(new SupabaseStorageRepository(supabase));
      try {
        const { error } = await supabase.rpc("ensure_membership");
        if (error) console.error("[use-auth] ensure_membership failed:", error);
      } catch (e) {
        console.error("[use-auth] ensure_membership threw:", e);
      }
      if (!cancelled) setMode("supabase");
    };

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) {
        await activateSession(data.session);
      } else {
        // Not logged in — no storage active. AuthGate will show login form.
        clearStorageRepository();
        setMode("anonymous");
      }
      setLoading(false);
    })();

    // Subscribe to auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (newSession) {
        void activateSession(newSession);
      } else {
        setSession(null);
        setUser(null);
        clearStorageRepository();
        setMode("anonymous");
      }
    });

    return () => {
      cancelled = true;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!isSupabaseConfigured()) {
      return { error: "Supabase ยังไม่ได้ตั้งค่า — กรุณาตั้งค่า .env.local ก่อน" };
    }
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signUp = async (email: string, password: string) => {
    if (!isSupabaseConfigured()) {
      return { error: "Supabase ยังไม่ได้ตั้งค่า", needsEmailConfirm: false };
    }
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message, needsEmailConfirm: false };
    // หาก auto-confirm ปิดอยู่ user ต้อง confirm email ก่อน
    const needsEmailConfirm = !data.session;
    return { error: null, needsEmailConfirm };
  };

  const signOut = async () => {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ mode, user, session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
