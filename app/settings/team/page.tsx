"use client";

import React from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { TeamManagementView } from "@/components/project-cost/team-management-view";

export default function TeamSettingsPage() {
  return (
    <AppLayout>
      <TeamManagementView />
    </AppLayout>
  );
}
