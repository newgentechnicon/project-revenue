"use client";

import React from "react";
import { Project, Scenario, ScenarioId, PositionRate, OverheadItem } from "@/lib/types";
import {
  calculateScenarios, SCENARIO_LABELS, DEFAULT_SCENARIOS,
} from "@/lib/calculations";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { BarChart3, Check } from "lucide-react";
import { toast } from "sonner";

interface ScenarioComparisonProps {
  project: Project;
  positions: PositionRate[];
  overheads: OverheadItem[];
  onUpdateProject: (updated: Project) => void;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);

export function ScenarioComparison({ project, positions, overheads, onUpdateProject }: ScenarioComparisonProps) {
  const scenarioResults = calculateScenarios(project, positions, overheads);
  const projectScenarios =
    project.scenarios && project.scenarios.length > 0 ? project.scenarios : DEFAULT_SCENARIOS;

  const handleScenarioMultiplierChange = (id: ScenarioId, value: number) => {
    const existing = projectScenarios.find((s) => s.id === id);
    const updated: Scenario = existing
      ? { ...existing, mandayMultiplier: value }
      : { id, mandayMultiplier: value };
    onUpdateProject({
      ...project,
      scenarios: [...projectScenarios.filter((s) => s.id !== id), updated],
    });
  };

  const handleApplyScenario = (id: ScenarioId) => {
    const result = scenarioResults.find((r) => r.scenario.id === id);
    if (!result) return;

    const multiplier = result.scenario.mandayMultiplier;
    const updatedAllocations = project.allocations.map((a) => ({
      ...a,
      mandays: Number((a.mandays * multiplier).toFixed(1)),
    }));

    onUpdateProject({
      ...project,
      allocations: updatedAllocations,
      markupPercentage: result.scenario.markupOverride ?? project.markupPercentage,
      contingencyPercent: result.scenario.contingencyOverride ?? project.contingencyPercent,
    });

    toast.success(`ใช้ค่าจาก ${SCENARIO_LABELS[id].label} เรียบร้อย!`, {
      description: `Mandays ถูกคูณด้วย ${multiplier}x`,
    });
  };

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" /> เปรียบเทียบสถานการณ์ (Scenario Analysis)
        </CardTitle>
        <CardDescription>
          ปรับ multiplier ของ Mandays เพื่อดูผลกระทบต่อราคา/กำไร — ใช้ประเมินช่วงราคาก่อนเสนอ
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {scenarioResults.map((sr) => {
            const meta = SCENARIO_LABELS[sr.scenario.id];
            const isRealistic = sr.scenario.id === "realistic";
            return (
              <div
                key={sr.scenario.id}
                className={`rounded-lg border p-4 space-y-3 ${
                  isRealistic
                    ? "border-primary/40 bg-primary/5"
                    : meta.tone === "emerald"
                      ? "border-emerald-200 bg-emerald-50/40 dark:bg-emerald-950/20 dark:border-emerald-900"
                      : "border-rose-200 bg-rose-50/40 dark:bg-rose-950/20 dark:border-rose-900"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-bold text-sm">{meta.label}</div>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    × {sr.scenario.mandayMultiplier.toFixed(2)}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] text-muted-foreground">Manday multiplier</Label>
                  <Slider
                    min={0.5}
                    max={2}
                    step={0.05}
                    value={[sr.scenario.mandayMultiplier]}
                    onValueChange={(v) => handleScenarioMultiplierChange(sr.scenario.id, v[0])}
                  />
                </div>

                <div className="space-y-1 pt-1 border-t border-border/60 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Mandays:</span>
                    <span className="font-mono">{sr.totalProjectMandays.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ต้นทุน:</span>
                    <span className="font-mono">{formatCurrency(sr.totalProductionCost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ราคาก่อน VAT:</span>
                    <span className="font-mono font-semibold">{formatCurrency(sr.priceBeforeTax)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-primary pt-1 border-t border-dashed border-border/40">
                    <span>ราคารวม VAT:</span>
                    <span className="font-mono">{formatCurrency(sr.finalPrice)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">กำไร:</span>
                    <span className={`font-mono font-semibold ${
                      sr.netProfit > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600"
                    }`}>
                      {formatCurrency(sr.netProfit)} ({sr.netMarginPercent.toFixed(1)}%)
                    </span>
                  </div>
                </div>

                {sr.scenario.notes && (
                  <p className="text-[10px] text-muted-foreground italic pt-1 border-t border-border/40">
                    {sr.scenario.notes}
                  </p>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  disabled={isRealistic}
                  onClick={() => handleApplyScenario(sr.scenario.id)}
                  className="w-full mt-2 h-7 text-[10px] gap-1.5 font-bold"
                >
                  <Check className="h-3 w-3" /> Apply to Project
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
