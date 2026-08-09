"use client";

import React from "react";
import { Project, CompanyInfo } from "@/lib/types";
import { ShieldCheck } from "lucide-react";

interface QuotationSignatureProps {
  project: Project;
  companyInfo: CompanyInfo;
}

export function QuotationSignature({ project, companyInfo }: QuotationSignatureProps) {
  const companyName = companyInfo.name || "ไอโปรเกรสเอ็กซ์ จำกัด";
  const clientName = project.client?.name || "(กรุณาระบุชื่อลูกค้า)";

  return (
    <div className="grid grid-cols-2 gap-12 pt-16 text-center text-xs text-slate-500">
      <div className="space-y-12">
        <div className="border-b border-dashed border-slate-300 pb-2 mx-auto w-48"></div>
        <div>
          <p className="font-bold text-slate-700">({clientName})</p>
          {project.client?.contactPerson && (
            <p className="text-[11px] text-slate-500">{project.client.contactPerson}</p>
          )}
          <p className="mt-1">ผู้อนุมัติฝั่งลูกค้า / วันที่อนุมัติ</p>
        </div>
      </div>
      <div className="space-y-12">
        <div className="flex flex-col items-center justify-end">
          <div className="border-b border-dashed border-slate-300 pb-2 w-48 mb-2"></div>
          <div className="text-[10px] text-green-600 bg-green-50 px-2 py-0.5 rounded border border-green-200 flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" /> ประเมินระบบเสร็จสมบูรณ์
          </div>
        </div>
        <div>
          {companyInfo.signerName ? (
            <>
              <p className="font-bold text-slate-700">({companyInfo.signerName})</p>
              {companyInfo.signerTitle && (
                <p className="text-[11px] text-slate-500">{companyInfo.signerTitle}</p>
              )}
            </>
          ) : (
            <p className="font-bold text-slate-700">ผู้จัดทำเอกสาร</p>
          )}
          <p className="mt-1">{companyName}</p>
        </div>
      </div>
    </div>
  );
}
