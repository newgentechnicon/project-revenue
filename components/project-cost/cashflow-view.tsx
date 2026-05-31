"use client";

import React, { useMemo, useState, useRef, useEffect } from "react";
import { Project, PositionRate, OverheadItem, Employee, Subscription, Product, Commission, CommissionPayee } from "@/lib/types";
import {
  computeYearWindow,
  toBuddhistYear,
  getAvailableYears,
} from "@/lib/resource-planning";
import { computeCashflow, summarizeCashflow, employeeMonthlyCost, isEmployeeActiveInMonth, computeChainedOpeningBalance, LaborCostSource } from "@/lib/cashflow";
import { CashflowSettings } from "@/hooks/use-cashflow-settings";
import { EditGate } from "@/components/project-cost/edit-gate";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ComposedChart,
  Line,
  ReferenceLine,
  LabelList,
} from "recharts";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Banknote, TrendingUp, TrendingDown, ChevronLeft, ChevronRight,
  AlertTriangle, Wallet, ArrowDownCircle, ArrowUpCircle, PiggyBank, Users, Settings, Link2, RotateCcw,
} from "lucide-react";

const CHART_COLORS = {
  inflow: "#10b981",   // emerald-500
  outflow: "#ef4444",  // red-500
  balance: "#4f46e5",  // indigo-600
  zero: "#94a3b8",     // slate-400
  border: "#e2e8f0",   // slate-200
};

// Deterministic palette for stacked inflow-by-project bars.
// Skews green-ish (since inflow = income) with enough hues to distinguish.
const PROJECT_PALETTE = [
  "#10b981", // emerald-500
  "#14b8a6", // teal-500
  "#06b6d4", // cyan-500
  "#3b82f6", // blue-500
  "#6366f1", // indigo-500
  "#8b5cf6", // violet-500
  "#a855f7", // purple-500
  "#ec4899", // pink-500
  "#f97316", // orange-500
  "#f59e0b", // amber-500
  "#84cc16", // lime-500
  "#22c55e", // green-500
];

const projectColor = (index: number) => PROJECT_PALETTE[index % PROJECT_PALETTE.length];

interface CashflowViewProps {
  projects: Project[];
  positions: PositionRate[];
  overheads: OverheadItem[];
  employees?: Employee[];
  subscriptions?: Subscription[];
  products?: Product[];
  commissions?: Commission[];
  commissionPayees?: CommissionPayee[];
  cashflowSettings: CashflowSettings;
  onUpdateCashflowSettings: (s: CashflowSettings) => void;
}

