/**
 * Project module helpers — โหมดประเมินค่าแรงราย Module
 *
 * แนวคิด: modules เป็นเลเยอร์สำหรับ "ป้อนข้อมูล" เท่านั้น
 * ส่วน project.allocations = ผลรวม mandays ของทุกโมดูล (rebuild อัตโนมัติ)
 * เพื่อให้ calculations/resource-planning/scenarios/validation เดิมใช้ได้โดยไม่ต้องแก้
 */

import type { Project, ProjectModule, ProjectPositionAllocation, PositionRate } from "./types";

export function newModuleId(seed = 0): string {
  return "mod_" + Date.now() + (seed ? "_" + seed : "");
}

/**
 * รวม allocations จากทุกโมดูลเป็นรายการเดียวต่อ "ตำแหน่ง" (รวม mandays)
 * - customDailyRate เป็นค่าระดับตำแหน่ง (ใช้ร่วมทุกโมดูล) → ดึงจาก allocations เดิมมาคงไว้
 */
export function rebuildAllocationsFromModules(
  modules: ProjectModule[],
  prevAllocations: ProjectPositionAllocation[] = []
): ProjectPositionAllocation[] {
  const rateByPos = new Map<string, number | undefined>();
  for (const a of prevAllocations) rateByPos.set(a.positionId, a.customDailyRate);

  const mandaysByPos = new Map<string, number>();
  for (const m of modules) {
    for (const a of m.allocations) {
      mandaysByPos.set(a.positionId, (mandaysByPos.get(a.positionId) ?? 0) + (a.mandays || 0));
      // เก็บ customDailyRate จากโมดูลด้วย (เผื่อยังไม่มีใน prev)
      if (a.customDailyRate !== undefined && !rateByPos.has(a.positionId)) {
        rateByPos.set(a.positionId, a.customDailyRate);
      }
    }
  }

  return [...mandaysByPos.entries()].map(([positionId, mandays]) => {
    const rate = rateByPos.get(positionId);
    const alloc: ProjectPositionAllocation = { positionId, mandays };
    if (rate !== undefined) alloc.customDailyRate = rate;
    return alloc;
  });
}

/** จำนวน mandays รวมของโมดูลหนึ่ง */
export function moduleMandays(m: ProjectModule): number {
  return m.allocations.reduce((s, a) => s + (a.mandays || 0), 0);
}

/**
 * สร้างชุดโมดูลเริ่มต้นจาก allocations ปัจจุบัน (ใช้ตอน toggle simple → module ครั้งแรก)
 * รวมงานเดิมทั้งหมดไว้ในโมดูลเดียว "งานทั้งหมด"
 */
export function seedModulesFromAllocations(project: Project): ProjectModule[] {
  const withMandays = (project.allocations ?? []).filter((a) => (a.mandays || 0) > 0);
  return [
    {
      id: newModuleId(),
      name: "งานทั้งหมด",
      allocations: withMandays.map((a) => ({ ...a })),
    },
  ];
}

/** หา customDailyRate ระดับตำแหน่ง (ใช้ร่วมทุกโมดูล) จาก allocations รวม */
export function customRateFor(
  project: Project,
  positionId: string
): number | undefined {
  return project.allocations.find((a) => a.positionId === positionId)?.customDailyRate;
}

/** เรต fully-loaded ต่อวัน (ตรงสูตรกับ calculations.ts): base×(1+benefit%) + SSO/วันทำงาน */
export function fullyLoadedDailyRate(
  pos: PositionRate,
  workingDays: number,
  baseOverride?: number
): number {
  const base = baseOverride !== undefined ? baseOverride : pos.dailyRate;
  const benefitMul = 1 + ((pos.benefitPercent ?? 0) / 100);
  const ssoDaily = (pos.socialSecurityAmount ?? 0) / (workingDays || 20);
  return base * benefitMul + ssoDaily;
}

/** ต้นทุนค่าแรงรวมของโมดูลหนึ่ง (ใช้เรต fully-loaded + customRate ระดับตำแหน่ง) */
export function moduleLaborCost(
  project: Project,
  m: ProjectModule,
  positions: PositionRate[]
): number {
  const wd = project.workingDaysPerMonth || 20;
  return m.allocations.reduce((sum, a) => {
    const pos = positions.find((p) => p.id === a.positionId);
    if (!pos) return sum;
    const rate = fullyLoadedDailyRate(pos, wd, customRateFor(project, a.positionId));
    return sum + (a.mandays || 0) * rate;
  }, 0);
}

