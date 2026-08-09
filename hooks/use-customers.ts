import { useCallback } from "react";
import { Customer } from "@/lib/types";
import { CustomerSchema, safeParseArray } from "@/lib/schemas";
import { usePersistentState } from "@/lib/storage/use-persistent-state";
import { DEFAULT_CUSTOMERS } from "@/lib/initial-data";
import { useAuth } from "@/hooks/use-auth";
import { getStorageRepository } from "@/lib/storage/storage-repository";
import { writeVersioned } from "@/lib/migrations";

export const CUSTOMERS_STORAGE_KEY = "cost_est_customers";

export function useCustomers() {
  const { mode } = useAuth();
  const enabled = mode === "supabase";

  const [customers, setCustomers, hydrated] = usePersistentState<Customer[]>({
    key: CUSTOMERS_STORAGE_KEY,
    defaultValue: DEFAULT_CUSTOMERS,
    hydrate: (raw) => safeParseArray(CustomerSchema, raw, "customers"),
    enabled,
  });

  const addCustomer = useCallback(
    (newItem: Omit<Customer, "id">) => {
      const item: Customer = { ...newItem, id: "cust_" + Date.now() };
      setCustomers((prev) => [...prev, item]);
      return item;
    },
    [setCustomers]
  );

  const updateCustomer = useCallback(
    (updated: Customer) => {
      setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    },
    [setCustomers]
  );

  const deleteCustomer = useCallback(
    (id: string) => {
      setCustomers((prev) => prev.filter((c) => c.id !== id));
      getStorageRepository().deleteItem(CUSTOMERS_STORAGE_KEY, id).catch((e) => {
        console.error(`[use-customers] deleteItem failed:`, e);
      });
    },
    [setCustomers]
  );

  const replaceAllCustomers = useCallback(
    (next: Customer[]) => {
      setCustomers(next);
      getStorageRepository()
        .replaceAll(CUSTOMERS_STORAGE_KEY, writeVersioned(next))
        .catch((e) => console.error(`[use-customers] replaceAll failed:`, e));
    },
    [setCustomers]
  );

  return {
    customers,
    hydrated,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    replaceAllCustomers,
  };
}
