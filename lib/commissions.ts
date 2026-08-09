import { Commission, Subscription, CommissionStatus, CommissionPayee, Project, Product } from "./types";

/**
 * Commission calculation helpers — บริสุทธิ์ (pure) เพื่อ test ได้
 *
 *  - project / subscription one_time: จ่ายครั้งเดียว
 *  - subscription recurring: จ่าย % ของทุกงวดที่ลูกค้าจ่าย (จำกัดจำนวนงวดได้)
 */

/** คอมต่อ 1 งวด/1 ครั้ง จากฐานเงิน baseAmount */
export function commissionOnAmount(c: Commission, baseAmount: number): number {
  if (c.basis === "fixed") return c.fixedAmount ?? 0;
  return baseAmount * ((c.ratePercent ?? 0) / 100);
}

/**
 * จำนวนงวดที่ subscription จ่ายเงินตลอดสัญญา
 *  - license = 1 ครั้ง
 *  - monthly/yearly = นับรอบจาก startDate ถึง endDate
 * จำกัดด้วย maxPayments ถ้าระบุ
 */
export function countSubscriptionPayments(sub: Subscription, maxPayments?: number): number {
  let count: number;
  if (sub.billingType === "license") {
    count = 1;
  } else {
    const start = new Date(sub.startDate + "T00:00:00Z");
    const end = new Date(sub.endDate + "T00:00:00Z");
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
    const step = sub.billingCycle === "yearly" ? 12 : 1;
    count = 0;
    const cursor = new Date(start);
    let guard = 0;
    while (cursor.getTime() <= end.getTime() && guard < 1200) {
      count++;
      cursor.setUTCMonth(cursor.getUTCMonth() + step);
      guard++;
    }
  }
  if (maxPayments && maxPayments > 0) return Math.min(count, maxPayments);
  return count;
}

export interface CommissionSourceInfo {
  /** ยอดขายโครงการ (ก่อน VAT) — ใช้เมื่อ sourceType = 'project' */
  projectBaseAmount?: number;
  /** subscription ที่ผูก — ใช้เมื่อ sourceType = 'subscription' */
  subscription?: Subscription;
}

/**
 * ประเมินค่าคอมรวมของรายการคอม 1 รายการ (ตลอดสัญญา)
 */
export function estimateCommissionTotal(c: Commission, source: CommissionSourceInfo): number {
  if (c.sourceType === "project") {
    return commissionOnAmount(c, source.projectBaseAmount ?? 0);
  }
  // subscription
  const sub = source.subscription;
  if (!sub) return 0;
  const perPayment = commissionOnAmount(c, sub.amount);
  if (c.subscriptionMode === "recurring") {
    return perPayment * countSubscriptionPayments(sub, c.recurringMaxPayments);
  }
  return perPayment; // one_time (default)
}

export interface CommissionSummary {
  totalAll: number;        // pending + paid (ไม่รวม cancelled)
  totalPending: number;
  totalPaid: number;
  countPending: number;
  countPaid: number;
  byPayee: Array<{ payeeId: string; total: number; count: number }>;
}

/** รายการคอมที่ผ่านการประเมินยอดแล้ว (ใช้สรุป) */
export interface ScoredCommission {
  payeeId: string;
  status: CommissionStatus;
  amount: number;
}

export function summarizeCommissions(items: ScoredCommission[]): CommissionSummary {
  let totalPending = 0;
  let totalPaid = 0;
  let countPending = 0;
  let countPaid = 0;
  const payeeMap = new Map<string, { total: number; count: number }>();

  for (const it of items) {
    if (it.status === "cancelled") continue;
    if (it.status === "pending") {
      totalPending += it.amount;
      countPending++;
    } else if (it.status === "paid") {
      totalPaid += it.amount;
      countPaid++;
    }
    const cur = payeeMap.get(it.payeeId) ?? { total: 0, count: 0 };
    cur.total += it.amount;
    cur.count++;
    payeeMap.set(it.payeeId, cur);
  }

  const byPayee = Array.from(payeeMap.entries())
    .map(([payeeId, v]) => ({ payeeId, total: v.total, count: v.count }))
    .sort((a, b) => b.total - a.total);

  return {
    totalAll: totalPending + totalPaid,
    totalPending,
    totalPaid,
    countPending,
    countPaid,
    byPayee,
  };
}

