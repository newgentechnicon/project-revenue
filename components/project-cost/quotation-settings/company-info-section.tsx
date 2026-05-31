"use client";

import React from "react";
import { CompanyInfo } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Building2, Lock } from "lucide-react";
import { useOrg } from "@/hooks/use-org";

interface CompanyInfoSectionProps {
  companyInfo: CompanyInfo;
  onUpdate: (patch: Partial<CompanyInfo>) => void;
}

export function CompanyInfoSection({ companyInfo, onUpdate }: CompanyInfoSectionProps) {
  // ข้อมูลบริษัทแชร์ระดับ org — แก้ได้เฉพาะผู้ดูแล (ตรงกับ RLS)
  const { isAdmin } = useOrg();
  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" /> ข้อมูลผู้ออกใบเสนอราคา (ไอโปรเกรสเอ็กซ์ จำกัด)
        </CardTitle>
        <CardDescription>
          ตั้งค่าครั้งเดียว ใช้กับใบเสนอราคาทุกใบ
          {!isAdmin && (
            <span className="ml-1 inline-flex items-center gap-1 text-amber-600">
              <Lock className="h-3 w-3" /> แก้ได้เฉพาะผู้ดูแล
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <fieldset disabled={!isAdmin} className="space-y-4 border-0 p-0 m-0 min-w-0 disabled:opacity-70">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="co-name">ชื่อบริษัท</Label>
            <Input
              id="co-name"
              value={companyInfo.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="co-taxid">เลขประจำตัวผู้เสียภาษี (13 หลัก)</Label>
            <Input
              id="co-taxid"
              value={companyInfo.taxId ?? ""}
              onChange={(e) => onUpdate({ taxId: e.target.value })}
              maxLength={13}
              placeholder="0105561234567"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="co-address">ที่อยู่ออกใบเสนอราคา</Label>
          <Textarea
            id="co-address"
            value={companyInfo.address ?? ""}
            onChange={(e) => onUpdate({ address: e.target.value })}
            rows={2}
            placeholder="123 ถ. ตัวอย่าง แขวง... เขต... กรุงเทพฯ 10000"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="co-phone">เบอร์โทร</Label>
            <Input
              id="co-phone"
              value={companyInfo.phone ?? ""}
              onChange={(e) => onUpdate({ phone: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="co-email">อีเมล</Label>
            <Input
              id="co-email"
              type="email"
              value={companyInfo.email ?? ""}
              onChange={(e) => onUpdate({ email: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="co-web">เว็บไซต์</Label>
            <Input
              id="co-web"
              value={companyInfo.website ?? ""}
              onChange={(e) => onUpdate({ website: e.target.value })}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="co-signer">ชื่อผู้ลงนาม</Label>
            <Input
              id="co-signer"
              value={companyInfo.signerName ?? ""}
              onChange={(e) => onUpdate({ signerName: e.target.value })}
              placeholder="คุณ A B"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="co-signer-title">ตำแหน่งผู้ลงนาม</Label>
            <Input
              id="co-signer-title"
              value={companyInfo.signerTitle ?? ""}
              onChange={(e) => onUpdate({ signerTitle: e.target.value })}
              placeholder="Managing Director"
            />
          </div>
        </div>
        </fieldset>
      </CardContent>
    </Card>
  );
}
