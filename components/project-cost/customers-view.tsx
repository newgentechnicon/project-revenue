"use client";

import React, { useMemo, useState } from "react";
import { Customer, Subscription, Project } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Edit2, Building2, Search, DownloadCloud } from "lucide-react";
import { EditGate } from "@/components/project-cost/edit-gate";
import { toast } from "sonner";

interface CustomersViewProps {
  customers: Customer[];
  subscriptions: Subscription[];
  projects: Project[];
  onAddCustomer: (item: Omit<Customer, "id">) => void;
  onUpdateCustomer: (item: Customer) => void;
  onDeleteCustomer: (id: string) => void;
  onImportFromExisting: () => number;
}

export function CustomersView({
  customers,
  subscriptions,
  projects,
  onAddCustomer,
  onUpdateCustomer,
  onDeleteCustomer,
  onImportFromExisting,
}: CustomersViewProps) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Form state
  const [name, setName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [address, setAddress] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [active, setActive] = useState(true);
  const [notes, setNotes] = useState("");
  const [tagsText, setTagsText] = useState("");

  const resetForm = () => {
    setName("");
    setTaxId("");
    setAddress("");
    setContactPerson("");
    setContactEmail("");
    setContactPhone("");
    setActive(true);
    setNotes("");
    setTagsText("");
  };

  const buildPayload = (): Omit<Customer, "id"> => {
    const tags = tagsText.split(",").map((t) => t.trim()).filter(Boolean);
    return {
      name: name.trim(),
      taxId: taxId.trim() || undefined,
      address: address.trim() || undefined,
      contactPerson: contactPerson.trim() || undefined,
      contactEmail: contactEmail.trim() || undefined,
      contactPhone: contactPhone.trim() || undefined,
      active,
      notes: notes.trim() || undefined,
      tags: tags.length > 0 ? tags : undefined,
    };
  };

  // จำนวนรายการที่อ้างอิงลูกค้าแต่ละราย (subscription + project)
  const usageById = useMemo(() => {
    const map = new Map<string, { subs: number; projects: number }>();
    for (const s of subscriptions) {
      if (!s.customerId) continue;
      const cur = map.get(s.customerId) ?? { subs: 0, projects: 0 };
      cur.subs++;
      map.set(s.customerId, cur);
    }
    for (const p of projects) {
      if (!p.customerId) continue;
      const cur = map.get(p.customerId) ?? { subs: 0, projects: 0 };
      cur.projects++;
      map.set(p.customerId, cur);
    }
    return map;
  }, [subscriptions, projects]);

  // จำนวนลูกค้าที่ยังฝังอยู่และยังไม่ถูกแยกออกมา (สำหรับปุ่ม import)
  const unlinkedCount = useMemo(() => {
    const subs = subscriptions.filter((s) => !s.customerId && s.customer.name.trim()).length;
    const projs = projects.filter((p) => !p.customerId && p.client.name.trim()).length;
    return subs + projs;
  }, [subscriptions, projects]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.taxId ?? "").includes(q) ||
        (c.tags ?? []).some((t) => t.toLowerCase().includes(q))
    );
  }, [customers, searchQuery]);

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return a.name.localeCompare(b.name, "th");
    }),
    [filtered]
  );

  const activeCount = customers.filter((c) => c.active).length;

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAddCustomer(buildPayload());
    resetForm();
    setIsAddOpen(false);
    toast.success("เพิ่มลูกค้าเรียบร้อย");
  };

  const handleStartEdit = (c: Customer) => {
    setEditing(c);
    setName(c.name);
    setTaxId(c.taxId ?? "");
    setAddress(c.address ?? "");
    setContactPerson(c.contactPerson ?? "");
    setContactEmail(c.contactEmail ?? "");
    setContactPhone(c.contactPhone ?? "");
    setActive(c.active);
    setNotes(c.notes ?? "");
    setTagsText((c.tags ?? []).join(", "));
    setIsEditOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !name.trim()) return;
    onUpdateCustomer({ ...editing, ...buildPayload() });
    setIsEditOpen(false);
    setEditing(null);
    toast.success("อัปเดตข้อมูลลูกค้าเรียบร้อย");
  };

  const handleDelete = (c: Customer) => {
    const usage = usageById.get(c.id);
    const used = usage ? usage.subs + usage.projects : 0;
    const warn = used > 0
      ? `\n\n⚠ มี ${used} รายการที่อ้างอิงลูกค้านี้อยู่ — รายการเหล่านั้นจะยังมี snapshot ข้อมูลเดิมแต่จะไม่เชื่อมกับ master อีก`
      : "";
    if (confirm(`ลบลูกค้า "${c.name}" ใช่หรือไม่?${warn}`)) {
      onDeleteCustomer(c.id);
      toast.success("ลบลูกค้าเรียบร้อย");
    }
  };

  const handleImport = () => {
    const n = onImportFromExisting();
    if (n > 0) toast.success(`ดึงลูกค้าใหม่ ${n} รายเข้า master + ผูกรายการให้แล้ว`);
    else toast.info("ไม่มีลูกค้าใหม่ให้ดึง (ทุกรายการเชื่อมกับ master แล้ว)");
  };

  const renderFormBody = () => (
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="cust-name">ชื่อบริษัท</Label>
          <Input id="cust-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="cust-tax">เลขผู้เสียภาษี</Label>
          <Input id="cust-tax" value={taxId} onChange={(e) => setTaxId(e.target.value)} maxLength={13} />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="cust-address">ที่อยู่</Label>
        <Textarea id="cust-address" value={address} onChange={(e) => setAddress(e.target.value)} rows={2} />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="cust-person">ผู้ติดต่อ</Label>
          <Input id="cust-person" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="cust-email">อีเมล</Label>
          <Input id="cust-email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="cust-phone">เบอร์โทร</Label>
          <Input id="cust-phone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="cust-tags">Tags (คั่นด้วยจุลภาค)</Label>
        <Input id="cust-tags" value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="เช่น VIP, สำนักงานบัญชี, กรุงเทพ" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="cust-notes">หมายเหตุ</Label>
        <Textarea id="cust-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>
      <div className="flex items-center gap-2">
        <Switch id="cust-active" checked={active} onCheckedChange={setActive} />
        <Label htmlFor="cust-active" className="cursor-pointer">ลูกค้ายังใช้งานอยู่ (active)</Label>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" /> ลูกค้า
          </h2>
          <p className="text-sm text-muted-foreground">
            ข้อมูลลูกค้ากลาง — ใช้อ้างอิงในรายรับประจำและใบเสนอราคา เก็บครั้งเดียวใช้ได้ทุกที่
          </p>
        </div>

        <div className="flex items-center gap-2">
          {unlinkedCount > 0 && (
            <Button variant="outline" className="gap-2" onClick={handleImport} title="สร้าง master จากลูกค้าที่ฝังอยู่ในรายการเดิม">
              <DownloadCloud className="h-4 w-4" /> ดึงลูกค้าเดิม ({unlinkedCount})
            </Button>
          )}
          <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) resetForm(); }}>
            <EditGate>
              <DialogTrigger asChild>
                <Button className="gap-2 font-semibold">
                  <Plus className="h-4 w-4" /> เพิ่มลูกค้า
                </Button>
              </DialogTrigger>
            </EditGate>
            <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
              <form onSubmit={handleAddSubmit}>
                <DialogHeader>
                  <DialogTitle>เพิ่มลูกค้าใหม่</DialogTitle>
                  <DialogDescription>ข้อมูลนี้จะใช้อ้างอิงได้ในรายรับประจำและใบเสนอราคา</DialogDescription>
                </DialogHeader>
                {renderFormBody()}
                <DialogFooter>
                  <Button type="submit">เพิ่มลูกค้า</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-4">
            <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">ลูกค้าทั้งหมด</div>
            <div className="text-2xl font-black">{customers.length}</div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-4">
            <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">ใช้งานอยู่</div>
            <div className="text-2xl font-black text-emerald-600">{activeCount}</div>
          </CardContent>
        </Card>
        <Card className={unlinkedCount > 0 ? "border-amber-300 bg-amber-50/60 dark:bg-amber-950/20" : "border-border/50 bg-card/50"}>
          <CardContent className="pt-4">
            <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">ยังไม่ได้แยก master</div>
            <div className={`text-2xl font-black ${unlinkedCount > 0 ? "text-amber-600" : ""}`}>{unlinkedCount}</div>
            <div className="text-[11px] text-muted-foreground">รายการที่ฝังลูกค้าไว้ตรงๆ</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="ค้นหาชื่อ เลขภาษี หรือ tag..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 max-w-md"
        />
      </div>

      {/* Table */}
      <Card className="border-border/50 bg-card/50">
        <CardContent className="pt-4">
          <div className="overflow-x-auto -mx-2 sm:mx-0">
            <Table className="min-w-[760px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">บริษัท</TableHead>
                  <TableHead className="hidden md:table-cell">ผู้ติดต่อ</TableHead>
                  <TableHead className="hidden lg:table-cell">Tags</TableHead>
                  <TableHead className="text-center">การใช้งาน</TableHead>
                  <TableHead className="text-center">สถานะ</TableHead>
                  <TableHead className="text-center w-[100px]">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground text-sm">
                      {searchQuery
                        ? "ไม่พบลูกค้าที่ตรงกับเงื่อนไข"
                        : unlinkedCount > 0
                          ? "ยังไม่มีลูกค้าใน master — กด 'ดึงลูกค้าเดิม' เพื่อแยกจากรายการที่มีอยู่ หรือ 'เพิ่มลูกค้า'"
                          : "ยังไม่มีลูกค้า กดปุ่ม 'เพิ่มลูกค้า' เพื่อเริ่มต้น"}
                    </TableCell>
                  </TableRow>
                ) : (
                  sorted.map((c) => {
                    const usage = usageById.get(c.id);
                    const used = usage ? usage.subs + usage.projects : 0;
                    return (
                      <TableRow key={c.id} className={c.active ? "hover:bg-muted/30" : "opacity-60 hover:bg-muted/20"}>
                        <TableCell>
                          <div className="font-semibold text-sm">{c.name}</div>
                          {c.taxId && <div className="text-[11px] text-muted-foreground font-mono">{c.taxId}</div>}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                          {c.contactPerson ? (
                            <>
                              <div>{c.contactPerson}</div>
                              {c.contactPhone && <div className="text-[10px]">{c.contactPhone}</div>}
                            </>
                          ) : (
                            <span className="italic">—</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="flex flex-wrap gap-1">
                            {(c.tags ?? []).map((t) => (
                              <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/60">
                                {t}
                              </span>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-xs text-muted-foreground">
                          {used > 0 ? (
                            <span title={`subscription ${usage?.subs ?? 0} · project ${usage?.projects ?? 0}`}>
                              {usage?.subs ?? 0}+{usage?.projects ?? 0}
                            </span>
                          ) : (
                            <span className="italic">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {c.active ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium border bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-900">
                              active
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium border bg-slate-100 text-slate-700 border-slate-200">
                              inactive
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <EditGate fallback={<span className="text-muted-foreground/40">—</span>}>
                            <div className="flex justify-center gap-1">
                              <Button size="icon" variant="ghost" onClick={() => handleStartEdit(c)} className="h-7 w-7" title="แก้ไข">
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => handleDelete(c)} className="h-7 w-7 text-destructive hover:bg-destructive/10" title="ลบ">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </EditGate>
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

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={(open) => { setIsEditOpen(open); if (!open) { setEditing(null); resetForm(); } }}>
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
          {editing && (
            <form onSubmit={handleEditSubmit}>
              <DialogHeader>
                <DialogTitle>แก้ไขข้อมูลลูกค้า</DialogTitle>
                <DialogDescription>การแก้ไขที่นี่ไม่กระทบ snapshot เดิมในรายการที่ขายไปแล้ว</DialogDescription>
              </DialogHeader>
              {renderFormBody()}
              <DialogFooter>
                <Button type="submit">บันทึก</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
