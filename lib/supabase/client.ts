import { createBrowserClient, type CookieMethodsBrowser } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let _client: SupabaseClient | null = null;

/**
 * ตรวจว่า Supabase config valid ไหม (ไม่ใช่ placeholder)
 */
export function isSupabaseConfigured(): boolean {
  return (
    !!supabaseUrl &&
    !!supabaseAnonKey &&
    !supabaseUrl.includes("placeholder") &&
    !supabaseAnonKey.includes("placeholder")
  );
}

/**
 * Browser-side Supabase client (singleton)
 * Auth session ถูกเก็บใน cookies เพื่อ multi-tab sync
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase ยังไม่ได้ตั้งค่า — กรุณาแก้ .env.local ใส่ NEXT_PUBLIC_SUPABASE_URL และ NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }
  if (!_client) {
    _client = createBrowserClient(supabaseUrl as string, supabaseAnonKey as string, {
      cookies: cookieMethods(),
    });
  }
  return _client;
}

/**
 * Cookie methods compatible with @supabase/ssr — ใช้ document.cookie
 * (next.js client components ไม่มี Next cookies() helper)
 */
function cookieMethods(): CookieMethodsBrowser {
  return {
    getAll() {
      if (typeof document === "undefined") return [];
      return document.cookie
        .split("; ")
        .filter(Boolean)
        .map((c) => {
          const [name, ...rest] = c.split("=");
          return { name, value: decodeURIComponent(rest.join("=")) };
        });
    },
    setAll(cookies) {
      if (typeof document === "undefined") return;
      cookies.forEach(({ name, value, options }) => {
        let cookie = `${name}=${encodeURIComponent(value)}`;
        if (options?.maxAge) cookie += `; Max-Age=${options.maxAge}`;
        if (options?.path) cookie += `; Path=${options.path}`;
        if (options?.domain) cookie += `; Domain=${options.domain}`;
        if (options?.sameSite) cookie += `; SameSite=${options.sameSite}`;
        if (options?.secure) cookie += `; Secure`;
        document.cookie = cookie;
      });
    },
  };
}
