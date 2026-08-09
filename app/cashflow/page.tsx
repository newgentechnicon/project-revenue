"use client";

import React from "react";
import { useAppState } from "@/lib/context/app-state-context";
import { AppLayout } from "@/components/layout/app-layout";
import { CashflowView } from "@/components/project-cost/cashflow-view";

export default function CashflowPage() {
  const { projects, positions, overheads, employees, subscriptions, products, commissions, commissionPayees, loans, cashflowSettings, setCashflowSettings } = useAppState();

  return (
    <AppLayout>
      <CashflowView
        projects={projects}
        positions={positions}
        overheads={overheads}
        employees={employees}
        subscriptions={subscriptions}
        products={products}
        commissions={commissions}
        commissionPayees={commissionPayees}
        loans={loans}
        cashflowSettings={cashflowSettings}
        onUpdateCashflowSettings={setCashflowSettings}
      />
    </AppLayout>
  );
}
