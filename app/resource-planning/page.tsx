"use client";

import React from "react";
import { useAppState } from "@/lib/context/app-state-context";
import { AppLayout } from "@/components/layout/app-layout";
import { ResourcePlanningView } from "@/components/project-cost/resource-planning/resource-planning-view";

export default function ResourcePlanningPage() {
  const {
    projects,
    positions,
    updateProject,
  } = useAppState();

  return (
    <AppLayout>
      <ResourcePlanningView
        projects={projects}
        positions={positions}
        onUpdateProject={updateProject}
      />
    </AppLayout>
  );
}
