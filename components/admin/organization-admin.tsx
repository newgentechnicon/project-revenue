"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Building2,
  Loader2,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserPlus,
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/hooks/use-auth"

type Member = {
  user_id: string
  email: string
  role: string
  data_scope: string
  active: boolean
}

type Organization = {
  id: string
  name: string
  created_at: string
  members: Member[]
}

type AuthAccount = {
  id: string
  email: string
}

async function readError(response: Response) {
  const body = (await response.json().catch(() => null)) as {
    error?: string
  } | null
  return body?.error ?? "เกิดข้อผิดพลาด กรุณาลองใหม่"
}

export function OrganizationAdmin() {
  const { session, user, signOut } = useAuth()
  const router = useRouter()
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [users, setUsers] = useState<AuthAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [orgName, setOrgName] = useState("")
  const [creatingOrg, setCreatingOrg] = useState(false)
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null)
  const [editOrgName, setEditOrgName] = useState("")
  const [savingOrg, setSavingOrg] = useState(false)
  const [selectedOrgId, setSelectedOrgId] = useState("")
  const [accountMode, setAccountMode] = useState<"existing" | "new">(
    "existing"
  )
  const [selectedUserId, setSelectedUserId] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState("owner")
  const [dataScope, setDataScope] = useState("all")
  const [creatingUser, setCreatingUser] = useState(false)

  const request = useCallback(
    (url: string, init?: RequestInit) =>
      fetch(url, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
          ...init?.headers,
        },
      }),
    [session?.access_token]
  )

  const load = useCallback(async () => {
    if (!session) return
    setLoading(true)
    const response = await request("/api/admin/organizations")
    if (response.status === 403) {
      setForbidden(true)
      setLoading(false)
      return
    }
    if (!response.ok) {
      toast.error(await readError(response))
      setLoading(false)
      return
    }
    const body = (await response.json()) as {
      organizations: Organization[]
      users: AuthAccount[]
    }
    setOrganizations(body.organizations)
    setUsers(body.users)
    setForbidden(false)
    setSelectedOrgId((current) => current || body.organizations[0]?.id || "")
    setLoading(false)
  }, [request, session])

  useEffect(() => {
    // Fetch external server state when the authenticated session becomes ready.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const createOrganization = async (event: React.FormEvent) => {
    event.preventDefault()
    setCreatingOrg(true)
    const response = await request("/api/admin/organizations", {
      method: "POST",
      body: JSON.stringify({ name: orgName }),
    })
    if (!response.ok) toast.error(await readError(response))
    else {
      const body = (await response.json()) as { organization: Organization }
      setOrgName("")
      setSelectedOrgId(body.organization.id)
      toast.success("สร้างบริษัทเรียบร้อยแล้ว")
      await load()
    }
    setCreatingOrg(false)
  }

  const createUser = async (event: React.FormEvent) => {
    event.preventDefault()
    setCreatingUser(true)
    const response = await request("/api/admin/users", {
      method: "POST",
      body: JSON.stringify(
        accountMode === "existing"
          ? {
              accountMode,
              orgId: selectedOrgId,
              userId: selectedUserId,
              role,
              dataScope,
            }
          : {
              accountMode,
              orgId: selectedOrgId,
              email,
              password,
              role,
              dataScope,
            }
      ),
    })
    if (!response.ok) toast.error(await readError(response))
    else {
      setSelectedUserId("")
      setEmail("")
      setPassword("")
      toast.success("สร้างบัญชีและผูกเข้าบริษัทเรียบร้อยแล้ว")
      await load()
    }
    setCreatingUser(false)
  }

  const openOrganizationEditor = (organization: Organization) => {
    setEditingOrg(organization)
    setEditOrgName(organization.name)
  }

  const updateOrganization = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!editingOrg) return

    setSavingOrg(true)
    const response = await request("/api/admin/organizations", {
      method: "PATCH",
      body: JSON.stringify({ id: editingOrg.id, name: editOrgName }),
    })
    if (!response.ok) {
      toast.error(await readError(response))
    } else {
      const body = (await response.json()) as { organization: Organization }
      setOrganizations((current) =>
        current.map((organization) =>
          organization.id === body.organization.id
            ? { ...organization, name: body.organization.name }
            : organization
        )
      )
      setEditingOrg(null)
      setEditOrgName("")
      toast.success("แก้ไขชื่อบริษัทเรียบร้อยแล้ว")
    }
    setSavingOrg(false)
  }

  const logout = async () => {
    await signOut()
    router.replace("/login")
  }

  const selectedOrganization = organizations.find(
    (organization) => organization.id === selectedOrgId
  )
  const memberIds = new Set(
    selectedOrganization?.members.map((member) => member.user_id) ?? []
  )
  const availableUsers = users.filter((account) => !memberIds.has(account.id))

  return (
    <AuthGate>
      <div className="min-h-screen bg-muted/20">
        <header className="border-b bg-background/90 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <div className="font-bold">Platform Admin</div>
                <div className="text-xs text-muted-foreground">
                  จัดการบริษัทและบัญชีผู้ใช้
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {user?.email}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={logout}
                className="gap-2"
              >
                <LogOut className="h-4 w-4" /> ออกจากระบบ
              </Button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
          {forbidden ? (
            <Card className="mx-auto max-w-lg">
              <CardHeader>
                <CardTitle>ไม่มีสิทธิ์เข้าถึง</CardTitle>
                <CardDescription>
                  บัญชีนี้ไม่ใช่ Platform Admin กรุณาติดต่อผู้ดูแลระบบ
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <>
              <div>
                <h1 className="text-2xl font-bold">Organizations</h1>
                <p className="text-sm text-muted-foreground">
                  สร้างบริษัทก่อน แล้วจึงสร้างบัญชีสำหรับบริษัทนั้น
                </p>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Building2 className="h-5 w-5" /> 1. สร้างบริษัท
                    </CardTitle>
                    <CardDescription>
                      ข้อมูลของแต่ละบริษัทจะถูกแยกด้วย Organization ID
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={createOrganization} className="flex gap-2">
                      <Input
                        value={orgName}
                        onChange={(event) => setOrgName(event.target.value)}
                        placeholder="ชื่อบริษัท"
                        minLength={2}
                        maxLength={120}
                        required
                      />
                      <Button
                        type="submit"
                        disabled={creatingOrg}
                        className="shrink-0 gap-2"
                      >
                        {creatingOrg ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}{" "}
                        สร้าง
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <UserPlus className="h-5 w-5" /> 2. เพิ่มบัญชีให้บริษัท
                    </CardTitle>
                    <CardDescription>
                      เลือกบัญชีเดิมในระบบ หรือสร้างบัญชีใหม่ให้บริษัท
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form
                      onSubmit={createUser}
                      className="grid gap-3 sm:grid-cols-2"
                    >
                      <div className="grid gap-1.5 sm:col-span-2">
                        <Label>บริษัท</Label>
                        <Select
                          value={selectedOrgId}
                          onValueChange={(value) => {
                            setSelectedOrgId(value)
                            setSelectedUserId("")
                          }}
                          required
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="เลือกบริษัท" />
                          </SelectTrigger>
                          <SelectContent>
                            {organizations.map((org) => (
                              <SelectItem key={org.id} value={org.id}>
                                {org.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Tabs
                        value={accountMode}
                        onValueChange={(value) => {
                          setAccountMode(value as "existing" | "new")
                          setSelectedUserId("")
                        }}
                        className="sm:col-span-2"
                      >
                        <TabsList className="grid w-full grid-cols-2">
                          <TabsTrigger value="existing">
                            เลือกบัญชีเดิม
                          </TabsTrigger>
                          <TabsTrigger value="new">สร้างบัญชีใหม่</TabsTrigger>
                        </TabsList>
                      </Tabs>
                      {accountMode === "existing" ? (
                        <div className="grid gap-1.5 sm:col-span-2">
                          <Label>บัญชีผู้ใช้ในระบบ</Label>
                          <Select
                            value={selectedUserId}
                            onValueChange={setSelectedUserId}
                            required
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="เลือกบัญชีผู้ใช้" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableUsers.map((account) => (
                                <SelectItem key={account.id} value={account.id}>
                                  {account.email}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {selectedOrgId && availableUsers.length === 0 && (
                            <p className="text-xs text-muted-foreground">
                              บัญชีทั้งหมดถูกเพิ่มในบริษัทนี้แล้ว
                            </p>
                          )}
                        </div>
                      ) : (
                        <>
                          <div className="grid gap-1.5">
                            <Label>อีเมล</Label>
                            <Input
                              type="email"
                              value={email}
                              onChange={(event) => setEmail(event.target.value)}
                              required
                            />
                          </div>
                          <div className="grid gap-1.5">
                            <Label>รหัสผ่านเริ่มต้น</Label>
                            <Input
                              type="password"
                              value={password}
                              onChange={(event) => setPassword(event.target.value)}
                              minLength={8}
                              required
                            />
                          </div>
                        </>
                      )}
                      <div className="grid gap-1.5">
                        <Label>Role</Label>
                        <Select value={role} onValueChange={setRole}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="owner">Owner</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="accountant">
                              Accountant
                            </SelectItem>
                            <SelectItem value="sales">Sales</SelectItem>
                            <SelectItem value="viewer">Viewer</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-1.5">
                        <Label>การมองเห็นข้อมูล</Label>
                        <Select value={dataScope} onValueChange={setDataScope}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">ทั้งหมดในบริษัท</SelectItem>
                            <SelectItem value="own">เฉพาะของตนเอง</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="submit"
                        className="gap-2 sm:col-span-2"
                        disabled={
                          creatingUser ||
                          !selectedOrgId ||
                          (accountMode === "existing" && !selectedUserId)
                        }
                      >
                        {creatingUser ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <UserPlus className="h-4 w-4" />
                        )}{" "}
                        {accountMode === "existing"
                          ? "เพิ่มบัญชีเข้าบริษัท"
                          : "สร้างบัญชี"}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">รายชื่อบริษัท</CardTitle>
                    <CardDescription>
                      {organizations.length} บริษัทในระบบ
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void load()}
                    disabled={loading}
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                    />
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>บริษัท</TableHead>
                          <TableHead>สมาชิก</TableHead>
                          <TableHead>บัญชีผู้ใช้</TableHead>
                          <TableHead className="w-20 text-right">จัดการ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loading ? (
                          <TableRow>
                            <TableCell
                              colSpan={4}
                              className="py-10 text-center"
                            >
                              <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                            </TableCell>
                          </TableRow>
                        ) : organizations.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={4}
                              className="py-10 text-center text-muted-foreground"
                            >
                              ยังไม่มีบริษัท
                            </TableCell>
                          </TableRow>
                        ) : (
                          organizations.map((org) => (
                            <TableRow key={org.id}>
                              <TableCell className="font-semibold">
                                {org.name}
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary">
                                  {org.members.length} คน
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1.5">
                                  {org.members.length ? (
                                    org.members.map((member) => (
                                      <Badge
                                        key={member.user_id}
                                        variant="outline"
                                      >
                                        {member.email} · {member.role}
                                      </Badge>
                                    ))
                                  ) : (
                                    <span className="text-xs text-muted-foreground">
                                      ยังไม่มีบัญชี
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon-sm"
                                  onClick={() => openOrganizationEditor(org)}
                                  aria-label={`แก้ไข ${org.name}`}
                                  title="แก้ไขชื่อบริษัท"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <Dialog
                open={editingOrg !== null}
                onOpenChange={(open) => {
                  if (!open && !savingOrg) {
                    setEditingOrg(null)
                    setEditOrgName("")
                  }
                }}
              >
                <DialogContent>
                  <form onSubmit={updateOrganization} className="grid gap-6">
                    <DialogHeader>
                      <DialogTitle>แก้ไข Organization</DialogTitle>
                      <DialogDescription>
                        เปลี่ยนชื่อบริษัทโดยไม่กระทบสมาชิกและข้อมูลเดิม
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-2">
                      <Label htmlFor="edit-organization-name">ชื่อบริษัท</Label>
                      <Input
                        id="edit-organization-name"
                        value={editOrgName}
                        onChange={(event) => setEditOrgName(event.target.value)}
                        minLength={2}
                        maxLength={120}
                        autoFocus
                        required
                      />
                    </div>
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setEditingOrg(null)
                          setEditOrgName("")
                        }}
                        disabled={savingOrg}
                      >
                        ยกเลิก
                      </Button>
                      <Button type="submit" disabled={savingOrg} className="gap-2">
                        {savingOrg && <Loader2 className="h-4 w-4 animate-spin" />}
                        บันทึก
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </>
          )}
        </main>
      </div>
    </AuthGate>
  )
}
