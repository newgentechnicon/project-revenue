"use client";

import React, { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Loan, LoanLenderType, LoanStatus, LoanRepayment, RepaymentStatus } from "@/lib/types";
import {
  summarizeLoans, outstandingPrincipal, principalPaid, interestPaid,
  scheduledUnpaid, isRepaymentPaid, sortRepayments, newRepaymentId,
  LOAN_LENDER_TYPE_LABELS, LOAN_STATUS_LABELS,
} from "@/lib/loans";
import { EditGate } from "@/components/project-cost/edit-gate";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Plus, Trash2, Edit2, Landmark, ListChecks, Info,
  TrendingDown, Wallet, Coins, Receipt, CheckCircle2, Circle, CalendarClock,
} from "lucide-react";
import { toast } from "sonner";

interface LoansViewProps {
  loans: Loan[];
  onAddLoan: (item: Omit<Loan, "id">) => void;
  onUpdateLoan: (updated: Loan) => void;
  onDeleteLoan: (id: string) => void;
}

const fmt = (v: number) => new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(v);
const todayISO = () => new Date().toISOString().split("T")[0];

const LENDER_TYPES: LoanLenderType[] = ["bank", "related_company", "individual", "other"];

export function LoansView({ loans, onAddLoan, onUpdateLoan, onDeleteLoan }: LoansViewProps) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editing, setEditing] = useState<Loan | null>(null);
  const [manageId, setManageId] = useState<string | null>(null);

  // Loan form state
  const [lender, setLender] = useState("");
  const [lenderType, setLenderType] = useState<LoanLenderType>("bank");
  const [principal, setPrincipal] = useState(0);
  const [annualInterestRate, setAnnualInterestRate] = useState(0);
  const [startDate, setStartDate] = useState(todayISO());
  const [termMonths, setTermMonths] = useState<number>(0);
  const [reference, setReference] = useState("");
  const [status, setStatus] = useState<LoanStatus>("active");
  const [notes, setNotes] = useState("");

  // Repayment form state
  const [rpDate, setRpDate] = useState(todayISO());
  const [rpPrincipal, setRpPrincipal] = useState(0);
  const [rpInterest, setRpInterest] = useState(0);
  const [rpStatus, setRpStatus] = useState<RepaymentStatus>("pending");
  const [rpNote, setRpNote] = useState("");

  // Generate-schedule form state (ทำตารางผ่อนล่วงหน้า)
  const [genCount, setGenCount] = useState(6);
  const [genFirstDate, setGenFirstDate] = useState(todayISO());
  const [genInterestPerPeriod, setGenInterestPerPeriod] = useState(0);

  const summary = useMemo(() => summarizeLoans(loans), [loans]);
  const sortedLoans = useMemo(
    () => [...loans].sort((a, b) => b.startDate.localeCompare(a.startDate)),
    [loans]
  );
  const manageLoan = manageId ? loans.find((l) => l.id === manageId) ?? null : null;

  const resetForm = () => {
    setLender("");
    setLenderType("bank");
    setPrincipal(0);
    setAnnualInterestRate(0);
    setStartDate(todayISO());
    setTermMonths(0);
    setReference("");
    setStatus("active");
    setNotes("");
  };

  const buildPayload = (): Omit<Loan, "id" | "repayments"> => ({
    lender: lender.trim(),
    lenderType,
    principal,
    annualInterestRate,
    startDate,
    termMonths: termMonths > 0 ? termMonths : undefined,
    reference: reference.trim() || undefined,
    status,
    notes: notes.trim() || undefined,
  });

  const handleOpenAdd = (open: boolean) => {
    setIsAddOpen(open);
    if (open) resetForm();
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lender.trim()) { toast.error("กรุณาระบุชื่อเจ้าหนี้/ผู้ให้กู้"); return; }
    if (principal <= 0) { toast.error("กรุณาระบุเงินต้นมากกว่า 0"); return; }
    onAddLoan({ ...buildPayload(), repayments: [] });
    setIsAddOpen(false);
    resetForm();
    toast.success("บันทึกเงินกู้เรียบร้อย");
  };

  const handleStartEdit = (loan: Loan) => {
    setEditing(loan);
    setLender(loan.lender);
    setLenderType(loan.lenderType);
    setPrincipal(loan.principal);
    setAnnualInterestRate(loan.annualInterestRate);
    setStartDate(loan.startDate);
    setTermMonths(loan.termMonths ?? 0);
    setReference(loan.reference ?? "");
    setStatus(loan.status);
    setNotes(loan.notes ?? "");
    setIsEditOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    if (!lender.trim()) { toast.error("กรุณาระบุชื่อเจ้าหนี้/ผู้ให้กู้"); return; }
    if (principal <= 0) { toast.error("กรุณาระบุเงินต้นมากกว่า 0"); return; }
    onUpdateLoan({ ...editing, ...buildPayload() });
    setIsEditOpen(false);
    setEditing(null);
    resetForm();
    toast.success("อัปเดตเงินกู้เรียบร้อย");
  };

  const handleDelete = (loan: Loan) => {
    if (!confirm(`ลบเงินกู้จาก "${loan.lender}" ใช่หรือไม่? (ประวัติการผ่อนจะถูกลบด้วย)`)) return;
    onDeleteLoan(loan.id);
    toast.success("ลบเงินกู้เรียบร้อย");
  };

  const resetRepaymentForm = () => {
    setRpDate(todayISO());
    setRpPrincipal(0);
    setRpInterest(0);
    setRpStatus("pending");
    setRpNote("");
  };

  // คืน loan ที่อัปเดต repayments + sync สถานะก้อน (ปิดยอดเมื่อจ่ายเงินต้นครบ)
  const withSyncedStatus = (loan: Loan, repayments: LoanRepayment[]): Loan => {
    const paidPrincipal = repayments.reduce(
      (s, r) => s + (isRepaymentPaid(r) ? r.principal || 0 : 0),
      0
    );
    const status: LoanStatus =
      loan.principal > 0 && paidPrincipal >= loan.principal ? "paid_off" : "active";
    return { ...loan, repayments, status };
  };

  const handleAddRepayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manageLoan) return;
    if (rpPrincipal <= 0 && rpInterest <= 0) {
      toast.error("กรุณาระบุเงินต้นหรือดอกเบี้ยอย่างน้อยหนึ่งช่อง");
      return;
    }
    const repayment: LoanRepayment = {
      id: newRepaymentId(manageLoan.repayments.length),
      date: rpDate,
      principal: rpPrincipal > 0 ? rpPrincipal : 0,
      interest: rpInterest > 0 ? rpInterest : 0,
      status: rpStatus,
      paidDate: rpStatus === "paid" ? rpDate : undefined,
      note: rpNote.trim() || undefined,
    };
    onUpdateLoan(withSyncedStatus(manageLoan, [...manageLoan.repayments, repayment]));
    resetRepaymentForm();
    toast.success(rpStatus === "paid" ? "บันทึกการผ่อนชำระแล้ว" : "เพิ่มงวดผ่อน (ยังไม่จ่าย) แล้ว");
  };

  // สลับสถานะ จ่ายแล้ว ↔ ยังไม่จ่าย
  const handleToggleRepayment = (rid: string) => {
    if (!manageLoan) return;
    const next = manageLoan.repayments.map((r) => {
      if (r.id !== rid) return r;
      const nowPaid = !isRepaymentPaid(r);
      return {
        ...r,
        status: (nowPaid ? "paid" : "pending") as RepaymentStatus,
        paidDate: nowPaid ? (r.paidDate || todayISO()) : undefined,
      };
    });
    onUpdateLoan(withSyncedStatus(manageLoan, next));
  };

  const handleDeleteRepayment = (rid: string) => {
    if (!manageLoan) return;
    onUpdateLoan(withSyncedStatus(manageLoan, manageLoan.repayments.filter((r) => r.id !== rid)));
  };

  // สร้างตารางผ่อนล่วงหน้า: แบ่งเงินต้นคงเหลือเท่า ๆ กัน N งวด (รายเดือน) สถานะ "ยังไม่จ่าย"
  const handleGenerateSchedule = () => {
    if (!manageLoan) return;
    const n = Math.floor(genCount);
    if (n <= 0) { toast.error("จำนวนงวดต้องมากกว่า 0"); return; }
    const remaining = outstandingPrincipal(manageLoan);
    if (remaining <= 0) { toast.error("เงินต้นคงเหลือเป็น 0 แล้ว"); return; }
    const base = new Date(genFirstDate + "T00:00:00Z");
    if (Number.isNaN(base.getTime())) { toast.error("วันที่เริ่มงวดแรกไม่ถูกต้อง"); return; }

    const per = Math.floor((remaining / n) * 100) / 100;
    const rows: LoanRepayment[] = [];
    for (let i = 0; i < n; i++) {
      const d = new Date(base);
      d.setUTCMonth(d.getUTCMonth() + i);
      // งวดสุดท้ายรับเศษที่ปัดทิ้ง เพื่อให้ผลรวม = เงินต้นคงเหลือพอดี
      const principal = i === n - 1 ? Math.round((remaining - per * (n - 1)) * 100) / 100 : per;
      rows.push({
        id: newRepaymentId(manageLoan.repayments.length + i),
        date: d.toISOString().split("T")[0],
        principal,
        interest: genInterestPerPeriod > 0 ? genInterestPerPeriod : 0,
        status: "pending",
        note: `งวดที่ ${i + 1}/${n}`,
      });
    }
    onUpdateLoan(withSyncedStatus(manageLoan, [...manageLoan.repayments, ...rows]));
    toast.success(`สร้างตารางผ่อน ${n} งวดแล้ว`);
  };

  const renderLoanFormBody = () => (
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="loan-lender">เจ้าหนี้ / ผู้ให้กู้</Label>
          <Input id="loan-lender" value={lender} onChange={(e) => setLender(e.target.value)} placeholder="เช่น ธนาคารกสิกรไทย / บ.เพื่อน จก." />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="loan-ltype">ประเภทเจ้าหนี้</Label>
          <Select value={lenderType} onValueChange={(v) => setLenderType(v as LoanLenderType)}>
            <SelectTrigger id="loan-ltype"><SelectValue /></SelectTrigger>
            <SelectContent>
              {LENDER_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{LOAN_LENDER_TYPE_LABELS[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="loan-principal">เงินต้น (฿)</Label>
          <Input id="loan-principal" type="number" min={0} value={principal} onChange={(e) => setPrincipal(Number(e.target.value) || 0)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="loan-rate">อัตราดอกเบี้ย/ปี (%)</Label>
          <Input id="loan-rate" type="number" min={0} max={100} step={0.01} value={annualInterestRate} onChange={(e) => setAnnualInterestRate(Number(e.target.value) || 0)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="loan-start">วันที่รับเงินกู้</Label>
          <Input id="loan-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="loan-term">ระยะเวลา (เดือน, optional)</Label>
          <Input id="loan-term" type="number" min={0} value={termMonths} onChange={(e) => setTermMonths(Number(e.target.value) || 0)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="loan-ref">เลขที่สัญญา/อ้างอิง</Label>
          <Input id="loan-ref" value={reference} onChange={(e) => setReference(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="loan-status">สถานะ</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as LoanStatus)}>
            <SelectTrigger id="loan-status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">{LOAN_STATUS_LABELS.active}</SelectItem>
              <SelectItem value="paid_off">{LOAN_STATUS_LABELS.paid_off}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="loan-notes">หมายเหตุ</Label>
        <Textarea id="loan-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Landmark className="h-6 w-6 text-primary" /> เงินกู้ยืม
          </h2>
          <p className="text-sm text-muted-foreground">
            ติดตามหนี้สินจากธนาคาร/บริษัทเพื่อน — เงินต้น ดอกเบี้ย และยอดคงเหลือที่ต้องจ่าย
          </p>
        </div>

        <Dialog open={isAddOpen} onOpenChange={handleOpenAdd}>
          <EditGate>
            <DialogTrigger asChild>
              <Button className="gap-2 font-semibold">
                <Plus className="h-4 w-4" /> เพิ่มเงินกู้
              </Button>
            </DialogTrigger>
          </EditGate>
          <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleAddSubmit}>
              <DialogHeader>
                <DialogTitle>เพิ่มเงินกู้</DialogTitle>
                <DialogDescription>บันทึกเงินกู้ยืมก้อนใหม่ — ผ่อนชำระภายหลังได้</DialogDescription>
              </DialogHeader>
              {renderLoanFormBody()}
              <DialogFooter>
                <Button type="submit">บันทึกเงินกู้</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-4">
            <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1">
              <Wallet className="h-3.5 w-3.5" /> เงินต้นกู้รวม
            </div>
            <div className="text-lg font-black font-mono">฿{fmt(summary.totalBorrowed)}</div>
            <div className="text-[11px] text-muted-foreground">{loans.length} ก้อน · กำลังผ่อน {summary.activeCount}</div>
          </CardContent>
        </Card>
        <Card className="border-rose-300 bg-rose-50/60 dark:bg-rose-950/20">
          <CardContent className="pt-4">
            <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1">
              <TrendingDown className="h-3.5 w-3.5 text-rose-600" /> หนี้คงเหลือ
            </div>
            <div className="text-lg font-black text-rose-600 font-mono">฿{fmt(summary.totalOutstanding)}</div>
            <div className="text-[11px] text-muted-foreground">เงินต้นที่ยังต้องจ่าย</div>
          </CardContent>
        </Card>
        <Card className="border-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/20">
          <CardContent className="pt-4">
            <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1">
              <Coins className="h-3.5 w-3.5 text-emerald-600" /> เงินต้นจ่ายแล้ว
            </div>
            <div className="text-lg font-black text-emerald-600 font-mono">฿{fmt(summary.totalPrincipalPaid)}</div>
            <div className="text-[11px] text-muted-foreground">ปิดยอด {summary.paidOffCount} ก้อน</div>
          </CardContent>
        </Card>
        <Card className="border-amber-300 bg-amber-50/60 dark:bg-amber-950/20">
          <CardContent className="pt-4">
            <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1">
              <Receipt className="h-3.5 w-3.5 text-amber-600" /> ดอกเบี้ยจ่ายสะสม
            </div>
            <div className="text-lg font-black text-amber-600 font-mono">฿{fmt(summary.totalInterestPaid)}</div>
            <div className="text-[11px] text-muted-foreground">ต้นทุนการกู้</div>
          </CardContent>
        </Card>
      </div>

      {/* Info: ledger linkage */}
      <div className="flex gap-2 text-xs text-muted-foreground rounded-lg border border-border/60 bg-muted/30 p-3">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <span>
          หน้านี้ติดตาม <b>หนี้สิน</b> (เงินต้นคงเหลือ) — ส่วน <b>เงินสดเข้า/ออกจริง</b> ให้บันทึกใน “รายการเดินบัญชี”
          โดยใช้หมวด <b>รับเงินกู้ / จ่ายคืนเงินต้น / ดอกเบี้ยจ่าย</b> เพื่อให้กระแสเงินสดและรายงานบัญชีตรงกัน
        </span>
      </div>

      {/* Table */}
      <Card className="border-border/50 bg-card/50">
        <CardContent className="pt-4">
          <div className="overflow-x-auto -mx-2 sm:mx-0">
            <Table className="min-w-[860px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px]">เจ้าหนี้</TableHead>
                  <TableHead className="text-right">เงินต้น</TableHead>
                  <TableHead className="text-right">ดอก/ปี</TableHead>
                  <TableHead className="w-[110px]">รับเงิน</TableHead>
                  <TableHead className="text-right min-w-[130px]">หนี้คงเหลือ</TableHead>
                  <TableHead className="text-center">สถานะ</TableHead>
                  <TableHead className="text-center w-[130px]">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedLoans.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground text-sm">
                      ยังไม่มีเงินกู้ กดปุ่ม &apos;เพิ่มเงินกู้&apos; เพื่อเริ่มต้น
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedLoans.map((loan) => {
                    const outstanding = outstandingPrincipal(loan);
                    let dateLabel = loan.startDate;
                    try { dateLabel = format(parseISO(loan.startDate), "dd/MM/yy"); } catch {}
                    const isPaid = loan.status === "paid_off";
                    return (
                      <TableRow key={loan.id} className="hover:bg-muted/30">
                        <TableCell className="text-xs">
                          <div className="font-semibold">{loan.lender}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {LOAN_LENDER_TYPE_LABELS[loan.lenderType]}
                            {loan.reference ? ` · ${loan.reference}` : ""}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">฿{fmt(loan.principal)}</TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">{loan.annualInterestRate}%</TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">{dateLabel}</TableCell>
                        <TableCell className={`text-right font-mono text-sm font-bold ${outstanding > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                          ฿{fmt(outstanding)}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`text-[11px] px-1.5 py-0.5 rounded-full border ${isPaid ? "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400" : "bg-muted border-border/60"}`}>
                            {LOAN_STATUS_LABELS[loan.status]}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-center gap-1">
                            <Button
                              size="icon" variant="ghost"
                              onClick={() => { setManageId(loan.id); resetRepaymentForm(); }}
                              className="h-7 w-7" title="การผ่อนชำระ"
                            >
                              <ListChecks className="h-3.5 w-3.5" />
                            </Button>
                            <EditGate fallback={null}>
                              <Button size="icon" variant="ghost" onClick={() => handleStartEdit(loan)} className="h-7 w-7" title="แก้ไข">
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => handleDelete(loan)} className="h-7 w-7 text-destructive hover:bg-destructive/10" title="ลบ">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </EditGate>
                          </div>
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
                <DialogTitle>แก้ไขเงินกู้</DialogTitle>
                <DialogDescription>ปรับรายละเอียดเงินกู้ก้อนนี้</DialogDescription>
              </DialogHeader>
              {renderLoanFormBody()}
              <DialogFooter>
                <Button type="submit">บันทึก</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Repayments Dialog */}
      <Dialog open={!!manageId} onOpenChange={(open) => { if (!open) { setManageId(null); resetRepaymentForm(); } }}>
        <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
          {manageLoan && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ListChecks className="h-5 w-5 text-primary" /> การผ่อนชำระ — {manageLoan.lender}
                </DialogTitle>
                <DialogDescription>
                  ทำตารางผ่อนล่วงหน้าแล้วกดสลับ “จ่ายแล้ว/ยังไม่จ่าย” ได้ — งวดที่ยังไม่จ่ายจะไปขึ้นใน Cashflow เป็นเงินออกล่วงหน้า
                </DialogDescription>
              </DialogHeader>

              {/* Loan snapshot */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div className="rounded-lg border border-border/60 bg-muted/30 p-2">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">เงินต้น</div>
                  <div className="font-mono font-bold text-sm">฿{fmt(manageLoan.principal)}</div>
                </div>
                <div className="rounded-lg border border-rose-300/60 bg-rose-50/40 dark:bg-rose-950/10 p-2">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">คงเหลือ</div>
                  <div className="font-mono font-bold text-sm text-rose-600">฿{fmt(outstandingPrincipal(manageLoan))}</div>
                </div>
                <div className="rounded-lg border border-amber-300/60 bg-amber-50/40 dark:bg-amber-950/10 p-2">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">ดอกจ่ายแล้ว</div>
                  <div className="font-mono font-bold text-sm text-amber-600">฿{fmt(interestPaid(manageLoan))}</div>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/30 p-2">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">ค้างจ่าย (แผน)</div>
                  <div className="font-mono font-bold text-sm">฿{fmt(scheduledUnpaid(manageLoan))}</div>
                </div>
              </div>

              {/* Add repayment form */}
              <EditGate>
                <form onSubmit={handleAddRepayment} className="rounded-lg border border-border/70 p-3 space-y-3 mt-2">
                  <div className="text-xs font-bold">เพิ่มงวดผ่อน</div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="grid gap-1.5">
                      <Label htmlFor="rp-date" className="text-xs">วันครบกำหนด/จ่าย</Label>
                      <Input id="rp-date" type="date" value={rpDate} onChange={(e) => setRpDate(e.target.value)} />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="rp-principal" className="text-xs">เงินต้น (฿)</Label>
                      <Input id="rp-principal" type="number" min={0} value={rpPrincipal} onChange={(e) => setRpPrincipal(Number(e.target.value) || 0)} />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="rp-interest" className="text-xs">ดอกเบี้ย (฿)</Label>
                      <Input id="rp-interest" type="number" min={0} value={rpInterest} onChange={(e) => setRpInterest(Number(e.target.value) || 0)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label htmlFor="rp-status" className="text-xs">สถานะ</Label>
                      <Select value={rpStatus} onValueChange={(v) => setRpStatus(v as RepaymentStatus)}>
                        <SelectTrigger id="rp-status"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">ยังไม่จ่าย (แผน)</SelectItem>
                          <SelectItem value="paid">จ่ายแล้ว</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="rp-note" className="text-xs">หมายเหตุ (optional)</Label>
                      <Input id="rp-note" value={rpNote} onChange={(e) => setRpNote(e.target.value)} placeholder="เช่น งวดที่ 1 / โอน KBANK" />
                    </div>
                  </div>
                  <Button type="submit" size="sm" className="gap-1.5">
                    <Plus className="h-3.5 w-3.5" /> เพิ่มงวด
                  </Button>
                </form>

                {/* Generate schedule */}
                <div className="rounded-lg border border-dashed border-border/70 p-3 space-y-3">
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <CalendarClock className="h-3.5 w-3.5" /> สร้างตารางผ่อนล่วงหน้า (รายเดือน)
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="grid gap-1.5">
                      <Label htmlFor="gen-count" className="text-xs">จำนวนงวด</Label>
                      <Input id="gen-count" type="number" min={1} value={genCount} onChange={(e) => setGenCount(Number(e.target.value) || 0)} />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="gen-first" className="text-xs">งวดแรกครบกำหนด</Label>
                      <Input id="gen-first" type="date" value={genFirstDate} onChange={(e) => setGenFirstDate(e.target.value)} />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="gen-int" className="text-xs">ดอก/งวด (฿)</Label>
                      <Input id="gen-int" type="number" min={0} value={genInterestPerPeriod} onChange={(e) => setGenInterestPerPeriod(Number(e.target.value) || 0)} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] text-muted-foreground">
                      แบ่งเงินต้นคงเหลือ (฿{fmt(outstandingPrincipal(manageLoan))}) เท่า ๆ กัน สถานะ “ยังไม่จ่าย”
                    </p>
                    <Button type="button" size="sm" variant="outline" onClick={handleGenerateSchedule} className="gap-1.5 shrink-0">
                      <CalendarClock className="h-3.5 w-3.5" /> สร้างตาราง
                    </Button>
                  </div>
                </div>
              </EditGate>

              {/* Repayment history */}
              <div className="overflow-x-auto">
                <Table className="min-w-[440px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">กำหนด</TableHead>
                      <TableHead className="text-right">เงินต้น</TableHead>
                      <TableHead className="text-right">ดอกเบี้ย</TableHead>
                      <TableHead className="text-center w-[120px]">สถานะ</TableHead>
                      <TableHead>หมายเหตุ</TableHead>
                      <TableHead className="w-[44px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {manageLoan.repayments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-6 text-muted-foreground text-xs">
                          ยังไม่มีงวดผ่อน — เพิ่มทีละงวด หรือกด “สร้างตาราง” ด้านบน
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortRepayments(manageLoan.repayments).map((r) => {
                        let d = r.date;
                        try { d = format(parseISO(r.date), "dd/MM/yy"); } catch {}
                        const paid = isRepaymentPaid(r);
                        return (
                          <TableRow key={r.id} className={paid ? "hover:bg-muted/30" : "bg-amber-50/40 dark:bg-amber-950/10 hover:bg-amber-100/40"}>
                            <TableCell className="text-xs font-mono text-muted-foreground">{d}</TableCell>
                            <TableCell className="text-right font-mono text-xs">฿{fmt(r.principal)}</TableCell>
                            <TableCell className="text-right font-mono text-xs text-amber-600">฿{fmt(r.interest)}</TableCell>
                            <TableCell className="text-center">
                              <EditGate fallback={
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${paid ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"}`}>
                                  {paid ? "จ่ายแล้ว" : "ยังไม่จ่าย"}
                                </span>
                              }>
                                <button
                                  type="button"
                                  onClick={() => handleToggleRepayment(r.id)}
                                  className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border transition-colors ${paid
                                    ? "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 hover:bg-emerald-200/60"
                                    : "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-400 hover:bg-amber-200/60"}`}
                                  title={paid ? "กดเพื่อเปลี่ยนเป็น ยังไม่จ่าย" : "กดเพื่อทำเครื่องหมาย จ่ายแล้ว"}
                                >
                                  {paid ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
                                  {paid ? "จ่ายแล้ว" : "ยังไม่จ่าย"}
                                </button>
                              </EditGate>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground truncate max-w-[140px]" title={r.note}>{r.note || "—"}</TableCell>
                            <TableCell>
                              <EditGate fallback={null}>
                                <Button size="icon" variant="ghost" onClick={() => handleDeleteRepayment(r.id)} className="h-6 w-6 text-destructive hover:bg-destructive/10" title="ลบงวดนี้">
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </EditGate>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              <DialogFooter>
                <div className="text-xs text-muted-foreground mr-auto self-center">
                  จ่ายเงินต้นแล้วรวม <b className="font-mono">฿{fmt(principalPaid(manageLoan))}</b> จาก ฿{fmt(manageLoan.principal)}
                </div>
                <Button variant="outline" onClick={() => { setManageId(null); resetRepaymentForm(); }}>ปิด</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
