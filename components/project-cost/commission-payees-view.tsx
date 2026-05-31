"use client";

import React, { useMemo, useState } from "react";
import { CommissionPayee, PayeeType, Employee } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Edit2, Handshake, Search } from "lucide-react";
import { EditGate } from "@/components/project-cost/edit-gate";
import { toast } from "sonner";

interface CommissionPayeesViewProps {
  payees: CommissionPayee[];
  employees: Employee[];
  onAddPayee: (item: Omit<CommissionPayee, "id">) => void;
  onUpdatePayee: (item: CommissionPayee) => void;
  onDeletePayee: (id: string) => void;
}

const typeLabel: Record<PayeeType, string> = {
  employee: "พนักงาน",
  partner: "พาร์ทเนอร์/รีเซลเลอร์",
};

const NO_EMPLOYEE = "_none";

export function CommissionPayeesView({
  payees,
  employees,
  onAddPayee,
  onUpdatePayee,
  onDeletePayee,
}: CommissionPayeesViewProps) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editing, setEditing] = useState<CommissionPayee | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [name, setName] = useState("");
  const [type, setType] = useState<PayeeType>("partner");
  const [employeeId, setEmployeeId] = useState<string>("");
  const [defaultRatePercent, setDefaultRatePercent] = useState<number>(0);
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [active, setActive] = useState(true);
  const [notes, setNotes] = useState("");

  const employeeById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);

  const resetForm = () => {
    setName("");
    setType("partner");
    setEmployeeId("");
    setDefaultRatePercent(0);
    setContactEmail("");
    setContactPhone("");
    setActive(true);
    setNotes("");
  };

  const buildPayload = (): Omit<CommissionPayee, "id"> => ({
    name: name.trim(),
    type,
    employeeId: type === "employee" && employeeId ? employeeId : undefined,
    defaultRatePercent: defaultRatePercent > 0 ? defaultRatePercent : undefined,
    contactEmail: contactEmail.trim() || undefined,
    contactPhone: contactPhone.trim() || undefined,
    active,
    notes: notes.trim() || undefined,
  });

  const handleEmployeeChange = (v: string) => {
    if (v === NO_EMPLOYEE) {
      setEmployeeId("");
      return;
    }
    setEmployeeId(v);
    const emp = employeeById.get(v);
    if (emp && !name.trim()) setName(emp.name);
  };

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return payees;
    return payees.filter((p) => p.name.toLowerCase().includes(q));
  }, [payees, searchQuery]);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAddPayee(buildPayload());
    resetForm();
    setIsAddOpen(false);
    toast.success("เพิ่มผู้รับคอมเรียบร้อย");
  };

  const handleStartEdit = (p: CommissionPayee) => {
    setEditing(p);
    setName(p.name);
    setType(p.type);
    setEmployeeId(p.employeeId ?? "");
    setDefaultRatePercent(p.defaultRatePercent ?? 0);
    setContactEmail(p.contactEmail ?? "");
    setContactPhone(p.contactPhone ?? "");
    setActive(p.active);
    setNotes(p.notes ?? "");
    setIsEditOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !name.trim()) return;
    onUpdatePayee({ ...editing, ...buildPayload() });
    setIsEditOpen(false);
    setEditing(null);
    toast.success("อัปเดตผู้รับคอมเรียบร้อย");
  };

  const handleDelete = (p: CommissionPayee) => {
    if (confirm(`ลบผู้รับคอม "${p.name}" ใช่หรือไม่?\nรายการคอมที่ผูกไว้จะยังอยู่แต่จะหาชื่อไม่เจอ`)) {
      onDeletePayee(p.id);
      toast.success("ลบผู้รับคอมเรียบร้อย");
    }
  };

  const renderFormBody = () => (
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="payee-type">ประเภท</Label>
          <Select value={type} onValueChange={(v) => setType(v as PayeeType)}>
            <SelectTrigger id="payee-type"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="partner">พาร์ทเนอร์/รีเซลเลอร์</SelectItem>
              <SelectItem value="employee">พนักงาน</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="payee-rate">เรตคอมตั้งต้น (%)</Label>
          <Input
            id="payee-rate"
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={defaultRatePercent}
            onChange={(e) => setDefaultRatePercent(Number(e.target.value) || 0)}
          />
        </div>
      </div>

      {type === "employee" && employees.length > 0 && (
        <div className="grid gap-2">
          <Label htmlFor="payee-emp">ผูกกับพนักงาน (optional)</Label>
          <Select value={employeeId || NO_EMPLOYEE} onValueChange={handleEmployeeChange}>
            <SelectTrigger id="payee-emp"><SelectValue placeholder="-- เลือก --" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_EMPLOYEE}>— ไม่ระบุ —</SelectItem>
              {employees.map((emp) => (
                <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid gap-2">
        <Label htmlFor="payee-name">ชื่อผู้รับคอม</Label>
        <Input id="payee-name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="payee-email">อีเมล</Label>
          <Input id="payee-email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="payee-phone">เบอร์โทร</Label>
          <Input id="payee-phone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="payee-notes">หมายเหตุ</Label>
        <Textarea id="payee-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>

      <div className="flex items-center gap-2">
        <Switch id="payee-active" checked={active} onCheckedChange={setActive} />
        <Label htmlFor="payee-active" className="cursor-pointer">ยังใช้งานอยู่ (active)</Label>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Handshake className="h-6 w-6 text-primary" /> ผู้รับคอม
          </h2>
          <p className="text-sm text-muted-foreground">
            พนักงานขายภายในและพาร์ทเนอร์/รีเซลเลอร์ — ใช้ผูกกับรายการค่าคอมมิชชั่น
          </p>
        </div>

        <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) resetForm(); }}>
          <EditGate>
            <DialogTrigger asChild>
              <Button className="gap-2 font-semibold">
                <Plus className="h-4 w-4" /> เพิ่มผู้รับคอม
              </Button>
            </DialogTrigger>
          </EditGate>
          <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleAddSubmit}>
              <DialogHeader>
                <DialogTitle>เพิ่มผู้รับคอมใหม่</DialogTitle>
                <DialogDescription>กำหนดประเภทและเรตคอมตั้งต้น (prefill ตอนสร้างรายการคอม)</DialogDescription>
              </DialogHeader>
              {renderFormBody()}
              <DialogFooter>
                <Button type="submit">เพิ่มผู้รับคอม</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="ค้นหาผู้รับคอม..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 max-w-md"
        />
      </div>

      <Card className="border-border/50 bg-card/50">
        <CardContent className="pt-4">
          <div className="overflow-x-auto -mx-2 sm:mx-0">
            <Table className="min-w-[620px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px]">ชื่อ</TableHead>
                  <TableHead>ประเภท</TableHead>
                  <TableHead className="text-right">เรตตั้งต้น</TableHead>
                  <TableHead className="hidden md:table-cell">ติดต่อ</TableHead>
                  <TableHead className="text-center">สถานะ</TableHead>
                  <TableHead className="text-center w-[100px]">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground text-sm">
                      {searchQuery ? "ไม่พบผู้รับคอมที่ตรงกับเงื่อนไข" : "ยังไม่มีผู้รับคอม กดปุ่ม 'เพิ่มผู้รับคอม' เพื่อเริ่มต้น"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((p) => (
                    <TableRow key={p.id} className={p.active ? "hover:bg-muted/30" : "opacity-60 hover:bg-muted/20"}>
                      <TableCell className="font-semibold text-sm">{p.name}</TableCell>
                      <TableCell className="text-xs">{typeLabel[p.type]}</TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {p.defaultRatePercent ? `${p.defaultRatePercent}%` : <span className="text-muted-foreground italic">—</span>}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {p.contactEmail || p.contactPhone || <span className="italic">—</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        {p.active ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium border bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-900">active</span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium border bg-slate-100 text-slate-700 border-slate-200">inactive</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <EditGate fallback={<span className="text-muted-foreground/40">—</span>}>
                          <div className="flex justify-center gap-1">
                            <Button size="icon" variant="ghost" onClick={() => handleStartEdit(p)} className="h-7 w-7" title="แก้ไข">
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => handleDelete(p)} className="h-7 w-7 text-destructive hover:bg-destructive/10" title="ลบ">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </EditGate>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isEditOpen} onOpenChange={(open) => { setIsEditOpen(open); if (!open) { setEditing(null); resetForm(); } }}>
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
          {editing && (
            <form onSubmit={handleEditSubmit}>
              <DialogHeader>
                <DialogTitle>แก้ไขผู้รับคอม</DialogTitle>
                <DialogDescription>ปรับประเภท เรตตั้งต้น หรือข้อมูลติดต่อ</DialogDescription>
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
