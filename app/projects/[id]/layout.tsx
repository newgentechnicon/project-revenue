"use client";

import React, { useMemo, useEffect } from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import { useAppState } from "@/lib/context/app-state-context";
import { AppLayout } from "@/components/layout/app-layout";
import { ProjectWorkspaceHeader } from "@/components/project-cost/project-workspace-header";
import { FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams();
  const { 
    projects, 
    updateProject, 
    deleteProject, 
    duplicateProject,
    setActiveProjectId 
  } = useAppState();
  const router = useRouter();
  const pathname = usePathname();

  const project = useMemo(() => projects.find((p) => p.id === id), [projects, id]);

  // Sync activeProjectId for Sidebar highlighting if needed
  useEffect(() => {
    if (id && typeof id === "string") {
      setActiveProjectId(id);
    }
  }, [id, setActiveProjectId]);

  if (!project) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-[70vh] text-center max-w-md mx-auto space-y-6">
          <div className="p-4 bg-muted rounded-full text-muted-foreground">
            <FolderOpen className="h-12 w-12" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold">ไม่พบโครงการ</h2>
            <p className="text-sm text-muted-foreground">
              โครงการที่คุณกำลังเรียกหาอาจถูกลบไปแล้วหรือไม่มีอยู่ในระบบ
            </p>
          </div>
          <Button variant="outline" onClick={() => router.push("/projects")}>
            กลับไปหน้าจัดการโครงการ
          </Button>
        </div>
      </AppLayout>
    );
  }

  // Determine activeView from pathname
  let activeView: any = "dashboard";
  if (pathname.endsWith("/labor")) activeView = "labor";
  else if (pathname.endsWith("/overheads")) activeView = "overhead_alloc";
  else if (pathname.endsWith("/settings")) activeView = "quote_settings";
  else if (pathname.endsWith("/quotation")) activeView = "quote";

  const handleChangeView = (view: string) => {
    const basePath = `/projects/${id}`;
    if (view === "dashboard") router.push(basePath);
    else if (view === "labor") router.push(`${basePath}/labor`);
    else if (view === "overhead_alloc") router.push(`${basePath}/overheads`);
    else if (view === "quote_settings") router.push(`${basePath}/settings`);
    else if (view === "quote") router.push(`${basePath}/quotation`);
  };

  return (
    <AppLayout>
      <ProjectWorkspaceHeader
        project={project}
        activeView={activeView}
        onChangeView={handleChangeView}
        onBackToList={() => router.push("/projects")}
        onUpdateProject={updateProject}
        onDeleteProject={deleteProject}
        onDuplicateProject={duplicateProject}
      />
      <div className="animate-fade-in duration-300 pt-4">
        {children}
      </div>
    </AppLayout>
  );
}
