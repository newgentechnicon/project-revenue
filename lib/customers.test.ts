import { describe, it, expect } from "vitest";
import { Customer, Subscription, Project } from "./types";
import { customerKey, extractCustomersFromRecords } from "./customers";

const sub = (id: string, name: string, taxId?: string, customerId?: string): Subscription => ({
  id,
  productId: "p1",
  customerId,
  customer: { name, taxId },
  billingType: "subscription",
  billingCycle: "monthly",
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  amount: 1000,
  status: "active",
  autoRenew: true,
});

const proj = (id: string, name: string, taxId?: string, customerId?: string): Project =>
  ({
    id,
    name: "Project " + id,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    quotationDate: "2026-01-01",
    workingDaysPerMonth: 20,
    durationMonths: 1,
    allocations: [],
    directCosts: [],
    overheadAllocationMethod: "proportional",
    overheadAllocationValue: 0,
    contingencyPercent: 0,
    pricingMode: "cost_plus",
    fixedPrice: 0,
    markupPercentage: 0,
    taxRate: 7,
    withholdingTaxPercent: 3,
    status: "draft",
    customerId,
    client: { name, taxId },
    paymentTerms: { installments: [], paymentDueDays: 30, lateFeePercent: 0 },
    phases: [],
  }) as Project;

const genId = (i: number) => `new_${i}`;

describe("customerKey", () => {
  it("ใช้เลขภาษีเป็นหลักเมื่อมี (ตัดอักขระไม่ใช่ตัวเลข)", () => {
    expect(customerKey("บริษัท A", "0-105-5-61234567")).toBe("tax:0105561234567");
  });
  it("ใช้ชื่อ normalize เมื่อไม่มีเลขภาษี", () => {
    expect(customerKey("  บริษัท   A  ")).toBe("name:บริษัท a");
  });
});

describe("extractCustomersFromRecords", () => {
  it("สร้างลูกค้าใหม่จาก subscription + project และผูก customerId", () => {
    const r = extractCustomersFromRecords(
      [sub("s1", "บริษัท A", "0105561234567")],
      [proj("pr1", "บริษัท B")],
      [],
      genId
    );
    expect(r.newCustomers).toHaveLength(2);
    expect(r.subscriptionLinks).toEqual([{ subscriptionId: "s1", customerId: "new_0" }]);
    expect(r.projectLinks).toEqual([{ projectId: "pr1", customerId: "new_1" }]);
  });

  it("dedupe ลูกค้าชื่อ/เลขภาษีเดียวกันข้าม subscription และ project", () => {
    const r = extractCustomersFromRecords(
      [sub("s1", "บริษัท A", "0105561234567")],
      [proj("pr1", "บริษัท A", "0105561234567")],
      [],
      genId
    );
    expect(r.newCustomers).toHaveLength(1);
    expect(r.subscriptionLinks[0].customerId).toBe("new_0");
    expect(r.projectLinks[0].customerId).toBe("new_0");
  });

  it("ผูกกับ master เดิมที่มีอยู่แล้ว ไม่สร้างซ้ำ", () => {
    const existing: Customer[] = [
      { id: "cust_existing", name: "บริษัท A", taxId: "0105561234567", active: true },
    ];
    const r = extractCustomersFromRecords([sub("s1", "บริษัท A", "0105561234567")], [], existing, genId);
    expect(r.newCustomers).toHaveLength(0);
    expect(r.subscriptionLinks[0].customerId).toBe("cust_existing");
  });

  it("ข้ามรายการที่ผูก customerId แล้ว หรือชื่อว่าง", () => {
    const r = extractCustomersFromRecords(
      [sub("s1", "บริษัท A", undefined, "cust_x"), sub("s2", "  ")],
      [],
      [],
      genId
    );
    expect(r.newCustomers).toHaveLength(0);
    expect(r.subscriptionLinks).toHaveLength(0);
  });
});
