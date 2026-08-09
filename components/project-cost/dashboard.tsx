"use client";

import React from "react";
import { Project, PositionRate, OverheadItem } from "@/lib/types";
import { CostCalculationResult } from "@/lib/calculations";
import { validateProject } from "@/lib/validation";
import { ValidationBanner } from "./dashboard/validation-banner";
import { KPICards } from "./dashboard/kpi-cards";
import { ProjectSettingsCard } from "./dashboard/project-settings-card";
import { PricingCalculator } from "./dashboard/pricing-calculator";
import { CostCharts } from "./dashboard/cost-charts";
import { ModuleBreakdownCard } from "./dashboard/module-breakdown-card";
import { ScenarioComparison } from "./dashboard/scenario-comparison";

interface DashboardProps {
  project: Project;
  positions: PositionRate[];
  overheads: OverheadItem[];
  calculations: CostCalculationResult;
  onUpdateProject: (updated: Project) => void;
}

export function Dashboard({
  project,
  positions,
  overheads,
  calculations,
  onUpdateProject,
}: DashboardProps) {
  const issues = validateProject(project, calculations);

  return (
    <div className="space-y-6">
      <ValidationBanner issues={issues} />

      <KPICards project={project} calculations={calculations} />

      <ProjectSettingsCard project={project} onUpdateProject={onUpdateProject} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <PricingCalculator
          project={project}
          calculations={calculations}
          onUpdateProject={onUpdateProject}
        />
        <CostCharts project={project} calculations={calculations} />
      </div>

      <ModuleBreakdownCard project={project} positions={positions} calculations={calculations} />

      <ScenarioComparison
        project={project}
        positions={positions}
        overheads={overheads}
        onUpdateProject={onUpdateProject}
      />
    </div>
  );
}
