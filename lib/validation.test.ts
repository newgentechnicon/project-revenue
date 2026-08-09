import { describe, it, expect } from "vitest";
import { validateProject } from "./validation";
import { calculateProjectCosts } from "./calculations";
import { Project, PositionRate, OverheadItem } from "./types";

const samplePosition: PositionRate = {
  id: "pos1",
  title: "Dev",
  salary: 60000,
  dailyRate: 3000,
  isCustomRate: false,
  headcount: 2,
  benefitPercent: 15,
  socialSecurityAmount: 750,
};

const sampleOverhead: OverheadItem = {
  id: "oh1",
  name: "Rent",
  cost: 30000,
  period: "monthly",
  effectiveFrom: "2024-01-01",
};

const baseProject: Project = {
  id: "p1",
  name: "Test",
  createdAt: "2024-06-01T00:00:00.000Z",
  updatedAt: "2024-06-01T00:00:00.000Z",
  quotationDate: "2024-06-01",
  quotationNumber: "QT-001",
  workingDaysPerMonth: 20,
  durationMonths: 1,
  allocations: [{ positionId: "pos1", mandays: 10 }],
  directCosts: [],
  overheadAllocationMethod: "proportional",
  overheadAllocationValue: 0,
  contingencyPercent: 10,
  pricingMode: "cost_plus",
  fixedPrice: 0,
  markupPercentage: 30,
  taxRate: 7,
  withholdingTaxPercent: 3,
  status: "draft",
  client: { name: "" },
  paymentTerms: {
    installments: [
      { id: "i1", name: "Deposit", percent: 30, dueAfterDays: 0 },
      { id: "i2", name: "On Delivery", percent: 70, dueAfterDays: 30 },
    ],
    paymentDueDays: 30,
    lateFeePercent: 1.5,
  },
  phases: [],
};

function makeIssues(project: Project, positions = [samplePosition], overheads = [sampleOverhead]) {
  const calc = calculateProjectCosts(project, positions, overheads);
  return validateProject(project, calc);
}

describe("validateProject — labor issues", () => {
  it("flags negative mandays as error", () => {
    const proj: Project = {
      ...baseProject,
      allocations: [{ positionId: "pos1", mandays: -5 }],
    };
    const issues = makeIssues(proj);
    const errFound = issues.find((i) => i.code === "NEGATIVE_MANDAYS");
    expect(errFound).toBeDefined();
    expect(errFound!.severity).toBe("error");
  });

  it("warns when 0 mandays but status is not draft", () => {
    const proj: Project = { ...baseProject, allocations: [], status: "quoted", client: { name: "X" } };
    const issues = makeIssues(proj);
    expect(issues.some((i) => i.code === "NO_MANDAYS")).toBe(true);
  });

  it("warns when mandays exceed company capacity", () => {
    // capacity = headcount(2) × 20 × 1 month = 40
    const proj: Project = {
      ...baseProject,
      allocations: [{ positionId: "pos1", mandays: 100 }],
    };
    const issues = makeIssues(proj);
    expect(issues.some((i) => i.code === "OVER_CAPACITY")).toBe(true);
  });
});

describe("validateProject — pricing issues", () => {
  it("errors on negative markup", () => {
    const proj: Project = { ...baseProject, markupPercentage: -10 };
    const issues = makeIssues(proj);
    expect(issues.some((i) => i.code === "NEGATIVE_MARKUP")).toBe(true);
  });

  it("warns on negative net profit", () => {
    const proj: Project = { ...baseProject, markupPercentage: -50 };
    const issues = makeIssues(proj);
    expect(issues.some((i) => i.code === "NEGATIVE_PROFIT")).toBe(true);
  });

  it("warns on unusual VAT rate", () => {
    const proj: Project = { ...baseProject, taxRate: 35 };
    const issues = makeIssues(proj);
    expect(issues.some((i) => i.code === "UNUSUAL_TAX")).toBe(true);
  });
});

