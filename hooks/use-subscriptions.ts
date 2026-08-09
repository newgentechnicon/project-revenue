import { useCallback } from "react";
import { Subscription } from "@/lib/types";
import { SubscriptionSchema, safeParseArray } from "@/lib/schemas";
import { usePersistentState } from "@/lib/storage/use-persistent-state";
import { DEFAULT_SUBSCRIPTIONS } from "@/lib/initial-data";
import { useAuth } from "@/hooks/use-auth";
import { getStorageRepository } from "@/lib/storage/storage-repository";
import { writeVersioned } from "@/lib/migrations";

export const SUBSCRIPTIONS_STORAGE_KEY = "cost_est_subscriptions";

export function useSubscriptions() {
  const { mode } = useAuth();
  const enabled = mode === "supabase";

  const [subscriptions, setSubscriptions, hydrated] = usePersistentState<Subscription[]>({
    key: SUBSCRIPTIONS_STORAGE_KEY,
    defaultValue: DEFAULT_SUBSCRIPTIONS,
    hydrate: (raw) => safeParseArray(SubscriptionSchema, raw, "subscriptions"),
    enabled,
  });

  const addSubscription = useCallback(
    (newItem: Omit<Subscription, "id">) => {
      const item: Subscription = { ...newItem, id: "sub_" + Date.now() };
      setSubscriptions((prev) => [...prev, item]);
    },
    [setSubscriptions]
  );

  const updateSubscription = useCallback(
    (updated: Subscription) => {
      setSubscriptions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    },
    [setSubscriptions]
  );

  const deleteSubscription = useCallback(
    (id: string) => {
      setSubscriptions((prev) => prev.filter((s) => s.id !== id));
      getStorageRepository().deleteItem(SUBSCRIPTIONS_STORAGE_KEY, id).catch((e) => {
        console.error(`[use-subscriptions] deleteItem failed:`, e);
      });
    },
    [setSubscriptions]
  );

  const replaceAllSubscriptions = useCallback(
    (next: Subscription[]) => {
      setSubscriptions(next);
      getStorageRepository()
        .replaceAll(SUBSCRIPTIONS_STORAGE_KEY, writeVersioned(next))
        .catch((e) => console.error(`[use-subscriptions] replaceAll failed:`, e));
    },
    [setSubscriptions]
  );

  return {
    subscriptions,
    hydrated,
    addSubscription,
    updateSubscription,
    deleteSubscription,
    replaceAllSubscriptions,
  };
}
