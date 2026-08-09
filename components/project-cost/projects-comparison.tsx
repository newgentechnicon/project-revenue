"use client";

import React, { useMemo, useState } from "react";
import { Project, PositionRate, OverheadItem } from "@/lib/types";
import { calculateProjectCosts } from "@/lib/calculations";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Plus, GitCompareArrows } from "lucide-react";

interface ProjectsComparisonProps {
  projects: Project[];
  positions: PositionRate[];
  overheads: OverheadItem[];
}

export function ProjectsComparison({ projects, positions, overheads }: ProjectsComparisonProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const formatBaht = (n: number) =>
    new Intl.NumberFormat("th-TH", {
      style: "currency",
      currency: "THB",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n);

  const selected = useMemo(() => {
    return selectedIds
      .map((id) => projects.find((p) => p.id === id))
      .filter((p): p is Project => !!p)
      .map((p) => ({ project: p, calc: calculateProjectCosts(p, positions, overheads) }));
  }, [selectedIds, projects, positions, overheads]);

  const availableProjects = projects.filter((p) => !selectedIds.includes(p.id));

  const togglePick = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : prev.length >= 3 ? prev : [...prev, id]
    );
  };

  const removePick = (id: string) => {
    setSelectedIds((prev) => prev.filter((i) => i !== id));
  };

  if (projects.length < 2) {
    return (
      <Card className="border-border/50 bg-card/50">
        <CardContent className="pt-12 pb-12 text-center text-sm text-muted-foreground">
          ต้องมีอย่างน้อย 2 โครงการขึ้นไปเพื่อเปรียบเทียบ
        </CardContent>
      </Card>
    );
  }

  // Calculate min/max for visual hint
  const findMaxBy = <K extends keyof (typeof selected)[number]["calc"]>(key: K) => {
    if (selected.length === 0) return null;
    return Math.max(...selected.map((s) => s.calc[key] as number));
  };
  const maxFinal = findMaxBy("finalPrice");
  const maxProfit = findMaxBy("netProfit");
  const maxMargin = findMaxBy("netMarginPercent");

  return (
    <div className="space-y-4">
      {/* Picker */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <GitCompareArrows className="h-4 w-4 text-primary" /> เลือกโครงการที่ต้องการเปรียบเทียบ
          </CardTitle>
          <CardDescription>
            เลือกได้สูงสุด 3 โครงการ ({selectedIds.length}/3 ที่เลือก)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Selected chips */}
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3 pb-3 border-b border-border/60">
              {selected.map(({ project }) => (
                <div
                  key={project.id}
                  className="flex items-center gap-1.5 bg-primary/10 border border-primary/30 rounded-full pl-3 pr-1 py-1 text-xs font-medium"
                >
                  <span>{project.name}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removePick(project.id)}
                    className="h-5 w-5 rounded-full hover:bg-primary/20"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Available */}
          <div className="flex flex-wrap gap-2">
            {availableProjects.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                เลือกครบทุกโครงการแล้ว หรือถึงขีดจำกัด 3 โครงการ
              </p>
            ) : (
              availableProjects.map((p) => {
                const disabled = selectedIds.length >= 3;
                return (
                  <Button
                    key={p.id}
                    size="sm"
                    variant="outline"
                    disabled={disabled}
                    onClick={() => togglePick(p.id)}
                    className="gap-1.5 text-xs h-7"
                  >
                    <Plus className="h-3 w-3" /> {p.name}
                  </Button>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Comparison Table */}
      {selected.length < 2 ? (
        <Card className="border-border/50 bg-card/50 border-dashed">
          <CardContent className="pt-12 pb-12 text-center text-sm text-muted-foreground">
            เลือกอย่างน้อย 2 โครงการเพื่อเริ่มเปรียบเทียบ
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-border">
                  <th className="text-left py-3 pr-4 font-semibold text-muted-foreground text-xs uppercase">
                    รายการ
                  </th>
                  {selected.map(({ project }) => (
                    <th key={project.id} className="text-right py-3 px-4 font-semibold min-w-[180px]">
                      <div className="text-foreground">{project.name}</div>
                      <div className="text-[10px] text-muted-foreground font-normal mt-0.5">
                        {project.client?.name || "(ยังไม่ระบุลูกค้า)"}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                <ComparisonRow label="สถานะ" values={selected.map((s) => s.project.status)} />
                <ComparisonRow
                  label="ระยะเวลา (เดือน)"
                  values={selected.map((s) => `${s.project.durationMonths}`)}
                />
                <ComparisonRow
                  label="วันที่ออกใบเสนอราคา"
                  values={selected.map((s) => s.project.quotationDate || "-")}
                />
                <ComparisonRow
                  label="Mandays รวม"
                  values={selected.map((s) => `${s.calc.totalProjectMandays.toFixed(1)} วัน`)}
                />
                <ComparisonHeader label="ต้นทุน" />
                <ComparisonRow
                  label="ค่าแรง"
                  values={selected.map((s) => formatBaht(s.calc.laborCost))}
                />
                <ComparisonRow
                  label="ค่าใช้จ่ายตรง"
                  values={selected.map((s) => formatBaht(s.calc.directCost))}
                />
                <ComparisonRow
                  label="โสหุ้ยปันส่วน"
                  values={selected.map((s) => formatBaht(s.calc.allocatedOverhead))}
                />
                <ComparisonRow
                  label="Contingency"
                  values={selected.map((s) => `${formatBaht(s.calc.contingencyAmount)} (${s.project.contingencyPercent}%)`)}
                />
                <ComparisonRow
                  label="รวมต้นทุน"
                  values={selected.map((s) => formatBaht(s.calc.totalProductionCost))}
                  bold
                />
                <ComparisonHeader label="ราคาขาย" />
                <ComparisonRow
                  label="โหมดราคา"
                  values={selected.map((s) =>
                    s.project.pricingMode === "fixed_price" ? "ขายเหมา" : "Cost + Markup"
                  )}
                />
                <ComparisonRow
                  label="Markup %"
                  values={selected.map((s) =>
                    s.project.pricingMode === "fixed_price"
                      ? `~${s.calc.effectiveMarkupPercent.toFixed(1)}% (effective)`
                      : `${s.project.markupPercentage}%`
                  )}
                />
                <ComparisonRow
                  label="ราคาก่อน VAT"
                  values={selected.map((s) => formatBaht(s.calc.priceBeforeTax))}
                />
                <ComparisonRow
                  label="VAT"
                  values={selected.map((s) => `${formatBaht(s.calc.taxAmount)} (${s.project.taxRate}%)`)}
                />
                <ComparisonRow
                  label="ราคารวม VAT"
                  values={selected.map((s) => formatBaht(s.calc.finalPrice))}
                  bold
                  highlight={selected.map((s) => s.calc.finalPrice === maxFinal)}
                  highlightLabel="สูงสุด"
                />
                <ComparisonRow
                  label="หัก ณ ที่จ่าย"
                  values={selected.map((s) => `${formatBaht(s.calc.withholdingTaxAmount)} (${s.project.withholdingTaxPercent}%)`)}
                />
                <ComparisonRow
                  label="เงินรับสุทธิ"
                  values={selected.map((s) => formatBaht(s.calc.netReceivable))}
                />
                <ComparisonHeader label="กำไร" />
                <ComparisonRow
                  label="กำไรสุทธิ"
                  values={selected.map((s) => formatBaht(s.calc.netProfit))}
                  bold
                  highlight={selected.map((s) => s.calc.netProfit === maxProfit)}
                  highlightLabel="สูงสุด"
                />
                <ComparisonRow
                  label="Net Margin"
                  values={selected.map((s) => `${s.calc.netMarginPercent.toFixed(1)}%`)}
                  highlight={selected.map((s) => s.calc.netMarginPercent === maxMargin)}
                  highlightLabel="สูงสุด"
                />
                <ComparisonRow
                  label="Gross Margin"
                  values={selected.map((s) => `${s.calc.grossMarginPercent.toFixed(1)}%`)}
                />
                <ComparisonHeader label="Phases & งวดเงิน" />
                <ComparisonRow
                  label="จำนวน Phases"
                  values={selected.map((s) => `${s.project.phases.length}`)}
                />
                <ComparisonRow
                  label="จำนวนงวดเงิน"
                  values={selected.map((s) => `${s.project.paymentTerms.installments.length}`)}
                />
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ComparisonRow({
  label,
  values,
  bold = false,
  highlight,
  highlightLabel,
}: {
  label: string;
  values: string[];
  bold?: boolean;
  highlight?: boolean[];
  highlightLabel?: string;
}) {
  return (
    <tr>
      <td className="py-2.5 pr-4 text-xs text-muted-foreground">{label}</td>
      {values.map((v, idx) => (
        <td
          key={idx}
          className={`py-2.5 px-4 text-right font-mono ${
            bold ? "font-bold text-foreground" : "text-foreground/90"
          }`}
        >
          <div className="flex items-center justify-end gap-2">
            {highlight && highlight[idx] && highlightLabel && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900">
                {highlightLabel}
              </span>
            )}
            <span>{v}</span>
          </div>
        </td>
      ))}
    </tr>
  );
}

function ComparisonHeader({ label }: { label: string }) {
  return (
    <tr className="bg-muted/30">
      <td colSpan={99} className="py-2 px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </td>
    </tr>
  );
}
