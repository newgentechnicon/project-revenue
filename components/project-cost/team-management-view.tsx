"use client";

import { useState } from "react";
import { useOrg } from "@/hooks/use-org";
import { useAuth } from "@/hooks/use-auth";
import { OrgRole, DataScope } from "@/lib/types";
import { FEATURES, FeatureAccess, FeatureKey, resolveAccess } from "@/lib/features";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Trash2, Check, ShieldAlert, Save } from "lucide-react";
import { toast } from "sonner";

const ROLE_LABELS: Record<OrgRole, string> = {
  owner: "เจ้าของ (Owner)",
  admin: "ผู้ดูแล (Admin)",
  accountant: "บัญชี (Accountant)",
  sales: "ฝ่ายขาย (Sales)",
  viewer: "ผู้ชม (Viewer)",
};

const ROLE_OPTIONS: OrgRole[] = ["owner", "admin", "accountant", "sales", "viewer"];

// role ที่ตั้งค่าสิทธิ์ feature ได้ (owner ล็อก = ทุกเมนู edit เสมอ)
const PERM_ROLES: OrgRole[] = ["admin", "accountant", "sales", "viewer"];
const ACCESS_LEVELS: { value: FeatureAccess; label: string }[] = [
  { value: "none", label: "ซ่อน" },
  { value: "view", label: "ดู" },
  { value: "edit", label: "แก้" },
];