export interface ModuleBreakdownRow {
  id: string;
  name: string;
  positionsLabel: string;   // เช่น "PM 5, Senior Dev 10"
  mandays: number;
  laborCost: number;
  share: number;            // สัดส่วน 0..1 ของค่าแรงรวม (ใช้ปันราคา)
  amount: number;           // มูลค่าโดยประมาณ (ก่อน VAT) ของส่วนแรงงานโมดูลนี้
}

export interface DirectCostRow {
  id: string;
  name: string;
  category?: string;
  cost: number;             // ต้นทุนจริง (raw)
}

export interface ModuleBreakdownResult {
  modules: ModuleBreakdownRow[];   // amount รวม = laborPricePool
  laborPricePool: number;          // ส่วนของราคาก่อน VAT ที่มาจากแรงงาน+โสหุ้ย+contingency+markup
  directItems: DirectCostRow[];    // ค่าใช้จ่ายตรง (ระดับโปรเจกต์ ไม่ผูกโมดูล)
  directCost: number;              // ผลรวมต้นทุนตรง (raw)
  directPrice: number;             // ส่วนของราคาก่อน VAT ที่มาจากค่าใช้จ่ายตรง
  priceBeforeTax: number;          // = laborPricePool + directPrice
}

interface PriceBasis {
  priceBeforeTax: number;
  directCost: number;
  totalProductionCost: number;
}

/**
 * แตกราย Module — แยก "ส่วนแรงงาน" (ปันราคาตามสัดส่วนค่าแรงต่อโมดูล)
 * ออกจาก "ค่าใช้จ่ายตรง" (ระดับโปรเจกต์ ไม่ผูกโมดูล เช่น ค่า migrate data)
 *
 * นโยบาย: ค่าใช้จ่ายตรงเป็น passthrough → โชว์ "ที่ราคาทุน" ไม่บวก markup
 *   directPrice    = directCost (ราคาทุน)
 *   laborPricePool = priceBeforeTax − directCost  ← ส่วน markup ที่เคยตกบน direct ถูกดูดมารวมในส่วนพัฒนา
 *   ⇒ Σ module.amount + directCost = priceBeforeTax พอดี (ราคารวมเท่าเดิม)
 */
export function moduleBreakdown(
  project: Project,
  positions: PositionRate[],
  basis: PriceBasis
): ModuleBreakdownResult {
  const modules = project.modules ?? [];
  const posTitle = (id: string) => positions.find((p) => p.id === id)?.title ?? "ตำแหน่งอื่น";

  const { priceBeforeTax, directCost } = basis;
  // direct โชว์ที่ราคาทุน (ไม่บวก markup) — clamp กันกรณีขายต่ำกว่าทุน
  const directPrice = Math.min(directCost, priceBeforeTax);
  const laborPricePool = Math.max(0, priceBeforeTax - directPrice);

  const base = modules.map((m) => {
    const cost = moduleLaborCost(project, m, positions);
    const mandays = moduleMandays(m);
    const positionsLabel = m.allocations
      .filter((a) => (a.mandays || 0) > 0)
      .map((a) => `${posTitle(a.positionId)} ${a.mandays}`)
      .join(", ");
    return { id: m.id, name: m.name, positionsLabel, mandays, laborCost: cost };
  });

  const totalCost = base.reduce((s, r) => s + r.laborCost, 0);
  const totalMandays = base.reduce((s, r) => s + r.mandays, 0);
  const weightTotal = totalCost > 0 ? totalCost : totalMandays;
  const weightOf = (r: { laborCost: number; mandays: number }) =>
    totalCost > 0 ? r.laborCost : r.mandays;

  let allocated = 0;
  const moduleRows: ModuleBreakdownRow[] = base.map((r, i) => {
    const share = weightTotal > 0 ? weightOf(r) / weightTotal : 0;
    const isLast = i === base.length - 1;
    const amount = isLast
      ? Math.max(0, laborPricePool - allocated)
      : Math.round(laborPricePool * share);
    allocated += amount;
    return { ...r, share, amount };
  });

  const directItems: DirectCostRow[] = (project.directCosts ?? []).map((d) => ({
    id: d.id,
    name: d.name,
    category: d.category,
    cost: d.cost,
  }));

  return {
    modules: moduleRows,
    laborPricePool,
    directItems,
    directCost,
    directPrice,
    priceBeforeTax,
  };
}
