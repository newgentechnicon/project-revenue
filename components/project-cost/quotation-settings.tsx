"use client";

import React from "react";
import { Project, CompanyInfo, Customer } from "@/lib/types";
import { toClientInfo } from "@/lib/customers";
import { CompanyInfoSection } from "./quotation-settings/company-info-section";
import { ClientInfoSection } from "./quotation-settings/client-info-section";
import { QuotationMetaSection } from "./quotation-settings/quotation-meta-section";
import { PaymentTermsSection } from "./quotation-settings/payment-terms-section";
import { PhasesSection } from "./quotation-settings/phases-section";

interface QuotationSettingsProps {
  project: Project;
  companyInfo: CompanyInfo;
  customers?: Customer[];
  onUpdateProject: (updated: Project) => void;
  onUpdateCompanyInfo: (info: CompanyInfo) => void;
}

export function QuotationSettings({
  project,
  companyInfo,
  customers = [],
  onUpdateProject,
  onUpdateCompanyInfo,
}: QuotationSettingsProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">ตั้งค่าใบเสนอราคา</h2>
        <p className="text-sm text-muted-foreground">
          จัดการข้อมูลผู้ออกใบเสนอราคา ข้อมูลลูกค้า เงื่อนไขการชำระเงิน และเฟสของโครงการ
        </p>
      </div>

      <CompanyInfoSection
        companyInfo={companyInfo}
        onUpdate={(patch) => onUpdateCompanyInfo({ ...companyInfo, ...patch })}
      />

      <QuotationMetaSection
        project={project}
        onUpdate={(patch) => onUpdateProject({ ...project, ...patch })}
      />

      <ClientInfoSection
        client={project.client}
        customers={customers}
        customerId={project.customerId}
        onUpdate={(patch) =>
          onUpdateProject({ ...project, client: { ...project.client, ...patch } })
        }
        onSelectCustomer={(customer) =>
          onUpdateProject(
            customer
              ? { ...project, customerId: customer.id, client: toClientInfo(customer) }
              : { ...project, customerId: undefined }
          )
        }
      />

      <PaymentTermsSection
        terms={project.paymentTerms}
        onUpdate={(patch) =>
          onUpdateProject({
            ...project,
            paymentTerms: { ...project.paymentTerms, ...patch },
          })
        }
      />

      <PhasesSection
        phases={project.phases}
        onUpdate={(next) => onUpdateProject({ ...project, phases: next })}
      />
    </div>
  );
}
