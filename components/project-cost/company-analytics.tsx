"use client";

import React, { useMemo, useState, useRef, useEffect } from "react";
import { Project, PositionRate, ProjectStatus, OverheadItem, Subscription, Commission, CommissionPayee } from "@/lib/types";
import { summarizeRevenue } from "@/lib/subscriptions";
import { estimateCommissionTotal, summarizeCommissions, ScoredCommission } from "@/lib/commissions";
import {
  computeYearWindow,
  computeMonthlyCompanyLoad,
  toBuddhistYear,
  getAvailableYears,
  getProjectDateRange,
} from "@/lib/resource-planning";
import { calculateProjectCosts } from "@/lib/calculations";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
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
  Cell,
} from "recharts";
import { TrendingUp, Users, AlertTriangle, ChevronLeft, ChevronRight, UserPlus, CheckCircle2, Wallet, TrendingDown, Banknote } from "lucide-react";

// Theme-stable literal colors (avoid SVG-attr resolving CSS var → oklch quirks in Recharts 3)
const CHART_COLORS = {
  primary: "#4f46e5",      // indigo-600 — matches --primary range
  destructive: "#e11d48",  // rose-600
  muted: "#94a3b8",        // slate-400
  border: "#e2e8f0",       // slate-200
};

interface CompanyAnalyticsProps {
  projects: Project[];
  positions: PositionRate[];
  overheads?: OverheadItem[];
  subscriptions?: Subscription[];
  commissions?: Commission[];
  commissionPayees?: CommissionPayee[];
}