export function TeamManagementView() {
  const {
    org, role, isAdmin, members, loading, updateMember, removeMember, renameOrg,
    featureMatrix, updateFeatureAccess,
  } = useOrg();
  const { user } = useAuth();
  // draft = ค่าที่ผู้ใช้กำลังพิมพ์ (null = ยังไม่แก้ → ใช้ค่าจาก org)
  const [draftName, setDraftName] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);
  const orgName = draftName ?? org?.name ?? "";
  // role ที่กำลังตั้งค่าสิทธิ์ feature (owner ล็อก = เห็น/แก้ได้ทุกเมนู)
  const [permRole, setPermRole] = useState<OrgRole>("sales");

  if (loading) {
    return <div className="py-12 text-center text-sm text-muted-foreground animate-pulse">กำลังโหลดข้อมูลทีม...</div>;
  }

  if (!isAdmin) {
    return (
      <Card className="border-amber-300 bg-amber-50/60 dark:bg-amber-950/20">
        <CardContent className="py-10 flex flex-col items-center gap-3 text-center">
          <ShieldAlert className="h-8 w-8 text-amber-600" />
          <div className="font-semibold">เฉพาะผู้ดูแล (Admin/Owner) เท่านั้น</div>
          <div className="text-sm text-muted-foreground">
            คุณมีสิทธิ์ระดับ <span className="font-semibold">{role ? ROLE_LABELS[role] : "-"}</span> — ไม่สามารถจัดการสมาชิกได้
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleSaveName = async () => {
    const name = orgName.trim();
    if (!name) { toast.error("กรุณาระบุชื่อองค์กร"); return; }
    setSavingName(true);
    const err = await renameOrg(name);
    setSavingName(false);
    if (err) toast.error(`บันทึกไม่สำเร็จ: ${err}`);
    else { setDraftName(null); toast.success("บันทึกชื่อองค์กรแล้ว"); }
  };

  const handleRole = async (userId: string, newRole: OrgRole) => {
    const err = await updateMember(userId, { role: newRole });
    if (err) toast.error(`เปลี่ยนสิทธิ์ไม่สำเร็จ: ${err}`);
    else toast.success("เปลี่ยนสิทธิ์เรียบร้อย");
  };

  const handleScope = async (userId: string, scope: DataScope) => {
    const err = await updateMember(userId, { dataScope: scope });
    if (err) toast.error(`เปลี่ยนขอบเขตข้อมูลไม่สำเร็จ: ${err}`);
    else toast.success("เปลี่ยนขอบเขตข้อมูลเรียบร้อย");
  };

  const handleRemove = async (userId: string, email?: string) => {
    if (!confirm(`นำ "${email ?? userId}" ออกจากองค์กรใช่หรือไม่?`)) return;
    const err = await removeMember(userId);
    if (err) toast.error(`นำออกไม่สำเร็จ: ${err}`);
    else toast.success("นำสมาชิกออกแล้ว");
  };

  const handleAccess = async (feature: FeatureKey, level: FeatureAccess) => {
    const err = await updateFeatureAccess(permRole, feature, level);
    if (err) toast.error(`บันทึกสิทธิ์ไม่สำเร็จ: ${err}`);
    else toast.success("อัปเดตสิทธิ์เรียบร้อย");
  };

  // จัดกลุ่ม feature ตาม group สำหรับแสดงผล
  const featureGroups = FEATURES.reduce<Record<string, typeof FEATURES>>((acc, f) => {
    (acc[f.group] ??= []).push(f);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" /> จัดการทีม
        </h2>
        <p className="text-sm text-muted-foreground">
          กำหนดสิทธิ์ (role) และขอบเขตการเห็นข้อมูล (เห็นทั้งหมด / เฉพาะของตัวเอง) ให้สมาชิกแต่ละคน
        </p>
      </div>

      {/* Org name */}
      <Card className="border-border/50 bg-card/50">
        <CardContent className="pt-4 flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="grid gap-1.5 flex-1">
            <label className="text-xs font-semibold text-muted-foreground">ชื่อองค์กร</label>
            <Input value={orgName} onChange={(e) => setDraftName(e.target.value)} placeholder="ชื่อบริษัท/องค์กร" />
          </div>
          <Button onClick={handleSaveName} disabled={savingName} className="gap-2">
            <Save className="h-4 w-4" /> บันทึกชื่อ
          </Button>
        </CardContent>
      </Card>

      {/* Members */}
      <Card className="border-border/50 bg-card/50">
        <CardContent className="pt-4">
          <div className="text-sm font-bold mb-1">สมาชิก ({members.length})</div>
          <p className="text-xs text-muted-foreground mb-4">
            บัญชีผู้ใช้ถูกสร้างและผูกกับบริษัทจากหน้า Platform Admin — หลังจากนั้นปรับสิทธิ์ของสมาชิกบริษัทนี้ได้ที่นี่
          </p>
          <div className="overflow-x-auto -mx-2 sm:mx-0">
            <Table className="min-w-[680px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">อีเมล</TableHead>
                  <TableHead className="min-w-[160px]">สิทธิ์ (Role)</TableHead>
                  <TableHead className="min-w-[150px]">เห็นข้อมูล</TableHead>
                  <TableHead className="text-center w-[80px]">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-10 text-muted-foreground text-sm">
                      ยังไม่มีสมาชิก
                    </TableCell>
                  </TableRow>
                ) : (
                  members.map((m) => {
                    const isSelf = m.userId === user?.id;
                    return (
                      <TableRow key={m.userId} className="hover:bg-muted/30">
                        <TableCell className="text-sm font-medium">
                          {m.email ?? m.userId}
                          {isSelf && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">คุณ</span>}
                        </TableCell>
                        <TableCell>
                          <Select value={m.role} onValueChange={(v) => handleRole(m.userId, v as OrgRole)}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {ROLE_OPTIONS.map((r) => (
                                <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select value={m.dataScope} onValueChange={(v) => handleScope(m.userId, v as DataScope)}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">เห็นทั้งหมด</SelectItem>
                              <SelectItem value="own">เฉพาะของตัวเอง</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-center">
                          {isSelf ? (
                            <span className="text-muted-foreground/40"><Check className="h-4 w-4 inline" /></span>
                          ) : (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleRemove(m.userId, m.email)}
                              className="h-7 w-7 text-destructive hover:bg-destructive/10"
                              title="นำออกจากองค์กร"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Feature access matrix (per-role) */}
      <Card className="border-border/50 bg-card/50">
        <CardContent className="pt-4">
          <div className="text-sm font-bold mb-1">สิทธิ์การเข้าถึงเมนู (ตาม Role)</div>
          <p className="text-xs text-muted-foreground mb-4">
            เลือก role แล้วกำหนดว่าแต่ละเมนู <span className="font-semibold">ซ่อน / ดูอย่างเดียว / แก้ไขได้</span> —
            เจ้าของ (Owner) เห็นและแก้ได้ทุกเมนูเสมอ
          </p>

          {/* role selector */}
          <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border/60 p-1 bg-card/40 w-fit mb-4">
            {PERM_ROLES.map((r) => (
              <Button
                key={r}
                variant={permRole === r ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setPermRole(r)}
                className="h-8 text-xs"
              >
                {ROLE_LABELS[r]}
              </Button>
            ))}
          </div>

          <div className="space-y-4">
            {Object.entries(featureGroups).map(([group, feats]) => (
              <div key={group}>
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-1.5">
                  {group}
                </div>
                <div className="space-y-1.5">
                  {feats.map((f) => {
                    const current = resolveAccess(featureMatrix, permRole, f.key);
                    return (
                      <div key={f.key} className="flex items-center justify-between gap-3 rounded-md border border-border/40 px-3 py-2">
                        <span className="text-sm">{f.label}</span>
                        <div className="flex items-center gap-0.5 rounded-lg border border-border/60 p-0.5 bg-card">
                          {ACCESS_LEVELS.map((lvl) => (
                            <Button
                              key={lvl.value}
                              variant={current === lvl.value ? "secondary" : "ghost"}
                              size="sm"
                              onClick={() => handleAccess(f.key, lvl.value)}
                              className="h-7 text-xs px-2.5"
                            >
                              {lvl.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
