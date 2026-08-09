import { Project, PositionRate } from "./types";

// ============================================================
// Date utilities
// ============================================================

/** Parse ISO date string (YYYY-MM-DD or full ISO) → Date at UTC midnight */
function parseDate(s: string): Date {
  // เอาเฉพาะส่วน YYYY-MM-DD เพื่อหลีกเลี่ยง timezone issue
  const datePart = s.includes("T") ? s.split("T")[0] : s;
  return new Date(datePart + "T00:00:00Z");
}

function formatISO(d: Date): string {
  return d.toISOString().split("T")[0];
}

/** เพิ่มจำนวนเดือนเข้าวันที่ (รองรับ fractional — ประมาณส่วนทศนิยมเป็นวัน) */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const intPart = months >= 0 ? Math.floor(months) : Math.ceil(months);
  const fracPart = months - intPart;
  d.setUTCMonth(d.getUTCMonth() + intPart);
  if (fracPart !== 0) {
    // ประมาณ fractional month เป็นวัน (ใช้ 30 วัน/เดือน)
    d.setUTCDate(d.getUTCDate() + Math.round(fracPart * 30));
  }
  return d;
}

/** ระยะห่างเป็นเดือน (รวมเศษ) ระหว่างสองวัน */
export function monthsBetween(start: Date, end: Date): number {
  const yearsDiff = end.getUTCFullYear() - start.getUTCFullYear();
  const monthsDiff = end.getUTCMonth() - start.getUTCMonth();
  const daysDiff = end.getUTCDate() - start.getUTCDate();
  return yearsDiff * 12 + monthsDiff + daysDiff / 30;
}

// ============================================================
// Project date range
// ============================================================

export interface ProjectDateRange {
  start: Date;
  end: Date;
  startISO: string;
  endISO: string;
}

/**
 * กำหนดช่วงเวลาของโปรเจกต์:
 * - start = startDate (ถ้ามี) หรือ quotationDate
 * - end = start + durationMonths
 */
export function getProjectDateRange(project: Project): ProjectDateRange {
  const startISO = project.startDate || project.quotationDate;
  const start = parseDate(startISO);
  const months = Math.max(project.durationMonths || 1, 0.1);
  const end = addMonths(start, months);
  return {
    start,
    end,
    startISO: formatISO(start),
    endISO: formatISO(end),
  };
}

// ============================================================
// Timeline window
// ============================================================

export interface TimelineWindow {
  start: Date;
  end: Date;
  monthCount: number;
  months: { date: Date; label: string }[];
}

/** สร้าง timeline window ที่ครอบคลุมทุกโปรเจกต์ ขอบ buffer ±1 เดือน */
export function computeTimelineWindow(
  projects: Project[],
  fallbackMonths = 6
): TimelineWindow {
  if (projects.length === 0) {
    const start = new Date();
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);
    const end = addMonths(start, fallbackMonths);
    return buildWindow(start, end);
  }

  let minStart = Infinity;
  let maxEnd = -Infinity;
  for (const p of projects) {
    const { start, end } = getProjectDateRange(p);
    minStart = Math.min(minStart, start.getTime());
    maxEnd = Math.max(maxEnd, end.getTime());
  }

  // Round to 1st of month + buffer
  const start = new Date(minStart);
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  // ขยายอีก 1 เดือนทางซ้าย
  const startWithBuffer = addMonths(start, -1);

  const end = new Date(maxEnd);
  // ขยายไปสิ้นเดือนหรือเดือนถัดไป
  end.setUTCDate(1);
  end.setUTCHours(0, 0, 0, 0);
  const endWithBuffer = addMonths(end, 2);

  return buildWindow(startWithBuffer, endWithBuffer);
}

function buildWindow(start: Date, end: Date): TimelineWindow {
  const months: { date: Date; label: string }[] = [];
  let cur = new Date(start);
  while (cur < end) {
    months.push({
      date: new Date(cur),
      label: cur.toLocaleDateString("th-TH", { month: "short", year: "2-digit" }),
    });
    cur = addMonths(cur, 1);
  }
  return {
    start,
    end,
    monthCount: months.length,
    months,
  };
}

/**
 * สร้าง timeline window ของปี ค.ศ. ที่ระบุ (ครอบคลุม ม.ค. – ธ.ค.)
 */
