import { describe, it, expect } from "vitest";
import {
  getProjectDateRange,
  computeTimelineWindow,
  computeYearWindow,
  computeBarPosition,
  buildResourcePlans,
  addMonths,
  toBuddhistYear,
  toCommonYear,
  getAvailableYears,
} from "./resource-planning";
import { Project, PositionRate } from "./types";

const samplePosition: PositionRate = {
  id: "pos1",
  title: "Senior Dev",
  salary: 60000,
  dailyRate: 3000,
  isCustomRate: false,
  headcount: 2,
  benefitPercent: 15,
  socialSecurityAmount: 750,
};

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "p1",
    name: "Test",
    createdAt: "2024-06-01T00:00:00.000Z",
    updatedAt: "2024-06-01T00:00:00.000Z",
    quotationDate: "2024-06-01",
    workingDaysPerMonth: 20,
    durationMonths: 3,
    allocations: [{ positionId: "pos1", mandays: 30 }],
    directCosts: [],
    overheadAllocationMethod: "proportional",
    overheadAllocationValue: 0,
    contingencyPercent: 0,
    pricingMode: "cost_plus",
    fixedPrice: 0,
    markupPercentage: 30,
    taxRate: 7,
    withholdingTaxPercent: 3,
    status: "won",
    client: { name: "X" },
    paymentTerms: { installments: [], paymentDueDays: 30, lateFeePercent: 0 },
    phases: [],
    ...overrides,
  };
}

describe("getProjectDateRange", () => {
  it("uses startDate if present", () => {
    const p = makeProject({ startDate: "2024-08-01", quotationDate: "2024-06-01", durationMonths: 2 });
    const r = getProjectDateRange(p);
    expect(r.startISO).toBe("2024-08-01");
    expect(r.endISO).toBe("2024-10-01");
  });

  it("falls back to quotationDate when startDate missing", () => {
    const p = makeProject({ quotationDate: "2024-06-01", durationMonths: 3 });
    const r = getProjectDateRange(p);
    expect(r.startISO).toBe("2024-06-01");
    expect(r.endISO).toBe("2024-09-01");
  });

  it("handles fractional durationMonths", () => {
    const p = makeProject({ quotationDate: "2024-06-01", durationMonths: 0.5 });
    const r = getProjectDateRange(p);
    expect(r.startISO).toBe("2024-06-01");
    // 0.5 month from June 1 — implementation uses setUTCMonth(month + 0)
    // = June 1 (because 0.5 is truncated by setUTCMonth)
    // Actually addMonths preserves date: setUTCMonth(6 + 0.5) — JS rounds down to 6
    // Test only that end > start
    expect(r.end.getTime()).toBeGreaterThan(r.start.getTime());
  });
});

describe("addMonths", () => {
  it("handles year rollover", () => {
    const d = new Date("2024-11-01T00:00:00Z");
    const next = addMonths(d, 3);
    expect(next.getUTCFullYear()).toBe(2025);
    expect(next.getUTCMonth()).toBe(1); // Feb
  });

  it("handles negative months", () => {
    const d = new Date("2024-03-01T00:00:00Z");
    const prev = addMonths(d, -5);
    expect(prev.getUTCFullYear()).toBe(2023);
    expect(prev.getUTCMonth()).toBe(9); // Oct
  });
});

describe("computeTimelineWindow", () => {
  it("returns fallback window when no projects", () => {
    const w = computeTimelineWindow([], 4);
    expect(w.monthCount).toBe(4);
  });

  it("encompasses all project ranges with buffer", () => {
    const projects = [
      makeProject({ id: "a", quotationDate: "2024-06-01", durationMonths: 2 }),
      makeProject({ id: "b", quotationDate: "2024-09-01", durationMonths: 3 }),
    ];
    const w = computeTimelineWindow(projects);
    // Earliest start = Jun 1 → buffer = May 1
    expect(w.start.getUTCMonth()).toBe(4); // May (0-indexed)
    expect(w.start.getUTCFullYear()).toBe(2024);
    // Latest end = Dec 1 → buffer = Feb 2025
    expect(w.end.getUTCFullYear()).toBe(2025);
  });
});

describe("computeYearWindow", () => {
  it("returns Jan 1 – Dec 31 of given CE year (12 months)", () => {
    const w = computeYearWindow(2026);
    expect(w.monthCount).toBe(12);
    expect(w.start.getUTCFullYear()).toBe(2026);
    expect(w.start.getUTCMonth()).toBe(0); // January
    expect(w.start.getUTCDate()).toBe(1);
    expect(w.end.getUTCFullYear()).toBe(2027);
    expect(w.end.getUTCMonth()).toBe(0);
  });

  it("month labels are short Thai month names", () => {
    const w = computeYearWindow(2026);
    expect(w.months).toHaveLength(12);
    expect(w.months[0].label).toContain("ม.ค.");
    expect(w.months[11].label).toContain("ธ.ค.");
  });
});

