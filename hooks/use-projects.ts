import { useCallback } from "react";
import { Project } from "@/lib/types";
import { ProjectSchema, safeParseArray } from "@/lib/schemas";
import { migrateProjectChain } from "@/lib/migrations";
import { usePersistentState } from "@/lib/storage/use-persistent-state";
import { DEFAULT_PROJECTS } from "@/lib/initial-data";
import { useAuth } from "@/hooks/use-auth";
import { getStorageRepository } from "@/lib/storage/storage-repository";
import { writeVersioned } from "@/lib/migrations";

export const PROJECTS_STORAGE_KEY = "cost_est_projects";

export function useProjects() {
  const { mode } = useAuth();
  const enabled = mode === "supabase";

  const [projects, setProjects, hydrated] = usePersistentState<Project[]>({
    key: PROJECTS_STORAGE_KEY,
    defaultValue: DEFAULT_PROJECTS,
    hydrate: (raw) => safeParseArray(ProjectSchema, raw, "projects"),
    migrateItem: migrateProjectChain,
    enabled,
  });

  const addProject = useCallback(
    (name: string, description?: string): Project => {
      const now = new Date();
      const yearMonth = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, "0")}`;
      const newProject: Project = {
        id: "p_" + Date.now(),
        name,
        description,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        quotationDate: now.toISOString().split("T")[0],
        quotationNumber: `QT-${yearMonth}-${(Math.random().toString().slice(-3))}`,
        workingDaysPerMonth: 20,
        durationMonths: 1,
        allocations: [],
        directCosts: [],
        overheadAllocationMethod: "proportional",
        overheadAllocationValue: 0,
        contingencyPercent: 10,
        pricingMode: "cost_plus",
        fixedPrice: 0,
        markupPercentage: 30,
        taxRate: 7,
        withholdingTaxPercent: 3,
        status: "draft",
        client: { name: "" },
        paymentTerms: {
          installments: [
            { id: "inst_" + Date.now(), name: "เงินมัดจำ (Deposit)", percent: 30, dueAfterDays: 0, description: "ชำระเมื่อเซ็นสัญญา" },
            { id: "inst_" + (Date.now() + 1), name: "ส่งมอบงาน (On Delivery)", percent: 70, dueAfterDays: 30, description: "ชำระเมื่อส่งมอบงานครบ" },
          ],
          paymentDueDays: 30,
          lateFeePercent: 1.5,
        },
        phases: [],
      };
      setProjects((prev) => [newProject, ...prev]);
      return newProject;
    },
    [setProjects]
  );

  const updateProject = useCallback(
    (updated: Project) => {
      setProjects((prev) =>
        prev.map((p) =>
          p.id === updated.id ? { ...updated, updatedAt: new Date().toISOString() } : p
        )
      );
    },
    [setProjects]
  );

  const deleteProject = useCallback(
    (id: string) => {
      setProjects((prev) => prev.filter((p) => p.id !== id));
      getStorageRepository().deleteItem(PROJECTS_STORAGE_KEY, id).catch((e) => {
        console.error(`[use-projects] deleteItem failed:`, e);
      });
    },
    [setProjects]
  );

  const duplicateProject = useCallback(
    (id: string): Project | null => {
      const target = projects.find((p) => p.id === id);
      if (!target) return null;
      const duplicated: Project = {
        ...target,
        id: "p_" + Date.now(),
        name: `${target.name} (Copy)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setProjects((prev) => {
        const idx = prev.findIndex((p) => p.id === id);
        const next = [...prev];
        next.splice(idx + 1, 0, duplicated);
        return next;
      });
      return duplicated;
    },
    [projects, setProjects]
  );

  /** Replace entire list (used by importData) — explicit full-replace on server */
  const replaceAllProjects = useCallback(
    (next: Project[]) => {
      setProjects(next);
      getStorageRepository()
        .replaceAll(PROJECTS_STORAGE_KEY, writeVersioned(next))
        .catch((e) => console.error(`[use-projects] replaceAll failed:`, e));
    },
    [setProjects]
  );

  /** ลบ allocations ของ position ที่ถูกลบใน master data — เรียกจาก usePositions */
  const cleanupPositionReferences = useCallback(
    (positionId: string) => {
      setProjects((prev) =>
        prev.map((proj) => ({
          ...proj,
          allocations: proj.allocations.filter((a) => a.positionId !== positionId),
          // ลบออกจากทุกโมดูลด้วย (โหมดประเมินราย Module)
          modules: proj.modules?.map((m) => ({
            ...m,
            allocations: m.allocations.filter((a) => a.positionId !== positionId),
          })),
        }))
      );
    },
    [setProjects]
  );

  return {
    projects,
    hydrated,
    addProject,
    updateProject,
    deleteProject,
    duplicateProject,
    replaceAllProjects,
    cleanupPositionReferences,
  };
}
