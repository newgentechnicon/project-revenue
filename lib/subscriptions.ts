import { Product, Subscription, SubscriptionStatus } from "./types";

/**
 * Recurring revenue helpers — MRR/ARR, expiry tracking, และ inflow expansion
 * สำหรับ cashflow
 *
 * หลักการ:
 *  - subscription รายเดือน  → MRR += amount
 *  - subscription รายปี     → MRR += amount / 12
 *  - license (จ่ายก้อนเดียว) → ไม่นับใน MRR (เป็น one-time) แต่นับใน "รายรับรับรู้"
 *    เฉลี่ยตามอายุสัญญา (recognized revenue) แยกต่างหาก
 *
 * ทุกฟังก์ชันรับ `todayISO` เข้ามาเพื่อให้ test ได้ deterministic
 * (ไม่เรียก new Date() ภายในเมื่อหลีกเลี่ยงได้)
 */

const MS_PER_DAY = 86_400_000;

export function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

/** จำนวนวันจนถึงวันหมดอายุ (ลบ = หมดอายุไปแล้ว n วัน) เทียบกับ todayISO */
export function daysUntilExpiry(sub: Subscription, today: string = todayISO()): number {
  const end = Date.parse(sub.endDate + "T00:00:00Z");
  const now = Date.parse(today + "T00:00:00Z");
  if (Number.isNaN(end) || Number.isNaN(now)) return 0;
  return Math.round((end - now) / MS_PER_DAY);
}

/**
 * สถานะที่ "มีผลจริง" ณ วันที่ today — ต่อยอดจาก status ที่บันทึกไว้:
 *  - ถ้า cancelled ก็ยังคง cancelled
 *  - ถ้าเลยวันหมดอายุแล้ว ถือว่า expired (แม้ field จะเป็น active)
 *  - ถ้ายังไม่ถึง startDate และ status = trial ก็คง trial
 *  - ที่เหลือใช้ค่า status เดิม
 */
export function effectiveStatus(
  sub: Subscription,
  today: string = todayISO()
): SubscriptionStatus {
  if (sub.status === "cancelled") return "cancelled";
  if (today > sub.endDate) return "expired";
  if (sub.status === "trial") return "trial";
  return "active";
}

/** subscription นี้สร้างรายรับต่อเนื่องอยู่หรือไม่ ณ วันที่ today */
export function isActiveRecurring(
  sub: Subscription,
  today: string = todayISO()
): boolean {
  return sub.billingType === "subscription" && effectiveStatus(sub, today) === "active";
}

/** แปลงราคา subscription เป็นรายรับต่อเดือน (normalize รายปี → /12) */
export function monthlyRecurring(sub: Subscription): number {
  if (sub.billingType !== "subscription") return 0;
  if (sub.billingCycle === "yearly") return sub.amount / 12;
  return sub.amount; // default รายเดือน
}

export interface RevenueSummary {
  /** Monthly Recurring Revenue — เฉพาะ subscription ที่ active */
  mrr: number;
  /** Annual Recurring Revenue = MRR × 12 */
  arr: number;
  /** จำนวนลูกค้า/สัญญาที่ active (รวม license ที่ยังไม่หมดอายุ) */
  activeCount: number;
  /** จำนวน subscription แบบ recurring ที่ active */
  recurringCount: number;
  /** จำนวน license (จ่ายก้อน) ที่ยังไม่หมดอายุ */
  activeLicenseCount: number;
  /** จำนวนที่ใกล้หมดอายุภายใน thresholdDays */
  expiringSoonCount: number;
  /** จำนวนที่หมดอายุไปแล้ว */
  expiredCount: number;
  /** มูลค่าสัญญารวมของรายการที่ active (license amount + subscription/รอบ) */
  activeContractValue: number;
}

export function summarizeRevenue(
  subs: Subscription[],
  today: string = todayISO(),
  thresholdDays = 30
): RevenueSummary {
  let mrr = 0;
  let activeCount = 0;
  let recurringCount = 0;
  let activeLicenseCount = 0;
  let expiringSoonCount = 0;
  let expiredCount = 0;
  let activeContractValue = 0;

  for (const sub of subs) {
    const status = effectiveStatus(sub, today);
    if (status === "expired") {
      expiredCount++;
      continue;
    }
    if (status === "cancelled") continue;

    // active หรือ trial
    activeCount++;
    activeContractValue += sub.amount;

    if (sub.billingType === "subscription") {
      recurringCount++;
      if (status === "active") mrr += monthlyRecurring(sub);
    } else {
      activeLicenseCount++;
    }

    const days = daysUntilExpiry(sub, today);
    if (days >= 0 && days <= thresholdDays) expiringSoonCount++;
  }

  return {
    mrr,
    arr: mrr * 12,
    activeCount,
    recurringCount,
    activeLicenseCount,
    expiringSoonCount,
    expiredCount,
    activeContractValue,
  };
}

export interface SubscriptionInflow {
  subscriptionId: string;
  customerName: string;
  productName: string;
  /** ISO yyyy-mm-dd ของวันที่คาดว่าจะได้รับเงิน */
  date: string;
  amount: number;
  kind: "license" | "subscription";
}

/**
 * กระจาย subscription เป็นรายการ inflow ตามช่วงเวลา [from, to] (ISO)
 *  - license: inflow ครั้งเดียว ณ paymentReceivedDate (หรือ startDate) เป็นจำนวน amount
 *  - subscription รายเดือน: inflow ทุกเดือนตั้งแต่ startDate จนถึง endDate
 *  - subscription รายปี: inflow ทุกปี (ครบรอบจากวัน startDate) จนถึง endDate
 *
 * คืนเฉพาะ inflow ที่ตกอยู่ในช่วง [from, to]
 */
export function expandSubscriptionInflows(
  subs: Subscription[],
  products: Product[],
  from: string,
  to: string
): SubscriptionInflow[] {
  const productName = new Map(products.map((p) => [p.id, p.name]));
  const out: SubscriptionInflow[] = [];

  for (const sub of subs) {
    if (sub.status === "cancelled") continue;
    const name = productName.get(sub.productId) ?? "สินค้า/แพ็กเกจ";

    const push = (dateISO: string, amount: number, kind: SubscriptionInflow["kind"]) => {
      if (amount <= 0) return;
      if (dateISO < from || dateISO > to) return;
      out.push({
        subscriptionId: sub.id,
        customerName: sub.customer.name,
        productName: name,
        date: dateISO,
        amount,
        kind,
      });
    };

    if (sub.billingType === "license") {
      push(sub.paymentReceivedDate || sub.startDate, sub.amount, "license");
      continue;
    }

    // subscription — เดินทีละรอบจาก startDate จนถึง endDate
    const start = new Date(sub.startDate + "T00:00:00Z");
    const end = new Date(sub.endDate + "T00:00:00Z");
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
    const stepMonths = sub.billingCycle === "yearly" ? 12 : 1;

    const cursor = new Date(start);
    let guard = 0;
    while (cursor.getTime() <= end.getTime() && guard < 1200) {
      push(cursor.toISOString().split("T")[0], sub.amount, "subscription");
      cursor.setUTCMonth(cursor.getUTCMonth() + stepMonths);
      guard++;
    }
  }

  return out;
}
