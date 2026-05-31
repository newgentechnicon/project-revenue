/**
 * Loan helpers — สรุปเงินกู้ยืม (หนี้สิน) + การผ่อนชำระ
 *
 * เงินกู้คือ "หนี้สิน" ไม่ใช่รายได้ — แยกจาก ledger ที่บันทึกเงินสดเข้า/ออกจริง
 * ที่นี่ใช้ติดตามยอดเงินต้นคงเหลือ + ดอกเบี้ยที่จ่ายไปแล้ว
 */

import type { Loan, LoanLenderType, LoanRepayment } from "./types";

export const LOAN_LENDER_TYPE_LABELS: Record<LoanLenderType, string> = {
  bank: "ธนาคาร",
  related_company: "บริษัทในเครือ/เพื่อน",
  individual: "บุคคล",
  other: "อื่น ๆ",
};

export const LOAN_STATUS_LABELS: Record<Loan["status"], string> = {
  active: "กำลังผ่อน",
  paid_off: "ปิดยอดแล้ว",
};

/** งวดนี้จ่ายแล้วหรือยัง — รายการเก่าที่ไม่มี status ถือว่าจ่ายแล้ว */
export function isRepaymentPaid(r: LoanRepayment): boolean {
  return r.status !== "pending";
}

/** รวมส่วนเงินต้นที่ "จ่ายแล้ว" ของเงินกู้ก้อนหนึ่ง */
export function principalPaid(loan: Loan): number {
  return loan.repayments.reduce((s, r) => s + (isRepaymentPaid(r) ? r.principal || 0 : 0), 0);
}

/** รวมดอกเบี้ยที่ "จ่ายแล้ว" ของเงินกู้ก้อนหนึ่ง */
export function interestPaid(loan: Loan): number {
  return loan.repayments.reduce((s, r) => s + (isRepaymentPaid(r) ? r.interest || 0 : 0), 0);
}

/** ยอดงวดที่ "ยังไม่จ่าย" (เงินต้น + ดอก ตามแผน) */
export function scheduledUnpaid(loan: Loan): number {
  return loan.repayments.reduce(
    (s, r) => s + (isRepaymentPaid(r) ? 0 : (r.principal || 0) + (r.interest || 0)),
    0
  );
}

/** ยอดเงินต้นคงเหลือ (ไม่ติดลบ) */
export function outstandingPrincipal(loan: Loan): number {
  return Math.max(0, loan.principal - principalPaid(loan));
}

export interface LoanSummary {
  totalBorrowed: number;       // เงินต้นรวมทุกก้อน
  totalOutstanding: number;    // เงินต้นคงเหลือรวม (หนี้ที่ยังต้องจ่าย)
  totalPrincipalPaid: number;  // เงินต้นที่จ่ายคืนไปแล้วรวม
  totalInterestPaid: number;   // ดอกเบี้ยจ่ายสะสมรวม
  totalScheduledUnpaid: number; // ยอดงวดที่ยังไม่จ่าย (ตามแผน) รวมทุกก้อน
  activeCount: number;
  paidOffCount: number;
}

export function summarizeLoans(loans: Loan[]): LoanSummary {
  const s: LoanSummary = {
    totalBorrowed: 0,
    totalOutstanding: 0,
    totalPrincipalPaid: 0,
    totalInterestPaid: 0,
    totalScheduledUnpaid: 0,
    activeCount: 0,
    paidOffCount: 0,
  };
  for (const loan of loans) {
    s.totalBorrowed += loan.principal;
    s.totalOutstanding += outstandingPrincipal(loan);
    s.totalPrincipalPaid += principalPaid(loan);
    s.totalInterestPaid += interestPaid(loan);
    s.totalScheduledUnpaid += scheduledUnpaid(loan);
    if (loan.status === "paid_off") s.paidOffCount++;
    else s.activeCount++;
  }
  return s;
}

/** new id helpers — ใช้ index กันชนตอนสร้างหลายงวดรวดเดียว */
export function newRepaymentId(seed = 0): string {
  return "rpm_" + Date.now() + (seed ? "_" + seed : "");
}

/** เรียงงวดผ่อนจากใหม่ → เก่า */
export function sortRepayments(repayments: LoanRepayment[]): LoanRepayment[] {
  return [...repayments].sort((a, b) => b.date.localeCompare(a.date));
}
