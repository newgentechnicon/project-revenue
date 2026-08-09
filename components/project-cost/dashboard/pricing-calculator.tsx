"use client";

import React from "react";
import { Project, PricingMode } from "@/lib/types";
import { CostCalculationResult } from "@/lib/calculations";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Percent, Tag, AlertTriangle } from "lucide-react";

interface PricingCalculatorProps {
  project: Project;
  calculations: CostCalculationResult;
  onUpdateProject: (updated: Project) => void;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);

export function PricingCalculator({ project, calculations, onUpdateProject }: PricingCalculatorProps) {
  const {
    laborCost,
    directCost,
    allocatedOverhead,
    subtotalBeforeContingency,
    contingencyAmount,
    totalProductionCost,
    markupAmount,
    effectiveMarkupPercent,
    priceBeforeTax,
    taxAmount,
    finalPrice,
    withholdingTaxAmount,
    netReceivable,
    isAtLoss,
  } = calculations;

  const pricingMode: PricingMode = project.pricingMode ?? "cost_plus";

  const handleModeChange = (mode: PricingMode) => {
    // เปลี่ยน mode แล้ว auto-fill ค่าเริ่มต้นที่สมเหตุสมผล
    if (mode === "fixed_price" && project.fixedPrice === 0) {
      // ใช้ราคาปัจจุบันที่คำนวณจาก cost-plus เป็นจุดเริ่มต้น
      onUpdateProject({ ...project, pricingMode: mode, fixedPrice: Math.round(priceBeforeTax) });
    } else {
      onUpdateProject({ ...project, pricingMode: mode });
    }
  };

  const handleMarkupChange = (val: number[]) => {
    onUpdateProject({ ...project, markupPercentage: val[0] });
  };

  const handleFixedPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value) || 0;
    onUpdateProject({ ...project, fixedPrice: Math.max(0, val) });
  };

  return (
    <Card className="lg:col-span-1 border-border/50 bg-card/50">
      <CardHeader>
        <CardTitle className="text-lg">ตัวคำนวณราคาขายและกำไร</CardTitle>
        <CardDescription>เลือกโหมดการกำหนดราคาที่เหมาะกับโครงการ</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Mode Toggle */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-muted/50 rounded-lg">
          <Button
            type="button"
            variant={pricingMode === "cost_plus" ? "default" : "ghost"}
            size="sm"
            onClick={() => handleModeChange("cost_plus")}
            className="h-9 text-xs gap-1.5 font-semibold"
          >
            <Percent className="h-3.5 w-3.5" /> Cost + Markup
          </Button>
          <Button
            type="button"
            variant={pricingMode === "fixed_price" ? "default" : "ghost"}
            size="sm"
            onClick={() => handleModeChange("fixed_price")}
            className="h-9 text-xs gap-1.5 font-semibold"
          >
            <Tag className="h-3.5 w-3.5" /> ขายเหมา (Fixed)
          </Button>
        </div>

        {/* Mode-specific control */}
        {pricingMode === "cost_plus" ? (
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <Label htmlFor="markup-slider">กำไรขั้นต้น (Markup):</Label>
              <span className="font-semibold text-primary">{project.markupPercentage}%</span>
            </div>
            <Slider
              id="markup-slider"
              min={0}
              max={150}
              step={5}
              value={[project.markupPercentage]}
              onValueChange={handleMarkupChange}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0% (เท่าทุน)</span>
              <span>150%</span>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="fixed-price-input">ราคาขายโครงการ (ก่อน VAT)</Label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-sm text-muted-foreground">฿</span>
              <Input
                id="fixed-price-input"
                type="number"
                min={0}
                step={1000}
                value={project.fixedPrice || ""}
                onChange={handleFixedPriceChange}
                placeholder="0"
                className="pl-7 font-bold text-base"
              />
            </div>
            <div className="text-xs text-muted-foreground">
              ต้นทุนรวม: <span className="font-mono font-semibold">{formatCurrency(totalProductionCost)}</span>
            </div>
            {isAtLoss && (
              <div className="flex items-start gap-1.5 text-xs text-rose-600 dark:text-rose-400">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>ราคาขายต่ำกว่าต้นทุน — กำลังขาดทุน {formatCurrency(Math.abs(markupAmount))}</span>
              </div>
            )}
            {project.fixedPrice > 0 && !isAtLoss && (
              <div className="text-xs text-emerald-600 dark:text-emerald-400">
                เทียบเป็น markup: <strong>{effectiveMarkupPercent.toFixed(1)}%</strong>
              </div>
            )}
          </div>
        )}

        {/* Breakdown */}
        <div className="pt-4 border-t border-border/60 space-y-2 text-sm">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>ค่าแรงรวม:</span>
            <span>{formatCurrency(laborCost)}</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>ค่าใช้จ่ายตรง:</span>
            <span>{formatCurrency(directCost)}</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>โสหุ้ยปันส่วน:</span>
            <span>{formatCurrency(allocatedOverhead)}</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground border-t border-dashed border-border/60 pt-2">
            <span>Subtotal:</span>
            <span className="font-medium">{formatCurrency(subtotalBeforeContingency)}</span>
          </div>
          <div className="flex justify-between text-xs text-amber-600 dark:text-amber-400">
            <span>+ Contingency ({project.contingencyPercent}%):</span>
            <span>{formatCurrency(contingencyAmount)}</span>
          </div>
          <div className="flex justify-between font-medium pt-1 border-t border-border/60">
            <span>ต้นทุนรวมโครงการ:</span>
            <span>{formatCurrency(totalProductionCost)}</span>
          </div>
          <div className={`flex justify-between ${markupAmount < 0 ? "text-rose-600 dark:text-rose-400" : "text-chart-5"}`}>
            <span>
              {pricingMode === "fixed_price"
                ? `${markupAmount < 0 ? "− ขาดทุน" : "+ กำไรขั้นต้น"} (${effectiveMarkupPercent.toFixed(1)}%):`
                : `+ Markup (${project.markupPercentage}%):`}
            </span>
            <span>{formatCurrency(markupAmount)}</span>
          </div>
          <div className="flex justify-between font-bold pt-1 border-t border-dashed border-border/60">
            <span>ราคาก่อนภาษี:</span>
            <span>{formatCurrency(priceBeforeTax)}</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>+ VAT ({project.taxRate}%):</span>
            <span>{formatCurrency(taxAmount)}</span>
          </div>
          <div className="flex justify-between font-bold text-base pt-2 border-t border-border text-primary">
            <span>ราคาขายรวม VAT:</span>
            <span>{formatCurrency(finalPrice)}</span>
          </div>
          <div className="flex justify-between text-xs text-rose-600 dark:text-rose-400">
            <span>− หัก ณ ที่จ่าย ({project.withholdingTaxPercent}%):</span>
            <span>{formatCurrency(withholdingTaxAmount)}</span>
          </div>
          <div className="flex justify-between font-bold text-base pt-1 border-t border-border">
            <span>เงินรับจริงสุทธิ:</span>
            <span className="text-emerald-600 dark:text-emerald-400">{formatCurrency(netReceivable)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
