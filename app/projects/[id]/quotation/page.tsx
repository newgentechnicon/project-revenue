"use client";

import React, { useMemo } from "react";
import { useParams } from "next/navigation";
import { useAppState } from "@/lib/context/app-state-context";
import { QuotationView } from "@/components/project-cost/quotation-view";
import { calculateProjectCosts } from "@/lib/calculations";

export default function ProjectQuotationPage() {
  const { id } = useParams();
  const { projects, positions, overheads, companyInfo } = useAppState();

  const project = useMemo(() => projects.find((p) => p.id === id), [projects, id]);
  const calculations = useMemo(() => calculateProjectCosts(project, positions, overheads), [project, positions, overheads]);

  if (!project) return null;

  return (
    <QuotationView
      project={project}
      positions={positions}
      overheads={overheads}
      companyInfo={companyInfo}
      calculations={calculations}
    />
  );
}