export function computeYearWindow(yearCE: number): TimelineWindow {
  const start = new Date(Date.UTC(yearCE, 0, 1)); // 1 January
  const end = new Date(Date.UTC(yearCE + 1, 0, 1)); // 1 January next year
  const months: { date: Date; label: string }[] = [];
  for (let m = 0; m < 12; m++) {
    const monthDate = new Date(Date.UTC(yearCE, m, 1));
    months.push({
      date: monthDate,
      label: monthDate.toLocaleDateString("th-TH", { month: "short" }),
    });
  }
  return { start, end, monthCount: 12, months };
}

// ============================================================
// Thai Buddhist year helpers
// ============================================================

/** แปลงปี ค.ศ. → พ.ศ. */
export function toBuddhistYear(yearCE: number): number {
  return yearCE + 543;
}

/** แปลงปี พ.ศ. → ค.ศ. */
export function toCommonYear(yearBE: number): number {
  return yearBE - 543;
}

/**
 * หาช่วงปี (ค.ศ.) ที่มีโปรเจกต์ — สำหรับ year selector
 * ถ้าไม่มีโปรเจกต์ → คืนแค่ปีปัจจุบัน
 */
export function getAvailableYears(projects: Project[]): number[] {
  const years = new Set<number>();
  const currentYear = new Date().getUTCFullYear();
  years.add(currentYear);
  years.add(currentYear + 1); // เผื่อปีถัดไป

  for (const p of projects) {
    const range = getProjectDateRange(p);
    const startYear = range.start.getUTCFullYear();
    const endYear = range.end.getUTCFullYear();
    for (let y = startYear; y <= endYear; y++) {
      years.add(y);
    }
  }

  return Array.from(years).sort((a, b) => a - b);
}

// ============================================================
// Bar positioning
// ============================================================

export interface BarPosition {
  leftPercent: number;
  widthPercent: number;
}

/**
 * คำนวณตำแหน่ง bar เป็น % ใน window — ใช้เฉพาะส่วนที่ overlap กับ window
 * ถ้า project ไม่ overlap กับ window → widthPercent = 0 (ซ่อน bar)
 */
export function computeBarPosition(
  projectRange: ProjectDateRange,
  window: TimelineWindow
): BarPosition {
  const winSpan = window.end.getTime() - window.start.getTime();
  if (winSpan <= 0) return { leftPercent: 0, widthPercent: 0 };

  // หา overlap ระหว่าง project กับ window
  const overlapStart = Math.max(projectRange.start.getTime(), window.start.getTime());
  const overlapEnd = Math.min(projectRange.end.getTime(), window.end.getTime());
  const overlap = overlapEnd - overlapStart;

  // ไม่ overlap เลย → ไม่ render
  if (overlap <= 0) {
    return { leftPercent: 0, widthPercent: 0 };
  }

  const leftPercent = ((overlapStart - window.start.getTime()) / winSpan) * 100;
  const widthPercent = (overlap / winSpan) * 100;

  return {
    leftPercent: Math.max(0, Math.min(100, leftPercent)),
    widthPercent: Math.max(0.5, Math.min(100 - leftPercent, widthPercent)),
  };
}

// ============================================================
// Assignments per position
// ============================================================

export interface ProjectAssignment {
  project: Project;
  mandays: number;
  range: ProjectDateRange;
}

export interface PositionResourcePlan {
  position: PositionRate;
  assignments: ProjectAssignment[];
  /** Mandays รวมของทุกโปรเจกต์ที่ต้องทำ (ทั้งช่วงเวลา) */
  totalAssignedMandays: number;
  /** Capacity ของตำแหน่งใน window ที่กำลังดู */
  capacityMandaysInWindow: number;
  /** Mandays ที่อยู่ใน window จริงๆ (overlapping portion) */
  mandaysInWindow: number;
  /** Utilization % ใน window (0-100+) */
  utilizationPercent: number;
}

/**
 * คำนวณ overlap (วัน) ระหว่างโปรเจกต์กับ window
 * แล้วประมาณ mandays ใน window แบบ linear distribution
 */
function computeMandaysInWindow(
  range: ProjectDateRange,
  totalMandays: number,
  window: TimelineWindow
): number {
  const projectSpan = range.end.getTime() - range.start.getTime();
  if (projectSpan <= 0) return 0;

  const overlapStart = Math.max(range.start.getTime(), window.start.getTime());
  const overlapEnd = Math.min(range.end.getTime(), window.end.getTime());
  const overlap = Math.max(0, overlapEnd - overlapStart);

  return (overlap / projectSpan) * totalMandays;
}

