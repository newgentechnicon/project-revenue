import { z } from "zod"

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(2, "กรุณาระบุชื่อบริษัท").max(120),
})

export const updateOrganizationSchema = createOrganizationSchema.extend({
  id: z.uuid("Organization ID ไม่ถูกต้อง"),
})

const organizationMembershipSchema = z.object({
  orgId: z.uuid(),
  role: z.enum(["owner", "admin", "accountant", "sales", "viewer"]),
  dataScope: z.enum(["all", "own"]),
})

export const createOrganizationUserSchema = z.discriminatedUnion(
  "accountMode",
  [
    organizationMembershipSchema.extend({
      accountMode: z.literal("existing"),
      userId: z.uuid("User ID ไม่ถูกต้อง"),
    }),
    organizationMembershipSchema.extend({
      accountMode: z.literal("new"),
      email: z.email().transform((value) => value.trim().toLowerCase()),
      password: z
        .string()
        .min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร")
        .max(72),
    }),
  ]
)

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>
export type CreateOrganizationUserInput = z.infer<
  typeof createOrganizationUserSchema
>
