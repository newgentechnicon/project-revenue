"use client";

import React from "react";
import { useAppState } from "@/lib/context/app-state-context";
import { AppLayout } from "@/components/layout/app-layout";
import { CustomersView } from "@/components/project-cost/customers-view";

export default function MasterCustomersPage() {
  const {
    customers,
    subscriptions,
    projects,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    importCustomersFromExisting,
  } = useAppState();

  return (
    <AppLayout>
      <CustomersView
        customers={customers}
        subscriptions={subscriptions}
        projects={projects}
        onAddCustomer={addCustomer}
        onUpdateCustomer={updateCustomer}
        onDeleteCustomer={deleteCustomer}
        onImportFromExisting={importCustomersFromExisting}
      />
    </AppLayout>
  );
}
