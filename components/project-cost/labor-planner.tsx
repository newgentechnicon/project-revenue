"use client";

import React from "react";
import { Project, PositionRate, ProjectPositionAllocation, ProjectModule } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Users, HelpCircle, Plus, Trash2, Layers, LayoutList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  newModuleId, rebuildAllocationsFromModules, moduleMandays,
  seedModulesFromAllocations, customRateFor,
} from "@/lib/project-modules";

interface LaborPlannerProps {
  project: Project;
  positions: PositionRate[];
  onUpdateProject: (updated: Project) => void;
  onUpdatePosition: (pos: PositionRate) => void;
}

export function LaborPlanner({
  project,
  positions,
  onUpdateProject,
  onUpdatePosition,
}: LaborPlannerProps) {

  const formatNumber = (num: number) =>
    new Intl.NumberFormat("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);

  const mode = project.estimationMode ?? "simple";

  const handleWorkingDaysChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value) || 20;
    onUpdateProject({ ...project, workingDaysPerMonth: val });
    positions.forEach((pos) => {
      if (!pos.isCustomRate) onUpdatePosition({ ...pos, dailyRate: Math.round(pos.salary / val) });
    });
  };

  // คำนวณ fully-loaded daily rate (ตรงกับสูตรใน calculations.ts)
  const computeFullyLoadedRate = (pos: PositionRate, baseOverride?: number) => {
    const base = baseOverride !== undefined ? baseOverride : pos.dailyRate;
    const benefitMul = 1 + ((pos.benefitPercent ?? 0) / 100);
    const ssoDaily = (pos.socialSecurityAmount ?? 0) / (project.workingDaysPerMonth || 20);
    return base * benefitMul + ssoDaily;
  };

  // ===================== Mode toggle =====================
  const switchMode = (next: "simple" | "module") => {
    if (next === mode) return;
    if (next === "module") {
      const existing = project.modules ?? [];
      // ถ้าผลรวม mandays ของ modules เดิมไม่ตรงกับ allocations ปัจจุบัน แสดงว่ามีการแก้ในโหมดตารางเดียว
      // → re-seed จาก allocations เพื่อไม่ให้ข้อมูลที่แก้ล่าสุดหาย
      const moduleTotal = existing.reduce(
        (s, m) => s + m.allocations.reduce((t, a) => t + (a.mandays || 0), 0),
        0
      );
      const allocTotal = project.allocations.reduce((s, a) => s + (a.mandays || 0), 0);
      const modules =
        existing.length > 0 && Math.abs(moduleTotal - allocTotal) < 0.001
          ? existing
          : seedModulesFromAllocations(project);
      onUpdateProject({
        ...project,
        estimationMode: "module",
        modules,
        allocations: rebuildAllocationsFromModules(modules, project.allocations),
      });
    } else {
      // กลับสู่โหมดเดิม — allocations เป็นผลรวมอยู่แล้ว, เก็บ modules ไว้เผื่อสลับกลับ
      onUpdateProject({ ...project, estimationMode: "simple" });
    }
  };

  // ===================== SIMPLE MODE handlers =====================
  const handleMandayChange = (positionId: string, value: string) => {
    const mandays = Math.max(0, parseFloat(value) || 0);
    const existingIndex = project.allocations.findIndex((a) => a.positionId === positionId);
    const updatedAllocations = [...project.allocations];
    if (existingIndex > -1) {
      updatedAllocations[existingIndex] = { ...updatedAllocations[existingIndex], mandays };
    } else {
      updatedAllocations.push({ positionId, mandays });
    }
    onUpdateProject({ ...project, allocations: updatedAllocations });
  };

  const handleCustomRateChange = (positionId: string, value: string) => {
    const customRate = value === "" ? undefined : parseFloat(value);
    const existingIndex = project.allocations.findIndex((a) => a.positionId === positionId);
    const updatedAllocations = [...project.allocations];
    if (existingIndex > -1) {
      updatedAllocations[existingIndex] = { ...updatedAllocations[existingIndex], customDailyRate: customRate };
    } else {
      updatedAllocations.push({ positionId, mandays: 0, customDailyRate: customRate });
    }
    onUpdateProject({ ...project, allocations: updatedAllocations });
  };

  const getAlloc = (posId: string): ProjectPositionAllocation =>
    project.allocations.find((a) => a.positionId === posId) || { positionId: posId, mandays: 0 };

  // ===================== MODULE MODE handlers =====================
  const modules = project.modules ?? [];

  const commitModules = (nextModules: ProjectModule[]) => {
    onUpdateProject({
      ...project,
      modules: nextModules,
      allocations: rebuildAllocationsFromModules(nextModules, project.allocations),
    });
  };

  const updateModule = (moduleId: string, patch: Partial<ProjectModule>) =>
    commitModules(modules.map((m) => (m.id === moduleId ? { ...m, ...patch } : m)));

  const handleAddModule = () =>
    commitModules([...modules, { id: newModuleId(modules.length), name: `โมดูลที่ ${modules.length + 1}`, allocations: [] }]);

  const handleDeleteModule = (moduleId: string) => {
    if (!confirm("ลบโมดูลนี้ใช่หรือไม่? (mandays ของโมดูลนี้จะถูกนำออกจากการประเมิน)")) return;
    commitModules(modules.filter((m) => m.id !== moduleId));
  };

  const handleModuleManday = (moduleId: string, positionId: string, value: string) => {
    const mandays = Math.max(0, parseFloat(value) || 0);
    const m = modules.find((x) => x.id === moduleId);
    if (!m) return;
    const allocations = m.allocations.some((a) => a.positionId === positionId)
      ? m.allocations.map((a) => (a.positionId === positionId ? { ...a, mandays } : a))
      : [...m.allocations, { positionId, mandays }];
    updateModule(moduleId, { allocations });
  };

  const handleAddPositionToModule = (moduleId: string, positionId: string) => {
    const m = modules.find((x) => x.id === moduleId);
    if (!m || m.allocations.some((a) => a.positionId === positionId)) return;
    updateModule(moduleId, { allocations: [...m.allocations, { positionId, mandays: 0 }] });
  };

  const handleRemovePositionFromModule = (moduleId: string, positionId: string) => {
    const m = modules.find((x) => x.id === moduleId);
    if (!m) return;
    updateModule(moduleId, { allocations: m.allocations.filter((a) => a.positionId !== positionId) });
  };

  // ===================== Totals =====================
  const lineCostOf = (positionId: string, mandays: number) => {
    const pos = positions.find((p) => p.id === positionId);
    if (!pos) return 0;
    return mandays * computeFullyLoadedRate(pos, customRateFor(project, positionId));
  };
  const moduleLaborCost = (m: ProjectModule) =>
    m.allocations.reduce((s, a) => s + lineCostOf(a.positionId, a.mandays), 0);

  const totalMandays = project.allocations.reduce((sum, a) => sum + a.mandays, 0);
  const totalLaborCost = project.allocations.reduce(
    (sum, a) => sum + lineCostOf(a.positionId, a.mandays),
    0
  );

  // ===================== Render: mode toggle =====================
  const modeToggle = (
    <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-card/40 p-1">
      <Button
        size="sm"
        variant={mode === "simple" ? "secondary" : "ghost"}
        onClick={() => switchMode("simple")}
        className="h-8 gap-1.5 text-xs font-semibold"
      >
        <LayoutList className="h-3.5 w-3.5" /> ตารางเดียว
      </Button>
      <Button
        size="sm"
        variant={mode === "module" ? "secondary" : "ghost"}
        onClick={() => switchMode("module")}
        className="h-8 gap-1.5 text-xs font-semibold"
      >
        <Layers className="h-3.5 w-3.5" /> ราย Module
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">วางแผนจัดสรรทีมพัฒนา (Labor & Mandays Planner)</h2>
          <p className="text-sm text-muted-foreground">
            ระบุวันทำงาน (Mandays) ของแต่ละตำแหน่งงาน — เลือกประเมินแบบตารางเดียว หรือแบ่งราย Module ได้
          </p>
        </div>
        {modeToggle}
      </div>

      {/* Configuration Header */}
      <Card className="border-border/50 bg-card/50">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="space-y-1">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" /> จำนวนวันทำงานต่อเดือนสำหรับโครงการนี้
              </h3>
              <p className="text-sm text-muted-foreground">
                จำนวนวันสำหรับปันส่วนหารเงินเดือนเป็นรายวัน (ค่าเริ่มต้นคือ 20 วันทำงานต่อเดือน)
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Label htmlFor="working-days" className="font-medium whitespace-nowrap">วันทำงานต่อเดือน:</Label>
              <Input
                id="working-days"
                type="number"
                min={1}
                max={31}
                value={project.workingDaysPerMonth}
                onChange={handleWorkingDaysChange}
                className="w-24 text-center font-bold text-primary"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {mode === "simple" ? (
        /* ===================== SIMPLE MODE ===================== */
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-lg">ประมาณการจำนวนวันทำงาน (Mandays)</CardTitle>
              <CardDescription>
                ใส่จำนวน Mandays เพื่อคำนวณราคาค่าแรงงานสะสม (รายการอ้างอิงจากฐานข้อมูลหลัก Master Data)
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
                    หากไม่มีบทบาทที่ต้องการแสดงในตาราง กรุณาไปที่เมนู <strong>&ldquo;ข้อมูลตำแหน่งงาน&rdquo;</strong> ในหมวด <strong>Master Data</strong> เพื่อบันทึกข้อมูลตำแหน่งงานใหม่เข้าระบบหลัก
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[26%]">ตำแหน่งงาน</TableHead>
                    <TableHead className="text-right w-[22%]">เรตจริง/วัน<br /><span className="text-[10px] font-normal text-muted-foreground">รวม benefit + SSO</span></TableHead>
                    <TableHead className="text-right w-[20%]">ระบุเรตเฉพาะ<br /><span className="text-[10px] font-normal text-muted-foreground">(ใส่ base — ระบบบวก benefit ให้)</span></TableHead>
                    <TableHead className="text-center w-[14%]">Mandays</TableHead>
                    <TableHead className="text-right w-[18%]">รวมยอดค่าแรง</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {positions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-sm">
                        ไม่พบข้อมูลตำแหน่งงานหลักในระบบ กรุณาไปตั้งค่าที่เมนูข้อมูลตำแหน่งงาน
                      </TableCell>
                    </TableRow>
                  ) : (
                    positions.map((pos) => {
                      const alloc = getAlloc(pos.id);
                      const baseRate = alloc.customDailyRate !== undefined ? alloc.customDailyRate : pos.dailyRate;
                      const fullyLoadedRate = computeFullyLoadedRate(pos, alloc.customDailyRate);
                      const lineCost = alloc.mandays * fullyLoadedRate;
                      const benefitPct = pos.benefitPercent ?? 0;
                      const sso = pos.socialSecurityAmount ?? 0;
                      const customPreview = alloc.customDailyRate !== undefined
                        ? computeFullyLoadedRate(pos, alloc.customDailyRate)
                        : null;

                      return (
                        <TableRow key={pos.id} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="font-semibold text-slate-800 dark:text-slate-200">
                            {pos.title}
                            <div className="text-[10px] font-normal text-muted-foreground mt-0.5">
                              base ฿{formatNumber(pos.dailyRate)} • benefit {benefitPct}% • SSO ฿{formatNumber(sso)}/ด.
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            <div className="font-bold text-primary">฿{formatNumber(Math.round(fullyLoadedRate))}</div>
                            <div className="text-[10px] text-muted-foreground font-normal">จาก ฿{formatNumber(baseRate)} + benefit + SSO</div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              placeholder={`base ฿${pos.dailyRate}`}
                              value={alloc.customDailyRate ?? ""}
                              onChange={(e) => handleCustomRateChange(pos.id, e.target.value)}
                              className="text-right text-xs h-8 font-mono border-dashed"
                            />
                            {customPreview !== null && (
                              <div className="text-[10px] text-muted-foreground font-mono mt-0.5">→ ฿{formatNumber(Math.round(customPreview))} fully-loaded</div>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <Input
                              type="number"
                              step="0.5"
                              min="0"
                              placeholder="0"
                              value={alloc.mandays || ""}
                              onChange={(e) => handleMandayChange(pos.id, e.target.value)}
                              className="text-center font-bold h-8 w-24 mx-auto"
                            />
                          </TableCell>
                          <TableCell className="text-right font-black font-mono text-slate-800 dark:text-slate-200">
                            ฿{formatNumber(lineCost)}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}

                  <TableRow className="bg-muted/50 hover:bg-muted/50 font-bold border-t-2 border-border/80 text-sm">
                    <TableCell colSpan={3}>สรุปประมาณการค่าแรงสะสมโครงการ</TableCell>
                    <TableCell className="text-center text-primary font-black text-base">{totalMandays} วัน</TableCell>
                    <TableCell className="text-right text-primary font-black text-lg font-mono">฿{formatNumber(totalLaborCost)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* ===================== MODULE MODE ===================== */
        <div className="space-y-4">
          {positions.length === 0 ? (
            <Card className="border-border/50 bg-card/50">
              <CardContent className="py-8 text-center text-muted-foreground text-sm">
                ไม่พบข้อมูลตำแหน่งงานหลักในระบบ กรุณาไปตั้งค่าที่เมนูข้อมูลตำแหน่งงานก่อน
              </CardContent>
            </Card>
          ) : (
            <>
              {modules.length === 0 && (
                <Card className="border-dashed border-border/60 bg-card/30">
                  <CardContent className="py-8 text-center text-sm text-muted-foreground">
                    ยังไม่มีโมดูล กดปุ่ม “เพิ่มโมดูล” ด้านล่างเพื่อเริ่มประเมินราย Module
                  </CardContent>
                </Card>
              )}

              {modules.map((m, mi) => {
                const availablePositions = positions.filter(
                  (p) => !m.allocations.some((a) => a.positionId === p.id)
                );
                const mMandays = moduleMandays(m);
                const mCost = moduleLaborCost(m);
                return (
                  <Card key={m.id} className="border-border/50 bg-card/50">
                    <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary text-xs font-bold">
                          {mi + 1}
                        </span>
                        <Input
                          value={m.name}
                          onChange={(e) => updateModule(m.id, { name: e.target.value })}
                          placeholder="ชื่อโมดูล เช่น ระบบสมาชิก / รายงาน"
                          className="h-8 font-semibold max-w-xs"
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">รวมโมดูล</div>
                          <div className="text-sm font-bold font-mono">
                            {mMandays} วัน · <span className="text-primary">฿{formatNumber(mCost)}</span>
                          </div>
                        </div>
                        <Button
                          size="icon" variant="ghost"
                          onClick={() => handleDeleteModule(m.id)}
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          title="ลบโมดูล"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>ตำแหน่งงาน</TableHead>
                              <TableHead className="text-right w-[20%]">เรตจริง/วัน</TableHead>
                              <TableHead className="text-center w-[16%]">Mandays</TableHead>
                              <TableHead className="text-right w-[20%]">รวมค่าแรง</TableHead>
                              <TableHead className="w-[44px]" />
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {m.allocations.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={5} className="text-center py-6 text-muted-foreground text-xs">
                                  ยังไม่มีตำแหน่งในโมดูลนี้ — เพิ่มจากเมนูด้านล่าง
                                </TableCell>
                              </TableRow>
                            ) : (
                              m.allocations.map((a) => {
                                const pos = positions.find((p) => p.id === a.positionId);
                                if (!pos) return null;
                                const rate = computeFullyLoadedRate(pos, customRateFor(project, a.positionId));
                                return (
                                  <TableRow key={a.positionId} className="hover:bg-muted/30">
                                    <TableCell className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                                      {pos.title}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-xs text-muted-foreground">
                                      ฿{formatNumber(Math.round(rate))}
                                    </TableCell>
                                    <TableCell className="text-center">
                                      <Input
                                        type="number" step="0.5" min="0" placeholder="0"
                                        value={a.mandays || ""}
                                        onChange={(e) => handleModuleManday(m.id, a.positionId, e.target.value)}
                                        className="text-center font-bold h-8 w-20 mx-auto"
                                      />
                                    </TableCell>
                                    <TableCell className="text-right font-mono font-bold text-sm">
                                      ฿{formatNumber(a.mandays * rate)}
                                    </TableCell>
                                    <TableCell>
                                      <Button
                                        size="icon" variant="ghost"
                                        onClick={() => handleRemovePositionFromModule(m.id, a.positionId)}
                                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                        title="เอาตำแหน่งออก"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                );
                              })
                            )}
                          </TableBody>
                        </Table>
                      </div>
                      {availablePositions.length > 0 && (
                        <div className="mt-3">
                          <Select value="" onValueChange={(v) => handleAddPositionToModule(m.id, v)}>
                            <SelectTrigger className="h-8 w-full sm:w-[280px] text-xs">
                              <SelectValue placeholder="+ เพิ่มตำแหน่งในโมดูลนี้" />
                            </SelectTrigger>
                            <SelectContent>
                              {availablePositions.map((p) => (
                                <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}

              {/* Add module + grand total */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <Button variant="outline" onClick={handleAddModule} className="gap-2 font-semibold">
                  <Plus className="h-4 w-4" /> เพิ่มโมดูล
                </Button>
                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-muted-foreground">รวมทุกโมดูล ({modules.length}):</span>
                      <span className="font-bold">{totalMandays} วัน</span>
                      <span className="font-black font-mono text-primary text-base">฿{formatNumber(totalLaborCost)}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <p className="text-[11px] text-muted-foreground">
                หมายเหตุ: ระบบรวม mandays ของทุกโมดูลเข้าด้วยกันเพื่อคำนวณต้นทุน/ราคา (Dashboard, Cashflow, ใบเสนอราคา ใช้ยอดรวมนี้) —
                การตั้ง “เรตเฉพาะ” รายตำแหน่งทำได้ในโหมดตารางเดียว
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
