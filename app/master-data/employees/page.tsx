"use client";

import React from "react";
import { useAppState } from "@/lib/context/app-state-context";
import { AppLayout } from "@/components/layout/app-layout";
import { MasterEmployeesView } from "@/components/project-cost/master-employees-view";

export default function MasterEmployeesPage() {
  const {
    employees,
    positions,
    addEmployee,
    updateEmployee,
    deleteEmployee,
  } = useAppState();

  return (
    <AppLayout>
      <MasterEmployeesView
        employees={employees}
        positions={positions}
        onAddEmployee={addEmployee}
        onUpdateEmployee={updateEmployee}
        onDeleteEmployee={deleteEmployee}
      />
    </AppLayout>
  );
}
