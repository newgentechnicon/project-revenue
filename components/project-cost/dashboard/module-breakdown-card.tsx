"use client";

import React from "react";
import { Project, PositionRate } from "@/lib/types";
import { CostCalculationResult } from "@/lib/calculations";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { moduleBreakdown } from "@/lib/project-modules";
import { Layers } from "lucide-react";

interface ModuleBreakdownCardProps {
  project: Project;
  positions: PositionRate[];
  calculations: CostCalculationResult;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

const DIRECT_CAT_LABEL: Record<string, string> = {
  license: "License/ลิขสิทธิ์",
  hosting: "Hosting/คลาวด์",
  outsource: "Outsource",
  travel: "ค่าเดินทาง",
  other: "อื่น ๆ",
};

export function ModuleBreakdownCard({ project, positions, calculations }: ModuleBreakdownCardProps) {
  // แสดงเฉพาะเมื่อประเมินแบบราย Module
  if (project.estimationMode !== "module" || !project.modules || project.modules.length === 0) {
    return null;
  }

  const bd = moduleBreakdown(project, positions, {
    priceBeforeTax: calculations.priceBeforeTax,
    directCost: calculations.directCost,
    totalProductionCost: calculations.totalProductionCost,
  });
  const totalMandays = bd.modules.reduce((s, r) => s + r.mandays, 0);
  const totalLabor = bd.modules.reduce((s, r) => s + r.laborCost, 0);

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Layers className="h-5 w-5 text-primary" /> แจกแจงรายโมดูล (Module Breakdown)
        </CardTitle>
        <CardDescription>
          ปริมาณงาน ค่าแรง และมูลค่าโดยประมาณของแต่ละโมดูล ({bd.modules.length} โมดูล)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>โมดูล</TableHead>
                <TableHead className="text-center w-[12%]">Mandays</TableHead>
                <TableHead className="text-right w-[16%]">ค่าแรง</TableHead>
                <TableHead className="w-[22%]">สัดส่วนงาน</TableHead>
                <TableHead className="text-right w-[16%]">มูลค่า (ก่อน VAT)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bd.modules.map((r, idx) => (
                <TableRow key={r.id} className="hover:bg-muted/30 align-top">
                  <TableCell>
                    <div className="font-semibold">{r.name || `โมดูลที่ ${idx + 1}`}</div>
                    {r.positionsLabel && (
                      <div className="text-[11px] text-muted-foreground mt-0.5">{r.positionsLabel}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-center font-mono text-sm">{r.mandays}</TableCell>
                  <TableCell className="text-right font-mono text-sm">฿{fmt(r.laborCost)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.round(r.share * 100)}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-mono text-muted-foreground w-10 text-right">
                        {(r.share * 100).toFixed(0)}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold text-primary">฿{fmt(r.amount)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/40 hover:bg-muted/40 font-semibold border-t border-border/60">
                <TableCell>รวมส่วนงานพัฒนา (แรงงาน)</TableCell>
                <TableCell className="text-center font-mono">{totalMandays}</TableCell>
                <TableCell className="text-right font-mono">฿{fmt(totalLabor)}</TableCell>
                <TableCell />
                <TableCell className="text-right font-mono">฿{fmt(bd.laborPricePool)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {/* Direct Costs — ระดับโปรเจกต์ (เช่น ค่า migrate data) */}
        {bd.directItems.length > 0 && (
          <div className="mt-5">
            <div className="text-sm font-semibold mb-2 text-muted-foreground">
              ค่าใช้จ่ายตรงของโครงการ (Direct Costs) — ไม่ผูกโมดูล
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>รายการ</TableHead>
                    <TableHead className="w-[28%]">หมวด</TableHead>
                    <TableHead className="text-right w-[20%]">ต้นทุน</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bd.directItems.map((d) => (
                    <TableRow key={d.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {d.category ? (DIRECT_CAT_LABEL[d.category] ?? d.category) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">฿{fmt(d.cost)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/40 hover:bg-muted/40 font-semibold border-t border-border/60">
                    <TableCell colSpan={2}>รวมค่าใช้จ่ายตรง (ราคาทุน)</TableCell>
                    <TableCell className="text-right font-mono">฿{fmt(bd.directPrice)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Grand total */}
        <div className="flex justify-end mt-3 pt-3 border-t-2 border-border/60">
          <div className="flex items-center gap-4 text-sm font-bold">
            <span className="text-muted-foreground">รวมราคาก่อน VAT:</span>
            <span className="font-mono text-primary text-base">฿{fmt(bd.priceBeforeTax)}</span>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground mt-3">
          * มูลค่าต่อโมดูลปันราคาส่วนงานพัฒนาตามสัดส่วนปริมาณงาน (แรงงาน) — ค่าใช้จ่ายตรงเป็นค่าระดับโครงการ
          แสดงที่ราคาทุน (ไม่บวกกำไร) รวมกันเท่ากับราคาก่อน VAT ของทั้งโครงการ
        </p>
      </CardContent>
    </Card>
  );
}
