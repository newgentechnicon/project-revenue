"use client";

import React from "react";
import { useAppState } from "@/lib/context/app-state-context";
import { AppLayout } from "@/components/layout/app-layout";
import { MasterOverheadsView } from "@/components/project-cost/master-overheads-view";

export default function MasterOverheadsPage() {
  const {
    overheads,
    addOverhead,
    updateOverhead,
    deleteOverhead,
  } = useAppState();

  return (
    <AppLayout>
      <MasterOverheadsView
        overheads={overheads}
        onAddOverhead={addOverhead}
        onUpdateOverhead={updateOverhead}
        onDeleteOverhead={deleteOverhead}
      />
    </AppLayout>
  );
}
