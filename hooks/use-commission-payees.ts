import { useCallback } from "react";
import { CommissionPayee } from "@/lib/types";
import { CommissionPayeeSchema, safeParseArray } from "@/lib/schemas";
import { usePersistentState } from "@/lib/storage/use-persistent-state";
import { DEFAULT_COMMISSION_PAYEES } from "@/lib/initial-data";
import { useAuth } from "@/hooks/use-auth";
import { getStorageRepository } from "@/lib/storage/storage-repository";
import { writeVersioned } from "@/lib/migrations";

export const COMMISSION_PAYEES_STORAGE_KEY = "cost_est_commission_payees";

export function useCommissionPayees() {
  const { mode } = useAuth();
  const enabled = mode === "supabase";

  const [payees, setPayees, hydrated] = usePersistentState<CommissionPayee[]>({
    key: COMMISSION_PAYEES_STORAGE_KEY,
    defaultValue: DEFAULT_COMMISSION_PAYEES,
    hydrate: (raw) => safeParseArray(CommissionPayeeSchema, raw, "commission_payees"),
    enabled,
  });

  const addPayee = useCallback(
    (newItem: Omit<CommissionPayee, "id">) => {
      const item: CommissionPayee = { ...newItem, id: "payee_" + Date.now() };
      setPayees((prev) => [...prev, item]);
      return item;
    },
    [setPayees]
  );

  const updatePayee = useCallback(
    (updated: CommissionPayee) => {
      setPayees((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    },
    [setPayees]
  );

  const deletePayee = useCallback(
    (id: string) => {
      setPayees((prev) => prev.filter((p) => p.id !== id));
      getStorageRepository().deleteItem(COMMISSION_PAYEES_STORAGE_KEY, id).catch((e) => {
        console.error(`[use-commission-payees] deleteItem failed:`, e);
      });
    },
    [setPayees]
  );

  const replaceAllPayees = useCallback(
    (next: CommissionPayee[]) => {
      setPayees(next);
      getStorageRepository()
        .replaceAll(COMMISSION_PAYEES_STORAGE_KEY, writeVersioned(next))
        .catch((e) => console.error(`[use-commission-payees] replaceAll failed:`, e));
    },
    [setPayees]
  );

  return { payees, hydrated, addPayee, updatePayee, deletePayee, replaceAllPayees };
}
