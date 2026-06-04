"use client";

import React, { useState } from "react";
import { Project, PositionRate, OverheadItem, CompanyInfo } from "@/lib/types";
import { CostCalculationResult } from "@/lib/calculations";
import { exportQuotationToExcel } from "@/lib/excel-export";
import { toast } from "sonner";
import { QuotationToolbar } from "./quotation/quotation-toolbar";
import { QuotationHeader } from "./quotation/quotation-header";
import { QuotationCostTable } from "./quotation/quotation-cost-table";
import { QuotationModulesSection } from "./quotation/quotation-modules-section";
import { QuotationPhasesSection } from "./quotation/quotation-phases-section";
import { QuotationPaymentSchedule } from "./quotation/quotation-payment-schedule";
import { QuotationSignature } from "./quotation/quotation-signature";

interface QuotationViewProps {
  project: Project;
  positions: PositionRate[];
  overheads: OverheadItem[];
  companyInfo: CompanyInfo;
  calculations: CostCalculationResult;
}

export function QuotationView({
  project,
  positions,
  overheads,
  companyInfo,
  calculations,
}: QuotationViewProps) {
  const [showDetailedLabor, setShowDetailedLabor] = useState(true);

  const handlePrint = () => window.print();

  const handleExportExcel = async () => {
    try {
      await exportQuotationToExcel(project, positions, overheads, companyInfo);
      toast.success("Export Excel เรียบร้อย");
    } catch (e) {
      console.error(e);
      toast.error("Export ไม่สำเร็จ");
    }
  };

  return (
    <div className="space-y-6">
      <QuotationToolbar
        showDetailedLabor={showDetailedLabor}
        onToggleDetailedLabor={() => setShowDetailedLabor(!showDetailedLabor)}
        onPrint={handlePrint}
        onExportExcel={handleExportExcel}
      />

      {/* Invoice Sheet */}
      <div className="print-container flex justify-center">
        <div className="w-full max-w-[800px] border border-border shadow-md bg-white text-black p-8 md:p-12 space-y-8 rounded-lg print:border-0 print:shadow-none print:p-0 print:m-0 print:max-w-none print:bg-transparent">
          <QuotationHeader project={project} companyInfo={companyInfo} />

          <QuotationCostTable
            project={project}
            calculations={calculations}
            showDetailedLabor={showDetailedLabor}
          />

          <QuotationModulesSection
            project={project}
            positions={positions}
            calculations={calculations}
          />

          <QuotationPhasesSection project={project} calculations={calculations} />

          <QuotationPaymentSchedule project={project} calculations={calculations} />

          <QuotationSignature project={project} companyInfo={companyInfo} />
        </div>
      </div>
    </div>
  );
}
