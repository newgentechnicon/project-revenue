"use client";

import React from "react";
import { Project, PositionRate } from "@/lib/types";
import { CostCalculationResult } from "@/lib/calculations";
import { moduleBreakdown } from "@/lib/project-modules";

const formatNumber = (n: number) =>
  new Intl.NumberFormat("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

const DIRECT_CAT_LABEL: Record<string, string> = {
  license: "ค่า License/ลิขสิทธิ์",
  hosting: "ค่า Hosting/คลาวด์",
  outsource: "งาน Outsource",
  travel: "ค่าเดินทาง",
  other: "อื่น ๆ",
};

interface QuotationModulesSectionProps {
  project: Project;
  positions: PositionRate[];
  calculations: CostCalculationResult;
}

export function QuotationModulesSection({
  project,
  positions,
  calculations,
}: QuotationModulesSectionProps) {
  // แสดงเฉพาะโปรเจกต์ที่ประเมินแบบราย Module และมีโมดูลอยู่
  if (project.estimationMode !== "module" || !project.modules || project.modules.length === 0) {
    return null;
  }

  const bd = moduleBreakdown(project, positions, {
    priceBeforeTax: calculations.priceBeforeTax,
    directCost: calculations.directCost,
    totalProductionCost: calculations.totalProductionCost,
  });
  const totalMandays = bd.modules.reduce((s, r) => s + r.mandays, 0);

  return (
    <div className="space-y-3 pt-4">
      <div className="text-sm font-bold text-slate-700 border-l-4 border-primary pl-2">
        ขอบเขตงานแยกตามโมดูล (Scope by Module)
      </div>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b-2 border-slate-200 text-slate-500 text-left">
            <th className="py-2 font-semibold w-[8%]">โมดูล</th>
            <th className="py-2 font-semibold">รายละเอียด</th>
            <th className="py-2 font-semibold text-center w-[14%]">Mandays</th>
            <th className="py-2 font-semibold text-center w-[12%]">สัดส่วน</th>
            <th className="py-2 font-semibold text-right w-[20%]">มูลค่า (ก่อน VAT)</th>
          </tr>
        </thead>
        <tbody>
          {bd.modules.map((r, idx) => (
            <tr key={r.id} className="border-b border-slate-100 align-top">
              <td className="py-3 pl-2 font-mono text-slate-600">{idx + 1}</td>
              <td className="py-3">
                <div className="font-semibold text-slate-800">{r.name || `โมดูลที่ ${idx + 1}`}</div>
                {r.positionsLabel && (
                  <div className="text-[11px] text-slate-500 mt-0.5">{r.positionsLabel}</div>
                )}
              </td>
              <td className="py-3 text-center font-mono text-slate-700">{r.mandays}</td>
              <td className="py-3 text-center font-mono text-slate-600">{(r.share * 100).toFixed(1)}%</td>
              <td className="py-3 text-right font-mono font-semibold text-slate-800">
                ฿{formatNumber(r.amount)}
              </td>
            </tr>
          ))}
          <tr className="bg-slate-50 font-semibold border-t border-slate-200">
            <td className="py-2.5 pl-2 text-slate-700" colSpan={2}>รวมส่วนงานพัฒนา (แรงงาน)</td>
            <td className="py-2.5 text-center font-mono text-slate-700">{totalMandays}</td>
            <td className="py-2.5" />
            <td className="py-2.5 text-right font-mono text-slate-800">฿{formatNumber(bd.laborPricePool)}</td>
          </tr>
        </tbody>
      </table>

      {/* Direct Costs — ระดับโปรเจกต์ (ไม่ผูกโมดูล) */}
      {bd.directItems.length > 0 && (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b-2 border-slate-200 text-slate-500 text-left">
              <th className="py-2 font-semibold" colSpan={2}>ค่าใช้จ่ายตรงของโครงการ (Direct Costs)</th>
              <th className="py-2 font-semibold text-right w-[20%]">มูลค่า (ก่อน VAT)</th>
            </tr>
          </thead>
          <tbody>
            {bd.directItems.map((d) => (
              <tr key={d.id} className="border-b border-slate-100 align-top">
                <td className="py-3 pl-2" colSpan={2}>
                  <div className="font-semibold text-slate-800">{d.name}</div>
                  {d.category && (
                    <div className="text-[11px] text-slate-500 mt-0.5">{DIRECT_CAT_LABEL[d.category] ?? d.category}</div>
                  )}
                </td>
                <td className="py-3 text-right font-mono text-slate-700">฿{formatNumber(d.cost)}</td>
              </tr>
            ))}
            <tr className="bg-slate-50 font-semibold border-t border-slate-200">
              <td className="py-2.5 pl-2 text-slate-700" colSpan={2}>รวมค่าใช้จ่ายตรง (ราคาทุน)</td>
              <td className="py-2.5 text-right font-mono text-slate-800">฿{formatNumber(bd.directPrice)}</td>
            </tr>
          </tbody>
        </table>
      )}

      {/* Grand total reconcile */}
      <div className="flex justify-end">
        <div className="w-[360px] flex justify-between text-sm font-bold border-t-2 border-slate-300 pt-2">
          <span className="text-slate-700">รวมราคาก่อน VAT:</span>
          <span className="font-mono text-primary">฿{formatNumber(bd.priceBeforeTax)}</span>
        </div>
      </div>

      <p className="text-[10px] text-slate-400">
        * มูลค่าต่อโมดูลเป็นการประมาณการโดยปันราคาส่วนงานพัฒนาตามสัดส่วนปริมาณงาน (แรงงาน) ของแต่ละโมดูล —
        ค่าใช้จ่ายตรงเป็นค่าระดับโครงการ แสดงที่ราคาทุน (ไม่บวกกำไร) รวมกันเท่ากับราคาก่อน VAT ของทั้งโครงการ
      </p>
    </div>
  );
}
