/**
 * Ledger helpers — สรุปรายการเดินบัญชี (เงินเข้า/ออกจริง)
 *
 * แยกจาก cashflow.ts ที่เป็น *projection* — ledger คือเงินที่เกิดขึ้น *จริง*
 * ฟังก์ชัน reconcile ใช้เทียบจริง vs ประมาณการ (actual vs projected)
 */

import { format, parseISO } from "date-fns";
import type { LedgerCategory, LedgerEntry } from "./types";
import type { CashflowMonth } from "./cashflow";

export const LEDGER_CATEGORY_LABELS: Record<LedgerCategory, string> = {
  project_payment: "รับเงินโครงการ",
  subscription: "รายรับประจำ",
  commission: "ค่าคอมมิชชั่น",
  salary: "เงินเดือน/ค่าแรง",
  overhead: "ค่าใช้จ่ายส่วนกลาง",
  tax: "ภาษี",
  refund: "คืนเงิน",
  loan_received: "รับเงินกู้",
  loan_principal: "จ่ายคืนเงินต้น",
  loan_interest: "ดอกเบี้ยจ่าย",
  other: "อื่น ๆ",
};

export interface LedgerSummary {
  totalIn: number;
  totalOut: number;
  net: number;           // totalIn - totalOut
  countIn: number;
  countOut: number;
}

export function summarizeLedger(entries: LedgerEntry[]): LedgerSummary {
  let totalIn = 0;
  let totalOut = 0;
  let countIn = 0;
  let countOut = 0;
  for (const e of entries) {
    if (e.direction === "in") {
      totalIn += e.amount;
      countIn++;
    } else {
      totalOut += e.amount;
      countOut++;
    }
  }
  return { totalIn, totalOut, net: totalIn - totalOut, countIn, countOut };
}

export interface LedgerCategoryBreakdown {
  category: LedgerCategory;
  label: string;
  direction: "in" | "out";
  total: number;
  count: number;
}