/**
 * สร้าง resource plan ต่อ position
 * - excludeStatuses: ไม่นับ projects ที่ status อยู่ในนี้ (default = ['lost'])
 */
export function buildResourcePlans(
  positions: PositionRate[],
  projects: Project[],
  window: TimelineWindow,
  options: { workingDaysPerMonth?: number; excludeStatuses?: string[] } = {}
): PositionResourcePlan[] {
  const wdPerMonth = options.workingDaysPerMonth ?? 20;
  const excludeStatuses = options.excludeStatuses ?? ["lost"];
  const windowMonths = window.monthCount;

  return positions.map((position) => {
    const assignments: ProjectAssignment[] = [];

    for (const project of projects) {
      if (excludeStatuses.includes(project.status)) continue;
      const allocation = project.allocations.find((a) => a.positionId === position.id);
      if (!allocation || allocation.mandays <= 0) continue;
      assignments.push({
        project,
        mandays: allocation.mandays,
        range: getProjectDateRange(project),
      });
    }

    // เรียงตามวันเริ่ม
    assignments.sort((a, b) => a.range.start.getTime() - b.range.start.getTime());

    const totalAssignedMandays = assignments.reduce((s, a) => s + a.mandays, 0);
    const capacityMandaysInWindow = (position.headcount || 0) * wdPerMonth * windowMonths;
    const mandaysInWindow = assignments.reduce(
      (s, a) => s + computeMandaysInWindow(a.range, a.mandays, window),
      0
    );
    const utilizationPercent =
      capacityMandaysInWindow > 0 ? (mandaysInWindow / capacityMandaysInWindow) * 100 : 0;

    return {
      position,
      assignments,
      totalAssignedMandays,
      capacityMandaysInWindow,
      mandaysInWindow,
      utilizationPercent,
    };
  });
}

// ============================================================
// Monthly Load Analysis (Cross-project)
// ============================================================

export interface MonthlyLoadData {
  month: string; // "Jan 24"
  monthDate: Date;
  load: number;
  capacity: number;
  utilization: number;
  positionDetails: {
    positionId: string;
    title: string;
    load: number;
    capacity: number;
  }[];
}

/**
 * คำนวณ Load vs Capacity แยกรายเดือน สำหรับทุกตำแหน่ง
 */
export function computeMonthlyCompanyLoad(
  positions: PositionRate[],
  projects: Project[],
  window: TimelineWindow,
  options: { workingDaysPerMonth?: number; excludeStatuses?: string[] } = {}
): MonthlyLoadData[] {
  const wdPerMonth = options.workingDaysPerMonth ?? 20;
  const excludeStatuses = options.excludeStatuses ?? ["lost"];

  return window.months.map((m) => {
    const monthStart = m.date.getTime();
    const nextMonth = new Date(m.date);
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
    const monthEnd = nextMonth.getTime();
    const monthSpan = monthEnd - monthStart;

    let totalLoad = 0;
    let totalCapacity = 0;

    const positionDetails = positions.map((pos) => {
      const posCapacity = (pos.headcount || 0) * wdPerMonth;
      let posLoad = 0;

      for (const proj of projects) {
        if (excludeStatuses.includes(proj.status)) continue;
        const alloc = proj.allocations.find((a) => a.positionId === pos.id);
        if (!alloc || alloc.mandays <= 0) continue;

        const range = getProjectDateRange(proj);
        const pStart = range.start.getTime();
        const pEnd = range.end.getTime();
        const pSpan = pEnd - pStart;

        if (pSpan <= 0) continue;

        // Overlap ระหว่าง project กับเดือนปัจจุบัน
        const overlapStart = Math.max(pStart, monthStart);
        const overlapEnd = Math.min(pEnd, monthEnd);
        const overlap = Math.max(0, overlapEnd - overlapStart);

        if (overlap > 0) {
          // กระจาย mandays ตามระยะเวลาที่คาบเกี่ยวในเดือนนี้ (linear distribution)
          posLoad += (overlap / pSpan) * alloc.mandays;
        }
      }

      totalLoad += posLoad;
      totalCapacity += posCapacity;

      return {
        positionId: pos.id,
        title: pos.title,
        load: posLoad,
        capacity: posCapacity,
      };
    });

    return {
      month: m.label,
      monthDate: m.date,
      load: totalLoad,
      capacity: totalCapacity,
      utilization: totalCapacity > 0 ? (totalLoad / totalCapacity) * 100 : 0,
      positionDetails,
    };
  });
}
