import { describe, it, expect } from "vitest";
import { calculateProjectCosts, calculateScenarios } from "./calculations";
import { Project, PositionRate, OverheadItem } from "./types";

// ============================================================
// Test fixtures
// ============================================================

const samplePosition: PositionRate = {
  id: "pos1",
  title: "Senior Dev",
  salary: 60000,
  dailyRate: 3000,
  isCustomRate: false,
  headcount: 2,
  benefitPercent: 20,
  socialSecurityAmount: 750,
};

const sampleOverhead: OverheadItem = {
  id: "oh1",
  name: "Office Rent",
  cost: 30000,
  period: "monthly",
  effectiveFrom: "2024-01-01",
};

const baseProject: Project = {
  id: "p1",
  name: "Test Project",
  createdAt: "2024-06-01T00:00:00.000Z",
  updatedAt: "2024-06-01T00:00:00.000Z",
  quotationDate: "2024-06-01",
  workingDaysPerMonth: 20,
  durationMonths: 1,
  allocations: [{ positionId: "pos1", mandays: 10 }],
  directCosts: [],
  overheadAllocationMethod: "proportional",
  overheadAllocationValue: 0,
  contingencyPercent: 0,
  pricingMode: "cost_plus",
  fixedPrice: 0,
  markupPercentage: 0,
  taxRate: 0,
  withholdingTaxPercent: 0,
  status: "draft",
  client: { name: "" },
  paymentTerms: { installments: [], paymentDueDays: 30, lateFeePercent: 0 },
  phases: [],
};

// ============================================================
// Empty/edge cases
// ============================================================

describe("calculateProjectCosts — edge cases", () => {
  it("returns zero result when project is undefined", () => {
    const r = calculateProjectCosts(undefined, [], []);
    expect(r.totalProductionCost).toBe(0);
    expect(r.finalPrice).toBe(0);
    expect(r.netProfit).toBe(0);
  });

  it("returns zero when no positions allocated", () => {
    const proj: Project = { ...baseProject, allocations: [] };
    const r = calculateProjectCosts(proj, [samplePosition], []);
    expect(r.laborCost).toBe(0);
    expect(r.totalProjectMandays).toBe(0);
  });

  it("handles missing position gracefully (allocation references deleted position)", () => {
    const proj: Project = {
      ...baseProject,
      allocations: [{ positionId: "deleted_pos", mandays: 5 }],
    };
    const r = calculateProjectCosts(proj, [], []);
    expect(r.laborCost).toBe(0);
    expect(r.totalProjectMandays).toBe(5); // still counts mandays
    expect(r.laborCostBreakdown[0].title).toBe("Unknown Position");
  });
});

// ============================================================
// Labor cost (fully-loaded rate)
// ============================================================

describe("calculateProjectCosts — labor", () => {
  it("computes fully-loaded daily rate = base × (1+benefit%) + (SSO/workingDays)", () => {
    // base 3000 × 1.20 = 3600
    // SSO 750 / 20 = 37.5
    // fully-loaded = 3637.5
    // 10 mandays × 3637.5 = 36375
    const r = calculateProjectCosts(baseProject, [samplePosition], []);
    expect(r.laborCost).toBe(36375);
    expect(r.laborCostBreakdown[0].dailyRate).toBeCloseTo(3637.5);
    expect(r.laborCostBreakdown[0].baseDailyRate).toBe(3000);
  });

  it("uses customDailyRate when provided (still adds benefit + SSO)", () => {
    const proj: Project = {
      ...baseProject,
      allocations: [{ positionId: "pos1", mandays: 10, customDailyRate: 4000 }],
    };
    // 4000 × 1.20 + 37.5 = 4837.5 → × 10 = 48375
    const r = calculateProjectCosts(proj, [samplePosition], []);
    expect(r.laborCost).toBe(48375);
    expect(r.laborCostBreakdown[0].baseDailyRate).toBe(4000);
  });

  it("treats undefined customDailyRate as fallback to position rate", () => {
    const proj: Project = {
      ...baseProject,
      allocations: [{ positionId: "pos1", mandays: 10, customDailyRate: undefined }],
    };
    const r = calculateProjectCosts(proj, [samplePosition], []);
    expect(r.laborCost).toBe(36375); // same as base case
  });

  it("handles zero benefit + zero SSO", () => {
    const pos: PositionRate = { ...samplePosition, benefitPercent: 0, socialSecurityAmount: 0 };
    const r = calculateProjectCosts(baseProject, [pos], []);
    expect(r.laborCost).toBe(30000); // 3000 × 10
  });

  it("aggregates multiple allocations correctly", () => {
    const pos2: PositionRate = { ...samplePosition, id: "pos2", dailyRate: 2000, benefitPercent: 10, socialSecurityAmount: 500 };
    const proj: Project = {
      ...baseProject,
      allocations: [
        { positionId: "pos1", mandays: 10 },
        { positionId: "pos2", mandays: 5 },
      ],
    };
    // pos1: 36375
    // pos2: 2000 × 1.10 + 25 = 2225 → × 5 = 11125
    const r = calculateProjectCosts(proj, [samplePosition, pos2], []);
    expect(r.laborCost).toBe(36375 + 11125);
    expect(r.totalProjectMandays).toBe(15);
  });
});

