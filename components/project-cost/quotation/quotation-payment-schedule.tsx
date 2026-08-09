"use client";

import React from "react";
import { Project } from "@/lib/types";
import { CostCalculationResult } from "@/lib/calculations";

const formatNumber = (n: number) =>
  new Intl.NumberFormat("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

interface QuotationPaymentScheduleProps {
  project: Project;
  calculations: CostCalculationResult;
}

export function QuotationPaymentSchedule({ project, calculations }: QuotationPaymentScheduleProps) {
  const installments = project.paymentTerms.installments;
  if (installments.length === 0) return null;

  const rows = installments.map((inst) => ({
    ...inst,
    amount: (calculations.finalPrice * (inst.percent || 0)) / 100,
  }));

  return (
    <div className="space-y-3 pt-4">
      <div className="text-sm font-bold text-slate-700 border-l-4 border-primary pl-2">
        เงื่อนไขและกำหนดการชำระเงิน
      </div>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b-2 border-slate-200 text-slate-500 text-left">
            <th className="py-2 font-semibold w-[10%]">งวดที่</th>
            <th className="py-2 font-semibold">รายละเอียด</th>
            <th className="py-2 font-semibold text-center w-[20%]">ครบกำหนด</th>
            <th className="py-2 font-semibold text-center w-[10%]">% ยอด</th>
            <th className="py-2 font-semibold text-right w-[20%]">จำนวนเงิน</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((inst, idx) => (
            <tr key={inst.id} className="border-b border-slate-100">
              <td className="py-2.5 pl-2 font-mono text-slate-600">{idx + 1}</td>
              <td className="py-2.5">
                <div className="font-semibold text-slate-800">{inst.name}</div>
                {inst.description && (
                  <div className="text-[11px] text-slate-500">{inst.description}</div>
                )}
              </td>
              <td className="py-2.5 text-center text-xs text-slate-600">
                {inst.dueAfterDays === 0 ? "เมื่อเซ็นสัญญา" : `+${inst.dueAfterDays} วัน`}
              </td>
              <td className="py-2.5 text-center font-mono text-slate-700">{inst.percent}%</td>
              <td className="py-2.5 text-right font-mono font-semibold text-slate-800">
                ฿{formatNumber(inst.amount)}
              </td>
            </tr>
          ))}
          <tr className="bg-slate-50 font-bold">
            <td colSpan={3} className="py-2.5 pl-2 text-slate-800">รวม</td>
            <td className="py-2.5 text-center font-mono text-slate-800">
              {installments.reduce((s, i) => s + (i.percent || 0), 0).toFixed(1)}%
            </td>
            <td className="py-2.5 text-right font-mono text-primary">
              ฿{formatNumber(rows.reduce((s, i) => s + i.amount, 0))}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="text-[11px] text-slate-500 space-y-1 pt-1">
        <div>
          • เครดิตการชำระเงินหลังออกใบแจ้งหนี้:{" "}
          <strong>{project.paymentTerms.paymentDueDays} วัน</strong>
        </div>
        {project.paymentTerms.lateFeePercent > 0 && (
          <div>
            • ค่าปรับล่าช้า: <strong>{project.paymentTerms.lateFeePercent}% ต่อเดือน</strong>
          </div>
        )}
        {project.paymentTerms.notes && (
          <div className="pt-1 whitespace-pre-line">{project.paymentTerms.notes}</div>
        )}
      </div>
    </div>
  );
}