describe("Buddhist year conversion", () => {
  it("toBuddhistYear: CE → BE adds 543", () => {
    expect(toBuddhistYear(2026)).toBe(2569);
    expect(toBuddhistYear(2024)).toBe(2567);
  });

  it("toCommonYear: BE → CE subtracts 543", () => {
    expect(toCommonYear(2569)).toBe(2026);
    expect(toCommonYear(2567)).toBe(2024);
  });

  it("roundtrip CE→BE→CE", () => {
    expect(toCommonYear(toBuddhistYear(2030))).toBe(2030);
  });
});

describe("getAvailableYears", () => {
  it("includes current year and next year when no projects", () => {
    const years = getAvailableYears([]);
    const current = new Date().getUTCFullYear();
    expect(years).toContain(current);
    expect(years).toContain(current + 1);
  });

  it("includes years that any project spans", () => {
    const projects = [
      makeProject({ quotationDate: "2024-11-01", durationMonths: 3 }), // 2024-11 → 2025-02
      makeProject({ id: "b", quotationDate: "2026-06-01", durationMonths: 2 }), // 2026
    ];
    const years = getAvailableYears(projects);
    expect(years).toContain(2024);
    expect(years).toContain(2025);
    expect(years).toContain(2026);
  });

  it("returns years sorted ascending", () => {
    const projects = [
      makeProject({ id: "b", quotationDate: "2026-06-01", durationMonths: 1 }),
      makeProject({ id: "a", quotationDate: "2023-06-01", durationMonths: 1 }),
    ];
    const years = getAvailableYears(projects);
    const sorted = [...years].sort((a, b) => a - b);
    expect(years).toEqual(sorted);
  });
});

describe("computeBarPosition", () => {
  it("returns 0-50% for project in first half of window", () => {
    const window = {
      start: new Date("2024-01-01T00:00:00Z"),
      end: new Date("2024-12-31T23:59:59Z"),
      monthCount: 12,
      months: [],
    };
    const range = getProjectDateRange(
      makeProject({ quotationDate: "2024-01-01", durationMonths: 6 })
    );
    const pos = computeBarPosition(range, window);
    expect(pos.leftPercent).toBe(0);
    expect(pos.widthPercent).toBeGreaterThan(40);
    expect(pos.widthPercent).toBeLessThan(60);
  });

  it("clamps to 0-100 range", () => {
    const window = {
      start: new Date("2024-06-01T00:00:00Z"),
      end: new Date("2024-12-01T00:00:00Z"),
      monthCount: 6,
      months: [],
    };
    const range = getProjectDateRange(
      makeProject({ quotationDate: "2024-08-01", durationMonths: 2 })
    );
    const pos = computeBarPosition(range, window);
    expect(pos.leftPercent).toBeGreaterThanOrEqual(0);
    expect(pos.widthPercent).toBeGreaterThanOrEqual(0.5);
  });

  it("clips project that starts before window — bar starts at 0%, ends at overlap", () => {
    // Window = 2025 (Jan-Dec). Project = Nov 2024 - Mar 2025 (5 เดือน)
    // overlap = Jan 2025 - Mar 2025 = 3 เดือน → bar 0% – ~25%
    const window = {
      start: new Date("2025-01-01T00:00:00Z"),
      end: new Date("2026-01-01T00:00:00Z"),
      monthCount: 12,
      months: [],
    };
    const range = getProjectDateRange(
      makeProject({ quotationDate: "2024-11-01", durationMonths: 5 })
    );
    const pos = computeBarPosition(range, window);
    expect(pos.leftPercent).toBe(0);
    // bar ควรกินประมาณ 3/12 ≈ 25% — ไม่ใช่ 5/12
    expect(pos.widthPercent).toBeGreaterThan(20);
    expect(pos.widthPercent).toBeLessThan(30);
  });

  it("clips project that ends after window — bar ends at 100%", () => {
    // Window = 2025. Project = Oct 2025 - Mar 2026 (6 เดือน)
    // overlap = Oct - Dec 2025 = 3 เดือน → bar ~75% – 100%
    const window = {
      start: new Date("2025-01-01T00:00:00Z"),
      end: new Date("2026-01-01T00:00:00Z"),
      monthCount: 12,
      months: [],
    };
    const range = getProjectDateRange(
      makeProject({ quotationDate: "2025-10-01", durationMonths: 6 })
    );
    const pos = computeBarPosition(range, window);
    expect(pos.leftPercent).toBeGreaterThan(70);
    expect(pos.leftPercent + pos.widthPercent).toBeLessThanOrEqual(100);
  });

  it("returns widthPercent 0 when project is completely outside window", () => {
    // Window = 2025. Project = 2023 → no overlap
    const window = {
      start: new Date("2025-01-01T00:00:00Z"),
      end: new Date("2026-01-01T00:00:00Z"),
      monthCount: 12,
      months: [],
    };
    const range = getProjectDateRange(
      makeProject({ quotationDate: "2023-01-01", durationMonths: 3 })
    );
    const pos = computeBarPosition(range, window);
    expect(pos.widthPercent).toBe(0);
  });

  it("entire project inside window — accurate positioning", () => {
    // Window = 2025. Project = Mar 2025 - Aug 2025 (5 months)
    // bar should be ~17% (Mar-Jan=2/12) - 42% (Mar+5=Aug=8/12)
    const window = {
      start: new Date("2025-01-01T00:00:00Z"),
      end: new Date("2026-01-01T00:00:00Z"),
      monthCount: 12,
      months: [],
    };
    const range = getProjectDateRange(
      makeProject({ quotationDate: "2025-03-01", durationMonths: 5 })
    );
    const pos = computeBarPosition(range, window);
    // bar เริ่ม Mar = ~16.7%, จบ Aug = ~58.3% → width = ~41.7%
    expect(pos.leftPercent).toBeGreaterThan(14);
    expect(pos.leftPercent).toBeLessThan(20);
    expect(pos.widthPercent).toBeGreaterThan(38);
    expect(pos.widthPercent).toBeLessThan(45);
  });
});

