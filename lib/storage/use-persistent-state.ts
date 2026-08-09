import { useEffect, useRef, useState } from "react";
import { getStorageRepository } from "./storage-repository";
import { readVersioned, writeVersioned } from "../migrations";
import type { z } from "zod";

interface PersistentStateOptions<T> {
  /** Storage key */
  key: string;
  /** ค่าเริ่มต้นถ้าไม่มีข้อมูล / parse fail */
  defaultValue: T;
  /** Schema สำหรับ validate ตอนอ่าน */
  schema?: z.ZodType<T>;
  /** Custom hydration — แปลงข้อมูล raw → T (ใช้กับ array ที่ต้อง parse ทีละ item) */
  hydrate?: (raw: unknown) => T;
  /** Custom migration */
  migrateItem?: (item: Record<string, unknown>, fromVersion: number) => Record<string, unknown>;
  /** เปิดใช้งานเมื่อพร้อมเท่านั้น (e.g. รอ auth ก่อน) */
  enabled?: boolean;
}

/**
 * Hook สำหรับ state ที่ persist ลง storage แบบ async
 * รองรับ:
 *  - Hydrate async ตอน mount
 *  - Auto-save ตอน state เปลี่ยน (debounced)
 *  - Versioned envelope + migration
 *  - Skip ถ้า enabled = false (รอ pre-condition)
 */
export function usePersistentState<T>(
  options: PersistentStateOptions<T>
): [T, (next: T | ((prev: T) => T)) => void, boolean] {
  const { key, defaultValue, schema, hydrate, migrateItem, enabled = true } = options;
  const [value, setValue] = useState<T>(defaultValue);
  const [hydrated, setHydrated] = useState(false);
  const isMountedRef = useRef(false);
  const writeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Conflict resolution: Track when we last successfully synced from remote
  const lastSyncTimestampRef = useRef<number>(0);

  // Hydrate from storage when enabled
  useEffect(() => {
    if (!enabled) {
      setHydrated(false);
      return;
    }
    let cancelled = false;
    const repo = getStorageRepository();

    (async () => {
      try {
        const raw = await repo.read(key);
        if (cancelled) return;

        const { data } = readVersioned<T>(raw, {
          context: key,
          defaultValue,
          migrateItem,
        });

        // Update sync timestamp on success
        lastSyncTimestampRef.current = Date.now();

        let next: T = defaultValue;
        if (hydrate) {
          next = hydrate(data);
        } else if (schema) {
          const r = schema.safeParse(data);
          next = r.success ? r.data : defaultValue;
        } else {
          next = data as T;
        }

        if (!cancelled) {
          setValue(next);
        }
      } catch (e) {
        console.error(`[usePersistentState] hydrate ${key} failed:`, e);
      } finally {
        if (!cancelled) {
          setHydrated(true);
          isMountedRef.current = true;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate ครั้งเดียวต่อ key
  }, [key, enabled]);

  // Persist on change (debounced 300ms)
  useEffect(() => {
    if (!isMountedRef.current || !enabled) return;
    const repo = getStorageRepository();

    if (writeTimerRef.current) clearTimeout(writeTimerRef.current);
    writeTimerRef.current = setTimeout(async () => {
      try {
        // Conflict resolution: Simple check
        // In a real multi-user app, we would fetch remote timestamp here.
        // For now, we trust our session until we get a background sync (if implemented)
        // or a re-hydration. 
        
        await repo.write(key, writeVersioned(value));
      } catch (e) {
        console.error(`[usePersistentState] write ${key} failed:`, e);
      }
    }, 300);

    return () => {
      if (writeTimerRef.current) clearTimeout(writeTimerRef.current);
    };
  }, [key, value, enabled]);

  // Flush pending write on unmount
  useEffect(() => {
    return () => {
      if (writeTimerRef.current && isMountedRef.current && enabled) {
        clearTimeout(writeTimerRef.current);
        const repo = getStorageRepository();
        repo.write(key, writeVersioned(value)).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- flush only on unmount
  }, []);

  return [value, setValue, hydrated];
}
