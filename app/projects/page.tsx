"use client";

import React from "react";
import { useAppState } from "@/lib/context/app-state-context";
import { AppLayout } from "@/components/layout/app-layout";
import { ProjectsListView } from "@/components/project-cost/projects-list-view";
import { useRouter } from "next/navigation";

export default function ProjectsPage() {
  const {
    projects,
    positions,
    overheads,
    customers,
    addProject,
    updateProject,
    deleteProject,
    duplicateProject,
    addCustomer,
    setActiveProjectId,
  } = useAppState();
  
  const router = useRouter();

  return (
    <AppLayout>
      <ProjectsListView
        projects={projects}
        positions={positions}
        overheads={overheads}
        customers={customers}
        onSelectProject={(id) => {
          setActiveProjectId(id);
          router.push(`/projects/${id}`);
        }}
        onAddProject={addProject}
        onUpdateProject={updateProject}
        onDeleteProject={deleteProject}
        onDuplicateProject={duplicateProject}
        onAddCustomer={addCustomer}
      />
    </AppLayout>
  );
}
