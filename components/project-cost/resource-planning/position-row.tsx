"use client";

import React, { useMemo } from "react";
import { Project } from "@/lib/types";
import { PositionResourcePlan, TimelineWindow, computeBarPosition, ProjectAssignment } from "@/lib/resource-planning";
import { ProjectBar } from "./project-bar";
import { AlertTriangle } from "lucide-react";

interface PositionRowProps {
  plan: PositionResourcePlan;
  window: TimelineWindow;
  onProjectClick?: (project: Project) => void;
}

const ROW_HEIGHT_PX = 72; // ความสูงแถวต่อ position
const BAR_HEIGHT_PERCENT = 40; // ความสูง bar (สำหรับ 1 lane)

/**
 * แบ่ง assignments เป็น "lanes" เพื่อไม่ให้ bars ทับกัน
 * Greedy: ใส่ assignment ลง lane แรกที่ว่าง (วันสิ้นสุด lane <= วันเริ่ม assignment)
 */
function assignLanes(assignments: ProjectAssignment[]): ProjectAssignment[][] {
  const lanes: ProjectAssignment[][] = [];
  for (const a of assignments) {
    let placed = false;
    for (const lane of lanes) {
      const last = lane[lane.length - 1];
      if (last.range.end.getTime() <= a.range.start.getTime()) {
        lane.push(a);
        placed = true;
        break;
      }
    }
    if (!placed) lanes.push([a]);
  }
  return lanes;
}

export function PositionRow({ plan, window, onProjectClick }: PositionRowProps) {
  const lanes = useMemo(() => assignLanes(plan.assignments), [plan.assignments]);
  const laneCount = Math.max(1, lanes.length);
  const totalHeight = laneCount === 1 ? ROW_HEIGHT_PX : Math.max(ROW_HEIGHT_PX, laneCount * 38);
  const laneHeightPercent = 100 / laneCount;
  const barHeightPercent = laneCount === 1 ? BAR_HEIGHT_PERCENT : laneHeightPercent * 0.7;

  const utilization = plan.utilizationPercent;
  const overUtilized = utilization > 100;

  return (
    <div className="flex border-b border-border/40 last:border-b-0">
      {/* Left label */}
      <div
        className="w-[200px] shrink-0 border-r border-border/40 px-3 py-2 flex flex-col justify-center bg-card/30"
        style={{ height: totalHeight }}
      >
        <div className="flex items-center gap-1.5 text-sm font-semibold truncate" title={plan.position.title}>
          {overUtilized && <AlertTriangle className="h-3.5 w-3.5 text-rose-500 shrink-0" />}
          <span className="truncate">{plan.position.title}</span>
        </div>
        <div className="text-[10px] text-muted-foreground">
          {plan.position.headcount} คน • {plan.assignments.length} โครงการ
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          <div className="flex-1 h-1.5 bg-muted rounded overflow-hidden">
            <div
              className={`h-full rounded transition-all ${
                overUtilized
                  ? "bg-rose-500"
                  : utilization > 80
                    ? "bg-amber-500"
                    : "bg-emerald-500"
              }`}
              style={{ width: `${Math.min(100, utilization)}%` }}
            />
          </div>
          <span
            className={`text-[10px] font-mono font-semibold ${
              overUtilized ? "text-rose-600" : "text-muted-foreground"
            }`}
          >
            {utilization.toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Timeline area */}
      <div
        className="flex-1 relative bg-background/30"
        style={{ height: totalHeight }}
      >
        {/* Month grid lines */}
        {window.months.map((m, idx) => (
          <div
            key={idx}
            className="absolute top-0 bottom-0 border-l border-border/30"
            style={{ left: `${(idx / window.monthCount) * 100}%` }}
          />
        ))}

        {/* Today line */}
        {(() => {
          const now = new Date().getTime();
          if (now < window.start.getTime() || now > window.end.getTime()) return null;
          const pct = ((now - window.start.getTime()) / (window.end.getTime() - window.start.getTime())) * 100;
          return (
            <div
              className="absolute top-0 bottom-0 border-l-2 border-primary/50 z-[1]"
              style={{ left: `${pct}%` }}
              title="วันนี้"
            />
          );
        })()}

        {/* Bars — ซ่อน bar ที่ไม่ overlap กับ window */}
        {lanes.map((lane, laneIdx) =>
          lane.map((assignment) => {
            const pos = computeBarPosition(assignment.range, window);
            if (pos.widthPercent <= 0) return null;
            const topPercent = laneIdx * laneHeightPercent + (laneHeightPercent - barHeightPercent) / 2;
            return (
              <ProjectBar
                key={assignment.project.id}
                assignment={assignment}
                position={pos}
                topPercent={topPercent}
                heightPercent={barHeightPercent}
                onClick={onProjectClick}
              />
            );
          })
        )}

        {/* Empty state */}
        {plan.assignments.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-[11px] text-muted-foreground italic">
            ยังไม่มีโครงการมอบหมาย
          </div>
        )}
      </div>
    </div>
  );
}
