import { describe, it, expect } from "vitest";
import { Commission, Subscription, Project, CommissionPayee, Product } from "./types";
import {
  commissionOnAmount,
  countSubscriptionPayments,
  estimateCommissionTotal,
  summarizeCommissions,
  expandCommissionPayouts,
} from "./commissions";

const sub = (overrides: Partial<Subscription>): Subscription => ({
  id: "s1",
  productId: "p1",
  customer: { name: "ลูกค้า A" },
  billingType: "subscription",
  billingCycle: "monthly",
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  amount: 1000,
  status: "active",
  autoRenew: true,
  ...overrides,
});

const comm = (overrides: Partial<Commission>): Commission => ({
  id: "c1",
  payeeId: "pay1",
  sourceType: "project",
  sourceId: "x",
  basis: "percent",
  ratePercent: 10,
  status: "pending",
  ...overrides,
});

describe("commissionOnAmount", () => {
  it("percent คิด % ของฐาน", () => {
    expect(commissionOnAmount(comm({ basis: "percent", ratePercent: 10 }), 50000)).toBe(5000);
  });
  it("fixed คืนจำนวนคงที่ ไม่สนฐาน", () => {
    expect(commissionOnAmount(comm({ basis: "fixed", fixedAmount: 3000 }), 999999)).toBe(3000);
  });
});

describe("countSubscriptionPayments", () => {
  it("license = 1 งวด", () => {
    expect(countSubscriptionPayments(sub({ billingType: "license", billingCycle: undefined }))).toBe(1);
  });
  it("รายเดือน 1 ปี = 12 งวด", () => {
    expect(countSubscriptionPayments(sub({ billingCycle: "monthly", startDate: "2026-01-01", endDate: "2026-12-31" }))).toBe(12);
  });
  it("รายปี 3 ปี = 3 งวด", () => {
    expect(countSubscriptionPayments(sub({ billingCycle: "yearly", startDate: "2026-01-01", endDate: "2028-12-31" }))).toBe(3);
  });
  it("จำกัดด้วย maxPayments", () => {
    expect(countSubscriptionPayments(sub({ billingCycle: "monthly", startDate: "2026-01-01", endDate: "2026-12-31" }), 6)).toBe(6);
  });
});

describe("estimateCommissionTotal", () => {
  it("project = % ของยอดขาย", () => {
    const c = comm({ sourceType: "project", basis: "percent", ratePercent: 10 });
    expect(estimateCommissionTotal(c, { projectBaseAmount: 200000 })).toBe(20000);
  });
  it("subscription one_time = % ของงวดเดียว", () => {
    const c = comm({ sourceType: "subscription", subscriptionMode: "one_time", basis: "percent", ratePercent: 10 });
    expect(estimateCommissionTotal(c, { subscription: sub({ amount: 1500 }) })).toBe(150);
  });
  it("subscription recurring = % × ทุกงวดตลอดสัญญา", () => {
    const c = comm({ sourceType: "subscription", subscriptionMode: "recurring", basis: "percent", ratePercent: 10 });
    // รายเดือน 12 งวด × 1000 × 10% = 1200
    expect(estimateCommissionTotal(c, { subscription: sub({ amount: 1000, billingCycle: "monthly" }) })).toBe(1200);
  });
  it("subscription recurring + จำกัดงวด", () => {
    const c = comm({ sourceType: "subscription", subscriptionMode: "recurring", basis: "percent", ratePercent: 10, recurringMaxPayments: 3 });
    expect(estimateCommissionTotal(c, { subscription: sub({ amount: 1000, billingCycle: "monthly" }) })).toBe(300);
  });
  it("subscription ที่หาไม่เจอ = 0", () => {
    const c = comm({ sourceType: "subscription" });
    expect(estimateCommissionTotal(c, {})).toBe(0);
  });
});

