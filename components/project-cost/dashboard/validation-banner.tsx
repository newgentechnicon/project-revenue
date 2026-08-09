"use client";

import React from "react";
import { ValidationIssue } from "@/lib/validation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, AlertCircle, Info } from "lucide-react";

interface ValidationBannerProps {
  issues: ValidationIssue[];
}

export function ValidationBanner({ issues }: ValidationBannerProps) {
  if (issues.length === 0) return null;

  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  const infos = issues.filter((i) => i.severity === "info");

  return (
    <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2 text-amber-900 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4" />
          พบ {errors.length > 0 && `${errors.length} ปัญหา • `}
          {warnings.length > 0 && `${warnings.length} คำเตือน • `}
          {infos.length > 0 && `${infos.length} แจ้งเตือน`}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1.5 text-xs">
          {issues.map((issue, idx) => {
            const Icon =
              issue.severity === "error"
                ? AlertCircle
                : issue.severity === "warning"
                  ? AlertTriangle
                  : Info;
            const color =
              issue.severity === "error"
                ? "text-rose-700 dark:text-rose-300"
                : issue.severity === "warning"
                  ? "text-amber-700 dark:text-amber-300"
                  : "text-blue-700 dark:text-blue-300";
            return (
              <li key={idx} className={`flex items-start gap-2 ${color}`}>
                <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span className="leading-snug">{issue.message}</span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
