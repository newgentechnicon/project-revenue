"use client";

import React, { useState } from "react";
import { Project, OverheadItem, DirectCostItem } from "@/lib/types";
import { CostCalculationResult } from "@/lib/calculations";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign, Check, HelpCircle, Plus, Trash2, Package } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface OverheadManagerProps {
  project: Project;
  overheads: OverheadItem[];
  calculations: CostCalculationResult;
  onUpdateProject: (updated: Project) => void;
}

export function OverheadManager({
  project,
  overheads,
  calculations,
  onUpdateProject,
}: OverheadManagerProps) {
  const { totalMonthlyOverhead, companyCapacityMandays, totalProjectMandays, allocatedOverhead, directCost, durationMonths } = calculations;

  const [newCostName, setNewCostName] = useState("");
  const [newCostAmount, setNewCostAmount] = useState<number>(0);
  const [newCostCategory, setNewCostCategory] = useState<DirectCostItem["category"]>("other");

  const handleAddDirectCost = () => {
    if (!newCostName.trim() || newCostAmount <= 0) return;
    const item: DirectCostItem = {
      id: "dc_" + Date.now(),
      name: newCostName.trim(),
      cost: newCostAmount,
      category: newCostCategory,
    };
    onUpdateProject({
      ...project,
      directCosts: [...(project.directCosts ?? []), item],
    });
    setNewCostName("");
    setNewCostAmount(0);
    setNewCostCategory("other");
  };

  const handleRemoveDirectCost = (id: string) => {
    onUpdateProject({
      ...project,
      directCosts: (project.directCosts ?? []).filter((d) => d.id !== id),
    });
  };

  const categoryLabels: Record<NonNullable<DirectCostItem["category"]>, string> = {
    license: "License/SaaS",
    hosting: "Cloud/Hosting",
    outsource: "Outsource",
    travel: "เดินทาง",
    other: "อื่นๆ",
  };

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("th-TH", {
      style: "currency",
      currency: "THB",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);
  };

  const handleAllocationMethodChange = (method: "proportional" | "percentage" | "fixed") => {
    onUpdateProject({
      ...project,
      overheadAllocationMethod: method,
      overheadAllocationValue: method === "percentage" ? 10 : method === "fixed" ? 5000 : 0,
    });
  };

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value) || 0;
    onUpdateProject({
      ...project,
      overheadAllocationValue: val,
    });
  };

  const capacityUsagePercent = companyCapacityMandays > 0 
    ? Math.min(100, (totalProjectMandays / companyCapacityMandays) * 100) 
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">การปันส่วนต้นทุนโสหุ้ย (Overhead Allocation)</h2>
        <p className="text-sm text-muted-foreground">
          จัดสัดส่วนค่าใช้จ่ายส่วนกลางของบริษัทเพื่อป้อนเข้าเป็นต้นทุนแฝงของโครงการซอฟต์แวร์นี้
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Method config */}
        <Card className="lg:col-span-1 border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="text-lg">วิธีปันส่วนค่าใช้จ่าย</CardTitle>
            <CardDescription>เลือกวิธีการกระจายต้นทุนตามรูปแบบความเหมาะสมของโครงการ</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">เลือกวิธีปันส่วนสำหรับโครงการนี้:</Label>
              <div className="grid grid-cols-1 gap-2">
                <Button
                  size="sm"
                  type="button"
                  variant={project.overheadAllocationMethod === "proportional" ? "default" : "outline"}
                  onClick={() => handleAllocationMethodChange("proportional")}
                  className="justify-start px-3 h-10 font-semibold"
                >
                  <span className="mr-2">📊</span> ปันส่วนสัดส่วนตามวันทำงาน (Mandays)
                </Button>
                <Button
                  size="sm"
                  type="button"
                  variant={project.overheadAllocationMethod === "percentage" ? "default" : "outline"}
                  onClick={() => handleAllocationMethodChange("percentage")}
                  className="justify-start px-3 h-10 font-semibold"
                >
                  <span className="mr-2">🎯</span> คิดเป็นเปอร์เซ็นต์คงที่ (% of Overheads)
                </Button>
                <Button
                  size="sm"
                  type="button"
                  variant={project.overheadAllocationMethod === "fixed" ? "default" : "outline"}
                  onClick={() => handleAllocationMethodChange("fixed")}
                  className="justify-start px-3 h-10 font-semibold"
                >
                  <span className="mr-2">💰</span> ระบุเป็นจำนวนเงินคงที่โดยตรง (Fixed Cost)
                </Button>
              </div>
            </div>

            {/* Explanatory descriptions / Inputs */}
            <div className="pt-2">
              {project.overheadAllocationMethod === "proportional" && (
                <div className="rounded-lg bg-muted/50 p-4 border border-border/60 space-y-3 text-xs leading-relaxed">
                  <div className="font-bold text-sm text-primary flex items-center gap-1">
                    <Check className="h-4 w-4" /> ปันส่วนตามสัดส่วนการทำงานจริง
                  </div>
                  <p className="text-muted-foreground">
                    คำนวณตามชั่วโมงการผลิตจริงเทียบกับ capacity ของบริษัท × ระยะเวลา {durationMonths} เดือน
                  </p>
                  <div className="border-t border-border/60 pt-2 space-y-1.5 font-mono text-muted-foreground">
                    <div className="flex justify-between">
                      <span>โสหุ้ยบริษัทต่อเดือน:</span>
                      <span className="text-foreground font-semibold">{formatCurrency(totalMonthlyOverhead)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>โสหุ้ยรวมตลอดโครงการ:</span>
                      <span className="text-foreground font-semibold">{formatCurrency(totalMonthlyOverhead * durationMonths)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Mandays โครงการ:</span>
                      <span className="text-foreground font-semibold">{totalProjectMandays}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Capacity บริษัท/เดือน:</span>
                      <span className="text-foreground font-semibold">{companyCapacityMandays} Mandays</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-dashed border-border/60 font-sans text-[11px]">
                      <span>สัดส่วนปันให้:</span>
                      <span className="text-primary font-bold">
                        {capacityUsagePercent.toFixed(1)}% (เทียบ capacity 1 เดือน)
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {project.overheadAllocationMethod === "percentage" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="alloc-percent">ระบุเปอร์เซ็นต์ปันส่วน (%):</Label>
                    <div className="relative">
                      <Input
                        id="alloc-percent"
                        type="number"
                        min={0}
                        max={100}
                        value={project.overheadAllocationValue}
                        onChange={handleValueChange}
                        className="pr-8"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-muted-foreground">%</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    เหมาะสำหรับโปรเจกต์ที่ตกลงแชร์ค่าใช้จ่ายสำนักงานในอัตราคงที่ เช่น แบ่งให้โครงการนี้ดูแล 15% ของค่าเซิร์ฟเวอร์และค่าเช่าตึกทั้งหมด
                  </p>
                </div>
              )}

              {project.overheadAllocationMethod === "fixed" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="alloc-fixed">จำนวนเงินปันส่วน (บาท):</Label>
                    <div className="relative">
                      <Input
                        id="alloc-fixed"
                        type="number"
                        min={0}
                        value={project.overheadAllocationValue}
                        onChange={handleValueChange}
                        className="pl-8"
                      />
                      <span className="absolute left-3 top-2.5 text-xs text-muted-foreground">฿</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    เหมาะสำหรับโครงการที่ระบุค่าใช้จ่ายโสหุ้ยแยกต่างหากอย่างชัดเจนโดยไม่ต้องการอิงกับรายจ่ายหลักของบริษัท
                  </p>
                </div>
              )}
            </div>

            {/* Total Allocated Overhead Box */}
            <div className="pt-4 border-t border-border">
              <div className="rounded-xl bg-primary/5 dark:bg-primary/10 border border-primary/20 p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground font-semibold">ยอดปันส่วนรวมเข้าโปรเจกต์</div>
                  <div className="text-2xl font-black text-primary mt-1">{formatCurrency(allocatedOverhead)}</div>
                </div>
                <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
                  <DollarSign className="h-5 w-5" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right column: Overheads preview list */}
        <Card className="lg:col-span-2 border-border/50 bg-card/50">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-lg">รายการต้นทุนส่วนกลางหลัก (Master Data)</CardTitle>
                <CardDescription>
                  รายการรายจ่ายอ้างอิงที่ดึงมาจากฐานข้อมูลหลักของบริษัท (คำนวณรวมต่อเดือน:{" "}
                  <span className="font-semibold text-foreground">{formatCurrency(totalMonthlyOverhead)}</span>)
                </CardDescription>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                      <HelpCircle className="h-4.5 w-4.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs">
                      รายการเหล่านี้เป็นข้อมูลโสหุ้ยหลักของบริษัท หากต้องการเพิ่ม ลบ หรือแก้ไขรายการเหล่านี้ กรุณาไปที่เมนู <strong>&ldquo;ข้อมูลค่าใช้จ่ายส่วนกลาง&rdquo;</strong> ในหมวด <strong>Master Data</strong>
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>รายการรายจ่าย</TableHead>
                    <TableHead className="text-right">จำนวนเงินปกติ</TableHead>
                    <TableHead className="text-center">รอบชำระ</TableHead>
                    <TableHead className="text-right">คำนวณเฉลี่ยรายเดือน</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overheads.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-sm">
                        ไม่มีข้อมูลค่าใช้จ่ายทั่วไปในระบบ Master Data กรุณาเพิ่มที่หน้าข้อมูลหลัก
                      </TableCell>
                    </TableRow>
                  ) : (
                    overheads.map((item) => {
                      const monthlyCost = item.period === "yearly" ? item.cost / 12 : item.cost;
                      return (
                        <TableRow key={item.id} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="font-medium text-slate-800 dark:text-slate-200">
                            {item.name}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            ฿{formatNumber(item.cost)}
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-muted border border-border">
                              {item.period === "monthly" ? "รายเดือน" : "รายปี"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-bold text-slate-700 dark:text-slate-300">
                            ฿{formatNumber(monthlyCost)}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}

                  {/* Summary row */}
                  <TableRow className="bg-muted/40 hover:bg-muted/40 font-bold border-t-2 border-border/80">
                    <TableCell colSpan={3}>รวมยอดโสหุ้ยอ้างอิงทั้งหมดต่อเดือน</TableCell>
                    <TableCell className="text-right text-primary font-black text-base">
                      ฿{formatNumber(totalMonthlyOverhead)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Direct Project Costs */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" /> ค่าใช้จ่ายตรงโครงการ (Direct Costs)
              </CardTitle>
              <CardDescription>
                ค่าใช้จ่ายที่ผูกกับโครงการนี้โดยตรง เช่น Cloud, License, Outsource — ไม่ใช่โสหุ้ยส่วนกลาง
              </CardDescription>
            </div>
            <div className="rounded-lg bg-primary/5 border border-primary/20 px-4 py-2 text-right">
              <div className="text-[10px] text-muted-foreground font-medium">รวม Direct</div>
              <div className="text-lg font-black text-primary">{formatCurrency(directCost)}</div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add Form */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
            <div className="md:col-span-5">
              <Label htmlFor="dc-name" className="text-xs">รายการ</Label>
              <Input
                id="dc-name"
                placeholder="เช่น Cloud Hosting AWS"
                value={newCostName}
                onChange={(e) => setNewCostName(e.target.value)}
              />
            </div>
            <div className="md:col-span-3">
              <Label htmlFor="dc-amount" className="text-xs">จำนวนเงิน (บาท)</Label>
              <Input
                id="dc-amount"
                type="number"
                min={0}
                value={newCostAmount || ""}
                onChange={(e) => setNewCostAmount(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="dc-cat" className="text-xs">หมวด</Label>
              <select
                id="dc-cat"
                value={newCostCategory ?? "other"}
                onChange={(e) => setNewCostCategory(e.target.value as DirectCostItem["category"])}
                className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                {Object.entries(categoryLabels).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <Button onClick={handleAddDirectCost} className="w-full gap-2" disabled={!newCostName.trim() || newCostAmount <= 0}>
                <Plus className="h-4 w-4" /> เพิ่ม
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>รายการ</TableHead>
                  <TableHead className="text-center">หมวด</TableHead>
                  <TableHead className="text-right">จำนวนเงิน</TableHead>
                  <TableHead className="text-center w-[60px]">ลบ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(project.directCosts ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-6 text-muted-foreground text-sm">
                      ยังไม่มีค่าใช้จ่ายตรงสำหรับโครงการนี้
                    </TableCell>
                  </TableRow>
                ) : (
                  (project.directCosts ?? []).map((dc) => (
                    <TableRow key={dc.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-medium">{dc.name}</TableCell>
                      <TableCell className="text-center">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted border border-border">
                          {categoryLabels[dc.category ?? "other"]}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        ฿{formatNumber(dc.cost)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleRemoveDirectCost(dc.id)}
                          className="h-7 w-7 text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
