"use client"

import React, { useRef } from "react"
import { Project } from "@/lib/types"
import { Button } from "@/components/ui/button"
import {
  Briefcase,
  Users,
  Download,
  Upload,
  Moon,
  Sun,
  Laptop,
  DollarSign,
  FolderKanban,
  CalendarRange,
  LogOut,
  User as UserIcon,
  Banknote,
  Repeat,
  Package,
  Building2,
  BarChart3,
  Receipt,
  Percent,
  Handshake,
  BookText,
  Users2,
  Landmark,
  LayoutGrid,
  type LucideIcon,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { toast } from "sonner"
import { useAuth } from "@/hooks/use-auth"
import { useOrg } from "@/hooks/use-org"
import type { OrgRole } from "@/lib/types"
import { VIEW_FEATURE } from "@/lib/features"

export type SidebarViewId =
  | "projects_list"
  | "dashboard"
  | "labor"
  | "overhead_alloc"
  | "quote_settings"
  | "quote"
  | "resource_planning"
  | "company_analytics"
  | "cashflow"
  | "subscriptions"
  | "commissions"
  | "ledger"
  | "loans"
  | "master_products"
  | "master_customers"
  | "master_commission_payees"
  | "master_positions"
  | "master_overheads"
  | "master_employees"
  | "team"

const PROJECT_SCOPE_VIEWS: SidebarViewId[] = [
  "projects_list",
  "dashboard",
  "labor",
  "overhead_alloc",
  "quote_settings",
  "quote",
]

interface NavItem {
  id: SidebarViewId
  label: string
  icon: LucideIcon
}

interface NavSection {
  title: string
  items: NavItem[]
}

// เมนูจัดกลุ่มเป็นหมวดหมู่ — แก้/เพิ่มเมนูที่นี่ที่เดียว
const NAV_SECTIONS: NavSection[] = [
  {
    title: "ดำเนินงาน",
    items: [
      { id: "projects_list", label: "จัดการโครงการ", icon: FolderKanban },
      {
        id: "resource_planning",
        label: "Resource Planning",
        icon: CalendarRange,
      },
    ],
  },
  {
    title: "รายรับ & การเงิน",
    items: [
      { id: "subscriptions", label: "รายรับประจำ", icon: Repeat },
      { id: "commissions", label: "ค่าคอมมิชชั่น", icon: Percent },
      { id: "ledger", label: "รายการเดินบัญชี", icon: BookText },
      { id: "loans", label: "เงินกู้ยืม", icon: Landmark },
      { id: "cashflow", label: "Cashflow", icon: Banknote },
      { id: "company_analytics", label: "Company Analytics", icon: BarChart3 },
    ],
  },
  {
    title: "ข้อมูลหลัก",
    items: [
      { id: "master_customers", label: "ลูกค้า", icon: Building2 },
      { id: "master_products", label: "สินค้า/แพ็กเกจ", icon: Package },
      { id: "master_commission_payees", label: "ผู้รับคอม", icon: Handshake },
      { id: "master_positions", label: "ข้อมูลเรตตำแหน่งงาน", icon: Briefcase },
      { id: "master_employees", label: "รายชื่อพนักงาน", icon: Users },
      { id: "master_overheads", label: "ค่าใช้จ่ายส่วนกลาง", icon: Receipt },
    ],
  },
]

interface SidebarProps {
  projects: Project[]
  activeProjectId: string
  activeView: SidebarViewId
  onSelectProject: (id: string) => void
  onSelectView: (view: SidebarViewId) => void
  onAddProject: (name: string, description?: string) => void
  onUpdateProject: (updated: Project) => void
  onDeleteProject: (id: string) => void
  onDuplicateProject: (id: string) => void
  onExportData: () => void
  onImportData: (dataStr: string) => boolean
}

const ROLE_SHORT: Record<OrgRole, string> = {
  owner: "เจ้าของ",
  admin: "ผู้ดูแล",
  accountant: "บัญชี",
  sales: "ฝ่ายขาย",
  viewer: "ผู้ชม",
}

export function Sidebar({
  activeView,
  onSelectView,
  onExportData,
  onImportData,
}: SidebarProps) {
  const { setTheme, theme } = useTheme()
  const router = useRouter()
  const { user, mode, signOut } = useAuth()
  const { role, isAdmin, canView } = useOrg()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // กรองเมนูตามสิทธิ์ view ของแต่ละ feature แล้วตัด section ที่ว่างทิ้ง
  const visibleSections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((it) => {
      const f = VIEW_FEATURE[it.id]
      return !f || canView(f)
    }),
  })).filter((section) => section.items.length > 0)

  const isProjectFlow = PROJECT_SCOPE_VIEWS.includes(activeView)

  const handleSignOut = async () => {
    await signOut()
    toast.success("ออกจากระบบเรียบร้อย")
  }

  const handleImportClick = () => fileInputRef.current?.click()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const result = event.target?.result as string
      const success = onImportData(result)
      if (success) toast.success("นำเข้าข้อมูลสำรองเรียบร้อยแล้ว!")
      else toast.error("รูปแบบไฟล์ไม่ถูกต้อง")
    }
    reader.readAsText(file)
    e.target.value = ""
  }

  return (
    <div className="flex h-full w-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      {/* Brand */}
      <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
          <DollarSign className="h-4 w-4 font-black" />
        </div>
        <div className="flex flex-col">
          <span className="text-[13px] leading-none font-bold tracking-tight">
            Software Cost Pro
          </span>
          <span className="mt-0.5 text-[9px] text-muted-foreground">
            ระบบวิเคราะห์และคำนวณต้นทุน
          </span>
        </div>
      </div>

      {/* Main Navigation — grouped */}
      <nav className="flex-1 space-y-4 overflow-y-auto px-2.5 py-3">
        <div className="space-y-0.5">
          <div className="px-2.5 pb-0.5 text-[10px] font-bold tracking-wider text-muted-foreground/60 uppercase">
            Portal
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/systems")}
            className="h-9 w-full justify-start gap-2.5 px-2.5 text-[13px] font-medium"
          >
            <LayoutGrid className="h-4 w-4 shrink-0 text-muted-foreground" />
            ระบบทั้งหมด
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/organizations")}
            className="h-9 w-full justify-start gap-2.5 px-2.5 text-[13px] font-medium"
          >
            <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            เปลี่ยน Organization
          </Button>
        </div>

        {visibleSections.map((section) => (
          <div key={section.title} className="space-y-0.5">
            <div className="px-2.5 pb-0.5 text-[10px] font-bold tracking-wider text-muted-foreground/60 uppercase">
              {section.title}
            </div>
            {section.items.map((item) => {
              const active =
                item.id === "projects_list"
                  ? isProjectFlow
                  : activeView === item.id
              const Icon = item.icon
              return (
                <Button
                  key={item.id}
                  variant={active ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => onSelectView(item.id)}
                  className={`h-9 w-full justify-start gap-2.5 px-2.5 text-[13px] ${active ? "font-semibold" : "font-medium"}`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`}
                  />
                  {item.label}
                </Button>
              )
            })}
          </div>
        ))}

        {/* ตั้งค่า — เฉพาะผู้ดูแล */}
        {isAdmin && (
          <div className="space-y-0.5">
            <div className="px-2.5 pb-0.5 text-[10px] font-bold tracking-wider text-muted-foreground/60 uppercase">
              ตั้งค่า
            </div>
            <Button
              variant={activeView === "team" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => onSelectView("team")}
              className={`h-9 w-full justify-start gap-2.5 px-2.5 text-[13px] ${activeView === "team" ? "font-semibold" : "font-medium"}`}
            >
              <Users2
                className={`h-4 w-4 shrink-0 ${activeView === "team" ? "text-primary" : "text-muted-foreground"}`}
              />
              จัดการทีม
            </Button>
          </div>
        )}
      </nav>

      {/* Footer: User + Backup + Theme */}
      <div className="space-y-2.5 border-t border-sidebar-border bg-sidebar-accent/10 p-3">
        {/* User block — แสดงเฉพาะเมื่อ login ผ่าน Supabase */}
        {mode === "supabase" && user && (
          <div className="flex items-center gap-2 border-b border-sidebar-border/40 pb-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UserIcon className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div
                className="truncate text-[11px] font-semibold"
                title={user.email ?? ""}
              >
                {user.email}
              </div>
              <div className="text-[9px] text-muted-foreground">
                {role ? ROLE_SHORT[role] : "Cloud sync"}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              className="h-6 w-6 shrink-0"
              title="ออกจากระบบ"
            >
              <LogOut className="h-3 w-3" />
            </Button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="xs"
            onClick={onExportData}
            className="h-8 w-full gap-1 border-sidebar-border/80 bg-sidebar text-[10px]"
          >
            <Download className="h-3 w-3 text-muted-foreground" /> Export
          </Button>
          <Button
            variant="outline"
            size="xs"
            onClick={handleImportClick}
            className="h-8 w-full gap-1 border-sidebar-border/80 bg-sidebar text-[10px]"
          >
            <Upload className="h-3 w-3 text-muted-foreground" /> Import
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".json"
            className="hidden"
          />
        </div>

        <div className="flex items-center justify-between border-t border-sidebar-border/40 pt-1 text-xs">
          <span className="text-muted-foreground">ธีม:</span>
          <div className="flex items-center gap-0.5 rounded-lg border border-sidebar-border bg-sidebar p-0.5">
            <Button
              size="icon"
              variant={theme === "light" ? "secondary" : "ghost"}
              onClick={() => setTheme("light")}
              className="h-6 w-6"
            >
              <Sun className="h-3 w-3" />
            </Button>
            <Button
              size="icon"
              variant={theme === "dark" ? "secondary" : "ghost"}
              onClick={() => setTheme("dark")}
              className="h-6 w-6"
            >
              <Moon className="h-3 w-3" />
            </Button>
            <Button
              size="icon"
              variant={theme === "system" ? "secondary" : "ghost"}
              onClick={() => setTheme("system")}
              className="h-6 w-6"
            >
              <Laptop className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
