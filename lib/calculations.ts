import { Project, PositionRate, OverheadItem, Scenario, ScenarioId, PricingMode } from "./types";

export interface LaborCostLine {
  positionId: string;
  title: string;
  mandays: number;
  dailyRate: number;       // เรตจริงที่ใช้คิด (รวม benefit แล้ว)
  baseDailyRate: number;   // เรตก่อนบวก benefit (อ้างอิงเดิม)
  totalCost: number;
}

export interface DirectCostLine {
  id: string;
  name: string;
  cost: number;
  category?: string;
}

export interface CostCalculationResult {
  totalMonthlyOverhead: number;
  companyCapacityMandays: number;     // capacity ต่อเดือน (headcount × workingDays)
  totalProjectMandays: number;
  durationMonths: number;
  laborCost: number;
  directCost: number;
  allocatedOverhead: number;
  subtotalBeforeContingency: number;  // labor + direct + overhead
  contingencyAmount: number;
  totalProductionCost: number;        // ต้นทุนรวมหลังเผื่อ contingency
  pricingMode: PricingMode;           // โหมดที่ใช้คำนวณ
  markupAmount: number;                // ส่วนต่างราคา - ต้นทุน (อาจติดลบในโหมด fixed_price ที่ขายต่ำกว่าทุน)
  effectiveMarkupPercent: number;      // % markup ย้อนกลับจากราคา/ต้นทุน (ใช้แสดงในโหมด fixed_price)
  priceBeforeTax: number;
  taxAmount: number;
  finalPrice: number;                 // ราคารวม VAT
  withholdingTaxAmount: number;
  netReceivable: number;              // เงินที่บริษัทได้รับจริง (final − หัก ณ ที่จ่าย)
  netProfit: number;                  // priceBeforeTax − totalProductionCost
  isAtLoss: boolean;                  // true ถ้าราคาขายต่ำกว่าต้นทุน
  grossMarginPercent: number;         // จากค่าแรงเทียบราคาก่อนภาษี
  netMarginPercent: number;           // จาก netProfit เทียบราคาก่อนภาษี
  laborCostBreakdown: LaborCostLine[];
  directCostBreakdown: DirectCostLine[];
}

const EMPTY_RESULT: CostCalculationResult = {
  totalMonthlyOverhead: 0,
  companyCapacityMandays: 0,
  totalProjectMandays: 0,
  durationMonths: 0,
  laborCost: 0,
  directCost: 0,
  allocatedOverhead: 0,
  pricingMode: "cost_plus",
  effectiveMarkupPercent: 0,
  isAtLoss: false,
  subtotalBeforeContingency: 0,
  contingencyAmount: 0,
  totalProductionCost: 0,
  markupAmount: 0,
  priceBeforeTax: 0,
  taxAmount: 0,
  finalPrice: 0,
  withholdingTaxAmount: 0,
  netReceivable: 0,
  netProfit: 0,
  grossMarginPercent: 0,
  netMarginPercent: 0,
  laborCostBreakdown: [],
  directCostBreakdown: [],
};