// ============================================================
// Overhead allocation
// ============================================================

describe("calculateProjectCosts — overhead allocation", () => {
  it("proportional: distributes by mandays/capacity × duration", () => {
    // capacity = headcount(2) × workingDays(20) = 40 mandays/month
    // proj mandays = 10, capacity = 40
    // overhead = 30000 × 1 month = 30000
    // allocated = 30000 × (10 / 40) = 7500
    const r = calculateProjectCosts(baseProject, [samplePosition], [sampleOverhead]);
    expect(r.allocatedOverhead).toBe(7500);
  });

  it("proportional: scales with duration", () => {
    const proj: Project = { ...baseProject, durationMonths: 3 };
    // capacity over 3 months = 40 × 3 = 120
    // overhead over 3 months = 30000 × 3 = 90000
    // allocated = 90000 × (10 / 120) = 7500 (same!)
    // ตรวจว่าสัดส่วนยังคงถูก
    const r = calculateProjectCosts(proj, [samplePosition], [sampleOverhead]);
    expect(r.allocatedOverhead).toBe(7500);
  });

  it("percentage: takes flat % of total overhead × duration", () => {
    const proj: Project = {
      ...baseProject,
      overheadAllocationMethod: "percentage",
      overheadAllocationValue: 20, // 20%
      durationMonths: 2,
    };
    // overhead over 2 months = 60000
    // 20% = 12000
    const r = calculateProjectCosts(proj, [samplePosition], [sampleOverhead]);
    expect(r.allocatedOverhead).toBe(12000);
  });

  it("fixed: uses absolute amount regardless of duration", () => {
    const proj: Project = {
      ...baseProject,
      overheadAllocationMethod: "fixed",
      overheadAllocationValue: 5000,
      durationMonths: 10,
    };
    const r = calculateProjectCosts(proj, [samplePosition], [sampleOverhead]);
    expect(r.allocatedOverhead).toBe(5000);
  });

  it("yearly overhead converts to monthly (/12) before applying", () => {
    const oh: OverheadItem = { ...sampleOverhead, cost: 120000, period: "yearly" };
    // 120000/12 = 10000/month
    // proportional: 10000 × (10/40) = 2500
    const r = calculateProjectCosts(baseProject, [samplePosition], [oh]);
    expect(r.allocatedOverhead).toBe(2500);
  });
});

// ============================================================
// Effective date filtering
// ============================================================

describe("calculateProjectCosts — effective date filter", () => {
  it("excludes overhead that starts after quotationDate", () => {
    const oh: OverheadItem = { ...sampleOverhead, effectiveFrom: "2025-01-01" };
    const proj: Project = { ...baseProject, quotationDate: "2024-06-01" };
    const r = calculateProjectCosts(proj, [samplePosition], [oh]);
    expect(r.allocatedOverhead).toBe(0);
    expect(r.totalMonthlyOverhead).toBe(0);
  });

  it("excludes overhead that ended before quotationDate", () => {
    const oh: OverheadItem = { ...sampleOverhead, effectiveFrom: "2023-01-01", effectiveTo: "2024-01-01" };
    const proj: Project = { ...baseProject, quotationDate: "2024-06-01" };
    const r = calculateProjectCosts(proj, [samplePosition], [oh]);
    expect(r.allocatedOverhead).toBe(0);
  });

  it("includes overhead within effective range", () => {
    const oh: OverheadItem = { ...sampleOverhead, effectiveFrom: "2024-01-01", effectiveTo: "2024-12-31" };
    const proj: Project = { ...baseProject, quotationDate: "2024-06-01" };
    const r = calculateProjectCosts(proj, [samplePosition], [oh]);
    expect(r.allocatedOverhead).toBe(7500);
  });
});

// ============================================================
// Direct costs
// ============================================================

describe("calculateProjectCosts — direct costs", () => {
  it("sums direct costs into total production cost", () => {
    const proj: Project = {
      ...baseProject,
      directCosts: [
        { id: "d1", name: "AWS", cost: 5000 },
        { id: "d2", name: "License", cost: 3000 },
      ],
    };
    const r = calculateProjectCosts(proj, [samplePosition], [sampleOverhead]);
    expect(r.directCost).toBe(8000);
    expect(r.subtotalBeforeContingency).toBe(36375 + 8000 + 7500);
  });
});

