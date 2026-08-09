"use client";

import React from "react";
import { Project, CompanyInfo } from "@/lib/types";

interface QuotationHeaderProps {
  project: Project;
  companyInfo: CompanyInfo;
}

export function QuotationHeader({ project, companyInfo }: QuotationHeaderProps) {
  const companyName = companyInfo.name || "ไอโปรเกรสเอ็กซ์ จำกัด";
  const clientName = project.client?.name || "(กรุณาระบุชื่อลูกค้าในตั้งค่าใบเสนอราคา)";
  const quotationNumber =
    project.quotationNumber ||
    `QT-${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, "0")}-001`;

  return (
    <>
      {/* Print Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start border-b-2 border-primary/40 pb-6 gap-6">
        <div className="space-y-1">
          <div className="text-lg font-black tracking-tight text-primary">{companyName}</div>
          {companyInfo.address && (
            <div className="text-[11px] text-slate-600 whitespace-pre-line max-w-[400px]">{companyInfo.address}</div>
          )}
          <div className="text-[11px] text-slate-500 space-x-3">
            {companyInfo.taxId && <span>เลขผู้เสียภาษี: {companyInfo.taxId}</span>}
            {companyInfo.phone && <span>โทร: {companyInfo.phone}</span>}
          </div>
          {(companyInfo.email || companyInfo.website) && (
            <div className="text-[11px] text-slate-500 space-x-3">
              {companyInfo.email && <span>{companyInfo.email}</span>}
              {companyInfo.website && <span>{companyInfo.website}</span>}
            </div>
          )}
        </div>
        <div className="text-right self-stretch sm:self-auto flex flex-col justify-between items-end gap-1">
          <div className="text-xl font-bold tracking-widest text-slate-800">ใบเสนอราคา</div>
          <div className="text-xs text-slate-500 font-mono">
            <div>เลขที่: {quotationNumber}</div>
            <div>
              วันที่:{" "}
              {project.quotationDate
                ? new Date(project.quotationDate).toLocaleDateString("th-TH")
                : new Date().toLocaleDateString("th-TH")}
            </div>
            {project.validUntil && (
              <div>ราคามีผลถึง: {new Date(project.validUntil).toLocaleDateString("th-TH")}</div>
            )}
          </div>
        </div>
      </div>

      {/* Client Details */}
      <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 p-4 rounded-lg border border-slate-100">
        <div>
          <div className="text-xs text-slate-400 font-semibold mb-1">เสนอราคาให้แก่:</div>
          <div className="font-bold text-slate-800">{clientName}</div>
          {project.client?.taxId && (
            <div className="text-[11px] text-slate-500 mt-0.5">เลขผู้เสียภาษี: {project.client.taxId}</div>
          )}
          {project.client?.address && (
            <div className="text-[11px] text-slate-500 mt-0.5 whitespace-pre-line">{project.client.address}</div>
          )}
          {project.client?.contactPerson && (
            <div className="text-[11px] text-slate-500 mt-1">
              ผู้ติดต่อ: {project.client.contactPerson}
              {project.client.contactPhone && ` • ${project.client.contactPhone}`}
            </div>
          )}
          {project.client?.contactEmail && (
            <div className="text-[11px] text-slate-500">{project.client.contactEmail}</div>
          )}
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-400 font-semibold mb-1">ชื่อโครงการซอฟต์แวร์:</div>
          <div className="font-bold text-primary">{project.name}</div>
          {project.description && (
            <div className="text-xs text-slate-500 mt-1 line-clamp-3">{project.description}</div>
          )}
          <div className="text-[11px] text-slate-500 mt-2">
            ระยะเวลาดำเนินงาน: <strong className="text-slate-700">{project.durationMonths} เดือน</strong>
          </div>
        </div>
      </div>
    </>
  );
}
