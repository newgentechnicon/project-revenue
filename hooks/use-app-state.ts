import { useAppState as useAppStateFromContext } from "@/lib/context/app-state-context";

/**
 * Composition root for app state — รวมทุก domain hook + cross-cutting actions
 * 
 * @deprecated แนะนำให้ใช้ import { useAppState } from "@/lib/context/app-state-context" โดยตรง
 */
export function useAppState() {
  return useAppStateFromContext();
}

export type UseAppStateReturn = ReturnType<typeof useAppState>;
