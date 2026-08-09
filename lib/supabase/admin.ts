import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

let adminClient: SupabaseClient | null = null;

export function getSupabaseAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serverSecretKey =
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serverSecretKey) {
    throw new Error("Server Supabase credentials are not configured");
  }

  adminClient ??= createClient(url, serverSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return adminClient;
}

export async function requirePlatformAdmin(
  request: Request
): Promise<{ user: User; admin: SupabaseClient } | { error: Response }> {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    return { error: Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 }) };
  }

  let admin: SupabaseClient;
  try {
    admin = getSupabaseAdminClient();
  } catch {
    return {
      error: Response.json(
        {
          error:
            "ยังไม่ได้ตั้งค่า SUPABASE_SECRET_KEY (หรือ SUPABASE_SERVICE_ROLE_KEY) บน server",
        },
        { status: 500 }
      ),
    };
  }

  const { data, error: userError } = await admin.auth.getUser(token);
  if (userError || !data.user) {
    return { error: Response.json({ error: "Session หมดอายุ กรุณาเข้าสู่ระบบใหม่" }, { status: 401 }) };
  }

  const { data: platformAdmin, error: adminError } = await admin
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (adminError || !platformAdmin) {
    return { error: Response.json({ error: "บัญชีนี้ไม่มีสิทธิ์ Platform Admin" }, { status: 403 }) };
  }

  return { user: data.user, admin };
}