// ============================================================
// Contingency, Markup, VAT, WHT
// ============================================================

describe("calculateProjectCosts — pricing chain", () => {
  it("applies contingency on subtotal", () => {
    const proj: Project = { ...baseProject, contingencyPercent: 10 };
    // subtotal = laborCost + 0 direct + 7500 overhead = 43875
    // contingency = 4387.5
    // total production = 48262.5
    const r = calculateProjectCosts(proj, [samplePosition], [sampleOverhead]);
    expect(r.subtotalBeforeContingency).toBe(43875);
    expect(r.contingencyAmount).toBeCloseTo(4387.5);
    expect(r.totalProductionCost).toBeCloseTo(48262.5);
  });

  it("applies markup on total production cost (after contingency)", () => {
    const proj: Project = { ...baseProject, markupPercentage: 30 };
    // total = 43875, markup = 30% = 13162.5
    // priceBeforeTax = 57037.5
    const r = calculateProjectCosts(proj, [samplePosition], [sampleOverhead]);
    expect(r.markupAmount).toBeCloseTo(13162.5);
    expect(r.priceBeforeTax).toBeCloseTo(57037.5);
  });

  it("applies VAT on priceBeforeTax", () => {
    const proj: Project = { ...baseProject, markupPercentage: 30, taxRate: 7 };
    // priceBeforeTax = 57037.5, vat 7% = 3992.625
    const r = calculateProjectCosts(proj, [samplePosition], [sampleOverhead]);
    expect(r.taxAmount).toBeCloseTo(3992.625);
    expect(r.finalPrice).toBeCloseTo(61030.125);
  });

  it("applies WHT on priceBeforeTax (not final price)", () => {
    const proj: Project = { ...baseProject, markupPercentage: 30, taxRate: 7, withholdingTaxPercent: 3 };
    // priceBeforeTax = 57037.5
    // WHT 3% of 57037.5 = 1711.125
    // netReceivable = finalPrice - WHT = 61030.125 - 1711.125 = 59319
    const r = calculateProjectCosts(proj, [samplePosition], [sampleOverhead]);
    expect(r.withholdingTaxAmount).toBeCloseTo(1711.125);
    expect(r.netReceivable).toBeCloseTo(59319);
  });
});

// ============================================================
// Margins
// ============================================================

describe("calculateProjectCosts — margins", () => {
  it("netMarginPercent = netProfit / priceBeforeTax × 100", () => {
    const proj: Project = { ...baseProject, markupPercentage: 50 };
    // production = 43875
    // markup = 21937.5
    // priceBeforeTax = 65812.5
    // netProfit = 21937.5
    // margin = 33.33%
    const r = calculateProjectCosts(proj, [samplePosition], [sampleOverhead]);
    expect(r.netProfit).toBeCloseTo(21937.5);
    expect(r.netMarginPercent).toBeCloseTo(33.333, 2);
  });

  it("returns 0% margin when priceBeforeTax is 0", () => {
    const proj: Project = { ...baseProject, allocations: [], markupPercentage: 0 };
    const r = calculateProjectCosts(proj, [samplePosition], []);
    expect(r.netMarginPercent).toBe(0);
  });
});

// ============================================================
// Scenarios
// ============================================================

describe("calculateScenarios", () => {
  it("returns empty when project is undefined", () => {
    expect(calculateScenarios(undefined, [], [])).toEqual([]);
  });

  it("applies manday multiplier to all allocations", () => {
    const proj: Project = { ...baseProject, markupPercentage: 30 };
    const results = calculateScenarios(proj, [samplePosition], [sampleOverhead]);
    expect(results).toHaveLength(3);
    const realistic = results.find((r) => r.scenario.id === "realistic");
    const best = results.find((r) => r.scenario.id === "best");
    const worst = results.find((r) => r.scenario.id === "worst");
    expect(realistic?.totalProjectMandays).toBe(10);
    expect(best?.totalProjectMandays).toBe(9); // 0.9x
    expect(worst?.totalProjectMandays).toBeCloseTo(12.5); // 1.25x
  });

  it("worst case has higher price than best case", () => {
    const proj: Project = { ...baseProject, markupPercentage: 30 };
    const results = calculateScenarios(proj, [samplePosition], [sampleOverhead]);
    const best = results.find((r) => r.scenario.id === "best")!;
    const worst = results.find((r) => r.scenario.id === "worst")!;
    expect(worst.finalPrice).toBeGreaterThan(best.finalPrice);
  });
});

