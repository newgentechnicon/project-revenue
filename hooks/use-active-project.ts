import { useEffect, useState } from "react";
import { Project } from "@/lib/types";

const ACTIVE_PROJECT_KEY = "cost_est_active_id";

const readLocal = (key: string): string | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeLocal = (key: string, value: string) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {}
};

/**
 * Active project selection — เก็บ id ของ project ที่กำลังเลือกอยู่
 * เก็บใน localStorage (UI state เท่านั้น — ไม่ใช่ business data, ไม่ sync ข้าม device)
 * ข้อมูลทั้งหมดอยู่บน Supabase, ตัวนี้แค่จำว่า device นี้เลือก project ไหนล่าสุด
 */
export function useActiveProject(projects: Project[], projectsHydrated: boolean) {
  const [activeProjectId, setActiveProjectIdState] = useState<string>("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!projectsHydrated) return;
    const stored = readLocal(ACTIVE_PROJECT_KEY);
    if (stored && projects.some((p) => p.id === stored)) {
      setActiveProjectIdState(stored);
    } else if (projects.length > 0 && !activeProjectId) {
      setActiveProjectIdState(projects[0].id);
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate ครั้งเดียวหลัง projects ready
  }, [projectsHydrated]);

  useEffect(() => {
    if (!hydrated) return;
    writeLocal(ACTIVE_PROJECT_KEY, activeProjectId);
  }, [activeProjectId, hydrated]);

  const setActiveProjectId = (id: string) => setActiveProjectIdState(id);
  const activeProject = projects.find((p) => p.id === activeProjectId);

  return { activeProjectId, activeProject, setActiveProjectId };
}
