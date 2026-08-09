import { createOrganizationUserSchema } from "@/lib/admin-validation"
import { requirePlatformAdmin } from "@/lib/supabase/admin"

export async function POST(request: Request) {
  const auth = await requirePlatformAdmin(request)
  if ("error" in auth) return auth.error

  const parsed = createOrganizationUserSchema.safeParse(
    await request.json().catch(() => null)
  )
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" },
      { status: 400 }
    )
  }

  const input = parsed.data
  const { data: organization, error: orgError } = await auth.admin
    .from("organizations")
    .select("id")
    .eq("id", input.orgId)
    .maybeSingle()

  if (orgError || !organization) {
    return Response.json({ error: "ไม่พบบริษัทที่เลือก" }, { status: 404 })
  }

  let createdNewAccount = false
  let account
  if (input.accountMode === "existing") {
    const { data, error: userError } =
      await auth.admin.auth.admin.getUserById(input.userId)
    if (userError || !data.user) {
      return Response.json(
        { error: "ไม่พบบัญชีผู้ใช้ที่เลือก" },
        { status: 404 }
      )
    }
    account = data.user
  } else {
    const { data: created, error: createError } =
      await auth.admin.auth.admin.createUser({
        email: input.email,
        password: input.password,
        email_confirm: true,
      })
    if (createError || !created.user) {
      return Response.json(
        { error: createError?.message ?? "สร้างบัญชีไม่สำเร็จ" },
        { status: 400 }
      )
    }
    account = created.user
    createdNewAccount = true
  }

  const { data: existingMembership, error: membershipLookupError } =
    await auth.admin
      .from("memberships")
      .select("org_id")
      .eq("org_id", input.orgId)
      .eq("user_id", account.id)
      .maybeSingle()

  if (membershipLookupError) {
    if (createdNewAccount) await auth.admin.auth.admin.deleteUser(account.id)
    return Response.json(
      { error: membershipLookupError.message },
      { status: 500 }
    )
  }
  if (existingMembership) {
    if (createdNewAccount) await auth.admin.auth.admin.deleteUser(account.id)
    return Response.json(
      { error: "บัญชีผู้ใช้นี้อยู่ในบริษัทที่เลือกแล้ว" },
      { status: 409 }
    )
  }

  const { error: membershipError } = await auth.admin
    .from("memberships")
    .insert({
      org_id: input.orgId,
      user_id: account.id,
      role: input.role,
      data_scope: input.dataScope,
      active: true,
    })

  if (membershipError) {
    if (createdNewAccount) await auth.admin.auth.admin.deleteUser(account.id)
    return Response.json({ error: membershipError.message }, { status: 400 })
  }

  return Response.json(
    {
      user: {
        id: account.id,
        email: account.email,
        orgId: input.orgId,
        role: input.role,
        dataScope: input.dataScope,
      },
    },
    { status: 201 }
  )
}