// ============================================================
// Capacity calculation
// ============================================================

// ============================================================
// Fixed Price (ขายเหมา) mode
// ============================================================

describe("calculateProjectCosts — fixed price mode", () => {
  it("uses fixedPrice as priceBeforeTax regardless of cost", () => {
    const proj: Project = {
      ...baseProject,
      pricingMode: "fixed_price",
      fixedPrice: 100000,
      markupPercentage: 999, // should be ignored
    };
    const r = calculateProjectCosts(proj, [samplePosition], [sampleOverhead]);
    expect(r.priceBeforeTax).toBe(100000);
    expect(r.pricingMode).toBe("fixed_price");
  });

  it("computes effective markup % backward from fixed price", () => {
    const proj: Project = {
      ...baseProject,
      pricingMode: "fixed_price",
      fixedPrice: 60000,
    };
    // total production = 43875
    // effective markup = (60000 - 43875) / 43875 = 36.75%
    const r = calculateProjectCosts(proj, [samplePosition], [sampleOverhead]);
    expect(r.effectiveMarkupPercent).toBeCloseTo(36.75, 1);
    expect(r.markupAmount).toBeCloseTo(16125, 0);
  });

  it("flags isAtLoss when fixed price < total production cost", () => {
    const proj: Project = {
      ...baseProject,
      pricingMode: "fixed_price",
      fixedPrice: 30000, // ต่ำกว่าต้นทุน 43875
    };
    const r = calculateProjectCosts(proj, [samplePosition], [sampleOverhead]);
    expect(r.isAtLoss).toBe(true);
    expect(r.netProfit).toBeLessThan(0);
    expect(r.markupAmount).toBeLessThan(0);
  });

  it("not at loss when fixed price exactly equals cost", () => {
    const proj: Project = {
      ...baseProject,
      pricingMode: "fixed_price",
      fixedPrice: 43875,
    };
    const r = calculateProjectCosts(proj, [samplePosition], [sampleOverhead]);
    expect(r.isAtLoss).toBe(false);
    expect(r.netProfit).toBe(0);
    expect(r.effectiveMarkupPercent).toBe(0);
  });

  it("applies VAT on fixed price", () => {
    const proj: Project = {
      ...baseProject,
      pricingMode: "fixed_price",
      fixedPrice: 100000,
      taxRate: 7,
    };
    const r = calculateProjectCosts(proj, [samplePosition], [sampleOverhead]);
    expect(r.taxAmount).toBeCloseTo(7000);
    expect(r.finalPrice).toBeCloseTo(107000);
  });

  it("applies WHT on fixed price", () => {
    const proj: Project = {
      ...baseProject,
      pricingMode: "fixed_price",
      fixedPrice: 100000,
      taxRate: 7,
      withholdingTaxPercent: 3,
    };
    const r = calculateProjectCosts(proj, [samplePosition], [sampleOverhead]);
    expect(r.withholdingTaxAmount).toBeCloseTo(3000);
    expect(r.netReceivable).toBeCloseTo(104000);
  });

  it("treats fixedPrice = 0 as priceBeforeTax 0", () => {
    const proj: Project = {
      ...baseProject,
      pricingMode: "fixed_price",
      fixedPrice: 0,
    };
    const r = calculateProjectCosts(proj, [samplePosition], [sampleOverhead]);
    expect(r.priceBeforeTax).toBe(0);
    expect(r.finalPrice).toBe(0);
  });

  it("cost_plus mode unchanged — defaults to project markup", () => {
    const proj: Project = {
      ...baseProject,
      pricingMode: "cost_plus",
      fixedPrice: 999999, // should be ignored
      markupPercentage: 30,
    };
    const r = calculateProjectCosts(proj, [samplePosition], [sampleOverhead]);
    // total = 43875, markup 30% = 13162.5 → priceBeforeTax = 57037.5
    expect(r.priceBeforeTax).toBeCloseTo(57037.5);
    expect(r.effectiveMarkupPercent).toBe(30);
    expect(r.isAtLoss).toBe(false);
  });
});

describe("calculateProjectCosts — capacity", () => {
  it("companyCapacity = sum of headcount × workingDays", () => {
    const pos2: PositionRate = { ...samplePosition, id: "pos2", headcount: 3 };
    const r = calculateProjectCosts(baseProject, [samplePosition, pos2], []);
    // (2 + 3) × 20 = 100
    expect(r.companyCapacityMandays).toBe(100);
  });

  it("companyCapacity minimum is workingDays (avoid /0)", () => {
    const r = calculateProjectCosts(baseProject, [], []);
    // No positions → capacity at least 1 × workingDays = 20
    expect(r.companyCapacityMandays).toBe(20);
  });
});
