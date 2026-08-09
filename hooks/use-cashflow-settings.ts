import { useCallback } from "react";
import { z } from "zod";
import { usePersistentState } from "@/lib/storage/use-persistent-state";
import { useAuth } from "@/hooks/use-auth";

export interface CashflowSettings {
  /** Anchor year (CE) where balance is known. Cashflow chains forward from here. */
  anchorYearCE: number;
  /** Cash on hand at the start of anchor year (1 Jan). */
  anchorAmount: number;
}

export const CASHFLOW_SETTINGS_STORAGE_KEY = "cost_est_cashflow_settings";

export const CashflowSettingsSchema = z.object({
  anchorYearCE: z.number().int(),
  anchorAmount: z.number(),
});

const DEFAULT_SETTINGS: CashflowSettings = {
  anchorYearCE: new Date().getUTCFullYear(),
  anchorAmount: 0,
};

export function useCashflowSettings() {
  const { mode } = useAuth();
  const enabled = mode === "supabase";

  const [settings, setSettingsState, hydrated] = usePersistentState<CashflowSettings>({
    key: CASHFLOW_SETTINGS_STORAGE_KEY,
    defaultValue: DEFAULT_SETTINGS,
    schema: CashflowSettingsSchema,
    enabled,
  });

  const setSettings = useCallback(
    (next: CashflowSettings) => setSettingsState(next),
    [setSettingsState]
  );

  return { cashflowSettings: settings, setCashflowSettings: setSettings, hydrated };
}
