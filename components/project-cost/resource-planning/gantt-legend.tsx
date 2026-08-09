"use client";

import React from "react";

const STATUS_DOTS = [
  { color: "bg-slate-400", label: "ร่าง" },
  { color: "bg-blue-500", label: "เสนอราคา" },
  { color: "bg-emerald-500", label: "ปิดการขาย" },
  { color: "bg-amber-500", label: "กำลังพัฒนา" },
  { color: "bg-violet-500", label: "ส่งมอบแล้ว" },
];

const UTIL_DOTS = [
  { color: "bg-emerald-500", label: "≤ 80%" },
  { color: "bg-amber-500", label: "80-100%" },
  { color: "bg-rose-500", label: "> 100% (over)" },
];

export function GanttLegend() {
  return (
    <div className="flex flex-col md:flex-row md:items-center gap-4 text-xs text-muted-foreground">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="font-semibold">สีโครงการ:</span>
        {STATUS_DOTS.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-3 rounded-sm ${s.color}`} />
            <span>{s.label}</span>
          </div>
        ))}
      </div>
      <div className="hidden md:block h-4 w-px bg-border" />
      <div className="flex items-center gap-3 flex-wrap">
        <span className="font-semibold">Utilization:</span>
        {UTIL_DOTS.map((u) => (
          <div key={u.label} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-3 rounded-sm ${u.color}`} />
            <span>{u.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