export function calculateProjectCosts(
  project: Project | undefined,
  positions: PositionRate[],
  overheads: OverheadItem[]
): CostCalculationResult {
  if (!project) return EMPTY_RESULT;

  const workingDays = project.workingDaysPerMonth || 20;
  const durationMonths = Math.max(project.durationMonths || 1, 0);
  const quotationDate = project.quotationDate || project.createdAt.split("T")[0];

  // 1) กรองเฉพาะ overheads ที่ active ใน quotationDate ของโปรเจกต์นี้
  //    → ใบเก่าใช้สูตรเก่า, ใบใหม่ใช้สูตรใหม่ (ตามวันที่มีผลของแต่ละรายการ)
  const activeOverheads = overheads.filter((item) => {
    if (item.effectiveFrom && quotationDate < item.effectiveFrom) return false;
    if (item.effectiveTo && quotationDate > item.effectiveTo) return false;
    return true;
  });

  const totalMonthlyOverhead = activeOverheads.reduce((sum, item) => {
    const monthly = item.period === "yearly" ? item.cost / 12 : item.cost;
    return sum + monthly;
  }, 0);

  // 2) Capacity ของบริษัทต่อเดือน = ผลรวม headcount × workingDays
  const totalHeadcount = positions.reduce(
    (sum, p) => sum + Math.max(p.headcount || 0, 0),
    0
  );
  const companyCapacityMandays = Math.max(totalHeadcount, 1) * workingDays;

  // 3) ค่าแรง — fully-loaded = (baseDailyRate × (1+benefit%)) + (socialSecurity/workingDays)
  let totalProjectMandays = 0;
  let laborCost = 0;
  const laborCostBreakdown: LaborCostLine[] = project.allocations.map((alloc) => {
    const pos = positions.find((p) => p.id === alloc.positionId);
    const title = pos?.title ?? "Unknown Position";
    const benefitMul = 1 + ((pos?.benefitPercent ?? 0) / 100);
    const ssoDaily = (pos?.socialSecurityAmount ?? 0) / workingDays;

    const baseDailyRate =
      alloc.customDailyRate !== undefined && alloc.customDailyRate !== null
        ? alloc.customDailyRate
        : (pos?.dailyRate ?? 0);
    const dailyRate = baseDailyRate * benefitMul + ssoDaily;

    const totalCost = alloc.mandays * dailyRate;
    totalProjectMandays += alloc.mandays;
    laborCost += totalCost;

    return {
      positionId: alloc.positionId,
      title,
      mandays: alloc.mandays,
      dailyRate,
      baseDailyRate,
      totalCost,
    };
  });

  // 4) Direct costs (license, hosting, outsource, travel)
  const directCostBreakdown: DirectCostLine[] = (project.directCosts ?? []).map((dc) => ({
    id: dc.id,
    name: dc.name,
    cost: dc.cost,
    category: dc.category,
  }));
  const directCost = directCostBreakdown.reduce((s, d) => s + (d.cost || 0), 0);

  // 5) ปันโสหุ้ย — คูณ duration เพื่อให้โครงการระยะยาวรับโสหุ้ยตามจริง
  const overheadOverDuration = totalMonthlyOverhead * durationMonths;
  let allocatedOverhead = 0;
  if (project.overheadAllocationMethod === "proportional") {
    const capacityOverDuration = companyCapacityMandays * durationMonths;
    allocatedOverhead =
      capacityOverDuration > 0
        ? overheadOverDuration * (totalProjectMandays / capacityOverDuration)
        : 0;
  } else if (project.overheadAllocationMethod === "percentage") {
    allocatedOverhead = overheadOverDuration * (project.overheadAllocationValue / 100);
  } else {
    // fixed = ใส่เป็นยอดบาทตรงๆ ไม่คูณ duration
    allocatedOverhead = project.overheadAllocationValue;
  }

  // 6) Subtotal + Contingency
  const subtotalBeforeContingency = laborCost + directCost + allocatedOverhead;
  const contingencyAmount =
    subtotalBeforeContingency * ((project.contingencyPercent || 0) / 100);
  const totalProductionCost = subtotalBeforeContingency + contingencyAmount;

  // 7) ราคาก่อนภาษี — ขึ้นกับ pricingMode
  const pricingMode: PricingMode = project.pricingMode ?? "cost_plus";
  let priceBeforeTax: number;
  let markupAmount: number;
  let effectiveMarkupPercent: number;

  if (pricingMode === "fixed_price") {
    // ขายเหมา: user กำหนดราคา → คำนวณ markup ย้อนกลับ
    priceBeforeTax = Math.max(0, project.fixedPrice ?? 0);
    markupAmount = priceBeforeTax - totalProductionCost;
    effectiveMarkupPercent =
      totalProductionCost > 0 ? (markupAmount / totalProductionCost) * 100 : 0;
  } else {
    // cost-plus: markup % → ราคา
    markupAmount = totalProductionCost * (project.markupPercentage / 100);
    priceBeforeTax = totalProductionCost + markupAmount;
    effectiveMarkupPercent = project.markupPercentage;
  }

  const taxAmount = priceBeforeTax * (project.taxRate / 100);
  const finalPrice = priceBeforeTax + taxAmount;

  // 8) หัก ณ ที่จ่าย — หักจากราคาก่อนภาษี (มาตรฐานไทย B2B services)
  const withholdingTaxAmount =
    priceBeforeTax * ((project.withholdingTaxPercent || 0) / 100);
  const netReceivable = finalPrice - withholdingTaxAmount;

  // 9) กำไรและอัตรากำไร
  const netProfit = priceBeforeTax - totalProductionCost;
  const isAtLoss = priceBeforeTax > 0 && netProfit < 0;
  const grossProfit = priceBeforeTax - laborCost - directCost;
  const grossMarginPercent =
    priceBeforeTax > 0 ? (grossProfit / priceBeforeTax) * 100 : 0;
  const netMarginPercent =
    priceBeforeTax > 0 ? (netProfit / priceBeforeTax) * 100 : 0;

  return {
    totalMonthlyOverhead,
    companyCapacityMandays,
    totalProjectMandays,
    durationMonths,
    laborCost,
    directCost,
    allocatedOverhead,
    subtotalBeforeContingency,
    contingencyAmount,
    totalProductionCost,
    pricingMode,
    markupAmount,
    effectiveMarkupPercent,
    priceBeforeTax,
    taxAmount,
    finalPrice,
    withholdingTaxAmount,
    netReceivable,
    netProfit,
    isAtLoss,
    grossMarginPercent,
    netMarginPercent,
    laborCostBreakdown,
    directCostBreakdown,
  };
}

