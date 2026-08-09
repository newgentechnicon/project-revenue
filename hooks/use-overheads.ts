import { useCallback } from "react";
import { OverheadItem } from "@/lib/types";
import { OverheadItemSchema, safeParseArray } from "@/lib/schemas";
import { migrateOverheadChain } from "@/lib/migrations";
import { usePersistentState } from "@/lib/storage/use-persistent-state";
import { DEFAULT_OVERHEADS } from "@/lib/initial-data";
import { useAuth } from "@/hooks/use-auth";
import { getStorageRepository } from "@/lib/storage/storage-repository";
import { writeVersioned } from "@/lib/migrations";

export const OVERHEADS_STORAGE_KEY = "cost_est_overheads";

export function useOverheads() {
  const { mode } = useAuth();
  const enabled = mode === "supabase";

  const [overheads, setOverheads, hydrated] = usePersistentState<OverheadItem[]>({
    key: OVERHEADS_STORAGE_KEY,
    defaultValue: DEFAULT_OVERHEADS,
    hydrate: (raw) => safeParseArray(OverheadItemSchema, raw, "overheads"),
    migrateItem: migrateOverheadChain,
    enabled,
  });

  const addOverhead = useCallback(
    (newItem: Omit<OverheadItem, "id">) => {
      const item: OverheadItem = { ...newItem, id: "oh_" + Date.now() };
      setOverheads((prev) => [...prev, item]);
    },
    [setOverheads]
  );

  const updateOverhead = useCallback(
    (updated: OverheadItem) => {
      setOverheads((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    },
    [setOverheads]
  );

  const deleteOverhead = useCallback(
    (id: string) => {
      setOverheads((prev) => prev.filter((o) => o.id !== id));
      getStorageRepository().deleteItem(OVERHEADS_STORAGE_KEY, id).catch((e) => {
        console.error(`[use-overheads] deleteItem failed:`, e);
      });
    },
    [setOverheads]
  );

  const replaceAllOverheads = useCallback(
    (next: OverheadItem[]) => {
      setOverheads(next);
      getStorageRepository()
        .replaceAll(OVERHEADS_STORAGE_KEY, writeVersioned(next))
        .catch((e) => console.error(`[use-overheads] replaceAll failed:`, e));
    },
    [setOverheads]
  );

  return {
    overheads,
    hydrated,
    addOverhead,
    updateOverhead,
    deleteOverhead,
    replaceAllOverheads,
  };
}
