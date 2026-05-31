"use client";

import React, { useMemo, useState } from "react";
import { Employee, PositionRate } from "@/lib/types";
import { employeeMonthlyCost } from "@/lib/cashflow";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Edit2, Users, Search } from "lucide-react";
import { EditGate } from "@/components/project-cost/edit-gate";
import { toast } from "sonner";

interface MasterEmployeesViewProps {
  employees: Employee[];
  positions: PositionRate[];
  onAddEmployee: (item: Omit<Employee, "id">) => void;
  onUpdateEmployee: (item: Employee) => void;
  onDeleteEmployee: (id: string) => void;
}

const todayISO = () => new Date().toISOString().split("T")[0];

export function MasterEmployeesView({
  employees,
  positions,
  onAddEmployee,
  onUpdateEmployee,
  onDeleteEmployee,
}: MasterEmployeesViewProps) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Form state — shared between Add/Edit
  const [name, setName] = useState("");
  const [positionId, setPositionId] = useState<string>("");
  const [monthlySalary, setMonthlySalary] = useState<number>(0);
  const [benefitPercent, setBenefitPercent] = useState<number>(15);
  const [socialSecurityAmount, setSocialSecurityAmount] = useState<number>(750);
  const [startDate, setStartDate] = useState<string>(todayISO());
  const [endDate, setEndDate] = useState<string>("");
  const [annualBonus, setAnnualBonus] = useState<number>(0);
  const [notes, setNotes] = useState<string>("");

  const resetForm = () => {
    setName("");
    setPositionId("");
    setMonthlySalary(0);
    setBenefitPercent(15);
    setSocialSecurityAmount(750);
    setStartDate(todayISO());
    setEndDate("");
    setAnnualBonus(0);
    setNotes("");
  };

  const fmt = (v: number) =>
    new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(v);

  const positionTitleById = useMemo(() => {
    const map = new Map<string, string>();
    positions.forEach((p) => map.set(p.id, p.title));
    return map;
  }, [positions]);

  const today = todayISO();
  const isActive = (e: Employee) => {
    if (e.startDate && today < e.startDate) return false;
    if (e.endDate && today > e.endDate) return false;
    return true;
  };

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        (e.positionId && positionTitleById.get(e.positionId)?.toLowerCase().includes(q))
    );
  }, [employees, searchQuery, positionTitleById]);

  // Sort: active first, then by start date desc
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aActive = isActive(a) ? 1 : 0;
      const bActive = isActive(b) ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;
      return b.startDate.localeCompare(a.startDate);
    });
  }, [filtered]);

  // Aggregate stats
  const activeEmployees = employees.filter(isActive);
  const totalMonthlyPayroll = activeEmployees.reduce((s, e) => s + employeeMonthlyCost(e), 0);
  const totalAnnualBonus = activeEmployees.reduce((s, e) => s + (e.annualBonus || 0), 0);
  const totalAnnualPayroll = totalMonthlyPayroll * 12 + totalAnnualBonus;

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAddEmployee({
      name: name.trim(),
      positionId: positionId || undefined,
      monthlySalary,
      benefitPercent,
      socialSecurityAmount,
      startDate,
      endDate: endDate || undefined,
      annualBonus: annualBonus || undefined,
      notes: notes.trim() || undefined,
    });
    resetForm();
    setIsAddOpen(false);
    toast.success("เพิ่มพนักงานเข้าระบบเรียบร้อย");
  };

  const handleStartEdit = (emp: Employee) => {
    setEditing(emp);
    setName(emp.name);
    setPositionId(emp.positionId ?? "");
    setMonthlySalary(emp.monthlySalary);
    setBenefitPercent(emp.benefitPercent);
    setSocialSecurityAmount(emp.socialSecurityAmount);
    setStartDate(emp.startDate);
    setEndDate(emp.endDate ?? "");
    setAnnualBonus(emp.annualBonus ?? 0);
    setNotes(emp.notes ?? "");
    setIsEditOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !name.trim()) return;
    onUpdateEmployee({
      ...editing,
      name: name.trim(),
      positionId: positionId || undefined,
      monthlySalary,
      benefitPercent,
      socialSecurityAmount,
      startDate,
      endDate: endDate || undefined,
      annualBonus: annualBonus || undefined,
      notes: notes.trim() || undefined,
    });
    setIsEditOpen(false);
    setEditing(null);
    toast.success("อัปเดตข้อมูลพนักงานเรียบร้อย");
  };

  const handleDelete = (emp: Employee) => {
    if (confirm(`ลบพนักงาน "${emp.name}" ใช่หรือไม่?\nข้อมูลจะหายไปถาวร`)) {
      onDeleteEmployee(emp.id);
      toast.success("ลบพนักงานเรียบร้อย");
    }
  };

  // Reusable form body (Add + Edit)
  const renderFormBody = () => (
    <div className="grid gap-4 py-4">
      <div className="grid gap-2">
        <Label htmlFor="emp-name">ชื่อ-นามสกุล</Label>
        <Input id="emp-name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="emp-position">ตำแหน่ง (optional)</Label>
          <Select value={positionId || "_none"} onValueChange={(v) => setPositionId(v === "_none" ? "" : v)}>
            <SelectTrigger id="emp-position">
              <SelectValue placeholder="-- เลือก --" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">— ไม่ระบุ —</SelectItem>
              {positions.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="emp-salary">เงินเดือน (฿/เดือน)</Label>
          <Input
            id="emp-salary"
            type="number"
            min={0}
            value={monthlySalary}
            onChange={(e) => setMonthlySalary(Number(e.target.value) || 0)}
            required
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="emp-benefit">สวัสดิการ (%)</Label>
          <Input
            id="emp-benefit"
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={benefitPercent}
            onChange={(e) => setBenefitPercent(Number(e.target.value) || 0)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="emp-sso">ประกันสังคม (฿/เดือน)</Label>
          <Input
            id="emp-sso"
            type="number"
            min={0}
            value={socialSecurityAmount}
            onChange={(e) => setSocialSecurityAmount(Number(e.target.value) || 0)}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="emp-start">วันเริ่มงาน</Label>
          <Input
            id="emp-start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="emp-end">วันลาออก (optional)</Label>
          <Input
            id="emp-end"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="emp-bonus">โบนัสประจำปี (฿) — จ่ายเดือน ธ.ค.</Label>
        <Input
          id="emp-bonus"
          type="number"
          min={0}
          value={annualBonus}
          onChange={(e) => setAnnualBonus(Number(e.target.value) || 0)}
          placeholder="0 = ไม่มี"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="emp-notes">หมายเหตุ</Label>
        <Textarea id="emp-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>
      <div className="text-[11px] text-muted-foreground bg-muted/40 p-3 rounded-lg">
        <strong>ต้นทุนรวม/เดือน:</strong>{" "}
        <span className="font-mono font-bold text-primary">
          ฿{fmt(monthlySalary * (1 + benefitPercent / 100) + socialSecurityAmount)}
        </span>
        <br />
        <span className="text-[10px]">
          = เงินเดือน × (1 + สวัสดิการ%) + ประกันสังคม
        </span>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> รายชื่อพนักงาน
          </h2>
          <p className="text-sm text-muted-foreground">
            จัดการรายชื่อพนักงานจริงพร้อมเงินเดือน — ใช้คำนวณ payroll ใน cashflow
          </p>
        </div>

        <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) resetForm(); }}>
          <EditGate>
            <DialogTrigger asChild>
              <Button className="gap-2 font-semibold">
                <Plus className="h-4 w-4" /> เพิ่มพนักงาน
              </Button>
            </DialogTrigger>
          </EditGate>
          <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleAddSubmit}>
              <DialogHeader>
                <DialogTitle>เพิ่มพนักงานใหม่</DialogTitle>
                <DialogDescription>ระบุข้อมูลและวันเริ่มงาน — ใช้คำนวณ cashflow ตั้งแต่วันนั้นเป็นต้นไป</DialogDescription>
              </DialogHeader>
              {renderFormBody()}
              <DialogFooter>
                <Button type="submit">เพิ่มพนักงาน</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-4">
            <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">พนักงานปัจจุบัน</div>
            <div className="text-2xl font-black">{activeEmployees.length}</div>
            <div className="text-[11px] text-muted-foreground">คน</div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-4">
            <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">Payroll/เดือน</div>
            <div className="text-lg font-black text-primary font-mono">฿{fmt(totalMonthlyPayroll)}</div>
            <div className="text-[11px] text-muted-foreground">รวมสวัสดิการ + สังคม</div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-4">
            <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">โบนัสประจำปี</div>
            <div className="text-lg font-black text-amber-600 font-mono">฿{fmt(totalAnnualBonus)}</div>
            <div className="text-[11px] text-muted-foreground">รวมโบนัส (ธ.ค.)</div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-4">
            <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">รวมต่อปี</div>
            <div className="text-lg font-black text-rose-600 font-mono">฿{fmt(totalAnnualPayroll)}</div>
            <div className="text-[11px] text-muted-foreground">payroll × 12 + bonus</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="ค้นหาชื่อพนักงาน หรือตำแหน่ง..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 max-w-md"
        />
      </div>

      {/* Table */}
      <Card className="border-border/50 bg-card/50">
        <CardContent className="pt-4">
          <div className="overflow-x-auto -mx-2 sm:mx-0">
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[160px]">ชื่อ-นามสกุล</TableHead>
                  <TableHead className="hidden md:table-cell">ตำแหน่ง</TableHead>
                  <TableHead className="text-right">เงินเดือน</TableHead>
                  <TableHead className="text-right hidden lg:table-cell">รวม/เดือน</TableHead>
                  <TableHead className="hidden md:table-cell">วันเริ่มงาน</TableHead>
                  <TableHead className="text-center">สถานะ</TableHead>
                  <TableHead className="text-center w-[100px]">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground text-sm">
                      {searchQuery
                        ? "ไม่พบพนักงานที่ตรงกับเงื่อนไข"
                        : "ยังไม่มีพนักงานในระบบ กดปุ่ม 'เพิ่มพนักงาน' เพื่อเริ่มต้น"}
                    </TableCell>
                  </TableRow>
                ) : (
                  sorted.map((emp) => {
                    const active = isActive(emp);
                    const total = employeeMonthlyCost(emp);
                    return (
                      <TableRow key={emp.id} className={active ? "hover:bg-muted/30" : "opacity-60 hover:bg-muted/20"}>
                        <TableCell>
                          <div className="font-semibold text-sm">{emp.name}</div>
                          <div className="text-[11px] text-muted-foreground md:hidden">
                            {emp.positionId ? positionTitleById.get(emp.positionId) ?? "—" : "—"}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                          {emp.positionId ? positionTitleById.get(emp.positionId) ?? "—" : <span className="italic">—</span>}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          ฿{fmt(emp.monthlySalary)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs hidden lg:table-cell text-primary font-bold">
                          ฿{fmt(total)}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs font-mono">
                          {emp.startDate}
                          {emp.endDate && <div className="text-[10px] text-rose-500">→ {emp.endDate}</div>}
                        </TableCell>
                        <TableCell className="text-center">
                          {active ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium border bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-900">
                              ทำงาน
                            </span>
                          ) : emp.endDate && today > emp.endDate ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium border bg-slate-100 text-slate-700 border-slate-200">
                              ลาออก
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium border bg-blue-100 text-blue-800 border-blue-200">
                              จะเริ่ม
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <EditGate fallback={<span className="text-muted-foreground/40">—</span>}>
                            <div className="flex justify-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleStartEdit(emp)}
                                className="h-7 w-7"
                                title="แก้ไข"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDelete(emp)}
                                className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                title="ลบ"
                              >
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
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
          {editing && (
            <form onSubmit={handleEditSubmit}>
              <DialogHeader>
                <DialogTitle>แก้ไขข้อมูลพนักงาน</DialogTitle>
                <DialogDescription>ปรับเงินเดือน วันที่ หรือสถานะการทำงาน</DialogDescription>
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
