import { Customer, Subscription, Project, SubscriptionCustomer, ClientInfo } from "./types";

/**
 * Helpers สำหรับ Customer master:
 *  - สร้าง snapshot จาก master (เพื่อฝังลง subscription/project)
 *  - ดึงลูกค้าเดิมที่ฝังอยู่ใน subscription/project ออกมาเป็น master (migration tool)
 */

/** key สำหรับ dedupe ลูกค้า — ใช้เลขภาษีก่อน ถ้าไม่มีใช้ชื่อ (normalize) */
export function customerKey(name: string, taxId?: string): string {
  const tax = (taxId ?? "").replace(/\D/g, "");
  if (tax) return `tax:${tax}`;
  return `name:${name.trim().toLowerCase().replace(/\s+/g, " ")}`;
}

/** แปลง Customer master → snapshot ที่ฝังใน subscription */
export function toSubscriptionCustomer(c: Customer): SubscriptionCustomer {
  return {
    name: c.name,
    taxId: c.taxId,
    contactPerson: c.contactPerson,
    contactEmail: c.contactEmail,
    contactPhone: c.contactPhone,
  };
}

/** แปลง Customer master → snapshot ClientInfo ที่ฝังใน project */
export function toClientInfo(c: Customer): ClientInfo {
  return {
    name: c.name,
    taxId: c.taxId,
    address: c.address,
    contactPerson: c.contactPerson,
    contactEmail: c.contactEmail,
    contactPhone: c.contactPhone,
  };
}

export interface ExtractCustomersResult {
  /** ลูกค้าใหม่ที่ต้องเพิ่มเข้า master */
  newCustomers: Customer[];
  /** subscription ที่ควร set customerId */
  subscriptionLinks: Array<{ subscriptionId: string; customerId: string }>;
  /** project ที่ควร set customerId */
  projectLinks: Array<{ projectId: string; customerId: string }>;
}

/**
 * ดึงลูกค้าที่ฝังอยู่ใน subscriptions/projects (ที่ยังไม่ผูก customerId)
 * ออกมาเป็น Customer master — dedupe กับ master เดิมและภายในชุดเดียวกัน
 *
 * `genId(index)` ใช้สร้าง id ของลูกค้าใหม่ (deterministic เพื่อ test ได้)
 */
export function extractCustomersFromRecords(
  subscriptions: Subscription[],
  projects: Project[],
  existingCustomers: Customer[],
  genId: (index: number) => string
): ExtractCustomersResult {
  const byKey = new Map<string, string>(); // key → customerId
  for (const c of existingCustomers) {
    byKey.set(customerKey(c.name, c.taxId), c.id);
  }

  const newCustomers: Customer[] = [];
  const subscriptionLinks: ExtractCustomersResult["subscriptionLinks"] = [];
  const projectLinks: ExtractCustomersResult["projectLinks"] = [];
  let createdCount = 0;

  const resolve = (name: string, taxId: string | undefined, snapshot: Partial<Customer>): string | null => {
    if (!name.trim()) return null;
    const key = customerKey(name, taxId);
    const existing = byKey.get(key);
    if (existing) return existing;
    const id = genId(createdCount);
    createdCount++;
    byKey.set(key, id);
    newCustomers.push({
      id,
      name: name.trim(),
      taxId: taxId || undefined,
      address: snapshot.address,
      contactPerson: snapshot.contactPerson,
      contactEmail: snapshot.contactEmail,
      contactPhone: snapshot.contactPhone,
      active: true,
    });
    return id;
  };

  for (const sub of subscriptions) {
    if (sub.customerId) continue;
    const cid = resolve(sub.customer.name, sub.customer.taxId, {
      contactPerson: sub.customer.contactPerson,
      contactEmail: sub.customer.contactEmail,
      contactPhone: sub.customer.contactPhone,
    });
    if (cid) subscriptionLinks.push({ subscriptionId: sub.id, customerId: cid });
  }

  for (const proj of projects) {
    if (proj.customerId) continue;
    const cid = resolve(proj.client.name, proj.client.taxId, {
      address: proj.client.address,
      contactPerson: proj.client.contactPerson,
      contactEmail: proj.client.contactEmail,
      contactPhone: proj.client.contactPhone,
    });
    if (cid) projectLinks.push({ projectId: proj.id, customerId: cid });
  }

  return { newCustomers, subscriptionLinks, projectLinks };
}