// Default scenarios ถ้าโปรเจกต์ยังไม่ได้กำหนด
export const DEFAULT_SCENARIOS: Scenario[] = [
  { id: "best", mandayMultiplier: 0.9, markupOverride: undefined, notes: "ทุกอย่างราบรื่น ทีม optimal" },
  { id: "realistic", mandayMultiplier: 1.0, notes: "ตามแผนที่ประมาณการ" },
  { id: "worst", mandayMultiplier: 1.25, contingencyOverride: undefined, notes: "งานยืดเยื้อ มี rework" },
];

export const SCENARIO_LABELS: Record<ScenarioId, { label: string; tone: string }> = {
  best: { label: "Best Case", tone: "emerald" },
  realistic: { label: "Realistic", tone: "blue" },
  worst: { label: "Worst Case", tone: "rose" },
};

export interface ScenarioResult {
  scenario: Scenario;
  totalProductionCost: number;
  priceBeforeTax: number;
  finalPrice: number;
  netProfit: number;
  netMarginPercent: number;
  totalProjectMandays: number;
}

// คำนวณผลของ scenario โดยปรับ mandays + markup/contingency override
export function calculateScenarios(
  project: Project | undefined,
  positions: PositionRate[],
  overheads: OverheadItem[]
): ScenarioResult[] {
  if (!project) return [];
  const scenarios = project.scenarios && project.scenarios.length > 0 ? project.scenarios : DEFAULT_SCENARIOS;

  return scenarios.map((sc) => {
    // คำนวณโดยปรับ project ชั่วคราว
    const adjusted: Project = {
      ...project,
      allocations: project.allocations.map((a) => ({
        ...a,
        mandays: a.mandays * sc.mandayMultiplier,
      })),
      markupPercentage: sc.markupOverride ?? project.markupPercentage,
      contingencyPercent: sc.contingencyOverride ?? project.contingencyPercent,
    };
    const calc = calculateProjectCosts(adjusted, positions, overheads);
    return {
      scenario: sc,
      totalProductionCost: calc.totalProductionCost,
      priceBeforeTax: calc.priceBeforeTax,
      finalPrice: calc.finalPrice,
      netProfit: calc.netProfit,
      netMarginPercent: calc.netMarginPercent,
      totalProjectMandays: calc.totalProjectMandays,
    };
  });
}
