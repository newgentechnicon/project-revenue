import {
  createOrganizationSchema,
  updateOrganizationSchema,
} from "@/lib/admin-validation";
import { requirePlatformAdmin } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const auth = await requirePlatformAdmin(request);
  if ("error" in auth) return auth.error;

  const [{ data: organizations, error: orgError }, { data: memberships, error: memberError }] =
    await Promise.all([
      auth.admin.from("organizations").select("id, name, created_at").order("created_at"),
      auth.admin.from("memberships").select("org_id, user_id, role, data_scope, active"),
    ]);

  if (orgError || memberError) {
    return Response.json({ error: orgError?.message ?? memberError?.message }, { status: 500 });
  }

  const usersById = new Map<string, string>();
  let page = 1;
  while (true) {
    const { data, error } = await auth.admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return Response.json({ error: error.message }, { status: 500 });
    data.users.forEach((user) => usersById.set(user.id, user.email ?? user.id));
    if (data.users.length < 1000) break;
    page += 1;
  }

  const membersByOrg = new Map<string, unknown[]>();
  for (const member of memberships ?? []) {
    const rows = membersByOrg.get(member.org_id) ?? [];
    rows.push({ ...member, email: usersById.get(member.user_id) ?? member.user_id });
    membersByOrg.set(member.org_id, rows);
  }

  return Response.json({
    organizations: (organizations ?? []).map((org) => ({
      ...org,
      members: membersByOrg.get(org.id) ?? [],
    })),
    users: Array.from(usersById, ([id, email]) => ({ id, email })).sort(
      (first, second) => first.email.localeCompare(second.email)
    ),
  });
}

export async function POST(request: Request) {
  const auth = await requirePlatformAdmin(request);
  if ("error" in auth) return auth.error;

  const parsed = createOrganizationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  const { data, error } = await auth.admin
    .from("organizations")
    .insert({ name: parsed.data.name })
    .select("id, name, created_at")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ organization: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requirePlatformAdmin(request);
  if ("error" in auth) return auth.error;

  const parsed = updateOrganizationSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" },
      { status: 400 }
    );
  }

  const { data, error } = await auth.admin
    .from("organizations")
    .update({ name: parsed.data.name })
    .eq("id", parsed.data.id)
    .select("id, name, created_at")
    .maybeSingle();

  if (error) return Response.json({ error: error.message }, { status: 400 });
  if (!data) {
    return Response.json({ error: "ไม่พบ Organization ที่ต้องการแก้ไข" }, { status: 404 });
  }

  return Response.json({ organization: data });
}
