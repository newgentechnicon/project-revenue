"use client";

import React, { useMemo } from "react";
import { useParams } from "next/navigation";
import { useAppState } from "@/lib/context/app-state-context";
import { Dashboard } from "@/components/project-cost/dashboard";
import { calculateProjectCosts } from "@/lib/calculations";

export default function ProjectDashboardPage() {
  const { id } = useParams();
  const { projects, positions, overheads, updateProject } = useAppState();

  const project = useMemo(() => projects.find((p) => p.id === id), [projects, id]);
  const calculations = useMemo(() => calculateProjectCosts(project, positions, overheads), [project, positions, overheads]);

  if (!project) return null; // Handled by layout

  return (
    <Dashboard
      project={project}
      positions={positions}
      overheads={overheads}
      calculations={calculations}
      onUpdateProject={updateProject}
    />
  );
}