export interface CommissionPayout {
  commissionId: string;
  payeeName: string;
  label: string;   // แหล่งที่มา (ชื่อโครงการ / ลูกค้า·สินค้า)
  date: string;    // ISO yyyy-mm-dd ของวันจ่ายคอม
  amount: number;
}

/** วันจ่ายเงินของ subscription ตลอดสัญญา (ISO) */
function subscriptionPaymentDates(sub: Subscription): string[] {
  if (sub.billingType === "license") {
    return [sub.paymentReceivedDate || sub.startDate];
  }
  const start = new Date(sub.startDate + "T00:00:00Z");
  const end = new Date(sub.endDate + "T00:00:00Z");
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  const step = sub.billingCycle === "yearly" ? 12 : 1;
  const dates: string[] = [];
  const cursor = new Date(start);
  let guard = 0;
  while (cursor.getTime() <= end.getTime() && guard < 1200) {
    dates.push(cursor.toISOString().split("T")[0]);
    cursor.setUTCMonth(cursor.getUTCMonth() + step);
    guard++;
  }
  return dates;
}

/**
 * กระจายรายการคอมเป็นเหตุการณ์จ่ายเงิน (outflow) ในช่วง [from, to]
 *  - project: จ่ายครั้งเดียว ณ payoutDate (หรือวันออกใบเสนอราคา) = % ของยอดขาย
 *  - subscription one_time: จ่ายครั้งเดียว ณ payoutDate (หรือวันเริ่ม) = % ของงวดแรก
 *  - subscription recurring: จ่ายทุกงวดตามวันจ่ายของลูกค้า (จำกัดจำนวนงวดได้)
 * ข้ามรายการที่ cancelled
 */
export function expandCommissionPayouts(
  commissions: Commission[],
  payees: CommissionPayee[],
  projects: Project[],
  subscriptions: Subscription[],
  products: Product[],
  projectBaseById: Map<string, number>,
  from: string,
  to: string
): CommissionPayout[] {
  const payeeName = new Map(payees.map((p) => [p.id, p.name]));
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const subById = new Map(subscriptions.map((s) => [s.id, s]));
  const productName = new Map(products.map((p) => [p.id, p.name]));
  const out: CommissionPayout[] = [];

  for (const c of commissions) {
    if (c.status === "cancelled") continue;
    const name = payeeName.get(c.payeeId) ?? "ผู้รับคอม";

    const push = (dateISO: string, amount: number, label: string) => {
      if (amount <= 0) return;
      if (dateISO < from || dateISO > to) return;
      out.push({ commissionId: c.id, payeeName: name, label, date: dateISO, amount });
    };

    if (c.sourceType === "project") {
      const project = projectById.get(c.sourceId);
      if (!project) continue;
      const base = projectBaseById.get(c.sourceId) ?? 0;
      const date = c.payoutDate || project.quotationDate || project.startDate || from;
      push(date, commissionOnAmount(c, base), project.name);
      continue;
    }

    // subscription
    const sub = subById.get(c.sourceId);
    if (!sub) continue;
    const label = `${sub.customer.name} · ${productName.get(sub.productId) ?? "—"}`;
    const perPayment = commissionOnAmount(c, sub.amount);

    if (c.subscriptionMode === "recurring") {
      let dates = subscriptionPaymentDates(sub);
      if (c.recurringMaxPayments && c.recurringMaxPayments > 0) {
        dates = dates.slice(0, c.recurringMaxPayments);
      }
      for (const d of dates) push(d, perPayment, label);
    } else {
      // one_time
      const date = c.payoutDate || sub.paymentReceivedDate || sub.startDate;
      push(date, perPayment, label);
    }
  }

  return out;
}
