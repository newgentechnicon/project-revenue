"use client";

import React, { useState } from "react";
import { Project, ProjectStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  LayoutDashboard, Users, Settings, ClipboardList, FileText,
  ChevronLeft, Edit2, Copy, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { SidebarViewId } from "./sidebar";

const STATUS_LABELS: Record<ProjectStatus, { label: string; className: string }> = {
  draft: { label: "ร่าง", className: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700" },
  quoted: { label: "เสนอราคา", className: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-900" },
  won: { label: "ปิดการขาย", className: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-900" },
  lost: { label: "ไม่ได้งาน", className: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-900" },
  in_progress: { label: "พัฒนา", className: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-900" },
  completed: { label: "ส่งมอบ", className: "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950 dark:text-violet-200 dark:border-violet-900" },
};

type ProjectScopeView = Extract<SidebarViewId, "dashboard" | "labor" | "overhead_alloc" | "quote_settings" | "quote">;

const SUB_TABS: { id: ProjectScopeView; label: string; icon: React.ElementType }[] = [
  { id: "dashboard", label: "แดชบอร์ด", icon: LayoutDashboard },
  { id: "labor", label: "จัดสรรคน", icon: Users },
  { id: "overhead_alloc", label: "ปันส่วนโสหุ้ย", icon: Settings },
  { id: "quote_settings", label: "ตั้งค่าใบเสนอราคา", icon: ClipboardList },
  { id: "quote", label: "ใบเสนอราคา / PDF", icon: FileText },
];

interface ProjectWorkspaceHeaderProps {
  project: Project;
  activeView: ProjectScopeView;
  onChangeView: (view: ProjectScopeView) => void;
  onBackToList: () => void;
  onUpdateProject: (updated: Project) => void;
  onDeleteProject: (id: string) => void;
  onDuplicateProject: (id: string) => void;
}

export function ProjectWorkspaceHeader({
  project,
  activeView,
  onChangeView,
  onBackToList,
  onUpdateProject,
  onDeleteProject,
  onDuplicateProject,
}: ProjectWorkspaceHeaderProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editName, setEditName] = useState(project.name);
  const [editDesc, setEditDesc] = useState(project.description ?? "");

  const handleStartEdit = () => {
    setEditName(project.name);
    setEditDesc(project.description ?? "");
    setIsEditOpen(true);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;
    onUpdateProject({
      ...project,
      name: editName.trim(),
      description: editDesc.trim() || undefined,
    });
    setIsEditOpen(false);
    toast.success("อัปเดตข้อมูลโครงการสำเร็จ");
  };

  const handleDuplicate = () => {
    onDuplicateProject(project.id);
    toast.success("คัดลอกโครงการสำเร็จ");
  };

  const handleDelete = () => {
    if (confirm(`ลบโครงการ "${project.name}" ใช่หรือไม่?\nข้อมูลทั้งหมดจะหายไปถาวร`)) {
      onDeleteProject(project.id);
      toast.success("ลบโครงการเรียบร้อย");
      onBackToList();
    }
  };

  const status = STATUS_LABELS[project.status];

  return (
    <div className="border-b border-border/60 bg-card/30 backdrop-blur-xs z-20 print:hidden -mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8">
      <div className="py-3 space-y-3">
        {/* Top row: back button + project info + actions */}
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBackToList}
            className="gap-1.5 h-8 -ml-2 shrink-0 text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="text-xs font-medium">ทุกโครงการ</span>
          </Button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-bold tracking-tight truncate" title={project.name}>
                {project.name}
              </h1>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${status.className}`}>
                {status.label}
              </span>
              {project.quotationNumber && (
                <span className="text-[10px] text-muted-foreground font-mono">
                  {project.quotationNumber}
                </span>
              )}
            </div>
            {project.client?.name && (
              <div className="text-xs text-muted-foreground mt-0.5 truncate">
                {project.client.name}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleStartEdit}
              className="h-8 w-8"
              title="แก้ไขชื่อ/คำอธิบาย"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDuplicate}
              className="h-8 w-8"
              title="คัดลอกโครงการ"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDelete}
              className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
              title="ลบโครงการ"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Sub-nav tabs */}
        <Tabs value={activeView} onValueChange={(v) => onChangeView(v as ProjectScopeView)}>
          <TabsList className="h-9 bg-transparent p-0 gap-1 w-full justify-start overflow-x-auto">
            {SUB_TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="gap-1.5 h-8 px-3 text-xs font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleSaveEdit}>
            <DialogHeader>
              <DialogTitle>แก้ไขข้อมูลโครงการ</DialogTitle>
              <DialogDescription>
                สำหรับข้อมูลลูกค้า/payment terms ดูที่ &ldquo;ตั้งค่าใบเสนอราคา&rdquo;
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="ph-edit-name">ชื่อโครงการ</Label>
                <Input
                  id="ph-edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ph-edit-desc">คำอธิบาย</Label>
                <Input
                  id="ph-edit-desc"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">บันทึกการแก้ไข</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
