import { useCallback } from "react";
import { Commission } from "@/lib/types";
import { CommissionSchema, safeParseArray } from "@/lib/schemas";
import { usePersistentState } from "@/lib/storage/use-persistent-state";
import { DEFAULT_COMMISSIONS } from "@/lib/initial-data";
import { useAuth } from "@/hooks/use-auth";
import { getStorageRepository } from "@/lib/storage/storage-repository";
import { writeVersioned } from "@/lib/migrations";

export const COMMISSIONS_STORAGE_KEY = "cost_est_commissions";

export function useCommissions() {
  const { mode } = useAuth();
  const enabled = mode === "supabase";

  const [commissions, setCommissions, hydrated] = usePersistentState<Commission[]>({
    key: COMMISSIONS_STORAGE_KEY,
    defaultValue: DEFAULT_COMMISSIONS,
    hydrate: (raw) => safeParseArray(CommissionSchema, raw, "commissions"),
    enabled,
  });

  const addCommission = useCallback(
    (newItem: Omit<Commission, "id">) => {
      const item: Commission = { ...newItem, id: "comm_" + Date.now() };
      setCommissions((prev) => [...prev, item]);
    },
    [setCommissions]
  );

  const updateCommission = useCallback(
    (updated: Commission) => {
      setCommissions((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    },
    [setCommissions]
  );

  const deleteCommission = useCallback(
    (id: string) => {
      setCommissions((prev) => prev.filter((c) => c.id !== id));
      getStorageRepository().deleteItem(COMMISSIONS_STORAGE_KEY, id).catch((e) => {
        console.error(`[use-commissions] deleteItem failed:`, e);
      });
    },
    [setCommissions]
  );

  const replaceAllCommissions = useCallback(
    (next: Commission[]) => {
      setCommissions(next);
      getStorageRepository()
        .replaceAll(COMMISSIONS_STORAGE_KEY, writeVersioned(next))
        .catch((e) => console.error(`[use-commissions] replaceAll failed:`, e));
    },
    [setCommissions]
  );

  return { commissions, hydrated, addCommission, updateCommission, deleteCommission, replaceAllCommissions };
}
