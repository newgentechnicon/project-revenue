"use client";

import React, { useMemo } from "react";
import { useParams } from "next/navigation";
import { useAppState } from "@/lib/context/app-state-context";
import { OverheadManager } from "@/components/project-cost/overhead-manager";
import { calculateProjectCosts } from "@/lib/calculations";

export default function ProjectOverheadsPage() {
  const { id } = useParams();
  const { projects, positions, overheads, updateProject } = useAppState();

  const project = useMemo(() => projects.find((p) => p.id === id), [projects, id]);
  const calculations = useMemo(() => calculateProjectCosts(project, positions, overheads), [project, positions, overheads]);

  if (!project) return null;

  return (
    <OverheadManager
      project={project}
      overheads={overheads}
      calculations={calculations}
      onUpdateProject={updateProject}
    />
  );
}
