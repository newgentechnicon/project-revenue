import { useCallback } from "react";
import { LedgerEntry } from "@/lib/types";
import { LedgerEntrySchema, safeParseArray } from "@/lib/schemas";
import { usePersistentState } from "@/lib/storage/use-persistent-state";
import { DEFAULT_LEDGER } from "@/lib/initial-data";
import { useAuth } from "@/hooks/use-auth";
import { getStorageRepository } from "@/lib/storage/storage-repository";
import { writeVersioned } from "@/lib/migrations";

export const LEDGER_STORAGE_KEY = "cost_est_ledger";

/** สร้าง id ใหม่สำหรับ ledger entry — ใช้ตอนเริ่มฟอร์ม (slip ผูกกับ id นี้) */
export function newLedgerId(): string {
  return "led_" + Date.now();
}

export function useLedger() {
  const { mode, user } = useAuth();
  const enabled = mode === "supabase";

  const [ledger, setLedger, hydrated] = usePersistentState<LedgerEntry[]>({
    key: LEDGER_STORAGE_KEY,
    defaultValue: DEFAULT_LEDGER,
    hydrate: (raw) => safeParseArray(LedgerEntrySchema, raw, "ledger"),
    enabled,
  });

  // รับ entry ที่ประกอบเสร็จแล้ว (id มาจาก newLedgerId ตอนเปิดฟอร์ม เพราะ slip ผูกกับ id)
  const addLedgerEntry = useCallback(
    (entry: Omit<LedgerEntry, "createdAt" | "updatedAt" | "ownerId">) => {
      const now = new Date().toISOString();
      const full: LedgerEntry = {
        ...entry,
        ownerId: user?.id,
        createdAt: now,
        updatedAt: now,
      };
      setLedger((prev) => [full, ...prev]);
    },
    [setLedger, user?.id]
  );

  const updateLedgerEntry = useCallback(
    (updated: LedgerEntry) => {
      setLedger((prev) =>
        prev.map((e) =>
          e.id === updated.id ? { ...updated, updatedAt: new Date().toISOString() } : e
        )
      );
    },
    [setLedger]
  );

  const deleteLedgerEntry = useCallback(
    (id: string) => {
      setLedger((prev) => prev.filter((e) => e.id !== id));
      getStorageRepository()
        .deleteItem(LEDGER_STORAGE_KEY, id)
        .catch((e) => console.error("[use-ledger] deleteItem failed:", e));
    },
    [setLedger]
  );

  const replaceAllLedger = useCallback(
    (next: LedgerEntry[]) => {
      setLedger(next);
      getStorageRepository()
        .replaceAll(LEDGER_STORAGE_KEY, writeVersioned(next))
        .catch((e) => console.error("[use-ledger] replaceAll failed:", e));
    },
    [setLedger]
  );

  return { ledger, hydrated, addLedgerEntry, updateLedgerEntry, deleteLedgerEntry, replaceAllLedger };
}