export function CashflowView({
  projects,
  positions,
  overheads,
  employees = [],
  subscriptions = [],
  products = [],
  commissions = [],
  commissionPayees = [],
  cashflowSettings,
  onUpdateCashflowSettings,
}: CashflowViewProps) {
  const [selectedYearCE, setSelectedYearCE] = useState<number>(new Date().getUTCFullYear());
  const [statusFilter, setStatusFilter] = useState<"active" | "all">("active");
  // Manual override of opening balance for the selected year (null = auto chain)
  const [openingOverride, setOpeningOverride] = useState<number | null>(null);
  // Labor source mode. Default to "payroll" — user can toggle. Tracked separately
  // so it doesn't reset when employees hydrate async from Supabase.
  const [laborSource, setLaborSource] = useState<LaborCostSource>("payroll");
  // Track whether user manually changed the toggle — if not, we auto-default
  // to payroll once employees arrive, project-spread when they're empty.
  const [laborSourceTouched, setLaborSourceTouched] = useState(false);

  // Auto-switch default mode once employees hydrate (only if user hasn't touched the toggle)
  useEffect(() => {
    if (laborSourceTouched) return;
    if (employees.length > 0) {
      setLaborSource("payroll");
    } else {
      setLaborSource("project-spread");
    }
  }, [employees.length, laborSourceTouched]);

  // Settings dialog state (mirror of cashflowSettings while editing)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsAnchorYear, setSettingsAnchorYear] = useState(cashflowSettings.anchorYearCE);
  const [settingsAnchorAmount, setSettingsAnchorAmount] = useState(cashflowSettings.anchorAmount);

  // Reset override when changing year (each year has its own auto-computed opening)
  useEffect(() => {
    setOpeningOverride(null);
  }, [selectedYearCE]);

  // Self-measured chart width
  const chartHostRef = useRef<HTMLDivElement | null>(null);
  const [chartWidth, setChartWidth] = useState(0);
  useEffect(() => {
    if (!chartHostRef.current) return;
    const el = chartHostRef.current;
    const measure = () => setChartWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const availableYears = useMemo(() => getAvailableYears(projects), [projects]);
  const yearWindow = useMemo(() => computeYearWindow(selectedYearCE), [selectedYearCE]);

  // Auto-chained opening balance from anchor year
  const chainedOpeningBalance = useMemo(
    () =>
      computeChainedOpeningBalance(
        selectedYearCE,
        cashflowSettings.anchorYearCE,
        cashflowSettings.anchorAmount,
        projects,
        positions,
        overheads,
        {
          excludeStatuses: statusFilter === "active" ? ["lost"] : [],
          laborSource,
          employees,
          subscriptions,
          products,
          commissions,
          commissionPayees,
        }
      ),
    [
      selectedYearCE,
      cashflowSettings.anchorYearCE,
      cashflowSettings.anchorAmount,
      projects,
      positions,
      overheads,
      statusFilter,
      laborSource,
      employees,
      subscriptions,
      products,
      commissions,
      commissionPayees,
    ]
  );

  const effectiveOpeningBalance = openingOverride ?? chainedOpeningBalance;

  const cashflowMonths = useMemo(
    () =>
      computeCashflow(projects, positions, overheads, yearWindow, {
        excludeStatuses: statusFilter === "active" ? ["lost"] : [],
        openingBalance: effectiveOpeningBalance,
        laborSource,
        employees,
        subscriptions,
        products,
        commissions,
        commissionPayees,
      }),
    [projects, positions, overheads, yearWindow, statusFilter, effectiveOpeningBalance, laborSource, employees, subscriptions, products, commissions, commissionPayees]
  );

  // Snapshot of payroll commitment for sub-card
  const payrollSnapshot = useMemo(() => {
    if (!employees.length) return null;
    // Use middle of year as reference month
    const refMonth = new Date(Date.UTC(selectedYearCE, 5, 1));
    const active = employees.filter((e) => isEmployeeActiveInMonth(e, refMonth));
    const monthlyTotal = active.reduce((s, e) => s + employeeMonthlyCost(e), 0);
    const annualBonus = active.reduce((s, e) => s + (e.annualBonus || 0), 0);
    return {
      activeCount: active.length,
      monthlyTotal,
      annualBonus,
      annualTotal: monthlyTotal * 12 + annualBonus,
    };
  }, [employees, selectedYearCE]);

  const summary = useMemo(
    () => summarizeCashflow(cashflowMonths, effectiveOpeningBalance),
    [cashflowMonths, effectiveOpeningBalance]
  );

  const hasAnyData = cashflowMonths.some((m) => m.inflow > 0 || m.outflow > 0);

  // Collect unique projects that contribute inflow this year, sorted by total
  // contribution desc → most prominent projects get first colors + legend slots.
  const projectInflowSeries = useMemo(() => {
    const totals = new Map<string, { name: string; total: number }>();
    for (const m of cashflowMonths) {
      for (const d of m.inflowDetails) {
        const cur = totals.get(d.projectId);
        if (cur) {
          cur.total += d.amount;
        } else {
          totals.set(d.projectId, { name: d.projectName, total: d.amount });
        }
      }
    }
    return Array.from(totals.entries())
      .map(([id, v], _i) => ({ id, name: v.name, total: v.total }))
      .sort((a, b) => b.total - a.total)
      .map((s, i) => ({ ...s, color: projectColor(i), dataKey: `inflow_${s.id}` }));
  }, [cashflowMonths]);

  // Recharts data — outflow displayed as negative to stack below zero line.
  // For each month, expand inflow into per-project keys for stacked bars.
  const chartData = useMemo(
    () =>
      cashflowMonths.map((m) => {
        const row: Record<string, number | string> = {
          month: m.monthLabel,
          inflow: m.inflow,
          outflow: -m.outflow,
          cumulative: m.cumulative,
          net: m.net,
        };
        // Initialize every project key to 0 so stack rendering is stable across months
        for (const s of projectInflowSeries) row[s.dataKey] = 0;
        // Sum inflow per project for this month
        for (const d of m.inflowDetails) {
          const key = `inflow_${d.projectId}`;
          row[key] = ((row[key] as number) || 0) + d.amount;
        }
        return row;
      }),
    [cashflowMonths, projectInflowSeries]
  );

  const formatTHB = (v: number) =>
    new Intl.NumberFormat("th-TH", {
      style: "currency",
      currency: "THB",
      maximumFractionDigits: 0,
    }).format(Math.round(v));
  const formatTHBCompact = (v: number) => {
    const abs = Math.abs(v);
    const sign = v < 0 ? "-" : "";
    if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}K`;
    return Math.round(v).toString();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Banknote className="h-6 w-6 text-primary" /> Cashflow Management
        </h2>
        <p className="text-sm text-muted-foreground">
          ดูเงินเข้า/ออกรายเดือนตามงวดงาน + ต้นทุน + โสหุ้ย พร้อม cumulative balance — ระบุเดือนที่เงินสดอาจติดลบล่วงหน้า
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-2">
            <CardDescription className="text-[11px] uppercase tracking-wider font-bold flex items-center gap-1">
              <ArrowUpCircle className="h-3.5 w-3.5" /> เงินเข้ารวม
            </CardDescription>
            <CardTitle className="text-lg lg:text-xl font-black text-emerald-600 font-mono">
              {formatTHB(summary.totalInflow)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[10px] text-muted-foreground">รวม {summary.monthsWithInflow} เดือนที่มีเงินเข้า</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-2">
            <CardDescription className="text-[11px] uppercase tracking-wider font-bold flex items-center gap-1">
              <ArrowDownCircle className="h-3.5 w-3.5" /> เงินออกรวม
            </CardDescription>
            <CardTitle className="text-lg lg:text-xl font-black text-rose-600 font-mono">
              {formatTHB(summary.totalOutflow)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[10px] text-muted-foreground">ค่าแรง + direct + โสหุ้ย + contingency</p>
          </CardContent>
        </Card>

        <Card className={`border-border/50 ${summary.netCashflow < 0 ? "bg-rose-50/50 dark:bg-rose-950/20" : "bg-card/50"}`}>
          <CardHeader className="pb-2">
            <CardDescription className="text-[11px] uppercase tracking-wider font-bold flex items-center gap-1">
              {summary.netCashflow < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
              Net Cashflow
            </CardDescription>
            <CardTitle className={`text-lg lg:text-xl font-black font-mono ${summary.netCashflow < 0 ? "text-rose-600" : "text-emerald-600"}`}>
              {formatTHB(summary.netCashflow)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[10px] text-muted-foreground">เงินเข้า − เงินออก ตลอดปี</p>
          </CardContent>
        </Card>

        <Card className={`border-border/50 ${summary.negativeMonths > 0 ? "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200" : "bg-card/50"}`}>
          <CardHeader className="pb-2">
            <CardDescription className="text-[11px] uppercase tracking-wider font-bold flex items-center gap-1">
              <PiggyBank className="h-3.5 w-3.5" /> Ending Balance
            </CardDescription>
            <CardTitle className={`text-lg lg:text-xl font-black font-mono ${summary.endingBalance < 0 ? "text-rose-600" : "text-primary"}`}>
              {formatTHB(summary.endingBalance)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[10px] text-muted-foreground">
              {summary.negativeMonths > 0
                ? `⚠ มี ${summary.negativeMonths} เดือนยอดติดลบ`
                : `ต่ำสุดในปี: ${formatTHBCompact(summary.minBalance)}`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between p-4 bg-card/30 border border-border/40 rounded-xl">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="outline"
              onClick={() => setSelectedYearCE(selectedYearCE - 1)}
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Select value={String(selectedYearCE)} onValueChange={(v) => setSelectedYearCE(parseInt(v))}>
              <SelectTrigger className="h-8 w-[140px] text-xs font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map((y) => (
                  <SelectItem key={y} value={String(y)}>พ.ศ. {toBuddhistYear(y)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="icon"
              variant="outline"
              onClick={() => setSelectedYearCE(selectedYearCE + 1)}
              className="h-8 w-8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2 bg-muted/40 p-1 rounded-lg">
            <Button
              size="sm"
              variant={statusFilter === "active" ? "secondary" : "ghost"}
              onClick={() => setStatusFilter("active")}
              className="h-7 text-[11px] font-bold"
            >
              Active
            </Button>
            <Button
              size="sm"
              variant={statusFilter === "all" ? "secondary" : "ghost"}
              onClick={() => setStatusFilter("all")}
              className="h-7 text-[11px] font-bold"
            >
              All Projects
            </Button>
          </div>

          {/* Labor source toggle */}
          <div className="flex items-center gap-2 bg-muted/40 p-1 rounded-lg" title="ค่าแรงในเงินออก: payroll จริง หรือ spread จากโปรเจกต์">
            <Button
              size="sm"
              variant={laborSource === "payroll" ? "secondary" : "ghost"}
              onClick={() => {
                setLaborSource("payroll");
                setLaborSourceTouched(true);
              }}
              className="h-7 text-[11px] font-bold gap-1"
              title="ใช้เงินเดือนจริงรายเดือน (ถ้ายังไม่มีพนักงาน → outflow มีแค่ overhead/direct)"
            >
              <Users className="h-3 w-3" /> Payroll
            </Button>
            <Button
              size="sm"
              variant={laborSource === "project-spread" ? "secondary" : "ghost"}
              onClick={() => {
                setLaborSource("project-spread");
                setLaborSourceTouched(true);
              }}
              className="h-7 text-[11px] font-bold"
              title="กระจายค่าแรงตาม project duration"
            >
              Project Spread
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="opening-balance" className="text-xs whitespace-nowrap flex items-center gap-1">
              {openingOverride === null ? <Link2 className="h-3 w-3 text-emerald-600" /> : null}
              Opening:
            </Label>
            <Input
              id="opening-balance"
              type="number"
              value={Math.round(effectiveOpeningBalance)}
              onChange={(e) => setOpeningOverride(Number(e.target.value) || 0)}
              className="h-8 w-[140px] text-xs text-right font-mono"
              placeholder="0"
              title={openingOverride === null
                ? `ยกยอดอัตโนมัติจากปี ${cashflowSettings.anchorYearCE} (พ.ศ. ${cashflowSettings.anchorYearCE + 543})`
                : "ระบุเอง — คลิก reset เพื่อกลับไปใช้ค่าอัตโนมัติ"}
            />
            {openingOverride !== null && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setOpeningOverride(null)}
                className="h-8 w-8"
                title="กลับไปใช้ค่ายกยอดอัตโนมัติ"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          <Dialog open={isSettingsOpen} onOpenChange={(open) => {
            setIsSettingsOpen(open);
            if (open) {
              setSettingsAnchorYear(cashflowSettings.anchorYearCE);
              setSettingsAnchorAmount(cashflowSettings.anchorAmount);
            }
          }}>
            <EditGate admin>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
                  <Settings className="h-3.5 w-3.5" />
                  ตั้งค่ายอดยกมา
                </Button>
              </DialogTrigger>
            </EditGate>
            <DialogContent className="sm:max-w-[480px]">
              <DialogHeader>
                <DialogTitle>ตั้งค่ายอดเงินสดต้นทุน</DialogTitle>
                <DialogDescription>
                  ระบุเงินสดของบริษัท ณ ต้นปีที่ระบุ (1 มกราคม) — ระบบจะใช้เป็นจุดเริ่ม
                  แล้วยกยอดสะสมไปยังปีถัดๆ ไปอัตโนมัติ
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="anchor-year">ปีอ้างอิง (ค.ศ. / พ.ศ.)</Label>
                  <Input
                    id="anchor-year"
                    type="number"
                    value={settingsAnchorYear}
                    onChange={(e) => setSettingsAnchorYear(Number(e.target.value) || new Date().getUTCFullYear())}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    = พ.ศ. {settingsAnchorYear + 543} (1 มกราคม)
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="anchor-amount">ยอดเงินสด ณ 1 มกราคม {settingsAnchorYear + 543} (บาท)</Label>
                  <Input
                    id="anchor-amount"
                    type="number"
                    value={settingsAnchorAmount}
                    onChange={(e) => setSettingsAnchorAmount(Number(e.target.value) || 0)}
                    placeholder="0"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    รวมเงินสดและเงินฝากของบริษัท ณ วันที่ระบุ — ใช้เป็นจุดเริ่มต้นของการคำนวณยอดสะสม
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsSettingsOpen(false)}>ยกเลิก</Button>
                <Button onClick={() => {
                  onUpdateCashflowSettings({
                    anchorYearCE: settingsAnchorYear,
                    anchorAmount: settingsAnchorAmount,
                  });
                  setIsSettingsOpen(false);
                  setOpeningOverride(null);
                }}>
                  บันทึก
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Carryover info banner */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-200/60 dark:border-emerald-900/40 rounded-lg text-xs">
        <Link2 className="h-4 w-4 text-emerald-600 shrink-0" />
        <div className="flex-1">
          {openingOverride !== null ? (
            <>
              <span className="font-semibold">ระบุยอด opening เอง:</span>{" "}
              <span className="font-mono">{formatTHB(openingOverride)}</span>{" "}
              <span className="text-muted-foreground">
                (อัตโนมัติคือ {formatTHB(chainedOpeningBalance)} — ยกยอดจากปี {cashflowSettings.anchorYearCE + 543})
              </span>
            </>
          ) : selectedYearCE === cashflowSettings.anchorYearCE ? (
            <>
              <span className="font-semibold">ปีอ้างอิง:</span>{" "}
              <span className="font-mono">{formatTHB(cashflowSettings.anchorAmount)}</span>{" "}
              <span className="text-muted-foreground">
                — ตั้งไว้ ณ 1 ม.ค. {cashflowSettings.anchorYearCE + 543}
              </span>
            </>
          ) : (
            <>
              <span className="font-semibold">ยกยอดจากปี {(selectedYearCE - 1) + 543}:</span>{" "}
              <span className="font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                {formatTHB(chainedOpeningBalance)}
              </span>{" "}
              <span className="text-muted-foreground">
                — chain จากปีอ้างอิง {cashflowSettings.anchorYearCE + 543} ({formatTHB(cashflowSettings.anchorAmount)})
              </span>
            </>
          )}
        </div>
      </div>

      {/* Payroll info banner */}
      {laborSource === "payroll" && payrollSnapshot && (
        <div className="flex items-start gap-3 p-4 bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-xl">
          <Users className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="flex-1 flex flex-col md:flex-row md:items-center md:justify-between gap-1">
            <div>
              <div className="text-sm font-bold">
                Payroll Mode — ใช้เงินเดือนจริงคำนวณ cashflow
              </div>
              <div className="text-[11px] text-muted-foreground">
                พนักงาน {payrollSnapshot.activeCount} คน · เงินเดือนรวม {formatTHB(payrollSnapshot.monthlyTotal)}/เดือน · รวม {formatTHB(payrollSnapshot.annualTotal)}/ปี (รวมโบนัส)
              </div>
            </div>
          </div>
        </div>
      )}
      {laborSource === "payroll" && !payrollSnapshot && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-900 rounded-xl">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-bold text-amber-900 dark:text-amber-200">
              ยังไม่มีพนักงานในระบบ
            </div>
            <div className="text-[11px] text-amber-800 dark:text-amber-300/90">
              ไปที่ Sidebar → รายชื่อพนักงาน เพื่อเพิ่มข้อมูล หรือสลับเป็น "Project Spread" mode
            </div>
          </div>
        </div>
      )}

      {/* Negative balance warning */}
      {summary.negativeMonths > 0 && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-900 rounded-xl">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
              ⚠ เงินสดอาจติดลบ {summary.negativeMonths} เดือน — ต่ำสุด {formatTHB(summary.minBalance)} ใน {summary.minBalanceMonth}
            </h4>
            <p className="text-xs text-amber-800 dark:text-amber-300/90 leading-relaxed">
              พิจารณา: เพิ่ม opening balance, เจรจาเงินมัดจำ (deposit) สูงขึ้น, ลด payment terms จากลูกค้า,
              หรือเลื่อน direct cost บางส่วนออกไป
            </p>
          </div>
        </div>
      )}

      {/* Main Chart */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle className="text-md flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" /> Monthly Cashflow + Cumulative Balance
          </CardTitle>
          <CardDescription>
            <span className="inline-flex items-center gap-1 mr-3">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-500" /> เงินเข้า
            </span>
            <span className="inline-flex items-center gap-1 mr-3">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-500" /> เงินออก
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block w-3 h-0.5 bg-indigo-600" /> Cumulative balance
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div ref={chartHostRef} className="w-full h-[400px] relative">
            {!hasAnyData ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-6">
                <AlertTriangle className="h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm font-semibold text-muted-foreground">ไม่มี cashflow ในปี {toBuddhistYear(selectedYearCE)}</p>
                <p className="text-[11px] text-muted-foreground max-w-md">
                  ตรวจสอบว่าโปรเจกต์มี payment terms ครบ + วันที่เริ่ม + duration ถูกต้อง
                </p>
              </div>
            ) : chartWidth > 0 ? (
              <ComposedChart
                width={chartWidth}
                height={400}
                data={chartData}
                margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_COLORS.border} />
                <XAxis dataKey="month" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis
                  yAxisId="left"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatTHBCompact(v)}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatTHBCompact(v)}
                />
                <ReferenceLine yAxisId="left" y={0} stroke={CHART_COLORS.zero} strokeWidth={1} />
                <ReferenceLine yAxisId="right" y={0} stroke={CHART_COLORS.zero} strokeDasharray="3 3" strokeWidth={1} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null;
                    const inflowTotal = (payload.find((p) => p.dataKey === "inflow")?.value as number) ?? 0;
                    const outflow = -((payload.find((p) => p.dataKey === "outflow")?.value as number) ?? 0);
                    const cumulative = (payload.find((p) => p.dataKey === "cumulative")?.value as number) ?? 0;
                    // Compute per-project breakdown from chartData row (in payload[0].payload)
                    const row = payload[0]?.payload as Record<string, number | string> | undefined;
                    const perProject = projectInflowSeries
                      .map((s) => ({
                        name: s.name,
                        amount: (row?.[s.dataKey] as number) || 0,
                        color: s.color,
                      }))
                      .filter((p) => p.amount > 0)
                      .sort((a, b) => b.amount - a.amount);
                    // Sum inflow from the per-project breakdown (matches stacked total)
                    const inflowSum = perProject.reduce((s, p) => s + p.amount, 0);
                    const inflow = inflowSum || inflowTotal;
                    const net = inflow - outflow;
                    return (
                      <div className="bg-popover border border-border p-3 rounded-lg shadow-xl text-xs space-y-1.5 min-w-[220px] max-w-[320px]">
                        <div className="font-bold border-b border-border pb-1">{label}</div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">เงินเข้ารวม:</span>
                          <span className="font-mono font-bold text-emerald-600">+{formatTHB(inflow)}</span>
                        </div>
                        {perProject.length > 0 && (
                          <div className="space-y-0.5 pl-2 border-l-2 border-emerald-200 dark:border-emerald-900">
                            {perProject.map((p) => (
                              <div key={p.name} className="flex justify-between gap-2 text-[10.5px]">
                                <span className="flex items-center gap-1 min-w-0">
                                  <span
                                    className="inline-block w-2 h-2 rounded-sm shrink-0"
                                    style={{ backgroundColor: p.color }}
                                  />
                                  <span className="truncate text-muted-foreground" title={p.name}>{p.name}</span>
                                </span>
                                <span className="font-mono text-emerald-700 dark:text-emerald-400 shrink-0">
                                  {formatTHBCompact(p.amount)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">เงินออก:</span>
                          <span className="font-mono font-bold text-rose-600">−{formatTHB(outflow)}</span>
                        </div>
                        <div className="flex justify-between border-t border-border pt-1">
                          <span className="text-muted-foreground">Net:</span>
                          <span className={`font-mono font-bold ${net < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                            {net >= 0 ? "+" : ""}{formatTHB(net)}
                          </span>
                        </div>
                        <div className="flex justify-between border-t border-border pt-1">
                          <span className="text-muted-foreground">Balance:</span>
                          <span className={`font-mono font-bold ${cumulative < 0 ? "text-rose-600" : "text-primary"}`}>
                            {formatTHB(cumulative)}
                          </span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 10, paddingTop: 16 }} />
                {/* Stacked inflow bars — one per contributing project */}
                {projectInflowSeries.length === 0 ? (
                  // Fallback when no inflow data — keep a placeholder bar so legend stays consistent
                  <Bar
                    yAxisId="left"
                    dataKey="inflow"
                    name="เงินเข้า"
                    fill={CHART_COLORS.inflow}
                    radius={[4, 4, 0, 0]}
                    barSize={18}
                    fillOpacity={0.85}
                  />
                ) : (
                  projectInflowSeries.map((s, i) => {
                    const isTop = i === projectInflowSeries.length - 1;
                    return (
                      <Bar
                        key={s.dataKey}
                        yAxisId="left"
                        dataKey={s.dataKey}
                        name={s.name}
                        stackId="inflow"
                        fill={s.color}
                        fillOpacity={0.9}
                        barSize={22}
                        radius={isTop ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                      />
                    );
                  })
                )}
                <Bar yAxisId="left" dataKey="outflow" name="เงินออก" fill={CHART_COLORS.outflow} radius={[0, 0, 4, 4]} barSize={22} fillOpacity={0.9} />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="cumulative"
                  name="ยอดคงเหลือ (Balance)"
                  stroke={CHART_COLORS.balance}
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: CHART_COLORS.balance }}
                  activeDot={{ r: 5 }}
                >
                  <LabelList
                    dataKey="cumulative"
                    position="top"
                    offset={12}
                    fontSize={10}
                    fontWeight={700}
                    fill={CHART_COLORS.balance}
                    stroke="#fff"
                    strokeWidth={3}
                    style={{ paintOrder: "stroke" }}
                    formatter={(value: unknown) =>
                      typeof value === "number" ? formatTHBCompact(value) : ""
                    }
                  />
                </Line>
              </ComposedChart>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Monthly Table */}
      {hasAnyData && (
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="text-md">Monthly Breakdown</CardTitle>
            <CardDescription>รายละเอียดเงินเข้า/ออกรายเดือน + ยอดสะสม</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto -mx-2 sm:mx-0">
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[100px]">เดือน</TableHead>
                    <TableHead className="text-right">เงินเข้า</TableHead>
                    <TableHead className="text-right">เงินออก</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="hidden md:table-cell">รายละเอียดเงินเข้า</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cashflowMonths.map((m) => (
                    <TableRow
                      key={m.monthLabel}
                      className={m.cumulative < 0 ? "bg-rose-50/40 dark:bg-rose-950/10" : "hover:bg-muted/30"}
                    >
                      <TableCell className="font-semibold text-xs">{m.monthLabel}</TableCell>
                      <TableCell className="text-right font-mono text-xs text-emerald-600">
                        {m.inflow > 0 ? `+${formatTHBCompact(m.inflow)}` : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-rose-600">
                        {m.outflow > 0 ? `−${formatTHBCompact(m.outflow)}` : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`font-mono text-xs font-bold ${m.net < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                          {m.net >= 0 ? "+" : ""}{formatTHBCompact(m.net)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`font-mono text-xs font-bold ${m.cumulative < 0 ? "text-rose-600" : "text-primary"}`}>
                          {formatTHBCompact(m.cumulative)}
                        </span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-[11px] text-muted-foreground">
                        {m.inflowDetails.length === 0 ? (
                          <span className="italic">—</span>
                        ) : (
                          <div className="space-y-0.5">
                            {m.inflowDetails.slice(0, 3).map((d, i) => (
                              <div key={i} className="truncate" title={`${d.projectName} • ${d.installmentName}`}>
                                <span className="text-emerald-700 dark:text-emerald-400 font-mono">
                                  {formatTHBCompact(d.amount)}
                                </span>{" "}
                                <span className="text-muted-foreground">{d.installmentName}</span>{" "}
                                <span className="text-muted-foreground/70">· {d.projectName}</span>
                              </div>
                            ))}
                            {m.inflowDetails.length > 3 && (
                              <div className="text-[10px] text-muted-foreground/70">
                                +{m.inflowDetails.length - 3} รายการ
                              </div>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="text-[11px] text-muted-foreground mt-3 space-y-1 leading-relaxed">
              <p>
                <span className="font-semibold">วิธีคำนวณเงินเข้า:</span> งวดงาน (installments) ถูก allocate ไปยังเดือนที่ลูกค้าจ่ายจริง
                (= projectStart + dueAfterDays + paymentDueDays) — ยอดเป็น netReceivable หลังหัก ณ ที่จ่าย
              </p>
              <p>
                <span className="font-semibold">วิธีคำนวณเงินออก:</span> ค่าแรง/direct/contingency กระจาย linear ตลอด project duration +
                โสหุ้ยรายเดือนทุกเดือนใน window
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
