import { useCallback } from "react";
import { Employee } from "@/lib/types";
import { EmployeeSchema, safeParseArray } from "@/lib/schemas";
import { usePersistentState } from "@/lib/storage/use-persistent-state";
import { DEFAULT_EMPLOYEES } from "@/lib/initial-data";
import { useAuth } from "@/hooks/use-auth";
import { getStorageRepository } from "@/lib/storage/storage-repository";
import { writeVersioned } from "@/lib/migrations";

export const EMPLOYEES_STORAGE_KEY = "cost_est_employees";

export function useEmployees() {
  const { mode } = useAuth();
  // Only run when authenticated against Supabase
  const enabled = mode === "supabase";

  const [employees, setEmployees, hydrated] = usePersistentState<Employee[]>({
    key: EMPLOYEES_STORAGE_KEY,
    defaultValue: DEFAULT_EMPLOYEES,
    hydrate: (raw) => safeParseArray(EmployeeSchema, raw, "employees"),
    enabled,
  });

  const addEmployee = useCallback(
    (newItem: Omit<Employee, "id">) => {
      const item: Employee = { ...newItem, id: "emp_" + Date.now() };
      setEmployees((prev) => [...prev, item]);
    },
    [setEmployees]
  );

  const updateEmployee = useCallback(
    (updated: Employee) => {
      setEmployees((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    },
    [setEmployees]
  );

  const deleteEmployee = useCallback(
    (id: string) => {
      setEmployees((prev) => prev.filter((e) => e.id !== id));
      // Explicit per-item delete on Supabase
      getStorageRepository().deleteItem(EMPLOYEES_STORAGE_KEY, id).catch((e) => {
        console.error(`[use-employees] deleteItem failed:`, e);
      });
    },
    [setEmployees]
  );

  const replaceAllEmployees = useCallback(
    (next: Employee[]) => {
      setEmployees(next);
      // Explicit replace-all (import/restore) — fires diff-delete on server
      getStorageRepository()
        .replaceAll(EMPLOYEES_STORAGE_KEY, writeVersioned(next))
        .catch((e) => console.error(`[use-employees] replaceAll failed:`, e));
    },
    [setEmployees]
  );

  return {
    employees,
    hydrated,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    replaceAllEmployees,
  };
}