describe("expandCommissionPayouts", () => {
  const payees: CommissionPayee[] = [{ id: "pay1", name: "เซลส์ A", type: "partner", active: true }];
  const products: Product[] = [{ id: "p1", name: "CRM Pro", billingType: "subscription", billingCycle: "monthly", defaultPrice: 1000, active: true }];
  const project = (id: string, quotationDate: string): Project =>
    ({
      id, name: "โปรเจกต์ " + id, createdAt: "2026-01-01", updatedAt: "2026-01-01",
      quotationDate, workingDaysPerMonth: 20, durationMonths: 1, allocations: [], directCosts: [],
      overheadAllocationMethod: "proportional", overheadAllocationValue: 0, contingencyPercent: 0,
      pricingMode: "cost_plus", fixedPrice: 0, markupPercentage: 0, taxRate: 7, withholdingTaxPercent: 3,
      status: "won", client: { name: "ลูกค้า" }, paymentTerms: { installments: [], paymentDueDays: 30, lateFeePercent: 0 }, phases: [],
    }) as Project;

  it("project: จ่ายครั้งเดียวที่วันออกใบเสนอราคา", () => {
    const c = comm({ sourceType: "project", sourceId: "pr1", basis: "percent", ratePercent: 10 });
    const out = expandCommissionPayouts(
      [c], payees, [project("pr1", "2026-03-15")], [], products,
      new Map([["pr1", 200000]]), "2026-01-01", "2026-12-31"
    );
    expect(out).toHaveLength(1);
    expect(out[0].date).toBe("2026-03-15");
    expect(out[0].amount).toBe(20000);
  });

  it("subscription recurring: 1 payout ต่องวด ตามวันจ่าย", () => {
    const c = comm({ sourceType: "subscription", sourceId: "s1", subscriptionMode: "recurring", basis: "percent", ratePercent: 10 });
    const out = expandCommissionPayouts(
      [c], payees, [], [sub({ id: "s1", amount: 1000, billingCycle: "monthly", startDate: "2026-01-01", endDate: "2026-03-31" })],
      products, new Map(), "2026-01-01", "2026-12-31"
    );
    expect(out).toHaveLength(3);
    expect(out.every((p) => p.amount === 100)).toBe(true);
  });

  it("ข้ามรายการ cancelled และเฉพาะในช่วงที่กำหนด", () => {
    const c1 = comm({ id: "c1", sourceType: "project", sourceId: "pr1", status: "cancelled", ratePercent: 10 });
    const c2 = comm({ id: "c2", sourceType: "project", sourceId: "pr1", ratePercent: 10, payoutDate: "2025-01-01" });
    const out = expandCommissionPayouts(
      [c1, c2], payees, [project("pr1", "2026-03-15")], [], products,
      new Map([["pr1", 100000]]), "2026-01-01", "2026-12-31"
    );
    // c1 cancelled, c2 payoutDate อยู่นอกช่วง → ไม่มี payout
    expect(out).toHaveLength(0);
  });
});

describe("summarizeCommissions", () => {
  it("รวมยอดตามสถานะ + ไม่นับ cancelled + จัดกลุ่มตาม payee", () => {
    const s = summarizeCommissions([
      { payeeId: "a", status: "pending", amount: 1000 },
      { payeeId: "a", status: "paid", amount: 2000 },
      { payeeId: "b", status: "pending", amount: 500 },
      { payeeId: "b", status: "cancelled", amount: 9999 },
    ]);
    expect(s.totalPending).toBe(1500);
    expect(s.totalPaid).toBe(2000);
    expect(s.totalAll).toBe(3500);
    expect(s.countPending).toBe(2);
    expect(s.countPaid).toBe(1);
    // payee a มียอดรวมสูงกว่า (3000) จึงมาก่อน
    expect(s.byPayee[0]).toEqual({ payeeId: "a", total: 3000, count: 2 });
    expect(s.byPayee[1]).toEqual({ payeeId: "b", total: 500, count: 1 });
  });
});