describe("validateProject — client & quotation", () => {
  it("warns when quoted/won but no client name", () => {
    const proj: Project = { ...baseProject, status: "quoted", client: { name: "" } };
    const issues = makeIssues(proj);
    expect(issues.some((i) => i.code === "MISSING_CLIENT_NAME")).toBe(true);
  });

  it("infos when missing client taxId in quoted state", () => {
    const proj: Project = { ...baseProject, status: "quoted", client: { name: "Acme" } };
    const issues = makeIssues(proj);
    expect(issues.some((i) => i.code === "MISSING_CLIENT_TAXID")).toBe(true);
  });

  it("warns on expired validUntil for quoted", () => {
    const proj: Project = {
      ...baseProject,
      status: "quoted",
      client: { name: "X", taxId: "0105561234567" },
      validUntil: "2020-01-01",
    };
    const issues = makeIssues(proj);
    expect(issues.some((i) => i.code === "QUOTATION_EXPIRED")).toBe(true);
  });
});

describe("validateProject — payment terms", () => {
  it("warns when installments don't sum to 100", () => {
    const proj: Project = {
      ...baseProject,
      paymentTerms: {
        ...baseProject.paymentTerms,
        installments: [
          { id: "i1", name: "A", percent: 50, dueAfterDays: 0 },
          { id: "i2", name: "B", percent: 30, dueAfterDays: 30 },
        ],
      },
    };
    const issues = makeIssues(proj);
    expect(issues.some((i) => i.code === "INSTALLMENT_TOTAL_NOT_100")).toBe(true);
  });

  it("no warning when installments sum to 100", () => {
    const issues = makeIssues(baseProject);
    expect(issues.some((i) => i.code === "INSTALLMENT_TOTAL_NOT_100")).toBe(false);
  });
});

describe("validateProject — phases", () => {
  it("warns when phase percentages don't sum to 100", () => {
    const proj: Project = {
      ...baseProject,
      phases: [
        { id: "ph1", name: "Phase 1", mandayPercent: 30, deliverables: [] },
        { id: "ph2", name: "Phase 2", mandayPercent: 50, deliverables: [] },
      ],
    };
    const issues = makeIssues(proj);
    expect(issues.some((i) => i.code === "PHASE_TOTAL_NOT_100")).toBe(true);
  });

  it("infos when phase dates not in chronological order", () => {
    const proj: Project = {
      ...baseProject,
      phases: [
        { id: "ph1", name: "P1", mandayPercent: 50, milestoneDate: "2024-09-01", deliverables: [] },
        { id: "ph2", name: "P2", mandayPercent: 50, milestoneDate: "2024-06-01", deliverables: [] },
      ],
    };
    const issues = makeIssues(proj);
    expect(issues.some((i) => i.code === "PHASE_DATES_NOT_ORDERED")).toBe(true);
  });
});

describe("validateProject — fixed price mode", () => {
  it("errors when fixed_price mode but fixedPrice = 0", () => {
    const proj: Project = { ...baseProject, pricingMode: "fixed_price", fixedPrice: 0 };
    const issues = makeIssues(proj);
    expect(issues.some((i) => i.code === "FIXED_PRICE_NOT_SET" && i.severity === "error")).toBe(true);
  });

  it("warns when fixed price is below total production cost (loss)", () => {
    // sample position cost = labor 36375 + overhead 7500 + contingency 10% = 48262.5
    const proj: Project = {
      ...baseProject,
      pricingMode: "fixed_price",
      fixedPrice: 30000, // ต่ำกว่าต้นทุน
    };
    const issues = makeIssues(proj);
    expect(issues.some((i) => i.code === "FIXED_PRICE_AT_LOSS")).toBe(true);
  });

  it("does not error on negative markup percentage when in fixed_price mode", () => {
    // markup -50 ใน cost_plus จะ error แต่ใน fixed_price ไม่ใช้
    const proj: Project = {
      ...baseProject,
      pricingMode: "fixed_price",
      fixedPrice: 100000,
      markupPercentage: -50, // ignored
    };
    const issues = makeIssues(proj);
    expect(issues.some((i) => i.code === "NEGATIVE_MARKUP")).toBe(false);
  });

  it("infos when fixed price markup < 10%", () => {
    // total = 48262.5, markup 5% = 2413 → fixed price = 50676
    const proj: Project = {
      ...baseProject,
      pricingMode: "fixed_price",
      fixedPrice: 50676, // markup ~5%
    };
    const issues = makeIssues(proj);
    expect(issues.some((i) => i.code === "FIXED_PRICE_LOW_MARGIN")).toBe(true);
  });
});

describe("validateProject — duration", () => {
  it("errors on zero duration", () => {
    const proj: Project = { ...baseProject, durationMonths: 0 };
    const issues = makeIssues(proj);
    expect(issues.some((i) => i.code === "INVALID_DURATION")).toBe(true);
  });
});
