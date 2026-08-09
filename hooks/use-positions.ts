import { useCallback } from "react";
import { PositionRate } from "@/lib/types";
import { PositionRateSchema, safeParseArray } from "@/lib/schemas";
import { migratePositionChain } from "@/lib/migrations";
import { usePersistentState } from "@/lib/storage/use-persistent-state";
import { DEFAULT_POSITIONS } from "@/lib/initial-data";
import { useAuth } from "@/hooks/use-auth";
import { getStorageRepository } from "@/lib/storage/storage-repository";
import { writeVersioned } from "@/lib/migrations";

export const POSITIONS_STORAGE_KEY = "cost_est_positions";

export function usePositions() {
  const { mode } = useAuth();
  const enabled = mode === "supabase";

  const [positions, setPositions, hydrated] = usePersistentState<PositionRate[]>({
    key: POSITIONS_STORAGE_KEY,
    defaultValue: DEFAULT_POSITIONS,
    hydrate: (raw) => safeParseArray(PositionRateSchema, raw, "positions"),
    migrateItem: migratePositionChain,
    enabled,
  });

  const addPosition = useCallback(
    (newPos: Omit<PositionRate, "id">) => {
      const pos: PositionRate = { ...newPos, id: "pos_" + Date.now() };
      setPositions((prev) => [...prev, pos]);
    },
    [setPositions]
  );

  const updatePosition = useCallback(
    (updated: PositionRate) => {
      setPositions((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    },
    [setPositions]
  );

  const deletePosition = useCallback(
    (id: string) => {
      setPositions((prev) => prev.filter((p) => p.id !== id));
      getStorageRepository().deleteItem(POSITIONS_STORAGE_KEY, id).catch((e) => {
        console.error(`[use-positions] deleteItem failed:`, e);
      });
    },
    [setPositions]
  );

  const replaceAllPositions = useCallback(
    (next: PositionRate[]) => {
      setPositions(next);
      getStorageRepository()
        .replaceAll(POSITIONS_STORAGE_KEY, writeVersioned(next))
        .catch((e) => console.error(`[use-positions] replaceAll failed:`, e));
    },
    [setPositions]
  );

  return {
    positions,
    hydrated,
    addPosition,
    updatePosition,
    deletePosition,
    replaceAllPositions,
  };
}
