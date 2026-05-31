"use client";

import React from "react";
import { useAppState } from "@/lib/context/app-state-context";
import { AppLayout } from "@/components/layout/app-layout";
import { LedgerView } from "@/components/project-cost/ledger-view";

export default function LedgerPage() {
  const {
    ledger,
    projects,
    subscriptions,
    addLedgerEntry,
    updateLedgerEntry,
    deleteLedgerEntry,
  } = useAppState();

  return (
    <AppLayout>
      <LedgerView
        ledger={ledger}
        projects={projects}
        subscriptions={subscriptions}
        onAddEntry={addLedgerEntry}
        onUpdateEntry={updateLedgerEntry}
        onDeleteEntry={deleteLedgerEntry}
      />
    </AppLayout>
  );
}