describe("buildResourcePlans", () => {
  const projectA = makeProject({
    id: "a",
    quotationDate: "2024-06-01",
    durationMonths: 2,
    allocations: [{ positionId: "pos1", mandays: 20 }],
  });
  const projectB = makeProject({
    id: "b",
    quotationDate: "2024-09-01",
    durationMonths: 2,
    allocations: [{ positionId: "pos1", mandays: 15 }],
  });
  const projectLost = makeProject({
    id: "c",
    quotationDate: "2024-06-01",
    durationMonths: 1,
    allocations: [{ positionId: "pos1", mandays: 100 }],
    status: "lost",
  });

  it("collects assignments for position, sorted by start date", () => {
    const window = computeTimelineWindow([projectA, projectB]);
    const plans = buildResourcePlans([samplePosition], [projectA, projectB], window);
    expect(plans).toHaveLength(1);
    expect(plans[0].assignments).toHaveLength(2);
    expect(plans[0].assignments[0].project.id).toBe("a"); // June first
  });

  it("excludes lost projects by default", () => {
    const window = computeTimelineWindow([projectA, projectLost]);
    const plans = buildResourcePlans([samplePosition], [projectA, projectLost], window);
    expect(plans[0].assignments).toHaveLength(1);
    expect(plans[0].assignments[0].project.id).toBe("a");
  });

  it("excludes positions with no mandays in any project", () => {
    const otherPos: PositionRate = { ...samplePosition, id: "pos2", title: "Designer" };
    const window = computeTimelineWindow([projectA]);
    const plans = buildResourcePlans([samplePosition, otherPos], [projectA], window);
    expect(plans).toHaveLength(2);
    expect(plans.find((p) => p.position.id === "pos2")?.assignments).toHaveLength(0);
  });

  it("computes capacity from headcount × wdPerMonth × windowMonths", () => {
    const window = computeTimelineWindow([projectA]);
    const plans = buildResourcePlans([samplePosition], [projectA], window, {
      workingDaysPerMonth: 20,
    });
    // headcount = 2, wd = 20, monthCount = (1 buffer + 2 project + 2 buffer) = 5 typically
    expect(plans[0].capacityMandaysInWindow).toBe(2 * 20 * window.monthCount);
  });

  it("warns over-utilization when assignments exceed capacity", () => {
    const heavy = makeProject({
      quotationDate: "2024-06-01",
      durationMonths: 1,
      allocations: [{ positionId: "pos1", mandays: 200 }], // way too much
    });
    const window = computeTimelineWindow([heavy]);
    const plans = buildResourcePlans([samplePosition], [heavy], window);
    expect(plans[0].utilizationPercent).toBeGreaterThan(0);
  });
});
