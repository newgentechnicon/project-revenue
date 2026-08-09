"use client";

import React from "react";
import { useAppState } from "@/lib/context/app-state-context";
import { AppLayout } from "@/components/layout/app-layout";
import { CommissionPayeesView } from "@/components/project-cost/commission-payees-view";

export default function MasterCommissionPayeesPage() {
  const {
    commissionPayees,
    employees,
    addCommissionPayee,
    updateCommissionPayee,
    deleteCommissionPayee,
  } = useAppState();

  return (
    <AppLayout>
      <CommissionPayeesView
        payees={commissionPayees}
        employees={employees}
        onAddPayee={addCommissionPayee}
        onUpdatePayee={updateCommissionPayee}
        onDeletePayee={deleteCommissionPayee}
      />
    </AppLayout>
  );
}
