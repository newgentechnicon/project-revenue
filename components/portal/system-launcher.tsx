"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  BarChart3,
  BookOpenCheck,
  Boxes,
  Building2,
  ChevronRight,
  FolderKanban,
  Landmark,
  Loader2,
  LogOut,
  Settings2,
  WalletCards,
} from "lucide-react"
import { AuthGate } from "@/components/auth/auth-gate"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useAuth } from "@/hooks/use-auth"
import { useOrg } from "@/hooks/use-org"
import type { FeatureKey } from "@/lib/features"

const SYSTEMS: Array<{
  title: string
  description: string
  icon: typeof FolderKanban
  routes: Array<{ feature: FeatureKey; href: string }>
}> = [
  {
    title: "Project Management",
    description: "โครงการ ต้นทุน ใบเสนอราคา และ Resource Planning",
    icon: FolderKanban,
    routes: [
      { feature: "projects", href: "/projects" },
      { feature: "resource_planning", href: "/resource-planning" },
    ],
  },
  {
    title: "Revenue Management",
    description: "รายรับประจำ สินค้า และค่าคอมมิชชั่น",
    icon: WalletCards,
    routes: [
      { feature: "subscriptions", href: "/subscriptions" },
      { feature: "products", href: "/master-data/products" },
      { feature: "commissions", href: "/commissions" },
    ],
  },
  {
    title: "Finance & Accounting",
    description: "รายการเดินบัญชี Cashflow และเงินกู้ยืม",
    icon: Landmark,
    routes: [
      { feature: "ledger", href: "/ledger" },
      { feature: "cashflow", href: "/cashflow" },
      { feature: "loans", href: "/loans" },
    ],
  },
  {
    title: "Company Analytics",
    description: "ภาพรวมรายได้ ต้นทุน และผลการดำเนินงาน",
    icon: BarChart3,
    routes: [{ feature: "analytics", href: "/analytics" }],
  },
  {
    title: "Master Data",
    description: "ลูกค้า พนักงาน ตำแหน่ง และค่าใช้จ่ายส่วนกลาง",
    icon: Boxes,
    routes: [
      { feature: "customers", href: "/master-data/customers" },
      { feature: "employees", href: "/master-data/employees" },
      { feature: "positions", href: "/master-data/positions" },
      { feature: "overheads", href: "/master-data/overheads" },
    ],
  },
]

export function SystemLauncher() {
  const router = useRouter()
  const { user, signOut } = useAuth()
  const { org, loading, canView, isAdmin } = useOrg()

  useEffect(() => {
    if (!loading && !org) router.replace("/organizations")
  }, [loading, org, router])

  if (loading || !org) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    )
  }

  const visibleSystems = SYSTEMS.flatMap((system) => {
    const href = system.routes.find((route) => canView(route.feature))?.href
    return href ? [{ ...system, href }] : []
  })
  const logout = async () => {
    await signOut()
    router.replace("/login")
  }

  return (
    <AuthGate>
      <div className="min-h-screen bg-muted/20">
        <header className="border-b bg-background/90 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 md:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="truncate font-bold">{org.name}</div>
                <div className="text-xs text-muted-foreground">
                  เลือกระบบที่ต้องการใช้งาน
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/organizations")}
                className="gap-2"
              >
                <Building2 className="h-4 w-4" />
                <span className="hidden sm:inline">เปลี่ยนบริษัท</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={logout}
                title={`ออกจากระบบ ${user?.email ?? ""}`}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl p-4 py-10 md:p-6 md:py-14">
          <div className="mb-8">
            <Badge variant="secondary" className="mb-3">
              Organization · {org.name}
            </Badge>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
              ระบบภายในบริษัท
            </h1>
            <p className="mt-2 text-muted-foreground">
              เลือกโมดูลเพื่อเข้าใช้งาน ระบบจะแสดงเฉพาะส่วนที่ Role
              ของคุณมีสิทธิ์เข้าถึง
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleSystems.map((system) => {
              const Icon = system.icon
              return (
                <Card
                  key={system.title}
                  className="group cursor-pointer transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
                  onClick={() => router.push(system.href)}
                >
                  <CardHeader>
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-6 w-6" />
                    </div>
                    <CardTitle className="text-lg">{system.title}</CardTitle>
                    <CardDescription className="min-h-10">
                      {system.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      variant="ghost"
                      className="-ml-3 gap-2 group-hover:text-primary"
                    >
                      เข้าสู่ระบบ <ChevronRight className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              )
            })}

            {isAdmin && (
              <Card
                className="group cursor-pointer border-dashed transition-all hover:border-primary/50"
                onClick={() => router.push("/settings/team")}
              >
                <CardHeader>
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                    <Settings2 className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-lg">
                    Organization Settings
                  </CardTitle>
                  <CardDescription>
                    จัดการสมาชิก Role และสิทธิ์การเข้าถึงระบบ
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="ghost" className="-ml-3 gap-2">
                    ตั้งค่า <ChevronRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {visibleSystems.length === 0 && !isAdmin && (
            <Card className="border-dashed">
              <CardHeader className="items-center py-14 text-center">
                <BookOpenCheck className="mb-2 h-8 w-8 text-muted-foreground" />
                <CardTitle>ยังไม่มีระบบที่เข้าถึงได้</CardTitle>
                <CardDescription>
                  กรุณาติดต่อผู้ดูแล Organization เพื่อเปิดสิทธิ์ให้ Role ของคุณ
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </main>
      </div>
    </AuthGate>
  )
}
