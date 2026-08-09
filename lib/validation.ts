import { Project } from "./types";
import { CostCalculationResult } from "./calculations";

export type ValidationSeverity = "error" | "warning" | "info";

export interface ValidationIssue {
  severity: ValidationSeverity;
  code: string;
  message: string;
  // ระบุว่า issue อยู่ในส่วนไหน (สำหรับ navigation ภายในแอป)
  area: "labor" | "overhead" | "settings" | "quotation" | "pricing" | "phases" | "payment";
}

export function validateProject(
  project: Project,
  calc: CostCalculationResult
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // --- Labor ---
  const negativeMandays = project.allocations.filter((a) => a.mandays < 0);
  if (negativeMandays.length > 0) {
    issues.push({
      severity: "error",
      code: "NEGATIVE_MANDAYS",
      message: `มี ${negativeMandays.length} ตำแหน่งที่ใส่ Mandays ติดลบ`,
      area: "labor",
    });
  }

  if (calc.totalProjectMandays === 0 && project.status !== "draft") {
    issues.push({
      severity: "warning",
      code: "NO_MANDAYS",
      message: "ยังไม่ได้จัดสรร Mandays แต่ status ไม่ใช่ 'ร่าง'",
      area: "labor",
    });
  }

  // --- Duration ---
  if (project.durationMonths <= 0) {
    issues.push({
      severity: "error",
      code: "INVALID_DURATION",
      message: "ระยะเวลาโครงการต้องมากกว่า 0 เดือน",
      area: "settings",
    });
  }

  // Workload sanity: project mandays > capacity?
  if (calc.companyCapacityMandays > 0 && project.durationMonths > 0) {
    const capacityOverDuration = calc.companyCapacityMandays * project.durationMonths;
    if (calc.totalProjectMandays > capacityOverDuration) {
      issues.push({
        severity: "warning",
        code: "OVER_CAPACITY",
        message: `Mandays โครงการ (${calc.totalProjectMandays}) เกิน capacity ของบริษัท (${capacityOverDuration} ใน ${project.durationMonths} เดือน) — อาจต้องจ้าง outsource เพิ่ม`,
        area: "labor",
      });
    }
  }

  // --- Pricing ---
  if (project.pricingMode === "cost_plus" && project.markupPercentage < 0) {
    issues.push({
      severity: "error",
      code: "NEGATIVE_MARKUP",
      message: "Markup ติดลบ — กำลังขายต่ำกว่าทุน",
      area: "pricing",
    });
  }

  if (project.pricingMode === "fixed_price") {
    if (project.fixedPrice <= 0) {
      issues.push({
        severity: "error",
        code: "FIXED_PRICE_NOT_SET",
        message: "ยังไม่ได้กำหนดราคาขายเหมา — กรุณาใส่ราคาก่อน VAT",
        area: "pricing",
      });
    } else if (calc.isAtLoss) {
      issues.push({
        severity: "warning",
        code: "FIXED_PRICE_AT_LOSS",
        message: `ราคาขายเหมา ${project.fixedPrice.toLocaleString("th-TH")} บาท ต่ำกว่าต้นทุน ${calc.totalProductionCost.toLocaleString("th-TH")} บาท — ขาดทุน ${Math.abs(calc.netProfit).toLocaleString("th-TH")} บาท`,
        area: "pricing",
      });
    } else if (calc.effectiveMarkupPercent < 10 && calc.totalProductionCost > 0) {
      issues.push({
        severity: "info",
        code: "FIXED_PRICE_LOW_MARGIN",
        message: `Markup ที่ได้จริงต่ำมาก (${calc.effectiveMarkupPercent.toFixed(1)}%) — ลองพิจารณาเพิ่มราคา`,
        area: "pricing",
      });
    }
  }

  if (calc.netProfit < 0 && project.pricingMode === "cost_plus") {
    issues.push({
      severity: "warning",
      code: "NEGATIVE_PROFIT",
      message: `กำไรสุทธิติดลบ ${Math.abs(calc.netProfit).toLocaleString("th-TH")} บาท — กรุณาปรับ markup หรือลดต้นทุน`,
      area: "pricing",
    });
  }

  if (project.contingencyPercent < 0) {
    issues.push({
      severity: "error",
      code: "NEGATIVE_CONTINGENCY",
      message: "Contingency ติดลบ",
      area: "pricing",
    });
  }

  // --- Client/Quotation completeness ---
  if (project.status === "quoted" || project.status === "won") {
    if (!project.client.name.trim()) {
      issues.push({
        severity: "warning",
        code: "MISSING_CLIENT_NAME",
        message: "ยังไม่ได้ระบุชื่อลูกค้า — โปรเจกต์ที่เสนอราคาแล้วควรมี",
        area: "quotation",
      });
    }
    if (!project.client.taxId) {
      issues.push({
        severity: "info",
        code: "MISSING_CLIENT_TAXID",
        message: "ยังไม่ได้ระบุเลขผู้เสียภาษีของลูกค้า",
        area: "quotation",
      });
    }
  }

  if (!project.quotationNumber) {
    issues.push({
      severity: "info",
      code: "MISSING_QUOTATION_NUMBER",
      message: "ยังไม่ได้กำหนดเลขที่ใบเสนอราคา",
      area: "quotation",
    });
  }

  if (project.validUntil) {
    const today = new Date().toISOString().split("T")[0];
    if (project.validUntil < today && project.status === "quoted") {
      issues.push({
        severity: "warning",
        code: "QUOTATION_EXPIRED",
        message: `ราคาหมดอายุแล้ว (${project.validUntil}) — กรุณา renew หรือเปลี่ยน status`,
        area: "quotation",
      });
    }
  }

  // --- Payment terms ---
  const installmentTotal = project.paymentTerms.installments.reduce(
    (s, i) => s + (i.percent || 0),
    0
  );
  if (project.paymentTerms.installments.length > 0 && Math.abs(installmentTotal - 100) > 0.001) {
    issues.push({
      severity: "warning",
      code: "INSTALLMENT_TOTAL_NOT_100",
      message: `ผลรวม % งวดเงินคือ ${installmentTotal.toFixed(1)}% ไม่เท่ากับ 100`,
      area: "payment",
    });
  }

  // --- Phases ---
  if (project.phases.length > 0) {
    const phaseTotal = project.phases.reduce((s, p) => s + (p.mandayPercent || 0), 0);
    if (Math.abs(phaseTotal - 100) > 0.001) {
      issues.push({
        severity: "warning",
        code: "PHASE_TOTAL_NOT_100",
        message: `ผลรวม % mandays ของ phases คือ ${phaseTotal.toFixed(1)}% ไม่เท่ากับ 100`,
        area: "phases",
      });
    }

    // Check ลำดับ milestone dates
    const datedPhases = project.phases
      .filter((p) => !!p.milestoneDate)
      .map((p) => p.milestoneDate as string);
    const sorted = [...datedPhases].sort();
    if (datedPhases.join("|") !== sorted.join("|")) {
      issues.push({
        severity: "info",
        code: "PHASE_DATES_NOT_ORDERED",
        message: "วันส่งมอบของ phases ไม่ได้เรียงตามลำดับเวลา",
        area: "phases",
      });
    }
  }

  // --- Tax ---
  if (project.taxRate < 0 || project.taxRate > 30) {
    issues.push({
      severity: "warning",
      code: "UNUSUAL_TAX",
      message: `VAT ${project.taxRate}% ดูผิดปกติ (มาตรฐานไทย = 7)`,
      area: "settings",
    });
  }

  if (project.withholdingTaxPercent < 0 || project.withholdingTaxPercent > 15) {
    issues.push({
      severity: "warning",
      code: "UNUSUAL_WHT",
      message: `หัก ณ ที่จ่าย ${project.withholdingTaxPercent}% ดูผิดปกติ (มาตรฐาน B2B IT = 3)`,
      area: "settings",
    });
  }

  return issues;
}
