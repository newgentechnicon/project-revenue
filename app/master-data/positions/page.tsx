"use client";

import React from "react";
import { useAppState } from "@/lib/context/app-state-context";
import { AppLayout } from "@/components/layout/app-layout";
import { MasterPositionsView } from "@/components/project-cost/master-positions-view";

export default function MasterPositionsPage() {
  const {
    positions,
    activeProject,
    addPosition,
    updatePosition,
    deletePosition,
  } = useAppState();

  return (
    <AppLayout>
      <MasterPositionsView
        positions={positions}
        defaultWorkingDays={activeProject?.workingDaysPerMonth || 20}
        onAddPosition={addPosition}
        onUpdatePosition={updatePosition}
        onDeletePosition={deletePosition}
      />
    </AppLayout>
  );
}
