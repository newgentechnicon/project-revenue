import { useCallback } from "react";
import { Loan } from "@/lib/types";
import { LoanSchema, safeParseArray } from "@/lib/schemas";
import { usePersistentState } from "@/lib/storage/use-persistent-state";
import { DEFAULT_LOANS } from "@/lib/initial-data";
import { useAuth } from "@/hooks/use-auth";
import { getStorageRepository } from "@/lib/storage/storage-repository";
import { writeVersioned } from "@/lib/migrations";

export const LOANS_STORAGE_KEY = "cost_est_loans";

export function useLoans() {
  const { mode } = useAuth();
  const enabled = mode === "supabase";

  const [loans, setLoans, hydrated] = usePersistentState<Loan[]>({
    key: LOANS_STORAGE_KEY,
    defaultValue: DEFAULT_LOANS,
    hydrate: (raw) => safeParseArray(LoanSchema, raw, "loans"),
    enabled,
  });

  const addLoan = useCallback(
    (newItem: Omit<Loan, "id">) => {
      const item: Loan = { ...newItem, id: "loan_" + Date.now() };
      setLoans((prev) => [...prev, item]);
    },
    [setLoans]
  );

  const updateLoan = useCallback(
    (updated: Loan) => {
      setLoans((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
    },
    [setLoans]
  );

  const deleteLoan = useCallback(
    (id: string) => {
      setLoans((prev) => prev.filter((l) => l.id !== id));
      getStorageRepository().deleteItem(LOANS_STORAGE_KEY, id).catch((e) => {
        console.error(`[use-loans] deleteItem failed:`, e);
      });
    },
    [setLoans]
  );

  const replaceAllLoans = useCallback(
    (next: Loan[]) => {
      setLoans(next);
      getStorageRepository()
        .replaceAll(LOANS_STORAGE_KEY, writeVersioned(next))
        .catch((e) => console.error(`[use-loans] replaceAll failed:`, e));
    },
    [setLoans]
  );

  return { loans, hydrated, addLoan, updateLoan, deleteLoan, replaceAllLoans };
}
