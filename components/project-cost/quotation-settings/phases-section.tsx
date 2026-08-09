"use client";

import React, { useMemo } from "react";
import { ProjectPhase } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ListChecks, Plus, Trash2, AlertCircle, Calendar } from "lucide-react";

interface PhasesSectionProps {
  phases: ProjectPhase[];
  onUpdate: (next: ProjectPhase[]) => void;
}

export function PhasesSection({ phases, onUpdate }: PhasesSectionProps) {
  const phaseTotalPercent = useMemo(
    () => phases.reduce((s, p) => s + (p.mandayPercent || 0), 0),
    [phases]
  );
  const phasesBalanced = phases.length === 0 || Math.abs(phaseTotalPercent - 100) < 0.001;

  const handleAdd = () => {
    const newPhase: ProjectPhase = {
      id: "ph_" + Date.now(),
      name: `Phase ${phases.length + 1}`,
      mandayPercent: 0,
      deliverables: [],
    };
    onUpdate([...phases, newPhase]);
  };

  const handleUpdate = (id: string, patch: Partial<ProjectPhase>) => {
    onUpdate(phases.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const handleRemove = (id: string) => {
    onUpdate(phases.filter((p) => p.id !== id));
  };

  const handleUpdateDeliverables = (id: string, raw: string) => {
    const items = raw
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    handleUpdate(id, { deliverables: items });
  };

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-primary" /> เฟสและกำหนดส่งมอบงาน (Phases & Milestones)
            </CardTitle>
            <CardDescription>
              แบ่งโครงการเป็นเฟสย่อย เพื่อให้ใบเสนอราคาแสดง breakdown และวันส่งมอบชัดเจน (optional)
            </CardDescription>
          </div>
          {phases.length > 0 && (
            <div className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
              phasesBalanced
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-amber-50 border-amber-200 text-amber-700"
            }`}>
              รวม % mandays: {phaseTotalPercent.toFixed(1)}%
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={handleAdd} variant="outline" className="gap-2 w-full md:w-auto">
          <Plus className="h-4 w-4" /> เพิ่มเฟสใหม่
        </Button>

        {phases.length === 0 ? (
          <div className="text-sm text-muted-foreground italic text-center py-6 border border-dashed rounded-lg">
            ยังไม่มี phase — เพิ่มได้ถ้าต้องการแสดง milestone breakdown ในใบเสนอราคา
          </div>
        ) : (
          <div className="space-y-3">
            {phases.map((phase, idx) => (
              <div key={phase.id} className="rounded-lg border border-border/60 p-4 space-y-3 bg-background/50">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-bold text-muted-foreground">เฟสที่ {idx + 1}</div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleRemove(phase.id)}
                    className="h-7 w-7 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  <div className="md:col-span-5 space-y-1.5">
                    <Label className="text-xs">ชื่อเฟส</Label>
                    <Input
                      value={phase.name}
                      onChange={(e) => handleUpdate(phase.id, { name: e.target.value })}
                      placeholder="เช่น Phase 1: Discovery & Design"
                    />
                  </div>
                  <div className="md:col-span-3 space-y-1.5">
                    <Label className="text-xs">% ของ mandays</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.1}
                      value={phase.mandayPercent || ""}
                      onChange={(e) => handleUpdate(phase.id, { mandayPercent: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="md:col-span-4 space-y-1.5">
                    <Label className="text-xs flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> วันส่งมอบ (Milestone)
                    </Label>
                    <Input
                      type="date"
                      value={phase.milestoneDate ?? ""}
                      onChange={(e) => handleUpdate(phase.id, { milestoneDate: e.target.value || undefined })}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">รายละเอียดเฟส</Label>
                  <Textarea
                    value={phase.description ?? ""}
                    onChange={(e) => handleUpdate(phase.id, { description: e.target.value })}
                    rows={1}
                    placeholder="คำอธิบายว่าเฟสนี้ครอบคลุมอะไร"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Deliverables (คั่นด้วย enter หรือ comma)</Label>
                  <Textarea
                    value={phase.deliverables.join("\n")}
                    onChange={(e) => handleUpdateDeliverables(phase.id, e.target.value)}
                    rows={2}
                    placeholder="เช่น&#10;Wireframes ทุก screen&#10;UX/UI design system&#10;Database schema document"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {!phasesBalanced && phases.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              ผลรวม % mandays ของทุก phase = <strong>{phaseTotalPercent.toFixed(1)}%</strong> ควรเท่ากับ 100% เพื่อให้ครอบคลุมทั้งโครงการ
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