/** รวมยอดแยกตามหมวด (เรียงจากมากไปน้อย) */
export function groupByCategory(entries: LedgerEntry[]): LedgerCategoryBreakdown[] {
  const map = new Map<string, LedgerCategoryBreakdown>();
  for (const e of entries) {
    const key = `${e.direction}:${e.category}`;
    const existing = map.get(key);
    if (existing) {
      existing.total += e.amount;
      existing.count++;
    } else {
      map.set(key, {
        category: e.category,
        label: LEDGER_CATEGORY_LABELS[e.category],
        direction: e.direction,
        total: e.amount,
        count: 1,
      });
    }
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

export interface LedgerMonth {
  monthKey: string;      // "2026-05"
  monthLabel: string;    // "May 26"
  inflow: number;
  outflow: number;
  net: number;
  cumulative: number;    // ยอดสะสม (running balance)
}

/**
 * รวมรายการเป็นรายเดือนตามวันที่เกิดรายการ + คำนวณยอดสะสม
 * @param openingBalance ยอดยกมาต้นงวด (default 0)
 */
export function summarizeLedgerByMonth(
  entries: LedgerEntry[],
  openingBalance = 0
): LedgerMonth[] {
  const buckets = new Map<string, LedgerMonth>();

  for (const e of entries) {
    if (!e.date) continue;
    let d: Date;
    try {
      d = parseISO(e.date);
      if (Number.isNaN(d.getTime())) continue;
    } catch {
      continue;
    }
    const monthKey = format(d, "yyyy-MM");
    let bucket = buckets.get(monthKey);
    if (!bucket) {
      bucket = {
        monthKey,
        monthLabel: format(d, "MMM yy"),
        inflow: 0,
        outflow: 0,
        net: 0,
        cumulative: 0,
      };
      buckets.set(monthKey, bucket);
    }
    if (e.direction === "in") bucket.inflow += e.amount;
    else bucket.outflow += e.amount;
  }

  const months = [...buckets.values()].sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  let running = openingBalance;
  for (const m of months) {
    m.net = m.inflow - m.outflow;
    running += m.net;
    m.cumulative = running;
  }
  return months;
}

// ====================================================
// สำรองจ่าย / เบิกคืน (reimbursable advances)
// ====================================================
export interface ReimbursementSummary {
  pendingCount: number;
  pendingTotal: number;     // ยอดที่ยังค้างเบิกคืน
  reimbursedCount: number;
  reimbursedTotal: number;  // ยอดที่เบิกคืนแล้ว
}

/** เป็นรายการสำรองจ่ายที่ยังไม่เบิกคืน */
export function isPendingReimbursement(e: LedgerEntry): boolean {
  return !!e.reimbursable && e.reimbursementStatus !== "reimbursed";
}

/** สรุปยอดสำรองจ่าย: ค้างเบิก vs เบิกคืนแล้ว */
export function summarizeReimbursements(entries: LedgerEntry[]): ReimbursementSummary {
  const s: ReimbursementSummary = {
    pendingCount: 0,
    pendingTotal: 0,
    reimbursedCount: 0,
    reimbursedTotal: 0,
  };
  for (const e of entries) {
    if (!e.reimbursable) continue;
    if (e.reimbursementStatus === "reimbursed") {
      s.reimbursedCount++;
      s.reimbursedTotal += e.amount;
    } else {
      s.pendingCount++;
      s.pendingTotal += e.amount;
    }
  }
  return s;
}

/** กรองรายการตามเดือน (yyyy-MM) ตามวันที่เกิดรายการ */
export function filterByMonth(entries: LedgerEntry[], monthKey: string): LedgerEntry[] {
  return entries.filter((e) => {
    if (!e.date) return false;
    try {
      const d = parseISO(e.date);
      if (Number.isNaN(d.getTime())) return false;
      return format(d, "yyyy-MM") === monthKey;
    } catch {
      return false;
    }
  });
}

/** รายชื่อเดือน (yyyy-MM) ที่มีรายการ เรียงใหม่→เก่า — ใช้ทำตัวเลือก export */
export function listMonthKeys(entries: LedgerEntry[]): string[] {
  const keys = new Set<string>();
  for (const e of entries) {
    if (!e.date) continue;
    try {
      const d = parseISO(e.date);
      if (Number.isNaN(d.getTime())) continue;
      keys.add(format(d, "yyyy-MM"));
    } catch {
      // ignore
    }
  }
  return [...keys].sort((a, b) => b.localeCompare(a));
}

export interface ReconcileRow {
  monthKey: string;
  monthLabel: string;
  projectedInflow: number;
  actualInflow: number;
  inflowVariance: number;   // actual - projected (บวก = เก็บได้มากกว่าคาด)
  projectedOutflow: number;
  actualOutflow: number;
  outflowVariance: number;  // actual - projected (บวก = จ่ายมากกว่าคาด)
}

/**
 * เทียบ "จริง (ledger) vs ประมาณการ (cashflow projection)" รายเดือน
 * รวม month keys จากทั้งสองฝั่ง — เดือนที่มีแค่ฝั่งใดฝั่งหนึ่งจะเติม 0 ให้อีกฝั่ง
 */
export function reconcileActualVsProjected(
  actual: LedgerMonth[],
  projected: CashflowMonth[]
): ReconcileRow[] {
  const rows = new Map<string, ReconcileRow>();

  const ensure = (monthKey: string, monthLabel: string): ReconcileRow => {
    let r = rows.get(monthKey);
    if (!r) {
      r = {
        monthKey,
        monthLabel,
        projectedInflow: 0,
        actualInflow: 0,
        inflowVariance: 0,
        projectedOutflow: 0,
        actualOutflow: 0,
        outflowVariance: 0,
      };
      rows.set(monthKey, r);
    }
    return r;
  };

  for (const p of projected) {
    const monthKey = format(p.monthDate, "yyyy-MM");
    const r = ensure(monthKey, p.monthLabel);
    r.projectedInflow += p.inflow;
    r.projectedOutflow += p.outflow;
  }

  for (const a of actual) {
    const r = ensure(a.monthKey, a.monthLabel);
    r.actualInflow += a.inflow;
    r.actualOutflow += a.outflow;
  }

  const result = [...rows.values()].sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  for (const r of result) {
    r.inflowVariance = r.actualInflow - r.projectedInflow;
    r.outflowVariance = r.actualOutflow - r.projectedOutflow;
  }
  return result;
}
