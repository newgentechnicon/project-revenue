import { describe, it, expect } from "vitest";
import { Product, Subscription } from "./types";
import {
  daysUntilExpiry,
  effectiveStatus,
  monthlyRecurring,
  summarizeRevenue,
  expandSubscriptionInflows,
} from "./subscriptions";

const baseSub = (overrides: Partial<Subscription>): Subscription => ({
  id: "s1",
  productId: "p1",
  customer: { name: "ลูกค้า A" },
  billingType: "subscription",
  billingCycle: "monthly",
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  amount: 1500,
  status: "active",
  autoRenew: true,
  ...overrides,
});

describe("daysUntilExpiry", () => {
  it("คืนจำนวนวันบวกเมื่อยังไม่หมดอายุ", () => {
    const sub = baseSub({ endDate: "2026-06-10" });
    expect(daysUntilExpiry(sub, "2026-06-01")).toBe(9);
  });
  it("คืนค่าลบเมื่อหมดอายุไปแล้ว", () => {
    const sub = baseSub({ endDate: "2026-05-01" });
    expect(daysUntilExpiry(sub, "2026-05-11")).toBe(-10);
  });
});

describe("effectiveStatus", () => {
  it("เป็น expired เมื่อเลยวันหมดอายุ แม้ status = active", () => {
    const sub = baseSub({ endDate: "2026-01-31", status: "active" });
    expect(effectiveStatus(sub, "2026-02-01")).toBe("expired");
  });
  it("คง cancelled ไว้เสมอ", () => {
    const sub = baseSub({ status: "cancelled" });
    expect(effectiveStatus(sub, "2026-06-01")).toBe("cancelled");
  });
  it("active เมื่อยังไม่หมดอายุ", () => {
    const sub = baseSub({ endDate: "2026-12-31" });
    expect(effectiveStatus(sub, "2026-06-01")).toBe("active");
  });
});

describe("monthlyRecurring", () => {
  it("รายเดือนคืน amount ตรงๆ", () => {
    expect(monthlyRecurring(baseSub({ billingCycle: "monthly", amount: 1500 }))).toBe(1500);
  });
  it("รายปีหารด้วย 12", () => {
    expect(monthlyRecurring(baseSub({ billingCycle: "yearly", amount: 36000 }))).toBe(3000);
  });
  it("license ไม่นับเป็น recurring", () => {
    expect(monthlyRecurring(baseSub({ billingType: "license", billingCycle: undefined }))).toBe(0);
  });
});

describe("summarizeRevenue", () => {
  const subs: Subscription[] = [
    baseSub({ id: "a", billingCycle: "monthly", amount: 1500, endDate: "2026-12-31" }),
    baseSub({ id: "b", billingCycle: "yearly", amount: 36000, endDate: "2026-12-31" }),
    baseSub({ id: "c", billingType: "license", billingCycle: undefined, amount: 30000, endDate: "2026-12-31" }),
    baseSub({ id: "d", billingCycle: "monthly", amount: 999, endDate: "2026-03-01", status: "active" }), // expired by today
    baseSub({ id: "e", billingCycle: "monthly", amount: 500, status: "cancelled", endDate: "2026-12-31" }),
  ];
  const today = "2026-06-01";

  it("MRR รวม subscription ที่ active เท่านั้น (1500 + 36000/12)", () => {
    const s = summarizeRevenue(subs, today);
    expect(s.mrr).toBe(1500 + 3000);
    expect(s.arr).toBe((1500 + 3000) * 12);
  });

  it("นับ active / license / expired / cancelled ถูกต้อง", () => {
    const s = summarizeRevenue(subs, today);
    // active: a, b, c (license ยังไม่หมด) → 3
    expect(s.activeCount).toBe(3);
    expect(s.activeLicenseCount).toBe(1);
    expect(s.recurringCount).toBe(2);
    expect(s.expiredCount).toBe(1); // d
  });

  it("นับ expiringSoon ตาม threshold", () => {
    const soon = baseSub({ id: "f", endDate: "2026-06-20", billingCycle: "monthly", amount: 100 });
    const s = summarizeRevenue([soon], "2026-06-01", 30);
    expect(s.expiringSoonCount).toBe(1);
  });
});

describe("expandSubscriptionInflows", () => {
  const products: Product[] = [
    { id: "p1", name: "CRM Pro", billingType: "subscription", billingCycle: "monthly", defaultPrice: 1500, active: true },
  ];

  it("subscription รายเดือนสร้าง inflow ทุกเดือนในช่วง", () => {
    const sub = baseSub({ startDate: "2026-01-01", endDate: "2026-03-31", amount: 1500 });
    const inflows = expandSubscriptionInflows([sub], products, "2026-01-01", "2026-12-31");
    // ม.ค., ก.พ., มี.ค. = 3 รอบ
    expect(inflows).toHaveLength(3);
    expect(inflows.every((i) => i.amount === 1500)).toBe(true);
    expect(inflows[0].date).toBe("2026-01-01");
  });

  it("license สร้าง inflow ครั้งเดียวที่ paymentReceivedDate", () => {
    const sub = baseSub({
      billingType: "license", billingCycle: undefined,
      startDate: "2026-02-01", endDate: "2027-01-31",
      amount: 30000, paymentReceivedDate: "2026-02-05",
    });
    const inflows = expandSubscriptionInflows([sub], products, "2026-01-01", "2026-12-31");
    expect(inflows).toHaveLength(1);
    expect(inflows[0].date).toBe("2026-02-05");
    expect(inflows[0].kind).toBe("license");
  });

  it("ไม่รวมรายการ cancelled", () => {
    const sub = baseSub({ status: "cancelled" });
    expect(expandSubscriptionInflows([sub], products, "2026-01-01", "2026-12-31")).toHaveLength(0);
  });

  it("คืนเฉพาะ inflow ในช่วงที่กำหนด", () => {
    const sub = baseSub({ startDate: "2026-01-01", endDate: "2026-12-31", amount: 1000, billingCycle: "monthly" });
    const inflows = expandSubscriptionInflows([sub], products, "2026-03-01", "2026-05-31");
    // มี.ค., เม.ย., พ.ค. = 3
    expect(inflows).toHaveLength(3);
  });
});
