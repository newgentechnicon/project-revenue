"use client";

import React from "react";
import { useAppState } from "@/lib/context/app-state-context";
import { AppLayout } from "@/components/layout/app-layout";
import { CompanyAnalytics } from "@/components/project-cost/company-analytics";

export default function AnalyticsPage() {
  const {
    projects,
    positions,
    overheads,
    subscriptions,
    commissions,
    commissionPayees,
  } = useAppState();

  return (
    <AppLayout>
      <CompanyAnalytics
        projects={projects}
        positions={positions}
        overheads={overheads}
        subscriptions={subscriptions}
        commissions={commissions}
        commissionPayees={commissionPayees}
      />
    </AppLayout>
  );
}
