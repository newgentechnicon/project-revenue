"use client";

import React from "react";
import { useAppState } from "@/lib/context/app-state-context";
import { AppLayout } from "@/components/layout/app-layout";
import { CommissionsView } from "@/components/project-cost/commissions-view";

export default function CommissionsPage() {
  const {
    commissions,
    commissionPayees,
    projects,
    subscriptions,
    products,
    positions,
    overheads,
    addCommission,
    updateCommission,
    deleteCommission,
  } = useAppState();

  return (
    <AppLayout>
      <CommissionsView
        commissions={commissions}
        payees={commissionPayees}
        projects={projects}
        subscriptions={subscriptions}
        products={products}
        positions={positions}
        overheads={overheads}
        onAddCommission={addCommission}
        onUpdateCommission={updateCommission}
        onDeleteCommission={deleteCommission}
      />
    </AppLayout>
  );
}
