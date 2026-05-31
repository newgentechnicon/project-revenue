/**
 * Feature-level permissions — กำหนดสิทธิ์เข้าถึงแต่ละเมนู/ฟีเจอร์ตาม role
 *
 * 3 ระดับ: none (ซ่อนเมนู) < view (เห็น/อ่านอย่างเดียว) < edit (แก้ไขได้)
 * เก็บ matrix ต่อ org ใน organizations.feature_access — owner = edit เสมอ
 */

import type { OrgRole } from "./types";

export type FeatureKey =
  | "projects"
  | "resource_planning"
  | "subscriptions"
  | "commissions"
  | "ledger"
  | "cashflow"
  | "analytics"
  | "customers"
  | "products"
  | "commission_payees"
  | "positions"
  | "employees"
  | "overheads";

export type FeatureAccess = "none" | "view" | "edit";

export interface FeatureDef {
  key: FeatureKey;
  label: string;
  group: string;
}

export const FEATURES: FeatureDef[] = [
  { key: "projects", label: "จัดการโครงการ", group: "ดำเนินงาน" },
  { key: "resource_planning", label: "Resource Planning", group: "ดำเนินงาน" },
  { key: "subscriptions", label: "รายรับประจำ", group: "รายรับ & การเงิน" },
  { key: "commissions", label: "ค่าคอมมิชชั่น", group: "รายรับ & การเงิน" },
  { key: "ledger", label: "รายการเดินบัญชี", group: "รายรับ & การเงิน" },
  { key: "cashflow", label: "Cashflow", group: "รายรับ & การเงิน" },
  { key: "analytics", label: "Company Analytics", group: "รายรับ & การเงิน" },
  { key: "customers", label: "ลูกค้า", group: "ข้อมูลหลัก" },
  { key: "products", label: "สินค้า/แพ็กเกจ", group: "ข้อมูลหลัก" },
  { key: "commission_payees", label: "ผู้รับคอม", group: "ข้อมูลหลัก" },
  { key: "positions", label: "เรตตำแหน่งงาน", group: "ข้อมูลหลัก" },
  { key: "employees", label: "รายชื่อพนักงาน", group: "ข้อมูลหลัก" },
  { key: "overheads", label: "ค่าใช้จ่ายส่วนกลาง", group: "ข้อมูลหลัก" },
];

/** map sidebar view id (string) → feature key */
export const VIEW_FEATURE: Record<string, FeatureKey> = {
  projects_list: "projects",
  dashboard: "projects",
  labor: "projects",
  overhead_alloc: "projects",
  quote_settings: "projects",
  quote: "projects",
  resource_planning: "resource_planning",
  company_analytics: "analytics",
  cashflow: "cashflow",
  subscriptions: "subscriptions",
  commissions: "commissions",
  ledger: "ledger",
  master_customers: "customers",
  master_products: "products",
  master_commission_payees: "commission_payees",
  master_positions: "positions",
  master_employees: "employees",
  master_overheads: "overheads",
};

export type FeatureAccessMatrix = Partial<Record<OrgRole, Partial<Record<FeatureKey, FeatureAccess>>>>;

export const ACCESS_RANK: Record<FeatureAccess, number> = { none: 0, view: 1, edit: 2 };

/** ค่า default เมื่อ matrix ไม่ได้ระบุ — viewer ดูได้อย่างเดียว, role อื่นแก้ได้ */
export function defaultAccess(role: OrgRole): FeatureAccess {
  return role === "viewer" ? "view" : "edit";
}

/** สิทธิ์ที่ใช้จริง: owner=edit เสมอ, อื่น ๆ อ่านจาก matrix → fallback default */
export function resolveAccess(
  matrix: FeatureAccessMatrix | null | undefined,
  role: OrgRole | null,
  feature: FeatureKey
): FeatureAccess {
  if (!role) return "none";
  if (role === "owner") return "edit";
  return matrix?.[role]?.[feature] ?? defaultAccess(role);
}
