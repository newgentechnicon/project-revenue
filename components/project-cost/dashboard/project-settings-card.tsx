"use client";

import React from "react";
import { Project } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ProjectSettingsCardProps {
  project: Project;
  onUpdateProject: (updated: Project) => void;
}

export function ProjectSettingsCard({ project, onUpdateProject }: ProjectSettingsCardProps) {
  const handleNumberPatch = (patch: Partial<Project>) =>
    onUpdateProject({ ...project, ...patch });

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">การตั้งค่าโครงการ</CardTitle>
        <CardDescription>กำหนดระยะเวลาและพารามิเตอร์ทางการเงินที่กระทบต้นทุนทั้งโครงการ</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="duration-months" className="text-xs">ระยะเวลาโครงการ (เดือน)</Label>
            <Input
              id="duration-months"
              type="number"
              min={0.5}
              step={0.5}
              value={project.durationMonths}
              onChange={(e) => handleNumberPatch({ durationMonths: parseFloat(e.target.value) || 1 })}
            />
            <p className="text-[10px] text-muted-foreground">คูณกับโสหุ้ยรายเดือน</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contingency-input" className="text-xs">เงินสำรองความเสี่ยง (%)</Label>
            <div className="relative">
              <Input
                id="contingency-input"
                type="number"
                min={0}
                max={100}
                value={project.contingencyPercent}
                onChange={(e) => handleNumberPatch({ contingencyPercent: parseFloat(e.target.value) || 0 })}
                className="pr-7"
              />
              <span className="absolute right-3 top-2.5 text-xs text-muted-foreground">%</span>
            </div>
            <p className="text-[10px] text-muted-foreground">บวกบน labor+direct+overhead</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vat-input" className="text-xs">VAT (%)</Label>
            <div className="relative">
              <Input
                id="vat-input"
                type="number"
                min={0}
                max={20}
                value={project.taxRate}
                onChange={(e) => handleNumberPatch({ taxRate: parseFloat(e.target.value) || 0 })}
                className="pr-7"
              />
              <span className="absolute right-3 top-2.5 text-xs text-muted-foreground">%</span>
            </div>
            <p className="text-[10px] text-muted-foreground">มาตรฐานไทย = 7</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wht-input" className="text-xs">หัก ณ ที่จ่าย (%)</Label>
            <div className="relative">
              <Input
                id="wht-input"
                type="number"
                min={0}
                max={20}
                value={project.withholdingTaxPercent}
                onChange={(e) => handleNumberPatch({ withholdingTaxPercent: parseFloat(e.target.value) || 0 })}
                className="pr-7"
              />
              <span className="absolute right-3 top-2.5 text-xs text-muted-foreground">%</span>
            </div>
            <p className="text-[10px] text-muted-foreground">B2B IT services = 3</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
