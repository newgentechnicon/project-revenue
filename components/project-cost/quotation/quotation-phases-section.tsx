"use client";

import React from "react";
import { Project } from "@/lib/types";
import { CostCalculationResult } from "@/lib/calculations";

const formatNumber = (n: number) =>
  new Intl.NumberFormat("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

interface QuotationPhasesSectionProps {
  project: Project;
  calculations: CostCalculationResult;
}

export function QuotationPhasesSection({ project, calculations }: QuotationPhasesSectionProps) {
  if (project.phases.length === 0) return null;

  return (
    <div className="space-y-3 pt-4">
      <div className="text-sm font-bold text-slate-700 border-l-4 border-primary pl-2">
        แผนการดำเนินงานและกำหนดส่งมอบ (Phases & Milestones)
      </div>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b-2 border-slate-200 text-slate-500 text-left">
            <th className="py-2 font-semibold w-[8%]">เฟส</th>
            <th className="py-2 font-semibold">ชื่อเฟสและผลลัพธ์</th>
            <th className="py-2 font-semibold text-center w-[15%]">% Mandays</th>
            <th className="py-2 font-semibold text-center w-[18%]">กำหนดส่งมอบ</th>
            <th className="py-2 font-semibold text-right w-[18%]">ราคาเฟสนี้</th>
          </tr>
        </thead>
        <tbody>
          {project.phases.map((phase, idx) => {
            const phaseAmount = (calculations.priceBeforeTax * (phase.mandayPercent || 0)) / 100;
            return (
              <tr key={phase.id} className="border-b border-slate-100 align-top">
                <td className="py-3 pl-2 font-mono text-slate-600">{idx + 1}</td>
                <td className="py-3">
                  <div className="font-semibold text-slate-800">{phase.name}</div>
                  {phase.description && (
                    <div className="text-[11px] text-slate-500 mt-0.5">{phase.description}</div>
                  )}
                  {phase.deliverables.length > 0 && (
                    <ul className="text-[11px] text-slate-600 mt-1.5 list-disc list-inside space-y-0.5">
                      {phase.deliverables.map((d, i) => (
                        <li key={i}>{d}</li>
                      ))}
                    </ul>
                  )}
                </td>
                <td className="py-3 text-center font-mono text-slate-700">
                  {(phase.mandayPercent || 0).toFixed(1)}%
                </td>
                <td className="py-3 text-center text-xs text-slate-600">
                  {phase.milestoneDate
                    ? new Date(phase.milestoneDate).toLocaleDateString("th-TH", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })
                    : "-"}
                </td>
                <td className="py-3 text-right font-mono font-semibold text-slate-800">
                  ฿{formatNumber(phaseAmount)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
