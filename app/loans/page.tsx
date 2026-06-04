"use client";

import React from "react";
import { useAppState } from "@/lib/context/app-state-context";
import { AppLayout } from "@/components/layout/app-layout";
import { LoansView } from "@/components/project-cost/loans-view";

export default function LoansPage() {
  const { loans, addLoan, updateLoan, deleteLoan } = useAppState();

  return (
    <AppLayout>
      <LoansView
        loans={loans}
        onAddLoan={addLoan}
        onUpdateLoan={updateLoan}
        onDeleteLoan={deleteLoan}
      />
    </AppLayout>
  );
}
