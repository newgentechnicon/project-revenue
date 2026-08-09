"use client";

import React, { useMemo, useState } from "react";
import { Project, PositionRate, ProjectStatus } from "@/lib/types";
import {
  computeTimelineWindow,
  computeYearWindow,
  buildResourcePlans,
  getProjectDateRange,
  toBuddhistYear,
  getAvailableYears,
} from "@/lib/resource-planning";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GanttChart } from "./gantt-chart";
import { GanttLegend } from "./gantt-legend";
import { CalendarRange, Filter, X, Edit2, ChevronLeft, ChevronRight, Maximize2 } from "lucide-react";
import { toast } from "sonner";

interface ResourcePlanningViewProps {
  projects: Project[];
  positions: PositionRate[];
  onUpdateProject: (updated: Project) => void;
}

type StatusFilter = "active" | "all" | ProjectStatus;
type ViewMode = "year" | "auto";

const STATUS_FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "active", label: "ที่ active (ไม่นับ lost)" },
  { value: "all", label: "ทุกสถานะ" },
  { value: "draft", label: "ร่าง" },
  { value: "quoted", label: "เสนอราคา" },
  { value: "won", label: "ปิดการขาย" },
  { value: "in_progress", label: "กำลังพัฒนา" },
  { value: "completed", label: "ส่งมอบแล้ว" },
];

