"use client";

import React from "react";
import { useAppState } from "@/lib/context/app-state-context";
import { AppLayout } from "@/components/layout/app-layout";
import { SubscriptionsView } from "@/components/project-cost/subscriptions-view";

export default function SubscriptionsPage() {
  const {
    subscriptions,
    products,
    customers,
    addSubscription,
    updateSubscription,
    deleteSubscription,
  } = useAppState();

  return (
    <AppLayout>
      <SubscriptionsView
        subscriptions={subscriptions}
        products={products}
        customers={customers}
        onAddSubscription={addSubscription}
        onUpdateSubscription={updateSubscription}
        onDeleteSubscription={deleteSubscription}
      />
    </AppLayout>
  );
}
