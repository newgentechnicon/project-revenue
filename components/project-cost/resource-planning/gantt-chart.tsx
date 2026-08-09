"use client";

import React, { useMemo } from "react";
import { Project } from "@/lib/types";
import { PositionResourcePlan, TimelineWindow, toBuddhistYear } from "@/lib/resource-planning";
import { PositionRow } from "./position-row";

interface GanttChartProps {
  plans: PositionResourcePlan[];
  window: TimelineWindow;
  onProjectClick?: (project: Project) => void;
}

/** จัดกลุ่ม months ตามปี ค.ศ. เพื่อสร้าง 2-row header */
function groupMonthsByYear(months: TimelineWindow["months"]) {
  const groups: { yearCE: number; startIdx: number; count: number }[] = [];
  for (let i = 0; i < months.length; i++) {
    const y = months[i].date.getUTCFullYear();
    const last = groups[groups.length - 1];
    if (last && last.yearCE === y) {
      last.count++;
    } else {
      groups.push({ yearCE: y, startIdx: i, count: 1 });
    }
  }
  return groups;
}

export function GanttChart({ plans, window, onProjectClick }: GanttChartProps) {
  const yearGroups = useMemo(() => groupMonthsByYear(window.months), [window.months]);
  const showYearRow = yearGroups.length > 1 || yearGroups[0]?.count !== 12 || window.monthCount > 1;

  return (
    <div className="rounded-lg border border-border/60 bg-card/40 overflow-hidden">
      {/* Year header (แสดงเฉพาะถ้าจำเป็น) */}
      {showYearRow && (
        <div className="flex border-b border-border bg-muted/60 sticky top-0 z-10">
          <div className="w-[200px] shrink-0 border-r border-border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {window.monthCount === 12 && yearGroups.length === 1
              ? `พ.ศ. ${toBuddhistYear(yearGroups[0].yearCE)}`
              : "ปี (พ.ศ.)"}
          </div>
          <div className="flex-1 relative h-7">
            <div
              className="absolute inset-0 grid"
              style={{ gridTemplateColumns: `repeat(${window.monthCount}, 1fr)` }}
            >
              {yearGroups.map((g) => (
                <div
                  key={`${g.yearCE}-${g.startIdx}`}
                  className="border-r border-border/40 last:border-r-0 flex items-center justify-center text-[11px] font-bold text-foreground bg-muted/40"
                  style={{
                    gridColumnStart: g.startIdx + 1,
                    gridColumnEnd: g.startIdx + 1 + g.count,
                  }}
                  title={`ปี ค.ศ. ${g.yearCE}`}
                >
                  พ.ศ. {toBuddhistYear(g.yearCE)}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Header row: months */}
      <div className="flex border-b-2 border-border bg-muted/40 sticky z-10" style={{ top: showYearRow ? "28px" : "0" }}>
        <div className="w-[200px] shrink-0 border-r border-border px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          ตำแหน่งงาน
        </div>
        <div className="flex-1 relative h-9">
          <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${window.monthCount}, 1fr)` }}>
            {window.months.map((m, idx) => (
              <div
                key={idx}
                className="border-r border-border/40 last:border-r-0 px-2 flex items-center justify-center text-[11px] font-semibold text-muted-foreground"
                title={m.date.toLocaleDateString("th-TH", { month: "long", year: "numeric" })}
              >
                {/* ใน year mode แสดงแค่ชื่อเดือน ไม่ต้องมีปี (year row ด้านบนแสดงแล้ว) */}
                {m.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Rows */}
      <div className="overflow-x-auto">
        {plans.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            ยังไม่มีตำแหน่งงานในระบบ
          </div>
        ) : (
          plans.map((plan) => (
            <PositionRow
              key={plan.position.id}
              plan={plan}
              window={window}
              onProjectClick={onProjectClick}
            />
          ))
        )}
      </div>
    </div>
  );
}
