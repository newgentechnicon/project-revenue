"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  Loader2,
  LogOut,
  ShieldCheck,
} from "lucide-react"
import { toast } from "sonner"
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

const ROLE_LABELS: Record<string, string> = {
  owner: "เจ้าของ",
  admin: "ผู้ดูแล",
  accountant: "บัญชี",
  sales: "ฝ่ายขาย",
  viewer: "ผู้ชม",
}

export function OrganizationSelector() {
  const router = useRouter()
  const { user, signOut } = useAuth()
  const { organizations, org, loading, selectOrganization } = useOrg()
  const [selectingId, setSelectingId] = useState<string | null>(null)

  const enterOrganization = async (orgId: string) => {
    setSelectingId(orgId)
    const error = await selectOrganization(orgId)
    if (error) {
      toast.error(error)
      setSelectingId(null)
      return
    }
    window.location.assign("/systems")
  }

  const logout = async () => {
    await signOut()
    router.replace("/login")
  }

  return (
    <AuthGate>
      <div className="min-h-screen bg-muted/20">
        <header className="border-b bg-background/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <div className="font-bold">Project Revenue</div>
                <div className="text-xs text-muted-foreground">
                  Organization Portal
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={logout}
              className="gap-2"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">ออกจากระบบ</span>
            </Button>
          </div>
        </header>

        <main className="mx-auto max-w-6xl p-4 py-10 md:p-6 md:py-14">
          <div className="mb-8 max-w-2xl">
            <Badge variant="secondary" className="mb-3">
              เข้าสู่ระบบแล้ว · {user?.email}
            </Badge>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
              เลือก Organization
            </h1>
            <p className="mt-2 text-muted-foreground">
              เลือกบริษัทที่ต้องการเข้าใช้งาน
              ข้อมูลและสิทธิ์ของแต่ละบริษัทจะแยกออกจากกัน
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center py-24">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
            </div>
          ) : organizations.length === 0 ? (
            <Card className="border-dashed">
              <CardHeader className="items-center py-14 text-center">
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                  <Building2 className="h-6 w-6 text-muted-foreground" />
                </div>
                <CardTitle>ยังไม่มี Organization</CardTitle>
                <CardDescription>
                  บัญชีนี้ยังไม่ได้ถูกเพิ่มเข้าในบริษัท กรุณาติดต่อ Platform
                  Admin
                </CardDescription>
                <Button
                  variant="outline"
                  className="mt-3 gap-2"
                  onClick={() => router.push("/admin/organizations")}
                >
                  <ShieldCheck className="h-4 w-4" /> ไปหน้า Platform Admin
                </Button>
              </CardHeader>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {organizations.map((organization) => {
                const isCurrent = org?.id === organization.id
                const isSelecting = selectingId === organization.id
                return (
                  <Card
                    key={organization.id}
                    className="group transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
                  >
                    <CardHeader>
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <Building2 className="h-5 w-5" />
                        </div>
                        {isCurrent && (
                          <Badge className="gap-1">
                            <CheckCircle2 className="h-3 w-3" /> ล่าสุด
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-lg">
                        {organization.name}
                      </CardTitle>
                      <CardDescription>
                        สิทธิ์:{" "}
                        {ROLE_LABELS[organization.role] ?? organization.role}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button
                        className="w-full gap-2"
                        onClick={() => void enterOrganization(organization.id)}
                        disabled={selectingId !== null}
                      >
                        {isSelecting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        เข้า Organization
                      </Button>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </main>
      </div>
    </AuthGate>
  )
}
