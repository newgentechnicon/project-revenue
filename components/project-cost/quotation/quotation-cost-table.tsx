"use client";

import React from "react";
import { Project } from "@/lib/types";
import { CostCalculationResult } from "@/lib/calculations";

const formatNumber = (n: number) =>
  new Intl.NumberFormat("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);

interface QuotationCostTableProps {
  project: Project;
  calculations: CostCalculationResult;
  showDetailedLabor: boolean;
}

export function QuotationCostTable({ project, calculations, showDetailedLabor }: QuotationCostTableProps) {
  const {
    directCost,
    allocatedOverhead,
    contingencyAmount,
    totalProductionCost,
    markupAmount,
    priceBeforeTax,
    taxAmount,
    finalPrice,
    withholdingTaxAmount,
    netReceivable,
    laborCostBreakdown,
    directCostBreakdown,
  } = calculations;

  return (
    <>
      <div className="space-y-4">
        <div className="text-sm font-bold text-slate-700 border-l-4 border-primary pl-2">
          รายละเอียดค่าใช้จ่ายในการดำเนินงาน
        </div>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b-2 border-slate-200 text-slate-500 text-left">
              <th className="py-2.5 font-semibold">รายการ / คำอธิบาย</th>
              <th className="py-2.5 font-semibold text-center w-[12%]">Mandays</th>
              <th className="py-2.5 font-semibold text-right w-[20%]">เรตเฉลี่ยรายวัน</th>
              <th className="py-2.5 font-semibold text-right w-[25%]">จำนวนเงินรวม</th>
            </tr>
          </thead>
          <tbody>
            {/* 1. Labor */}
            {showDetailedLabor ? (
              laborCostBreakdown
                .filter((l) => l.mandays > 0)
                .map((item) => (
                  <tr key={item.positionId} className="border-b border-slate-100 text-slate-600">
                    <td className="py-3 pl-2">
                      <div className="font-semibold text-slate-800">{item.title}</div>
                      <div className="text-xs text-slate-400">พัฒนาและออกแบบระบบ</div>
                    </td>
                    <td className="py-3 text-center font-mono">{item.mandays}</td>
                    <td className="py-3 text-right font-mono">฿{formatNumber(item.dailyRate)}</td>
                    <td className="py-3 text-right font-semibold font-mono text-slate-800">
                      ฿{formatNumber(item.totalCost)}
                    </td>
                  </tr>
                ))
            ) : (
              <tr className="border-b border-slate-100 text-slate-600">
                <td className="py-3 pl-2">
                  <div className="font-semibold text-slate-800">ค่าพัฒนาและดำเนินการระบบซอฟต์แวร์ (Software Development &amp; Services)</div>
                  <div className="text-xs text-slate-400">
                    ค่าออกแบบ พัฒนา ทดสอบ และบริหารโครงการโดยทีมงานครบวงจร (รวมค่าดำเนินงานทั้งหมด)
                  </div>
                </td>
                <td className="py-3 text-center font-mono">{calculations.totalProjectMandays}</td>
                <td className="py-3 text-right text-slate-400">-</td>
                <td className="py-3 text-right font-semibold font-mono text-slate-800">
                  ฿{formatNumber(priceBeforeTax - directCost)}
                </td>
              </tr>
            )}

            {/* 2. Direct Costs */}
            {directCostBreakdown.length > 0 && (
              <tr className="border-b border-slate-100 text-slate-600">
                <td className="py-3 pl-2">
                  <div className="font-semibold text-slate-800">ค่าใช้จ่ายตรงของโครงการ (Direct Costs)</div>
                  <div className="text-xs text-slate-400">
                    {directCostBreakdown.map((d) => d.name).join(", ")}
                  </div>
                </td>
                <td className="py-3 text-center text-slate-400">-</td>
                <td className="py-3 text-right text-slate-400">-</td>
                <td className="py-3 text-right font-semibold font-mono text-slate-800">
                  ฿{formatNumber(directCost)}
                </td>
              </tr>
            )}

            {showDetailedLabor && (
              <>
            {/* 3. Overhead */}
            <tr className="border-b border-slate-100 text-slate-600">
              <td className="py-3 pl-2">
                <div className="font-semibold text-slate-800">ค่าโสหุ้ยและค่าใช้จ่ายทั่วไปปันส่วน (Overheads)</div>
                <div className="text-xs text-slate-400">
                  ค่าเช่าระบบคลาวด์ ค่าระบบสนับสนุนการทำงาน และค่าบริหารจัดการออฟฟิศ
                </div>
              </td>
              <td className="py-3 text-center text-slate-400">-</td>
              <td className="py-3 text-right text-slate-400">-</td>
              <td className="py-3 text-right font-semibold font-mono text-slate-800">
                ฿{formatNumber(allocatedOverhead)}
              </td>
            </tr>

            {/* 4. Contingency */}
            {contingencyAmount > 0 && (
              <tr className="border-b border-slate-100 text-slate-600">
                <td className="py-3 pl-2">
                  <div className="font-semibold text-slate-800">เงินสำรองความเสี่ยง (Contingency {project.contingencyPercent}%)</div>
                  <div className="text-xs text-slate-400">
                    เผื่อความเสี่ยงจากการเปลี่ยนแปลง scope, อุปกรณ์, และเทคนิคของโครงการ
                  </div>
                </td>
                <td className="py-3 text-center text-slate-400">-</td>
                <td className="py-3 text-right text-slate-400">-</td>
                <td className="py-3 text-right font-semibold font-mono text-slate-800">
                  ฿{formatNumber(contingencyAmount)}
                </td>
              </tr>
            )}

            {/* Subtotal */}
            <tr className="bg-slate-50 font-bold border-b border-slate-200">
              <td className="py-3 pl-2 text-slate-800">รวมต้นทุนการผลิตจริง (Total Production Cost)</td>
              <td className="py-3 text-center font-mono text-slate-700">{calculations.totalProjectMandays}</td>
              <td className="py-3 text-right text-slate-400">-</td>
              <td className="py-3 text-right font-mono text-slate-900">฿{formatNumber(totalProductionCost)}</td>
            </tr>

            {/* Markup / Fixed price difference */}
            {calculations.pricingMode === "fixed_price" ? (
              <tr className="text-slate-600">
                <td className="py-3 pl-2">
                  <div className="font-semibold text-slate-800">
                    {markupAmount >= 0 ? "ส่วนต่างราคาเหมา (กำไรขั้นต้น)" : "ขายต่ำกว่าทุน"}
                  </div>
                  <div className="text-xs text-slate-400">
                    {markupAmount >= 0
                      ? `ราคาขายเหมาสูงกว่าต้นทุน ${calculations.effectiveMarkupPercent.toFixed(1)}%`
                      : `ขายขาดทุน — ราคาต่ำกว่าต้นทุนผลิต`}
                  </div>
                </td>
                <td className="py-3 text-center text-slate-400">-</td>
                <td className="py-3 text-right text-slate-400">-</td>
                <td className={`py-3 text-right font-semibold font-mono ${markupAmount < 0 ? "text-rose-700" : "text-slate-800"}`}>
                  {markupAmount < 0 ? "− " : ""}฿{formatNumber(Math.abs(markupAmount))}
                </td>
              </tr>
            ) : (
              <tr className="text-slate-600">
                <td className="py-3 pl-2">
                  <div className="font-semibold text-slate-800">ส่วนต่างบวกเพิ่มกำไรของบริษัท (Company Markup)</div>
                  <div className="text-xs text-slate-400">
                    อัตราส่วนแบ่งกำไรขั้นต้นสำหรับการดำเนินงานและการพัฒนาธุรกิจ {project.markupPercentage}%
                  </div>
                </td>
                <td className="py-3 text-center text-slate-400">-</td>
                <td className="py-3 text-right text-slate-400">-</td>
                <td className="py-3 text-right font-semibold font-mono text-slate-800">฿{formatNumber(markupAmount)}</td>
              </tr>
            )}
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Totals box */}
      <div className="flex justify-end pt-4">
        <div className="w-[360px] space-y-2 border-t-2 border-slate-300 pt-3 text-sm">
          <div className="flex justify-between font-semibold text-slate-700">
            <span>ราคาก่อนภาษีมูลค่าเพิ่ม:</span>
            <span className="font-mono">฿{formatNumber(priceBeforeTax)}</span>
          </div>
          <div className="flex justify-between text-xs text-slate-500">
            <span>ภาษีมูลค่าเพิ่ม VAT {project.taxRate}%:</span>
            <span className="font-mono">฿{formatNumber(taxAmount)}</span>
          </div>
          <div className="flex justify-between font-black text-lg text-primary border-t border-slate-200 pt-2">
            <span>ยอดเงินเสนอราคาสุทธิ:</span>
            <span className="font-mono">{formatCurrency(finalPrice)}</span>
          </div>
          {project.withholdingTaxPercent > 0 && (
            <>
              <div className="flex justify-between text-xs text-slate-500 pt-1">
                <span>หัก ณ ที่จ่าย {project.withholdingTaxPercent}%:</span>
                <span className="font-mono">฿{formatNumber(withholdingTaxAmount)}</span>
              </div>
              <div className="flex justify-between text-xs font-semibold text-emerald-700 border-t border-dashed border-slate-300 pt-1">
                <span>เงินรับสุทธิหลังหัก ณ ที่จ่าย:</span>
                <span className="font-mono">{formatCurrency(netReceivable)}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