export function ResourcePlanningView({
  projects,
  positions,
  onUpdateProject,
}: ResourcePlanningViewProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [viewMode, setViewMode] = useState<ViewMode>("year");
  const [selectedYearCE, setSelectedYearCE] = useState<number>(new Date().getUTCFullYear());
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editStartDate, setEditStartDate] = useState("");
  const [editDuration, setEditDuration] = useState(1);

  // Filter projects
  const filteredProjects = useMemo(() => {
    if (statusFilter === "all") return projects;
    if (statusFilter === "active") return projects.filter((p) => p.status !== "lost");
    return projects.filter((p) => p.status === statusFilter);
  }, [projects, statusFilter]);

  const availableYears = useMemo(() => getAvailableYears(projects), [projects]);

  const window = useMemo(() => {
    if (viewMode === "year") return computeYearWindow(selectedYearCE);
    return computeTimelineWindow(filteredProjects);
  }, [viewMode, selectedYearCE, filteredProjects]);

  const plans = useMemo(() => {
    const excludeStatuses = statusFilter === "all" ? [] : statusFilter === "active" ? ["lost"] : [];
    return buildResourcePlans(positions, filteredProjects, window, { excludeStatuses });
  }, [positions, filteredProjects, window, statusFilter]);

  const handleProjectClick = (project: Project) => {
    setEditingProject(project);
    const range = getProjectDateRange(project);
    setEditStartDate(range.startISO);
    setEditDuration(project.durationMonths);
  };

  const handleSaveEdit = () => {
    if (!editingProject) return;
    onUpdateProject({
      ...editingProject,
      startDate: editStartDate,
      durationMonths: Math.max(0.5, editDuration),
    });
    toast.success("ปรับช่วงเวลาโครงการเรียบร้อย");
    setEditingProject(null);
  };

  const handleClearStartDate = () => {
    if (!editingProject) return;
    onUpdateProject({
      ...editingProject,
      startDate: undefined,
    });
    toast.success("ยกเลิก start date — ใช้ quotationDate แทน");
    setEditingProject(null);
  };

  // Stats summary
  const totalProjects = filteredProjects.length;
  const overUtilizedCount = plans.filter((p) => p.utilizationPercent > 100).length;
  const idleCount = plans.filter((p) => p.assignments.length === 0).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <CalendarRange className="h-6 w-6 text-primary" /> Resource Planning
        </h2>
        <p className="text-sm text-muted-foreground">
          ดูภาพรวมว่าแต่ละตำแหน่งงานต้องดูโครงการอะไรบ้างเป็น Gantt timeline พร้อม utilization ของแต่ละบทบาท
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-4 pb-4">
            <div className="text-[11px] text-muted-foreground font-semibold">โครงการในผัง</div>
            <div className="text-2xl font-black">{totalProjects}</div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-4 pb-4">
            <div className="text-[11px] text-muted-foreground font-semibold">ตำแหน่งที่ใช้งาน</div>
            <div className="text-2xl font-black">{positions.length - idleCount}</div>
            <div className="text-[10px] text-muted-foreground">ว่าง {idleCount} ตำแหน่ง</div>
          </CardContent>
        </Card>
        <Card className={`border-border/50 ${overUtilizedCount > 0 ? "bg-rose-50/50 dark:bg-rose-950/20 border-rose-200" : "bg-card/50"}`}>
          <CardContent className="pt-4 pb-4">
            <div className="text-[11px] text-muted-foreground font-semibold">เกิน capacity</div>
            <div className={`text-2xl font-black ${overUtilizedCount > 0 ? "text-rose-600 dark:text-rose-400" : ""}`}>
              {overUtilizedCount}
            </div>
            <div className="text-[10px] text-muted-foreground">ตำแหน่ง</div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-4 pb-4">
            <div className="text-[11px] text-muted-foreground font-semibold">
              {viewMode === "year" ? "ปีที่ดู" : "ช่วงเวลา"}
            </div>
            {viewMode === "year" ? (
              <>
                <div className="text-2xl font-black text-primary">
                  พ.ศ. {toBuddhistYear(selectedYearCE)}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  ค.ศ. {selectedYearCE} • 12 เดือน
                </div>
              </>
            ) : (
              <>
                <div className="text-sm font-bold">
                  {window.start.toLocaleDateString("th-TH", { month: "short", year: "2-digit" })}
                  {" – "}
                  {window.end.toLocaleDateString("th-TH", { month: "short", year: "2-digit" })}
                </div>
                <div className="text-[10px] text-muted-foreground">{window.monthCount} เดือน</div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <Card className="border-border/50 bg-card/50">
        <CardContent className="pt-4 pb-4 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between flex-wrap">
            {/* View mode toggle */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg">
                <Button
                  size="sm"
                  variant={viewMode === "year" ? "default" : "ghost"}
                  onClick={() => setViewMode("year")}
                  className="h-7 px-3 text-xs gap-1.5"
                >
                  <CalendarRange className="h-3.5 w-3.5" /> รายปี
                </Button>
                <Button
                  size="sm"
                  variant={viewMode === "auto" ? "default" : "ghost"}
                  onClick={() => setViewMode("auto")}
                  className="h-7 px-3 text-xs gap-1.5"
                >
                  <Maximize2 className="h-3.5 w-3.5" /> Auto-fit
                </Button>
              </div>

              {/* Year navigator — แสดงเฉพาะ year mode */}
              {viewMode === "year" && (
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => setSelectedYearCE(selectedYearCE - 1)}
                    className="h-8 w-8"
                    title="ปีก่อนหน้า"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Select
                    value={String(selectedYearCE)}
                    onValueChange={(v) => setSelectedYearCE(parseInt(v))}
                  >
                    <SelectTrigger className="h-8 w-[140px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableYears.map((y) => (
                        <SelectItem key={y} value={String(y)}>
                          พ.ศ. {toBuddhistYear(y)} ({y})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => setSelectedYearCE(selectedYearCE + 1)}
                    className="h-8 w-8"
                    title="ปีถัดไป"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  {selectedYearCE !== new Date().getUTCFullYear() && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedYearCE(new Date().getUTCFullYear())}
                      className="h-8 text-xs"
                    >
                      กลับไปปีนี้
                    </Button>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Label className="text-xs whitespace-nowrap">สถานะ:</Label>
                <Select value={statusFilter} onValueChange={(v: StatusFilter) => setStatusFilter(v)}>
                  <SelectTrigger className="h-8 w-[180px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_FILTER_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="pt-2 border-t border-border/40">
            <GanttLegend />
          </div>
        </CardContent>
      </Card>

      {/* Gantt */}
      {totalProjects === 0 ? (
        <Card className="border-border/50 bg-card/50 border-dashed">
          <CardContent className="pt-12 pb-12 text-center text-sm text-muted-foreground">
            ไม่มีโครงการที่ตรงกับเงื่อนไข
          </CardContent>
        </Card>
      ) : (
        <GanttChart plans={plans} window={window} onProjectClick={handleProjectClick} />
      )}

      <div className="text-[11px] text-muted-foreground italic">
        💡 คลิกที่แถบโครงการเพื่อปรับวันเริ่มและระยะเวลา หรือไปที่ &ldquo;ตั้งค่าใบเสนอราคา&rdquo; ของแต่ละโปรเจกต์
      </div>

      {/* Edit Project Schedule Dialog */}
      <Dialog open={!!editingProject} onOpenChange={(open) => !open && setEditingProject(null)}>
        <DialogContent className="sm:max-w-[450px]">
          {editingProject && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Edit2 className="h-4 w-4" /> ปรับช่วงเวลาโครงการ
                </DialogTitle>
                <DialogDescription>
                  <span className="font-semibold text-foreground">{editingProject.name}</span>
                  {editingProject.client?.name && ` • ${editingProject.client.name}`}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-1.5">
                  <Label htmlFor="rp-start-date">วันเริ่มงาน</Label>
                  <Input
                    id="rp-start-date"
                    type="date"
                    value={editStartDate}
                    onChange={(e) => setEditStartDate(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    ถ้าเว้นว่าง ระบบจะใช้ &ldquo;วันที่ออกใบเสนอราคา&rdquo; ({editingProject.quotationDate})
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rp-duration">ระยะเวลา (เดือน)</Label>
                  <Input
                    id="rp-duration"
                    type="number"
                    min={0.5}
                    step={0.5}
                    value={editDuration}
                    onChange={(e) => setEditDuration(parseFloat(e.target.value) || 1)}
                  />
                </div>
                {editingProject.startDate && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearStartDate}
                    className="gap-1.5 text-xs"
                  >
                    <X className="h-3 w-3" /> ยกเลิก start date เฉพาะ (ใช้ quotationDate)
                  </Button>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingProject(null)}>
                  ยกเลิก
                </Button>
                <Button onClick={handleSaveEdit}>บันทึก</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
