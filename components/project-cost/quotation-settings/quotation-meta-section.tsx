"use client";

import React from "react";
import { Project } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText } from "lucide-react";

interface QuotationMetaSectionProps {
  project: Project;
  onUpdate: (patch: Partial<Project>) => void;
}

export function QuotationMetaSection({ project, onUpdate }: QuotationMetaSectionProps) {
  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" /> ข้อมูลเอกสารใบเสนอราคา
        </CardTitle>
        <CardDescription>เลขที่และวันหมดอายุของใบเสนอราคานี้</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="qt-number">เลขที่ใบเสนอราคา</Label>
            <Input
              id="qt-number"
              value={project.quotationNumber ?? ""}
              onChange={(e) => onUpdate({ quotationNumber: e.target.value })}
              placeholder="QT-202405-001"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qt-date">วันที่ออกใบเสนอราคา</Label>
            <Input
              id="qt-date"
              type="date"
              value={project.quotationDate}
              onChange={(e) => onUpdate({ quotationDate: e.target.value })}
            />
            <p className="text-[10px] text-muted-foreground">กรองโสหุ้ยที่ active ในช่วงนี้</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qt-valid">ราคามีผลถึง</Label>
            <Input
              id="qt-valid"
              type="date"
              value={project.validUntil ?? ""}
              onChange={(e) => onUpdate({ validUntil: e.target.value || undefined })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
