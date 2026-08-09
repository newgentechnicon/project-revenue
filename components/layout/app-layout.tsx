"use client"

import React, { useEffect, useState } from "react"
import { useAppState } from "@/lib/context/app-state-context"
import { Sidebar, SidebarViewId } from "@/components/project-cost/sidebar"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Menu } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { AuthGate } from "@/components/auth/auth-gate"
import {
  ReadOnlyBanner,
  FeatureScopeProvider,
} from "@/components/project-cost/edit-gate"
import { useOrg } from "@/hooks/use-org"
import { VIEW_FEATURE } from "@/lib/features"
import { Lock } from "lucide-react"

interface AppLayoutProps {
  children: React.ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const {
    isLoaded,
    projects,
    activeProjectId,
    setActiveProjectId,
    addProject,
    updateProject,
    deleteProject,
    duplicateProject,
    exportData,
    importData,
  } = useAppState()

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { org, canView, loading: orgLoading } = useOrg()

  useEffect(() => {
    if (!orgLoading && !org) router.replace("/organizations")
  }, [orgLoading, org, router])

  // Determine activeView from pathname for Sidebar highlighting
  let activeView: SidebarViewId = "projects_list"
  if (pathname === "/projects" || pathname === "/") activeView = "projects_list"
  else if (pathname.startsWith("/resource-planning"))
    activeView = "resource_planning"
  else if (pathname.startsWith("/analytics")) activeView = "company_analytics"
  else if (pathname.startsWith("/cashflow")) activeView = "cashflow"
  else if (pathname.startsWith("/subscriptions")) activeView = "subscriptions"
  else if (pathname.startsWith("/commissions")) activeView = "commissions"
  else if (pathname.startsWith("/loans")) activeView = "loans"
  else if (pathname.startsWith("/ledger")) activeView = "ledger"
  else if (pathname.startsWith("/settings/team")) activeView = "team"
  else if (pathname.startsWith("/master-data/products"))
    activeView = "master_products"
  else if (pathname.startsWith("/master-data/customers"))
    activeView = "master_customers"
  else if (pathname.startsWith("/master-data/commission-payees"))
    activeView = "master_commission_payees"
  else if (pathname.startsWith("/master-data/positions"))
    activeView = "master_positions"
  else if (pathname.startsWith("/master-data/overheads"))
    activeView = "master_overheads"
  else if (pathname.startsWith("/master-data/employees"))
    activeView = "master_employees"
  else if (pathname.startsWith("/projects/")) {
    // Project scope views
    if (pathname.endsWith("/labor")) activeView = "labor"
    else if (pathname.endsWith("/overheads")) activeView = "overhead_alloc"
    else if (pathname.endsWith("/settings")) activeView = "quote_settings"
    else if (pathname.endsWith("/quotation")) activeView = "quote"
    else activeView = "dashboard"
  }

  const handleSelectView = (view: SidebarViewId) => {
    switch (view) {
      case "projects_list":
        router.push("/projects")
        break
      case "resource_planning":
        router.push("/resource-planning")
        break
      case "company_analytics":
        router.push("/analytics")
        break
      case "cashflow":
        router.push("/cashflow")
        break
      case "subscriptions":
        router.push("/subscriptions")
        break
      case "commissions":
        router.push("/commissions")
        break
      case "ledger":
        router.push("/ledger")
        break
      case "loans":
        router.push("/loans")
        break
      case "team":
        router.push("/settings/team")
        break
      case "master_products":
        router.push("/master-data/products")
        break
      case "master_customers":
        router.push("/master-data/customers")
        break
      case "master_commission_payees":
        router.push("/master-data/commission-payees")
        break
      case "master_positions":
        router.push("/master-data/positions")
        break
      case "master_overheads":
        router.push("/master-data/overheads")
        break
      case "master_employees":
        router.push("/master-data/employees")
        break
      default:
        // Project views need an ID, so we stay on current or go to projects list if no active
        if (activeProjectId) {
          const basePath = `/projects/${activeProjectId}`
          if (view === "dashboard") router.push(`${basePath}`)
          else if (view === "labor") router.push(`${basePath}/labor`)
          else if (view === "overhead_alloc")
            router.push(`${basePath}/overheads`)
          else if (view === "quote_settings")
            router.push(`${basePath}/settings`)
          else if (view === "quote") router.push(`${basePath}/quotation`)
        } else {
          router.push("/projects")
        }
    }
  }

  if (orgLoading || !org || !isLoaded) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
        <div className="flex h-12 w-12 animate-bounce items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <span className="text-xl font-bold">฿</span>
        </div>
        <div className="animate-pulse text-sm font-semibold tracking-wider">
          กำลังโหลดระบบ...
        </div>
      </div>
    )
  }

  return (
    <AuthGate>
      <div className="flex min-h-screen bg-background text-foreground">
        {/* 1. Desktop Sidebar */}
        <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 lg:block print:hidden">
          <Sidebar
            projects={projects}
            activeProjectId={activeProjectId}
            activeView={activeView}
            onSelectProject={setActiveProjectId}
            onSelectView={handleSelectView}
            onAddProject={addProject}
            onUpdateProject={updateProject}
            onDeleteProject={deleteProject}
            onDuplicateProject={duplicateProject}
            onExportData={exportData}
            onImportData={importData}
          />
        </aside>

        {/* 2. Mobile Sidebar Drawer */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent
            side="left"
            className="w-[232px] border-r border-sidebar-border bg-sidebar p-0 print:hidden"
          >
            <Sidebar
              projects={projects}
              activeProjectId={activeProjectId}
              activeView={activeView}
              onSelectProject={(id) => {
                setActiveProjectId(id)
                setMobileMenuOpen(false)
              }}
              onSelectView={(view) => {
                handleSelectView(view)
                setMobileMenuOpen(false)
              }}
              onAddProject={addProject}
              onUpdateProject={updateProject}
              onDeleteProject={deleteProject}
              onDuplicateProject={duplicateProject}
              onExportData={exportData}
              onImportData={importData}
            />
          </SheetContent>
        </Sheet>

        {/* 3. Main Workspace Panel */}
        <main className="flex min-w-0 flex-1 flex-col bg-muted/20">
          {/* Mobile header */}
          <header className="sticky top-0 z-30 flex h-14 items-center border-b border-border/60 bg-card/40 px-4 backdrop-blur-xs lg:hidden print:hidden">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <span className="ml-3 text-sm font-semibold">
              Software Cost Pro
            </span>
          </header>

          <div className="w-full flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 print:overflow-visible print:p-0">
            <FeatureScopeProvider feature={VIEW_FEATURE[activeView] ?? null}>
              <div className="mx-auto max-w-7xl space-y-6">
                <ReadOnlyBanner />
                {VIEW_FEATURE[activeView] &&
                !orgLoading &&
                !canView(VIEW_FEATURE[activeView]) ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                      <Lock className="h-6 w-6" />
                    </div>
                    <div className="font-semibold">
                      ไม่มีสิทธิ์เข้าถึงเมนูนี้
                    </div>
                    <div className="max-w-sm text-sm text-muted-foreground">
                      บัญชีของคุณไม่ได้รับสิทธิ์ให้เข้าถึงส่วนนี้ —
                      ติดต่อผู้ดูแลเพื่อขอเปิดสิทธิ์
                    </div>
                  </div>
                ) : (
                  children
                )}
              </div>
            </FeatureScopeProvider>
          </div>
        </main>
      </div>
    </AuthGate>
  )
}
