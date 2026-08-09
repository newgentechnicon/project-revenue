"use client";

import React from "react";
import { Project } from "@/lib/types";
import { CostCalculationResult } from "@/lib/calculations";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip as ChartTooltip, Legend } from "recharts";

interface CostChartsProps {
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

export function CostCharts({ calculations }: CostChartsProps) {
  const { laborCost, directCost, allocatedOverhead, contingencyAmount, totalProductionCost, laborCostBreakdown } = calculations;

  const pieData = [
    { name: "ค่าแรงรวม (Labor)", value: laborCost, color: "var(--chart-1)" },
    { name: "ค่าใช้จ่ายตรง (Direct)", value: directCost, color: "var(--chart-3)" },
    { name: "ค่าโสหุ้ยปันส่วน (Overhead)", value: allocatedOverhead, color: "var(--chart-2)" },
    { name: "เงินสำรอง (Contingency)", value: contingencyAmount, color: "var(--chart-4)" },
  ].filter((d) => d.value > 0);

  const barData = laborCostBreakdown
    .filter((item) => item.mandays > 0)
    .map((item) => ({
      name: item.title.split(" (")[0],
      "ค่าแรงสะสม (฿)": item.totalCost,
      "จำนวนวัน (Manday)": item.mandays,
    }));

  return (
    <Card className="lg:col-span-2 border-border/50 bg-card/50">
      <CardHeader>
        <CardTitle className="text-lg">แผนภูมิแจกแจงค่าใช้จ่าย</CardTitle>
        <CardDescription>วิเคราะห์สัดส่วนของต้นทุนพัฒนาซอฟต์แวร์</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-[250px] flex flex-col items-center justify-center">
            <p className="text-xs font-semibold mb-2 text-muted-foreground text-center">
              สัดส่วนต้นทุนผลิต (Cost Breakdown)
            </p>
            {totalProductionCost > 0 ? (
              <ResponsiveContainer width="100%" height="90%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <ChartTooltip
                    formatter={(value) => [formatCurrency(Number(value ?? 0)), ""]}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-sm text-muted-foreground flex items-center justify-center h-full">
                ยังไม่มีต้นทุนสำหรับสร้างแผนภูมิ
              </div>
            )}
          </div>

          <div className="h-[250px] flex flex-col justify-center">
            <p className="text-xs font-semibold mb-2 text-muted-foreground text-center">
              ค่าแรงจำแนกตามตำแหน่ง (Labor Cost by Role)
            </p>
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={barData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={(val) => `${val / 1000}k`} tick={{ fontSize: 10 }} />
                  <ChartTooltip
                    formatter={(value, name) => [
                      name === "ค่าแรงสะสม (฿)" ? formatCurrency(Number(value ?? 0)) : `${value} วัน`,
                      name,
                    ]}
                  />
                  <Bar dataKey="ค่าแรงสะสม (฿)" fill="var(--chart-4)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-sm text-muted-foreground flex items-center justify-center h-full">
                กรุณาป้อนจำนวน Mandays เพื่อแสดงค่าใช้จ่าย
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
