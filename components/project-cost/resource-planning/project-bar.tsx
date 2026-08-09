"use client";

import React from "react";
import { Project } from "@/lib/types";
import { ProjectAssignment, BarPosition } from "@/lib/resource-planning";

interface ProjectBarProps {
  assignment: ProjectAssignment;
  position: BarPosition;
  topPercent: number;
  heightPercent: number;
  onClick?: (project: Project) => void;
}

const STATUS_COLOR: Record<string, string> = {
  draft: "bg-slate-400 hover:bg-slate-500 border-slate-500",
  quoted: "bg-blue-500 hover:bg-blue-600 border-blue-600",
  won: "bg-emerald-500 hover:bg-emerald-600 border-emerald-600",
  in_progress: "bg-amber-500 hover:bg-amber-600 border-amber-600",
  completed: "bg-violet-500 hover:bg-violet-600 border-violet-600",
  lost: "bg-rose-500 hover:bg-rose-600 border-rose-600",
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "2-digit" });

export function ProjectBar({ assignment, position, topPercent, heightPercent, onClick }: ProjectBarProps) {
  const colorClass = STATUS_COLOR[assignment.project.status] ?? STATUS_COLOR.draft;
  const phases = assignment.project.phases || [];

  return (
    <div
      className="absolute group"
      style={{
        left: `${position.leftPercent}%`,
        width: `${position.widthPercent}%`,
        top: `${topPercent}%`,
        height: `${heightPercent}%`,
      }}
    >
      <button
        type="button"
        onClick={() => onClick?.(assignment.project)}
        title={`${assignment.project.name}\n${assignment.mandays} mandays\n${formatDate(assignment.range.startISO)} → ${formatDate(assignment.range.endISO)}\n${phases.map(p => `- ${p.name} (${p.mandayPercent}%)`).join('\n')}`}
        className={`w-full h-full rounded-md border text-[10px] text-white font-semibold shadow-sm px-1.5 truncate cursor-pointer transition-all hover:shadow-md hover:z-10 relative overflow-hidden ${colorClass}`}
        style={{
          lineHeight: "1.4",
        }}
      >
        {/* Phase background indicators */}
        <div className="absolute inset-0 flex pointer-events-none opacity-20">
          {phases.map((p, idx) => (
            <div
              key={p.id}
              className={`h-full border-r border-white/30 last:border-r-0`}
              style={{ width: `${p.mandayPercent}%` }}
            />
          ))}
        </div>

        <span className="relative z-10 truncate block">{assignment.project.name}</span>
        <div className="relative z-10 flex items-center justify-between gap-1 opacity-90">
          <span className="text-[9px] truncate">
            {assignment.mandays}d
          </span>
          {phases.length > 0 && (
            <span className="text-[8px] font-normal truncate hidden sm:block">
              {phases.length} phases
            </span>
          )}
        </div>
      </button>

      {/* Milestone markers (if any) */}
      {phases.filter(p => !!p.milestoneDate).map((p, idx) => {
        // This is a simplified positioning of milestones within the bar
        // Ideally we'd calculate the exact position based on milestoneDate vs project start/end
        return (
          <div 
            key={p.id}
            className="absolute -bottom-1.5 w-2 h-2 bg-primary border border-white rounded-full z-20 shadow-sm"
            style={{ left: `${p.mandayPercent}%`, transform: 'translateX(-50%)' }}
            title={`Milestone: ${p.name} (${p.milestoneDate})`}
          />
        );
      })}
    </div>
  );
}