export function CompanyAnalytics({
  projects,
  positions,
  overheads = [],
  subscriptions = [],
  commissions = [],
  commissionPayees = [],
}: CompanyAnalyticsProps) {
  const [selectedYearCE, setSelectedYearCE] = useState<number>(new Date().getUTCFullYear());
  const [statusFilter, setStatusFilter] = useState<"active" | "all">("active");

  // Self-measured chart width — avoids Recharts ResponsiveContainer flakiness inside Radix Tabs
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

  const monthlyData = useMemo(() => {
    const excludeStatuses = statusFilter === "active" ? ["lost"] : [];
    return computeMonthlyCompanyLoad(positions, projects, yearWindow, { excludeStatuses });
  }, [positions, projects, yearWindow, statusFilter]);

  // Aggregate stats (guard against empty/zero data)
  const peakUtilization = monthlyData.length
    ? Math.max(...monthlyData.map((d) => d.utilization))
    : 0;
  const avgUtilization = monthlyData.length
    ? monthlyData.reduce((s, d) => s + d.utilization, 0) / monthlyData.length
    : 0;
  const criticalMonths = monthlyData.filter((d) => d.utilization > 100).length;
  const hasAnyData = monthlyData.some((d) => d.load > 0 || d.capacity > 0);

  // ---- Recurring revenue summary (subscriptions / licenses) ----
  const revenueSummary = useMemo(() => summarizeRevenue(subscriptions), [subscriptions]);
  const fmtBaht = (v: number) =>
    new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(v);

  // ---- Per-role breakdown (workload + financial) ----
  // Allocates project revenue & cost to each role proportionally:
  //   - by year-overlap (project may span multiple years)
  //   - by mandays share within the project (for revenue split)
  const WD_PER_MONTH = 20;
  const MONTHS_PER_YEAR = 12;

  // Precompute project financials once
  const projectCalcMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof calculateProjectCosts>>();
    for (const p of projects) {
      map.set(p.id, calculateProjectCosts(p, positions, overheads));
    }
    return map;
  }, [projects, positions, overheads]);

  const excludedStatuses = statusFilter === "active" ? new Set(["lost"]) : new Set<string>();

  const roleBreakdown = useMemo(() => {
    return positions
      .map((pos) => {
        // --- Workload metrics from monthlyData ---
        const perMonth = monthlyData.map((m) => {
          const detail = m.positionDetails.find((d) => d.positionId === pos.id);
          const load = detail?.load ?? 0;
          const capacity = detail?.capacity ?? 0;
          const util = capacity > 0 ? (load / capacity) * 100 : load > 0 ? Infinity : 0;
          return { month: m.month, load, capacity, util };
        });
        const peakEntry = perMonth.reduce(
          (best, cur) => (cur.load > best.load ? cur : best),
          perMonth[0] ?? { month: "-", load: 0, capacity: 0, util: 0 }
        );
        const totalLoad = perMonth.reduce((s, m) => s + m.load, 0);
        const totalCapacity = perMonth.reduce((s, m) => s + m.capacity, 0);
        const avgUtil = totalCapacity > 0 ? (totalLoad / totalCapacity) * 100 : 0;
        const criticalMonthsForRole = perMonth.filter((m) => m.util > 100).length;
        const currentHeadcount = pos.headcount || 0;
        const recommendedHeadcount = Math.max(
          currentHeadcount,
          Math.ceil(peakEntry.load / WD_PER_MONTH)
        );
        const headcountGap = Math.max(0, recommendedHeadcount - currentHeadcount);

        // --- Financial allocation to this role across all projects (year-windowed) ---
        let revenueInYear = 0;
        let costInYear = 0;
        const yearStart = yearWindow.start.getTime();
        const yearEnd = yearWindow.end.getTime();

        for (const project of projects) {
          if (excludedStatuses.has(project.status)) continue;
          const calc = projectCalcMap.get(project.id);
          if (!calc) continue;
          const labor = calc.laborCostBreakdown.find((l) => l.positionId === pos.id);
          if (!labor || labor.mandays <= 0) continue;

          const range = getProjectDateRange(project);
          const projectSpan = range.end.getTime() - range.start.getTime();
          if (projectSpan <= 0) continue;
          const overlap = Math.max(
            0,
            Math.min(range.end.getTime(), yearEnd) - Math.max(range.start.getTime(), yearStart)
          );
          if (overlap <= 0) continue;
          const overlapRatio = overlap / projectSpan;

          // role's revenue share within this project = mandays share
          const mandaysShare =
            calc.totalProjectMandays > 0 ? labor.mandays / calc.totalProjectMandays : 0;

          revenueInYear += calc.priceBeforeTax * overlapRatio * mandaysShare;
          costInYear += labor.totalCost * overlapRatio;
        }
        const profitInYear = revenueInYear - costInYear;
        const marginPercent = revenueInYear > 0 ? (profitInYear / revenueInYear) * 100 : 0;
        const revenuePerManday = totalLoad > 0 ? revenueInYear / totalLoad : 0;

        // --- Hiring economics: cost to add 1 person for a year vs revenue capacity ---
        const benefitMul = 1 + (pos.benefitPercent ?? 0) / 100;
        const annualHireCostPerPerson =
          (pos.salary || 0) * MONTHS_PER_YEAR * benefitMul +
          (pos.socialSecurityAmount || 0) * MONTHS_PER_YEAR;
        // Annual revenue 1 fully-utilized person could bring at the current revenue/manday rate
        const annualRevenuePerFTE = revenuePerManday * WD_PER_MONTH * MONTHS_PER_YEAR;
        // ROI: > 1 means 1 new hire pays for themselves at current pricing
        const hireRoi =
          annualHireCostPerPerson > 0 ? annualRevenuePerFTE / annualHireCostPerPerson : 0;
        // Projected delta if we actually fill the gap
        const additionalHireCost = headcountGap * annualHireCostPerPerson;
        const additionalRevenueCapacity = headcountGap * annualRevenuePerFTE;

        return {
          position: pos,
          peakLoad: peakEntry.load,
          peakMonth: peakEntry.month,
          peakUtil: peakEntry.util,
          avgUtil,
          criticalMonths: criticalMonthsForRole,
          currentHeadcount,
          recommendedHeadcount,
          headcountGap,
          // financial
          revenueInYear,
          costInYear,
          profitInYear,
          marginPercent,
          revenuePerManday,
          annualHireCostPerPerson,
          annualRevenuePerFTE,
          hireRoi,
          additionalHireCost,
          additionalRevenueCapacity,
        };
      })
      .sort((a, b) => {
        if (b.headcountGap !== a.headcountGap) return b.headcountGap - a.headcountGap;
        return b.peakUtil - a.peakUtil;
      });
  }, [positions, projects, monthlyData, projectCalcMap, excludedStatuses, yearWindow]);

  const totalHeadcountGap = roleBreakdown.reduce((s, r) => s + r.headcountGap, 0);

  // Company-wide financial totals for the year
  const companyFinancials = useMemo(() => {
    const yearStart = yearWindow.start.getTime();
    const yearEnd = yearWindow.end.getTime();
    let revenue = 0;
    let laborCost = 0;
    let directCost = 0;
    let overhead = 0;
    let contingency = 0;
    for (const project of projects) {
      if (excludedStatuses.has(project.status)) continue;
      const calc = projectCalcMap.get(project.id);
      if (!calc) continue;
      const range = getProjectDateRange(project);
      const projectSpan = range.end.getTime() - range.start.getTime();
      if (projectSpan <= 0) continue;
      const overlap = Math.max(
        0,
        Math.min(range.end.getTime(), yearEnd) - Math.max(range.start.getTime(), yearStart)
      );
      if (overlap <= 0) continue;
      const ratio = overlap / projectSpan;
      revenue += calc.priceBeforeTax * ratio;
      laborCost += calc.laborCost * ratio;
      directCost += calc.directCost * ratio;
      overhead += calc.allocatedOverhead * ratio;
      contingency += calc.contingencyAmount * ratio;
    }
    const totalCost = laborCost + directCost + overhead + contingency;
    const profit = revenue - totalCost;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    return { revenue, laborCost, directCost, overhead, contingency, totalCost, profit, margin };
  }, [projects, projectCalcMap, excludedStatuses, yearWindow]);

  // ---- Commission summary + leaderboard ----
  const commissionData = useMemo(() => {
    const projectBaseById = new Map(
      projects.map((p) => [p.id, (projectCalcMap.get(p.id)?.priceBeforeTax) ?? 0])
    );
    const subById = new Map(subscriptions.map((s) => [s.id, s]));
    const payeeName = new Map(commissionPayees.map((p) => [p.id, p.name]));
    const scored: ScoredCommission[] = commissions.map((c) => {
      const amount =
        c.sourceType === "project"
          ? estimateCommissionTotal(c, { projectBaseAmount: projectBaseById.get(c.sourceId) ?? 0 })
          : estimateCommissionTotal(c, { subscription: subById.get(c.sourceId) });
      return { payeeId: c.payeeId, status: c.status, amount };
    });
    const summary = summarizeCommissions(scored);
    const leaderboard = summary.byPayee
      .slice(0, 5)
      .map((b) => ({ name: payeeName.get(b.payeeId) ?? "(ไม่พบผู้รับคอม)", total: b.total, count: b.count }));
    return { summary, leaderboard };
  }, [commissions, commissionPayees, projects, projectCalcMap, subscriptions]);

  const profitAfterCommission = companyFinancials.profit - commissionData.summary.totalAll;

  const totalAdditionalHireCost = roleBreakdown.reduce((s, r) => s + r.additionalHireCost, 0);
  const totalAdditionalRevenueCapacity = roleBreakdown.reduce(
    (s, r) => s + r.additionalRevenueCapacity,
    0
  );

  const formatUtil = (v: number) => (Number.isFinite(v) ? `${v.toFixed(0)}%` : "—");
  const formatTHB = (v: number) =>
    new Intl.NumberFormat("th-TH", {
      style: "currency",
      currency: "THB",
      maximumFractionDigits: 0,
    }).format(Math.round(v));
  const formatTHBCompact = (v: number) => {
    const abs = Math.abs(v);
    if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
    return Math.round(v).toString();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-primary" /> Company Analytics
        </h2>
        <p className="text-sm text-muted-foreground">
          วิเคราะห์โหลดงานรวมของทั้งบริษัท เทียบกับขีดความสามารถ (Capacity) รายเดือน
        </p>
      </div>

      {/* Recurring Revenue (Subscriptions) */}
      {subscriptions.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Banknote className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold tracking-tight">รายรับประจำ (Recurring Revenue)</h3>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="border-border/50 bg-card/50">
              <CardHeader className="pb-2">
                <CardDescription className="text-[11px] uppercase tracking-wider font-bold">MRR</CardDescription>
                <CardTitle className="text-xl font-black text-primary font-mono">฿{fmtBaht(revenueSummary.mrr)}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-[10px] text-muted-foreground">รายได้ต่อเนื่องต่อเดือน</p>
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-card/50">
              <CardHeader className="pb-2">
                <CardDescription className="text-[11px] uppercase tracking-wider font-bold">ARR</CardDescription>
                <CardTitle className="text-xl font-black text-emerald-600 font-mono">฿{fmtBaht(revenueSummary.arr)}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-[10px] text-muted-foreground">รายได้ต่อเนื่องต่อปี (MRR × 12)</p>
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-card/50">
              <CardHeader className="pb-2">
                <CardDescription className="text-[11px] uppercase tracking-wider font-bold">ลูกค้าที่ใช้งาน</CardDescription>
                <CardTitle className="text-2xl font-black">{revenueSummary.activeCount}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-[10px] text-muted-foreground">
                  subscription {revenueSummary.recurringCount} · license {revenueSummary.activeLicenseCount}
                </p>
              </CardContent>
            </Card>
            <Card className={`border-border/50 ${revenueSummary.expiringSoonCount > 0 ? "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200" : "bg-card/50"}`}>
              <CardHeader className="pb-2">
                <CardDescription className="text-[11px] uppercase tracking-wider font-bold">ใกล้หมดอายุ</CardDescription>
                <CardTitle className={`text-2xl font-black ${revenueSummary.expiringSoonCount > 0 ? "text-amber-600" : ""}`}>
                  {revenueSummary.expiringSoonCount}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-[10px] text-muted-foreground">ภายใน 30 วัน · หมดอายุแล้ว {revenueSummary.expiredCount}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Commission */}
      {commissions.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Banknote className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold tracking-tight">ค่าคอมมิชชั่น</h3>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="border-border/50 bg-card/50">
              <CardHeader className="pb-2">
                <CardDescription className="text-[11px] uppercase tracking-wider font-bold">ค่าคอมรวม</CardDescription>
                <CardTitle className="text-xl font-black text-primary font-mono">฿{fmtBaht(commissionData.summary.totalAll)}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-[10px] text-muted-foreground">ค้างจ่าย + จ่ายแล้ว (ประเมินตลอดสัญญา)</p>
              </CardContent>
            </Card>
            <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
              <CardHeader className="pb-2">
                <CardDescription className="text-[11px] uppercase tracking-wider font-bold">ค้างจ่าย</CardDescription>
                <CardTitle className="text-xl font-black text-amber-600 font-mono">฿{fmtBaht(commissionData.summary.totalPending)}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-[10px] text-muted-foreground">{commissionData.summary.countPending} รายการ</p>
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-card/50">
              <CardHeader className="pb-2">
                <CardDescription className="text-[11px] uppercase tracking-wider font-bold">จ่ายแล้ว</CardDescription>
                <CardTitle className="text-xl font-black text-emerald-600 font-mono">฿{fmtBaht(commissionData.summary.totalPaid)}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-[10px] text-muted-foreground">{commissionData.summary.countPaid} รายการ</p>
              </CardContent>
            </Card>
            <Card className={`border-border/50 ${profitAfterCommission < 0 ? "bg-rose-50/50 dark:bg-rose-950/20 border-rose-200" : "bg-card/50"}`}>
              <CardHeader className="pb-2">
                <CardDescription className="text-[11px] uppercase tracking-wider font-bold">กำไรหลังหักคอม</CardDescription>
                <CardTitle className={`text-xl font-black font-mono ${profitAfterCommission < 0 ? "text-rose-600" : "text-primary"}`}>
                  ฿{fmtBaht(profitAfterCommission)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-[10px] text-muted-foreground">กำไรโครงการ (ปีนี้) − ค่าคอมรวม</p>
              </CardContent>
            </Card>
          </div>

          {commissionData.leaderboard.length > 0 && (
            <Card className="border-border/50 bg-card/50 mt-3">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">อันดับผู้รับคอม (Top 5)</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-1.5">
                  {commissionData.leaderboard.map((r, i) => (
                    <div key={r.name} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="text-[11px] text-muted-foreground w-4 text-right">{i + 1}.</span>
                        <span className="truncate font-medium">{r.name}</span>
                        <span className="text-[10px] text-muted-foreground">({r.count})</span>
                      </span>
                      <span className="font-mono font-bold text-primary shrink-0">฿{fmtBaht(r.total)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-2">
            <CardDescription className="text-[11px] uppercase tracking-wider font-bold">Peak Utilization</CardDescription>
            <CardTitle className={`text-2xl font-black ${peakUtilization > 100 ? "text-rose-600" : "text-primary"}`}>
              {peakUtilization.toFixed(1)}%
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[10px] text-muted-foreground">อัตราการใช้งานคนสูงสุดในรอบปี</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-2">
            <CardDescription className="text-[11px] uppercase tracking-wider font-bold">Avg. Utilization</CardDescription>
            <CardTitle className="text-2xl font-black text-primary">
              {avgUtilization.toFixed(1)}%
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[10px] text-muted-foreground">ค่าเฉลี่ยการใช้งานคนทั้งปี</p>
          </CardContent>
        </Card>

        <Card className={`border-border/50 ${criticalMonths > 0 ? "bg-rose-50/50 dark:bg-rose-950/20 border-rose-200" : "bg-card/50"}`}>
          <CardHeader className="pb-2">
            <CardDescription className="text-[11px] uppercase tracking-wider font-bold">Critical Months</CardDescription>
            <CardTitle className={`text-2xl font-black ${criticalMonths > 0 ? "text-rose-600" : ""}`}>
              {criticalMonths}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[10px] text-muted-foreground">จำนวนเดือนที่มีโหลดงานเกิน 100%</p>
          </CardContent>
        </Card>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-2">
            <CardDescription className="text-[11px] uppercase tracking-wider font-bold flex items-center gap-1">
              <Banknote className="h-3.5 w-3.5" /> Revenue
            </CardDescription>
            <CardTitle className="text-lg lg:text-xl font-black text-primary font-mono">
              {formatTHB(companyFinancials.revenue)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[10px] text-muted-foreground">ราคาขายก่อน VAT ที่ allocate ในปีนี้</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-2">
            <CardDescription className="text-[11px] uppercase tracking-wider font-bold flex items-center gap-1">
              <Wallet className="h-3.5 w-3.5" /> Total Cost
            </CardDescription>
            <CardTitle className="text-lg lg:text-xl font-black text-slate-700 dark:text-slate-300 font-mono">
              {formatTHB(companyFinancials.totalCost)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[10px] text-muted-foreground">
              คน {formatTHBCompact(companyFinancials.laborCost)} + โสหุ้ย {formatTHBCompact(companyFinancials.overhead)} + อื่นๆ
            </p>
          </CardContent>
        </Card>
        <Card className={`border-border/50 ${companyFinancials.profit < 0 ? "bg-rose-50/50 dark:bg-rose-950/20 border-rose-200" : "bg-card/50"}`}>
          <CardHeader className="pb-2">
            <CardDescription className="text-[11px] uppercase tracking-wider font-bold flex items-center gap-1">
              {companyFinancials.profit < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
              Net Profit
            </CardDescription>
            <CardTitle className={`text-lg lg:text-xl font-black font-mono ${companyFinancials.profit < 0 ? "text-rose-600" : "text-emerald-600"}`}>
              {formatTHB(companyFinancials.profit)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[10px] text-muted-foreground">Revenue − Cost (ก่อน VAT/หัก ณ ที่จ่าย)</p>
          </CardContent>
        </Card>
        <Card className={`border-border/50 ${companyFinancials.margin < 0 ? "bg-rose-50/50 dark:bg-rose-950/20" : companyFinancials.margin < 15 ? "bg-amber-50/50 dark:bg-amber-950/20" : "bg-card/50"}`}>
          <CardHeader className="pb-2">
            <CardDescription className="text-[11px] uppercase tracking-wider font-bold">Net Margin</CardDescription>
            <CardTitle className={`text-lg lg:text-xl font-black font-mono ${companyFinancials.margin < 0 ? "text-rose-600" : companyFinancials.margin < 15 ? "text-amber-600" : "text-emerald-600"}`}>
              {companyFinancials.margin.toFixed(1)}%
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[10px] text-muted-foreground">
              {companyFinancials.margin < 0 ? "ขาดทุน — pricing/ต้นทุนผิดพลาด" : companyFinancials.margin < 15 ? "ค่อนข้างต่ำ — ระวัง" : "อยู่ในเกณฑ์ปลอดภัย"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between p-4 bg-card/30 border border-border/40 rounded-xl">
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="outline"
            onClick={() => setSelectedYearCE(selectedYearCE - 1)}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Select
            value={String(selectedYearCE)}
            onValueChange={(v) => setSelectedYearCE(parseInt(v))}
          >
            <SelectTrigger className="h-8 w-[140px] text-xs font-bold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  พ.ศ. {toBuddhistYear(y)}
                </SelectItem>
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
            Active Projects
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
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6">
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="text-md flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Workload vs Capacity (Mandays)
            </CardTitle>
            <CardDescription>แสดงโหลดงานรวมของทุกตำแหน่งงานเปรียบเทียบกับขีดความสามารถทั้งหมด</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div ref={chartHostRef} className="w-full h-[350px] relative">
              {!hasAnyData ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-6">
                  <AlertTriangle className="h-8 w-8 text-muted-foreground/50" />
                  <p className="text-sm font-semibold text-muted-foreground">ยังไม่มีข้อมูลในปี {toBuddhistYear(selectedYearCE)}</p>
                  <p className="text-[11px] text-muted-foreground max-w-md">
                    {positions.length === 0
                      ? "ยังไม่ได้ตั้งตำแหน่งงาน — ไปที่ Master Data → Positions"
                      : positions.every((p) => !p.headcount)
                      ? "ตำแหน่งงานทั้งหมดยังไม่ได้ระบุ Headcount (จำนวนคน) — Capacity จึงเป็น 0"
                      : `ไม่มีโปรเจกต์ที่ active ในปีนี้ (ลอง toggle เป็น "All Projects" หรือเลือกปีอื่น)`}
                  </p>
                </div>
              ) : chartWidth > 0 ? (
                <ComposedChart
                  width={chartWidth}
                  height={350}
                  data={monthlyData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_COLORS.border} />
                  <XAxis
                    dataKey="month"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${value}d`}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-popover border border-border p-3 rounded-lg shadow-xl text-xs space-y-2 min-w-[150px]">
                            <div className="font-bold border-b border-border pb-1">{label}</div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Load:</span>
                              <span className="font-mono font-bold text-primary">{data.load.toFixed(1)} d</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Capacity:</span>
                              <span className="font-mono">{data.capacity.toFixed(0)} d</span>
                            </div>
                            <div className="flex justify-between pt-1 border-t border-border">
                              <span className="text-muted-foreground">Utilization:</span>
                              <span className={`font-mono font-bold ${data.utilization > 100 ? "text-rose-500" : "text-emerald-500"}`}>
                                {data.utilization.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 10, paddingTop: 20 }} />
                  <Bar
                    dataKey="load"
                    name="Project Load"
                    radius={[4, 4, 0, 0]}
                    barSize={30}
                  >
                    {monthlyData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.utilization > 100 ? CHART_COLORS.destructive : CHART_COLORS.primary}
                        fillOpacity={0.85}
                      />
                    ))}
                  </Bar>
                  <Line
                    type="monotone"
                    dataKey="capacity"
                    name="Total Capacity"
                    stroke={CHART_COLORS.muted}
                    strokeDasharray="5 5"
                    strokeWidth={2}
                    dot={false}
                  />
                </ComposedChart>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {criticalMonths > 0 && (
          <div className="flex items-start gap-3 p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 rounded-xl">
            <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-rose-900 dark:text-rose-200">ข้อควรระวัง: กำลังคนไม่เพียงพอ</h4>
              <p className="text-xs text-rose-800 dark:text-rose-300/90 leading-relaxed">
                ในบางเดือนมีโหลดงานสูงกว่า Capacity ของทีมงานทั้งหมดรวมกัน คุณควรพิจารณาขยายเวลาส่งมอบในบางโปรเจกต์
                หรือเพิ่มจำนวนพนักงาน (Headcount) ในตำแหน่งที่วิกฤต — ดูตารางรายตำแหน่งด้านล่าง
              </p>
            </div>
          </div>
        )}

        {/* Per-role breakdown — workload + financial */}
        {hasAnyData && (
          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <CardTitle className="text-md flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" /> Role Breakdown — Workload + P&amp;L
              </CardTitle>
              <CardDescription className="flex flex-col gap-1">
                <span>โหลดงาน + revenue/cost/profit ที่ allocate ให้แต่ละตำแหน่ง พร้อม ROI ของการ hire เพิ่ม</span>
                {totalHeadcountGap > 0 ? (
                  <span className="text-rose-600 font-semibold text-xs inline-flex items-center gap-1">
                    <UserPlus className="h-3.5 w-3.5" />
                    แนะนำเพิ่ม {totalHeadcountGap} คน — ต้นทุน ~{formatTHB(totalAdditionalHireCost)}/ปี ↔ capacity revenue เพิ่มได้ ~{formatTHB(totalAdditionalRevenueCapacity)}/ปี
                  </span>
                ) : (
                  <span className="text-emerald-600 font-semibold text-xs inline-flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Headcount เพียงพอกับโหลดงานในปีนี้
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto -mx-2 sm:mx-0">
                <Table className="min-w-[900px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[170px]">ตำแหน่ง</TableHead>
                      <TableHead className="text-center">HC</TableHead>
                      <TableHead className="text-right">Peak Util</TableHead>
                      <TableHead className="text-right hidden md:table-cell">Revenue</TableHead>
                      <TableHead className="text-right hidden md:table-cell">Cost</TableHead>
                      <TableHead className="text-right">Profit</TableHead>
                      <TableHead className="text-right hidden lg:table-cell">Margin</TableHead>
                      <TableHead className="text-right hidden xl:table-cell">฿/MD</TableHead>
                      <TableHead className="text-center">Hire ROI</TableHead>
                      <TableHead className="text-center">แนะนำ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {roleBreakdown.map((r) => {
                      const isCritical = r.headcountGap > 0;
                      const overloaded = r.peakUtil > 100;
                      const profitable = r.profitInYear >= 0;
                      // ROI thresholds: > 2 = great, 1.2–2 = OK, < 1.2 = risky, < 1 = loss
                      const roiTone =
                        r.hireRoi >= 2
                          ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30"
                          : r.hireRoi >= 1.2
                          ? "text-amber-600 bg-amber-50 dark:bg-amber-950/30"
                          : r.hireRoi > 0
                          ? "text-rose-600 bg-rose-50 dark:bg-rose-950/30"
                          : "text-muted-foreground bg-muted/30";
                      const roiLabel = r.hireRoi >= 2 ? "คุ้มมาก" : r.hireRoi >= 1.2 ? "พอคุ้ม" : r.hireRoi > 0 ? "ต่ำ" : "—";
                      return (
                        <TableRow
                          key={r.position.id}
                          className={isCritical ? "bg-rose-50/40 dark:bg-rose-950/10 hover:bg-rose-50/60 dark:hover:bg-rose-950/20" : "hover:bg-muted/30"}
                        >
                          <TableCell>
                            <div className="font-semibold text-sm">{r.position.title}</div>
                            <div className="text-[11px] text-muted-foreground md:hidden font-mono">
                              ฿{formatTHBCompact(r.revenueInYear)} − ฿{formatTHBCompact(r.costInYear)}
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-mono text-xs">
                            {r.currentHeadcount}
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className={`text-xs font-mono font-bold ${
                                overloaded ? "text-rose-600" : r.peakUtil > 80 ? "text-amber-600" : "text-emerald-600"
                              }`}
                            >
                              {formatUtil(r.peakUtil)}
                            </span>
                            <div className="text-[10px] text-muted-foreground font-mono">
                              {r.peakMonth}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs hidden md:table-cell">
                            {formatTHBCompact(r.revenueInYear)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs hidden md:table-cell text-slate-600 dark:text-slate-400">
                            {formatTHBCompact(r.costInYear)}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={`text-xs font-mono font-bold ${profitable ? "text-emerald-600" : "text-rose-600"}`}>
                              {profitable ? "" : "−"}฿{formatTHBCompact(Math.abs(r.profitInYear))}
                            </span>
                          </TableCell>
                          <TableCell className="text-right hidden lg:table-cell">
                            <span
                              className={`text-xs font-mono font-bold ${
                                r.marginPercent < 0 ? "text-rose-600" : r.marginPercent < 20 ? "text-amber-600" : "text-emerald-600"
                              }`}
                            >
                              {r.revenueInYear > 0 ? `${r.marginPercent.toFixed(0)}%` : "—"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs hidden xl:table-cell text-muted-foreground">
                            {r.revenuePerManday > 0 ? formatTHBCompact(r.revenuePerManday) : "—"}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className={`inline-flex flex-col items-center px-2 py-0.5 rounded-md ${roiTone}`}>
                              <span className="text-xs font-mono font-bold">
                                {r.hireRoi > 0 ? `${r.hireRoi.toFixed(1)}×` : "—"}
                              </span>
                              <span className="text-[9px] uppercase tracking-wider">{roiLabel}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {r.headcountGap > 0 ? (
                              <div className="flex flex-col items-center gap-0.5">
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 bg-rose-100 dark:bg-rose-950/40 px-2 py-0.5 rounded-full whitespace-nowrap">
                                  <UserPlus className="h-3 w-3" />
                                  +{r.headcountGap}
                                </span>
                                <span className="text-[10px] text-muted-foreground font-mono whitespace-nowrap">
                                  −฿{formatTHBCompact(r.additionalHireCost)}/y
                                </span>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600">
                                <CheckCircle2 className="h-3 w-3" />
                                พอ
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="text-[11px] text-muted-foreground mt-3 space-y-1 leading-relaxed">
                <p>
                  <span className="font-semibold">Revenue ต่อ role:</span> ปันส่วนจาก priceBeforeTax ของแต่ละโปรเจกต์ × (overlap_year/duration) × (role_mandays/total_mandays)
                </p>
                <p>
                  <span className="font-semibold">Hire ROI:</span> รายได้ต่อปีที่ FTE 1 คนทำได้ (ที่ revenue/manday ปัจจุบัน) ÷ ต้นทุนจริงในการจ้าง 1 คน (salary × 12 × (1+benefit%) + sso × 12) —
                  ROI &gt; 1 = จ้างแล้วคุ้มในแง่ revenue, &gt; 2 = คุ้มชัดเจน, &lt; 1.2 = เสี่ยง
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
