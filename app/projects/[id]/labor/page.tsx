"use client";

import React, { useMemo } from "react";
import { useParams } from "next/navigation";
import { useAppState } from "@/lib/context/app-state-context";
import { LaborPlanner } from "@/components/project-cost/labor-planner";

export default function ProjectLaborPage() {
  const { id } = useParams();
  const { projects, positions, updateProject, updatePosition } = useAppState();

  const project = useMemo(() => projects.find((p) => p.id === id), [projects, id]);

  if (!project) return null;

  return (
    <LaborPlanner
      project={project}
      positions={positions}
      onUpdateProject={updateProject}
      onUpdatePosition={updatePosition}
    />
  );
}
