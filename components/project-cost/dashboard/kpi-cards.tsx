"use client";

import React from "react";
import { Project } from "@/lib/types";
import { CostCalculationResult } from "@/lib/calculations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, DollarSign, TrendingUp, FileText } from "lucide-react";

interface KPICardsProps {
  project: Project;
  calculations: CostCalculationResult;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);

export function KPICards({ project, calculations }: KPICardsProps) {
  const {
    laborCost,
    allocatedOverhead,
    totalProductionCost,
    priceBeforeTax,
    finalPrice,
    netReceivable,
    netProfit,
    netMarginPercent,
    grossMarginPercent,
    totalProjectMandays,
    isAtLoss,
    pricingMode,
  } = calculations;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Cost */}
      <Card className="relative overflow-hidden border-border/50 bg-card/50 backdrop-blur-xs transition-all hover:border-primary/20">
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-sm font-medium text-muted-foreground">ต้นทุนรวมโครงการ</CardTitle>
          <div className="p-2 bg-chart-1/10 rounded-lg text-chart-1">
            <DollarSign className="h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(totalProductionCost)}</div>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <span>ค่าแรง: {formatCurrency(laborCost)}</span>
            <span>•</span>
            <span>โสหุ้ย: {formatCurrency(allocatedOverhead)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Total Mandays */}
      <Card className="relative overflow-hidden border-border/50 bg-card/50 backdrop-blur-xs transition-all hover:border-primary/20">
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-sm font-medium text-muted-foreground">จำนวนวันที่ใช้พัฒนา</CardTitle>
          <div className="p-2 bg-chart-3/10 rounded-lg text-chart-3">
            <Users className="h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalProjectMandays} Mandays</div>
          <p className="mt-1 text-xs text-muted-foreground">
            วันทำงานเฉลี่ยต่อเดือน: {project.workingDaysPerMonth} วัน
          </p>
        </CardContent>
      </Card>

      {/* Profit Margin */}
      <Card className="relative overflow-hidden border-border/50 bg-card/50 backdrop-blur-xs transition-all hover:border-primary/20">
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-sm font-medium text-muted-foreground">อัตรากำไรสุทธิ</CardTitle>
          <div className="p-2 bg-chart-5/10 rounded-lg text-chart-5">
            <TrendingUp className="h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold flex items-center gap-2">
            {netMarginPercent.toFixed(1)}%
            <Badge
              variant={isAtLoss ? "destructive" : netMarginPercent > 20 ? "default" : "secondary"}
              className="h-5"
            >
              {isAtLoss ? "ขาดทุน" : netProfit > 0 ? "มีกำไร" : "เท่าทุน"}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            กำไรสุทธิ: {formatCurrency(netProfit)} • Gross: {grossMarginPercent.toFixed(1)}%
            {pricingMode === "fixed_price" && (
              <span className="ml-1 px-1 py-0.5 rounded bg-blue-100 text-blue-700 text-[9px] dark:bg-blue-950 dark:text-blue-300">ขายเหมา</span>
            )}
          </p>
        </CardContent>
      </Card>

      {/* Final Price */}
      <Card className="relative overflow-hidden border-primary/20 bg-primary/5 dark:bg-primary/10 backdrop-blur-xs transition-all hover:border-primary/40">
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-sm font-medium text-primary-foreground/80 dark:text-primary-foreground/90">
            ราคาเสนอขายสุทธิ
          </CardTitle>
          <div className="p-2 bg-primary/20 rounded-lg text-primary">
            <FileText className="h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-black text-primary">{formatCurrency(finalPrice)}</div>
          <p className="mt-1 text-xs text-muted-foreground">
            ก่อนภาษี: {formatCurrency(priceBeforeTax)} • รับจริง: {formatCurrency(netReceivable)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
