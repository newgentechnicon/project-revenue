import ExcelJS from "exceljs";
import { format, parseISO } from "date-fns";
import { Project, PositionRate, OverheadItem, CompanyInfo, LedgerEntry } from "./types";
import { calculateProjectCosts } from "./calculations";
import { LEDGER_CATEGORY_LABELS, filterByMonth } from "./ledger";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function workbookToBlob(wb: ExcelJS.Workbook): Promise<Blob> {
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

const STATUS_TH: Record<string, string> = {
  draft: "ร่าง",
  quoted: "เสนอราคาแล้ว",
  won: "ปิดการขาย",
  lost: "ไม่ได้งาน",
  in_progress: "กำลังพัฒนา",
  completed: "ส่งมอบแล้ว",
};

// =====================================================
// Export 1 ใบเสนอราคา (ลึกครบทุก section)
// =====================================================
export async function exportQuotationToExcel(
  project: Project,
  positions: PositionRate[],
  overheads: OverheadItem[],
  companyInfo: CompanyInfo
) {
  const calc = calculateProjectCosts(project, positions, overheads);
  const wb = new ExcelJS.Workbook();
  wb.creator = companyInfo.name;
  wb.created = new Date();

  // ----- Sheet 1: Summary -----
  const sumSheet = wb.addWorksheet("สรุปใบเสนอราคา");
  sumSheet.columns = [{ width: 32 }, { width: 28 }];

  const addRow = (label: string, value: string | number, bold = false) => {
    const row = sumSheet.addRow([label, value]);
    if (bold) {
      row.font = { bold: true };
    }
  };

  sumSheet.addRow(["ใบเสนอราคา", ""]).font = { bold: true, size: 16, color: { argb: "FF1E40AF" } };
  sumSheet.addRow([]);
  addRow("ผู้ออกใบเสนอราคา:", companyInfo.name, true);
  if (companyInfo.taxId) addRow("เลขผู้เสียภาษี:", companyInfo.taxId);
  if (companyInfo.address) addRow("ที่อยู่:", companyInfo.address);
  if (companyInfo.phone) addRow("โทร:", companyInfo.phone);
  if (companyInfo.email) addRow("อีเมล:", companyInfo.email);
  sumSheet.addRow([]);
  addRow("เลขที่ใบเสนอราคา:", project.quotationNumber ?? "-", true);
  addRow("วันที่ออก:", project.quotationDate);
  if (project.validUntil) addRow("ราคามีผลถึง:", project.validUntil);
  addRow("สถานะ:", STATUS_TH[project.status] ?? project.status);
  sumSheet.addRow([]);
  addRow("ลูกค้า:", project.client.name, true);
  if (project.client.taxId) addRow("เลขผู้เสียภาษีลูกค้า:", project.client.taxId);
  if (project.client.address) addRow("ที่อยู่ลูกค้า:", project.client.address);
  if (project.client.contactPerson) addRow("ผู้ติดต่อ:", project.client.contactPerson);
  if (project.client.contactEmail) addRow("อีเมล:", project.client.contactEmail);
  if (project.client.contactPhone) addRow("โทร:", project.client.contactPhone);
  sumSheet.addRow([]);
  addRow("ชื่อโครงการ:", project.name, true);
  if (project.description) addRow("คำอธิบาย:", project.description);
  addRow("ระยะเวลา (เดือน):", project.durationMonths);
  addRow("วันทำงาน/เดือน:", project.workingDaysPerMonth);
  sumSheet.addRow([]);

  // Totals
  const headerRow = sumSheet.addRow(["สรุปมูลค่าโครงการ", ""]);
  headerRow.font = { bold: true, size: 13, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E40AF" } };
  headerRow.alignment = { vertical: "middle" };

  const formatBaht = (n: number) =>
    new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", minimumFractionDigits: 0 }).format(n);

  addRow("ค่าแรงรวม", formatBaht(calc.laborCost));
  addRow("ค่าใช้จ่ายตรง", formatBaht(calc.directCost));
  addRow("ค่าโสหุ้ยปันส่วน", formatBaht(calc.allocatedOverhead));
  addRow("เงินสำรองความเสี่ยง", formatBaht(calc.contingencyAmount));
  const tpRow = sumSheet.addRow(["รวมต้นทุนการผลิต", formatBaht(calc.totalProductionCost)]);
  tpRow.font = { bold: true };

  const pricingModeLabel = calc.pricingMode === "fixed_price" ? "ขายเหมา (Fixed Price)" : "Cost + Markup";
  addRow("โหมดการกำหนดราคา", pricingModeLabel, true);

  if (calc.pricingMode === "fixed_price") {
    addRow("ราคาขายเหมาที่ตั้ง (ก่อน VAT)", formatBaht(project.fixedPrice));
    const diffLabel = calc.markupAmount >= 0 ? "กำไรขั้นต้น (effective)" : "ขายต่ำกว่าทุน";
    addRow(`${diffLabel} (${calc.effectiveMarkupPercent.toFixed(1)}%)`, formatBaht(calc.markupAmount));
  } else {
    addRow(`Markup (${project.markupPercentage}%)`, formatBaht(calc.markupAmount));
  }
  const pbtRow = sumSheet.addRow(["ราคาก่อนภาษี", formatBaht(calc.priceBeforeTax)]);
  pbtRow.font = { bold: true };
  addRow(`VAT (${project.taxRate}%)`, formatBaht(calc.taxAmount));
  const fpRow = sumSheet.addRow(["ราคาขายรวม VAT", formatBaht(calc.finalPrice)]);
  fpRow.font = { bold: true, color: { argb: "FF1E40AF" }, size: 12 };
  fpRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF6FF" } };
  if (project.withholdingTaxPercent > 0) {
    addRow(`หัก ณ ที่จ่าย (${project.withholdingTaxPercent}%)`, formatBaht(calc.withholdingTaxAmount));
    const nrRow = sumSheet.addRow(["เงินรับสุทธิ", formatBaht(calc.netReceivable)]);
    nrRow.font = { bold: true, color: { argb: "FF047857" } };
  }

  // ----- Sheet 2: Labor Breakdown -----
  const laborSheet = wb.addWorksheet("ค่าแรงรายตำแหน่ง");
  laborSheet.columns = [
    { header: "ตำแหน่ง", key: "title", width: 30 },
    { header: "Mandays", key: "mandays", width: 12 },
    { header: "เรตฐาน/วัน", key: "base", width: 14 },
    { header: "เรต Fully-loaded/วัน", key: "rate", width: 18 },
    { header: "รวม", key: "total", width: 16 },
  ];
  laborSheet.getRow(1).font = { bold: true };
  laborSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
  calc.laborCostBreakdown
    .filter((l) => l.mandays > 0)
    .forEach((l) => {
      laborSheet.addRow({
        title: l.title,
        mandays: l.mandays,
        base: Math.round(l.baseDailyRate),
        rate: Math.round(l.dailyRate),
        total: l.totalCost,
      });
    });
  laborSheet.getColumn("base").numFmt = '"฿"#,##0';
  laborSheet.getColumn("rate").numFmt = '"฿"#,##0';
  laborSheet.getColumn("total").numFmt = '"฿"#,##0';

  // Total row
  const lt = laborSheet.addRow({
    title: "รวม",
    mandays: calc.totalProjectMandays,
    total: calc.laborCost,
  });
  lt.font = { bold: true };
  lt.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF6FF" } };

  // ----- Sheet 3: Direct Costs -----
  if (calc.directCostBreakdown.length > 0) {
    const dSheet = wb.addWorksheet("ค่าใช้จ่ายตรง");
    dSheet.columns = [
      { header: "รายการ", key: "name", width: 40 },
      { header: "หมวด", key: "category", width: 18 },
      { header: "จำนวนเงิน", key: "cost", width: 18 },
    ];
    dSheet.getRow(1).font = { bold: true };
    dSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
    calc.directCostBreakdown.forEach((d) => {
      dSheet.addRow({ name: d.name, category: d.category ?? "other", cost: d.cost });
    });
    dSheet.getColumn("cost").numFmt = '"฿"#,##0';
    const t = dSheet.addRow({ name: "รวม", cost: calc.directCost });
    t.font = { bold: true };
  }

  // ----- Sheet 4: Phases -----
  if (project.phases.length > 0) {
    const phSheet = wb.addWorksheet("Phases");
    phSheet.columns = [
      { header: "ลำดับ", key: "idx", width: 8 },
      { header: "ชื่อเฟส", key: "name", width: 30 },
      { header: "% Mandays", key: "pct", width: 12 },
      { header: "วันส่งมอบ", key: "date", width: 14 },
      { header: "Deliverables", key: "deliv", width: 50 },
      { header: "ราคาเฟสนี้", key: "amount", width: 16 },
    ];
    phSheet.getRow(1).font = { bold: true };
    phSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
    project.phases.forEach((p, idx) => {
      phSheet.addRow({
        idx: idx + 1,
        name: p.name,
        pct: p.mandayPercent / 100,
        date: p.milestoneDate ?? "",
        deliv: p.deliverables.join("; "),
        amount: (calc.priceBeforeTax * p.mandayPercent) / 100,
      });
    });
    phSheet.getColumn("pct").numFmt = "0.0%";
    phSheet.getColumn("amount").numFmt = '"฿"#,##0';
  }

  // ----- Sheet 5: Payment Schedule -----
  if (project.paymentTerms.installments.length > 0) {
    const pSheet = wb.addWorksheet("งวดเงิน");
    pSheet.columns = [
      { header: "งวด", key: "idx", width: 6 },
      { header: "ชื่องวด", key: "name", width: 26 },
      { header: "รายละเอียด", key: "desc", width: 40 },
      { header: "ครบกำหนด (วันหลังเซ็นสัญญา)", key: "due", width: 26 },
      { header: "% ยอด", key: "pct", width: 10 },
      { header: "จำนวนเงิน", key: "amount", width: 16 },
    ];
    pSheet.getRow(1).font = { bold: true };
    pSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
    project.paymentTerms.installments.forEach((inst, idx) => {
      pSheet.addRow({
        idx: idx + 1,
        name: inst.name,
        desc: inst.description ?? "",
        due: inst.dueAfterDays === 0 ? "เมื่อเซ็นสัญญา" : `+${inst.dueAfterDays} วัน`,
        pct: inst.percent / 100,
        amount: (calc.finalPrice * inst.percent) / 100,
      });
    });
    pSheet.getColumn("pct").numFmt = "0.0%";
    pSheet.getColumn("amount").numFmt = '"฿"#,##0';
    const t = pSheet.addRow({
      name: "รวม",
      pct:
        project.paymentTerms.installments.reduce((s, i) => s + (i.percent || 0), 0) / 100,
      amount: project.paymentTerms.installments.reduce(
        (s, i) => s + (calc.finalPrice * (i.percent || 0)) / 100,
        0
      ),
    });
    t.font = { bold: true };
  }

  const blob = await workbookToBlob(wb);
  const fileSafe = (project.quotationNumber || project.name).replace(/[\\/:*?"<>|]/g, "_");
  downloadBlob(blob, `Quotation_${fileSafe}_${project.quotationDate}.xlsx`);
}

// =====================================================
// Export รายงานค่าใช้จ่ายบริษัทรายเดือน (เงินออก) — ส่งสำนักงานบัญชี
// Sheet 1: รายการค่าใช้จ่ายเรียงตามวันที่ (พร้อม VAT/หัก ณ ที่จ่าย/สำรองจ่าย)
// Sheet 2: สรุปยอดแยกตามหมวด
// =====================================================
const REIMBURSE_STATUS_TH: Record<string, string> = {
  pending: "รอเบิกคืน",
  reimbursed: "เบิกคืนแล้ว",
};

const TH_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

/** "2026-05" -> "พฤษภาคม 2569" (พ.ศ.) */
function thaiMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  if (!y || !m) return monthKey;
  return `${TH_MONTHS[m - 1]} ${y + 543}`;
}

export async function exportMonthlyExpensesToExcel(
  ledger: LedgerEntry[],
  monthKey: string,
  companyInfo?: CompanyInfo
) {
  // โฟกัสเฉพาะเงินออก (รายการค่าใช้จ่ายบริษัท) ของเดือนนั้น เรียงตามวันที่
  const entries = filterByMonth(ledger, monthKey)
    .filter((e) => e.direction === "out")
    .sort((a, b) => a.date.localeCompare(b.date));

  const wb = new ExcelJS.Workbook();
  wb.creator = companyInfo?.name || "Project Revenue";
  wb.created = new Date();

  const monthLabel = thaiMonthLabel(monthKey);

  // ----- Sheet 1: รายการค่าใช้จ่าย -----
  const sheet = wb.addWorksheet("ค่าใช้จ่าย");
  sheet.columns = [
    { header: "วันที่", key: "date", width: 12 },
    { header: "หมวด", key: "category", width: 16 },
    { header: "ผู้รับเงิน / คู่ค้า", key: "counterparty", width: 26 },
    { header: "รายละเอียด", key: "description", width: 34 },
    { header: "เลขที่อ้างอิง", key: "reference", width: 16 },
    { header: "บัญชี/ธนาคาร", key: "account", width: 18 },
    { header: "จำนวนเงิน", key: "amount", width: 15 },
    { header: "VAT", key: "vat", width: 12 },
    { header: "หัก ณ ที่จ่าย", key: "wht", width: 13 },
    { header: "สำรองจ่ายโดย", key: "paidBy", width: 16 },
    { header: "สถานะเบิกคืน", key: "reimburse", width: 14 },
    { header: "slip", key: "slip", width: 7 },
  ];

  // ----- ชื่อบริษัท + หัวรายงาน (แทรกบนสุด) -----
  sheet.spliceRows(1, 0, [], [], []);
  const titleRow = sheet.getRow(1);
  titleRow.getCell(1).value = companyInfo?.name || "รายงานค่าใช้จ่ายบริษัท";
  titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: "FF1E40AF" } };
  const subRow = sheet.getRow(2);
  subRow.getCell(1).value = `รายงานค่าใช้จ่ายประจำเดือน ${monthLabel}`;
  subRow.getCell(1).font = { bold: true, size: 11 };
  if (companyInfo?.taxId) {
    sheet.getRow(3).getCell(1).value = `เลขผู้เสียภาษี: ${companyInfo.taxId}`;
    sheet.getRow(3).getCell(1).font = { size: 10, color: { argb: "FF6B7280" } };
  }

  const headerRow = sheet.getRow(4);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E40AF" } };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };

  let totalAmount = 0;
  let totalVat = 0;
  let totalWht = 0;
  for (const e of entries) {
    let dateLabel = e.date;
    try { dateLabel = format(parseISO(e.date), "dd/MM/yyyy"); } catch { /* keep raw */ }
    totalAmount += e.amount;
    totalVat += e.vatAmount ?? 0;
    totalWht += e.whtAmount ?? 0;
    sheet.addRow({
      date: dateLabel,
      category: LEDGER_CATEGORY_LABELS[e.category],
      counterparty: e.counterparty ?? "",
      description: e.description ?? "",
      reference: e.reference ?? "",
      account: e.account ?? "",
      amount: e.amount,
      vat: e.vatAmount ?? 0,
      wht: e.whtAmount ?? 0,
      paidBy: e.reimbursable ? (e.paidBy || "—") : "",
      reimburse: e.reimbursable
        ? REIMBURSE_STATUS_TH[e.reimbursementStatus ?? "pending"]
        : "",
      slip: e.attachments?.length ? e.attachments.length : "",
    });
  }

  // แถวรวม
  const totalRow = sheet.addRow({
    category: `รวม ${entries.length} รายการ`,
    amount: totalAmount,
    vat: totalVat,
    wht: totalWht,
  });
  totalRow.font = { bold: true };
  totalRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF6FF" } };

  for (const key of ["amount", "vat", "wht"]) {
    sheet.getColumn(key).numFmt = '"฿"#,##0.00';
  }
  // ตรึงหัวตาราง (4 แถวบน)
  sheet.views = [{ state: "frozen", ySplit: 4 }];

  // ----- Sheet 2: สรุปตามหมวด -----
  const sumSheet = wb.addWorksheet("สรุปตามหมวด");
  sumSheet.columns = [
    { header: "หมวด", key: "category", width: 22 },
    { header: "จำนวนรายการ", key: "count", width: 14 },
    { header: "ยอดรวม", key: "amount", width: 16 },
    { header: "VAT", key: "vat", width: 14 },
    { header: "หัก ณ ที่จ่าย", key: "wht", width: 14 },
  ];
  const sumHeader = sumSheet.getRow(1);
  sumHeader.font = { bold: true, color: { argb: "FFFFFFFF" } };
  sumHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E40AF" } };
  sumHeader.alignment = { vertical: "middle", horizontal: "center" };

  const byCat = new Map<string, { count: number; amount: number; vat: number; wht: number }>();
  for (const e of entries) {
    const label = LEDGER_CATEGORY_LABELS[e.category];
    const agg = byCat.get(label) ?? { count: 0, amount: 0, vat: 0, wht: 0 };
    agg.count++;
    agg.amount += e.amount;
    agg.vat += e.vatAmount ?? 0;
    agg.wht += e.whtAmount ?? 0;
    byCat.set(label, agg);
  }
  [...byCat.entries()]
    .sort((a, b) => b[1].amount - a[1].amount)
    .forEach(([category, agg]) => {
      sumSheet.addRow({ category, count: agg.count, amount: agg.amount, vat: agg.vat, wht: agg.wht });
    });
  const sumTotal = sumSheet.addRow({
    category: "รวมทั้งสิ้น",
    count: entries.length,
    amount: totalAmount,
    vat: totalVat,
    wht: totalWht,
  });
  sumTotal.font = { bold: true };
  sumTotal.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF6FF" } };
  for (const key of ["amount", "vat", "wht"]) {
    sumSheet.getColumn(key).numFmt = '"฿"#,##0.00';
  }

  const blob = await workbookToBlob(wb);
  downloadBlob(blob, `Expenses_${monthKey}.xlsx`);
}

// =====================================================
// Export รายการโครงการทั้งหมด (overview เป็น single sheet)
// =====================================================
export async function exportProjectsListToExcel(
  projects: Project[],
  positions: PositionRate[],
  overheads: OverheadItem[]
) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Software Cost Pro";
  wb.created = new Date();

  const sheet = wb.addWorksheet("รายการโครงการ");
  sheet.columns = [
    { header: "เลขที่", key: "qn", width: 16 },
    { header: "ชื่อโครงการ", key: "name", width: 32 },
    { header: "ลูกค้า", key: "client", width: 28 },
    { header: "สถานะ", key: "status", width: 14 },
    { header: "โหมดราคา", key: "mode", width: 14 },
    { header: "วันออกใบเสนอ", key: "qd", width: 14 },
    { header: "ระยะเวลา (เดือน)", key: "dur", width: 14 },
    { header: "Mandays", key: "md", width: 10 },
    { header: "ต้นทุน", key: "cost", width: 16 },
    { header: "ราคาก่อน VAT", key: "pbt", width: 16 },
    { header: "ราคารวม VAT", key: "fp", width: 16 },
    { header: "กำไรสุทธิ", key: "profit", width: 14 },
    { header: "Margin %", key: "margin", width: 10 },
  ];
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E40AF" } };
  sheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };

  projects.forEach((p) => {
    const calc = calculateProjectCosts(p, positions, overheads);
    sheet.addRow({
      qn: p.quotationNumber ?? "-",
      name: p.name,
      client: p.client?.name ?? "",
      status: STATUS_TH[p.status] ?? p.status,
      mode: p.pricingMode === "fixed_price" ? "ขายเหมา" : "Cost+Markup",
      qd: p.quotationDate,
      dur: p.durationMonths,
      md: calc.totalProjectMandays,
      cost: calc.totalProductionCost,
      pbt: calc.priceBeforeTax,
      fp: calc.finalPrice,
      profit: calc.netProfit,
      margin: calc.netMarginPercent / 100,
    });
  });

  sheet.getColumn("cost").numFmt = '"฿"#,##0';
  sheet.getColumn("pbt").numFmt = '"฿"#,##0';
  sheet.getColumn("fp").numFmt = '"฿"#,##0';
  sheet.getColumn("profit").numFmt = '"฿"#,##0';
  sheet.getColumn("margin").numFmt = "0.0%";

  // Totals
  const totals = projects.reduce(
    (acc, p) => {
      const c = calculateProjectCosts(p, positions, overheads);
      acc.cost += c.totalProductionCost;
      acc.pbt += c.priceBeforeTax;
      acc.fp += c.finalPrice;
      acc.profit += c.netProfit;
      acc.md += c.totalProjectMandays;
      return acc;
    },
    { cost: 0, pbt: 0, fp: 0, profit: 0, md: 0 }
  );
  const tRow = sheet.addRow({
    name: `รวม ${projects.length} โครงการ`,
    md: totals.md,
    cost: totals.cost,
    pbt: totals.pbt,
    fp: totals.fp,
    profit: totals.profit,
  });
  tRow.font = { bold: true };
  tRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF6FF" } };

  // freeze header
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  const blob = await workbookToBlob(wb);
  downloadBlob(blob, `Projects_Overview_${new Date().toISOString().split("T")[0]}.xlsx`);
}
