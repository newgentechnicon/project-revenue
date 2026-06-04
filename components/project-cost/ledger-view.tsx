"use client";

import React, { useMemo, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  LedgerEntry, LedgerDirection, LedgerCategory, LedgerAttachment,
  Project, Subscription, CompanyInfo,
} from "@/lib/types";
import {
  summarizeLedger, summarizeLedgerByMonth, LEDGER_CATEGORY_LABELS,
  summarizeReimbursements, isPendingReimbursement, listMonthKeys,
} from "@/lib/ledger";
import { exportMonthlyExpensesToExcel } from "@/lib/excel-export";
import { uploadSlip, getSlipUrl, deleteSlips, MAX_SLIP_SIZE_BYTES } from "@/lib/supabase/storage";
import { newLedgerId } from "@/hooks/use-ledger";
import { EditGate } from "@/components/project-cost/edit-gate";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Plus, Trash2, Edit2, BookText, Search, ArrowDownCircle, ArrowUpCircle,
  Paperclip, Loader2, FileText, X, Download, HandCoins, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

interface LedgerViewProps {
  ledger: LedgerEntry[];
  projects: Project[];
  subscriptions: Subscription[];
  companyInfo?: CompanyInfo;
  onAddEntry: (entry: Omit<LedgerEntry, "createdAt" | "updatedAt" | "ownerId">) => void;
  onUpdateEntry: (entry: LedgerEntry) => void;
  onDeleteEntry: (id: string) => void;
}

const THIS_MONTH = () => new Date().toISOString().slice(0, 7);

/** "2026-05" -> "พ.ค. 2569" */
const monthKeyLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  const TH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  return y && m ? `${TH[m - 1]} ${y + 543}` : key;
};

const fmt = (v: number) => new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(v);

const CATEGORIES: LedgerCategory[] = [
  "project_payment", "subscription", "commission",
  "salary", "overhead", "tax", "refund",
  "loan_received", "loan_principal", "loan_interest", "other",
];

type FilterId = "all" | "in" | "out" | "pending";

const todayISO = () => new Date().toISOString().split("T")[0];

export function LedgerView({
  ledger,
  projects,
  subscriptions,
  companyInfo,
  onAddEntry,
  onUpdateEntry,
  onDeleteEntry,
}: LedgerViewProps) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editing, setEditing] = useState<LedgerEntry | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<FilterId>("all");
  const [exportMonth, setExportMonth] = useState<string>(THIS_MONTH());

  // Form state
  const [draftId, setDraftId] = useState<string>("");
  const [date, setDate] = useState(todayISO());
  const [direction, setDirection] = useState<LedgerDirection>("in");
  const [amount, setAmount] = useState<number>(0);
  const [vatAmount, setVatAmount] = useState<number>(0);
  const [whtAmount, setWhtAmount] = useState<number>(0);
  const [category, setCategory] = useState<LedgerCategory>("project_payment");
  const [account, setAccount] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [reference, setReference] = useState("");
  const [description, setDescription] = useState("");
  const [sourceType, setSourceType] = useState<NonNullable<LedgerEntry["sourceType"]>>("manual");
  const [sourceId, setSourceId] = useState("");
  const [reimbursable, setReimbursable] = useState(false);
  const [paidBy, setPaidBy] = useState("");
  const [reimbursementStatus, setReimbursementStatus] = useState<"pending" | "reimbursed">("pending");
  const [reimbursedDate, setReimbursedDate] = useState("");
  const [attachments, setAttachments] = useState<LedgerAttachment[]>([]);
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const summary = useMemo(() => summarizeLedger(ledger), [ledger]);
  const months = useMemo(() => summarizeLedgerByMonth(ledger), [ledger]);
  const reimburse = useMemo(() => summarizeReimbursements(ledger), [ledger]);
  const monthKeys = useMemo(() => {
    const keys = listMonthKeys(ledger);
    const now = THIS_MONTH();
    return keys.includes(now) ? keys : [now, ...keys];
  }, [ledger]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...ledger]
      .filter((e) => {
        if (filter === "pending") {
          if (!isPendingReimbursement(e)) return false;
        } else if (filter !== "all" && e.direction !== filter) {
          return false;
        }
        if (q) {
          const hay = `${e.counterparty ?? ""} ${e.reference ?? ""} ${e.description ?? ""} ${LEDGER_CATEGORY_LABELS[e.category]}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [ledger, filter, searchQuery]);

  const resetForm = () => {
    setDraftId("");
    setDate(todayISO());
    setDirection("in");
    setAmount(0);
    setVatAmount(0);
    setWhtAmount(0);
    setCategory("project_payment");
    setAccount("");
    setCounterparty("");
    setReference("");
    setDescription("");
    setSourceType("manual");
    setSourceId("");
    setReimbursable(false);
    setPaidBy("");
    setReimbursementStatus("pending");
    setReimbursedDate("");
    setAttachments([]);
  };

  // id ที่ใช้ผูก slip — draftId ตอนเพิ่ม, editing.id ตอนแก้
  const currentEntryId = () => editing?.id ?? draftId;

  const handleOpenAdd = (open: boolean) => {
    setIsAddOpen(open);
    if (open) {
      resetForm();
      setDraftId(newLedgerId());
    } else {
      resetForm();
    }
  };

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    const entryId = currentEntryId();
    if (!entryId) return;

    setUploading(true);
    for (const file of files) {
      if (file.size > MAX_SLIP_SIZE_BYTES) {
        toast.error(`"${file.name}" ใหญ่เกิน ${Math.round(MAX_SLIP_SIZE_BYTES / 1024 / 1024)} MB`);
        continue;
      }
      try {
        const att = await uploadSlip(file, entryId);
        setAttachments((prev) => [...prev, att]);
        toast.success(`แนบ "${file.name}" แล้ว`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "อัปโหลดไม่สำเร็จ");
      }
    }
    setUploading(false);
  };

  const handleRemoveAttachment = async (att: LedgerAttachment) => {
    setAttachments((prev) => prev.filter((a) => a.id !== att.id));
    await deleteSlips([att.storagePath]);
  };

  const handleViewSlip = async (att: LedgerAttachment) => {
    const url = await getSlipUrl(att.storagePath);
    if (url) window.open(url, "_blank", "noopener");
    else toast.error("เปิดไฟล์ไม่สำเร็จ");
  };

  const buildPayload = (id: string): Omit<LedgerEntry, "createdAt" | "updatedAt" | "ownerId"> => ({
    id,
    date,
    direction,
    amount,
    vatAmount: vatAmount > 0 ? vatAmount : undefined,
    whtAmount: whtAmount > 0 ? whtAmount : undefined,
    category,
    account: account.trim() || undefined,
    counterparty: counterparty.trim() || undefined,
    reference: reference.trim() || undefined,
    description: description.trim() || undefined,
    sourceType,
    sourceId: sourceType !== "manual" && sourceId ? sourceId : undefined,
    // เคสสำรองจ่ายใช้กับเงินออกเท่านั้น
    reimbursable: direction === "out" && reimbursable ? true : undefined,
    paidBy: direction === "out" && reimbursable ? (paidBy.trim() || undefined) : undefined,
    reimbursementStatus: direction === "out" && reimbursable ? reimbursementStatus : undefined,
    reimbursedDate:
      direction === "out" && reimbursable && reimbursementStatus === "reimbursed" && reimbursedDate
        ? reimbursedDate
        : undefined,
    attachments,
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) { toast.error("กรุณาระบุจำนวนเงินมากกว่า 0"); return; }
    onAddEntry(buildPayload(draftId));
    setIsAddOpen(false);
    resetForm();
    toast.success("บันทึกรายการเรียบร้อย");
  };

  const handleStartEdit = (entry: LedgerEntry) => {
    setEditing(entry);
    setDate(entry.date);
    setDirection(entry.direction);
    setAmount(entry.amount);
    setVatAmount(entry.vatAmount ?? 0);
    setWhtAmount(entry.whtAmount ?? 0);
    setCategory(entry.category);
    setAccount(entry.account ?? "");
    setCounterparty(entry.counterparty ?? "");
    setReference(entry.reference ?? "");
    setDescription(entry.description ?? "");
    setSourceType(entry.sourceType ?? "manual");
    setSourceId(entry.sourceId ?? "");
    setReimbursable(!!entry.reimbursable);
    setPaidBy(entry.paidBy ?? "");
    setReimbursementStatus(entry.reimbursementStatus ?? "pending");
    setReimbursedDate(entry.reimbursedDate ?? "");
    setAttachments(entry.attachments ?? []);
    setIsEditOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    if (amount <= 0) { toast.error("กรุณาระบุจำนวนเงินมากกว่า 0"); return; }
    onUpdateEntry({ ...editing, ...buildPayload(editing.id) });
    setIsEditOpen(false);
    setEditing(null);
    resetForm();
    toast.success("อัปเดตรายการเรียบร้อย");
  };

  const handleDelete = async (entry: LedgerEntry) => {
    if (!confirm("ลบรายการเดินบัญชีนี้ใช่หรือไม่? (ไฟล์แนบจะถูกลบด้วย)")) return;
    if (entry.attachments?.length) {
      await deleteSlips(entry.attachments.map((a) => a.storagePath));
    }
    onDeleteEntry(entry.id);
    toast.success("ลบรายการเรียบร้อย");
  };

  // ปุ่มลัด: ทำเครื่องหมายว่าเบิกคืนแล้ว (บริษัทจ่ายคืนวันนี้)
  const handleMarkReimbursed = (entry: LedgerEntry) => {
    onUpdateEntry({
      ...entry,
      reimbursementStatus: "reimbursed",
      reimbursedDate: entry.reimbursedDate || todayISO(),
    });
    toast.success("ทำเครื่องหมายเบิกคืนแล้ว");
  };

  const handleExportMonth = async () => {
    const hasOut = ledger.some(
      (e) => e.direction === "out" && e.date?.slice(0, 7) === exportMonth
    );
    if (!hasOut) {
      toast.error(`ไม่มีรายการเงินออกในเดือน ${monthKeyLabel(exportMonth)}`);
      return;
    }
    try {
      await exportMonthlyExpensesToExcel(ledger, exportMonth, companyInfo);
      toast.success(`ส่งออกค่าใช้จ่ายเดือน ${monthKeyLabel(exportMonth)} แล้ว`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ส่งออกไม่สำเร็จ");
    }
  };

  const renderFormBody = () => (
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="led-dir">ทิศทาง</Label>
          <Select value={direction} onValueChange={(v) => setDirection(v as LedgerDirection)}>
            <SelectTrigger id="led-dir"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="in">เงินเข้า</SelectItem>
              <SelectItem value="out">เงินออก</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="led-date">วันที่</Label>
          <Input id="led-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="led-amount">จำนวนเงิน (฿)</Label>
          <Input id="led-amount" type="number" min={0} value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="led-cat">หมวด</Label>
          <Select value={category} onValueChange={(v) => setCategory(v as LedgerCategory)}>
            <SelectTrigger id="led-cat"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{LEDGER_CATEGORY_LABELS[c]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="led-vat">VAT (฿, optional)</Label>
          <Input id="led-vat" type="number" min={0} value={vatAmount} onChange={(e) => setVatAmount(Number(e.target.value) || 0)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="led-wht">หัก ณ ที่จ่าย (฿, optional)</Label>
          <Input id="led-wht" type="number" min={0} value={whtAmount} onChange={(e) => setWhtAmount(Number(e.target.value) || 0)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="led-cp">คู่ค้า/ผู้รับเงิน</Label>
          <Input id="led-cp" value={counterparty} onChange={(e) => setCounterparty(e.target.value)} placeholder="เช่น ลูกค้า / พนักงาน" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="led-acc">บัญชี/ธนาคาร</Label>
          <Input id="led-acc" value={account} onChange={(e) => setAccount(e.target.value)} placeholder="เช่น KBANK xxx-x-x1234" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="led-src">ผูกกับ (optional)</Label>
          <Select
            value={sourceType}
            onValueChange={(v) => { setSourceType(v as NonNullable<LedgerEntry["sourceType"]>); setSourceId(""); }}
          >
            <SelectTrigger id="led-src"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">ไม่ผูก</SelectItem>
              <SelectItem value="project">โครงการ</SelectItem>
              <SelectItem value="subscription">รายรับประจำ</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="led-ref">เลขที่อ้างอิง/ใบเสร็จ</Label>
          <Input id="led-ref" value={reference} onChange={(e) => setReference(e.target.value)} />
        </div>
      </div>

      {sourceType === "project" && (
        <div className="grid gap-2">
          <Label htmlFor="led-srcid">เลือกโครงการ</Label>
          <Select value={sourceId} onValueChange={setSourceId}>
            <SelectTrigger id="led-srcid"><SelectValue placeholder="-- เลือก --" /></SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}{p.client?.name ? ` · ${p.client.name}` : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {sourceType === "subscription" && (
        <div className="grid gap-2">
          <Label htmlFor="led-srcid">เลือก subscription</Label>
          <Select value={sourceId} onValueChange={setSourceId}>
            <SelectTrigger id="led-srcid"><SelectValue placeholder="-- เลือก --" /></SelectTrigger>
            <SelectContent>
              {subscriptions.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.customer.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid gap-2">
        <Label htmlFor="led-desc">รายละเอียด</Label>
        <Textarea id="led-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </div>

      {/* สำรองจ่าย — เฉพาะรายการเงินออก */}
      {direction === "out" && (
        <div className="rounded-lg border border-amber-300/70 bg-amber-50/40 dark:bg-amber-950/10 p-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <HandCoins className="h-4 w-4 text-amber-600" />
              <div>
                <Label htmlFor="led-reimb" className="cursor-pointer">สำรองจ่าย (จ่ายเงินส่วนตัวก่อน)</Label>
                <p className="text-[11px] text-muted-foreground">ออกเงินแทนบริษัทก่อน แล้วค่อยเบิกคืน</p>
              </div>
            </div>
            <Switch id="led-reimb" checked={reimbursable} onCheckedChange={setReimbursable} />
          </div>

          {reimbursable && (
            <div className="grid gap-3 pt-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="led-paidby">ผู้สำรองจ่าย</Label>
                  <Input id="led-paidby" value={paidBy} onChange={(e) => setPaidBy(e.target.value)} placeholder="เช่น ชื่อพนักงาน/เจ้าของ" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="led-rstatus">สถานะเบิกคืน</Label>
                  <Select value={reimbursementStatus} onValueChange={(v) => setReimbursementStatus(v as "pending" | "reimbursed")}>
                    <SelectTrigger id="led-rstatus"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">รอเบิกคืน</SelectItem>
                      <SelectItem value="reimbursed">เบิกคืนแล้ว</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {reimbursementStatus === "reimbursed" && (
                <div className="grid gap-2">
                  <Label htmlFor="led-rdate">วันที่บริษัทจ่ายคืน</Label>
                  <Input id="led-rdate" type="date" value={reimbursedDate} onChange={(e) => setReimbursedDate(e.target.value)} />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Slip attachments */}
      <div className="grid gap-2">
        <Label>ไฟล์แนบ (slip / ใบเสร็จ)</Label>
        <div className="rounded-lg border border-dashed border-border/70 p-3 space-y-2">
          {attachments.length > 0 && (
            <div className="space-y-1.5">
              {attachments.map((att) => (
                <div key={att.id} className="flex items-center gap-2 text-xs rounded-md bg-muted/50 px-2 py-1.5">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <button type="button" onClick={() => handleViewSlip(att)} className="flex-1 text-left truncate hover:underline" title={att.fileName}>
                    {att.fileName}
                  </button>
                  <span className="text-muted-foreground shrink-0">{Math.round(att.sizeBytes / 1024)} KB</span>
                  <Button type="button" size="icon" variant="ghost" onClick={() => handleRemoveAttachment(att)} className="h-6 w-6 text-destructive hover:bg-destructive/10">
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="gap-2 w-full"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
            {uploading ? "กำลังอัปโหลด..." : "แนบไฟล์ slip"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,application/pdf"
            onChange={handleFilePick}
            className="hidden"
          />
        </div>
      </div>
    </div>
  );

  const filterButton = (id: FilterId, label: string, count?: number) => (
    <Button variant={filter === id ? "secondary" : "ghost"} size="sm" onClick={() => setFilter(id)} className="h-8 text-xs">
      {label}{count !== undefined ? ` (${count})` : ""}
    </Button>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BookText className="h-6 w-6 text-primary" /> รายการเดินบัญชี
          </h2>
          <p className="text-sm text-muted-foreground">
            บันทึกเงินเข้า–เงินออกจริง พร้อมแนบ slip/ใบเสร็จ — ใช้ติดตามกระแสเงินจริงของบริษัท
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Export ค่าใช้จ่ายรายเดือน (ส่งสำนักงานบัญชี) */}
          <div className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/40 p-1">
            <Select value={exportMonth} onValueChange={setExportMonth}>
              <SelectTrigger className="h-8 w-[130px] border-0 bg-transparent text-xs shadow-none focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthKeys.map((k) => (
                  <SelectItem key={k} value={k}>{monthKeyLabel(k)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={handleExportMonth} className="h-8 gap-1.5 text-xs" title="ส่งออกรายงานค่าใช้จ่ายเดือนนี้เป็น Excel">
              <Download className="h-3.5 w-3.5" /> Excel
            </Button>
          </div>

          <Dialog open={isAddOpen} onOpenChange={handleOpenAdd}>
            <EditGate>
              <DialogTrigger asChild>
                <Button className="gap-2 font-semibold">
                  <Plus className="h-4 w-4" /> เพิ่มรายการ
                </Button>
              </DialogTrigger>
            </EditGate>
          <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleAddSubmit}>
              <DialogHeader>
                <DialogTitle>เพิ่มรายการเดินบัญชี</DialogTitle>
                <DialogDescription>บันทึกเงินเข้า/ออก พร้อมแนบ slip ได้</DialogDescription>
              </DialogHeader>
              {renderFormBody()}
              <DialogFooter>
                <Button type="submit" disabled={uploading}>บันทึกรายการ</Button>
              </DialogFooter>
            </form>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card className="border-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/20">
          <CardContent className="pt-4">
            <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1">
              <ArrowDownCircle className="h-3.5 w-3.5 text-emerald-600" /> เงินเข้า
            </div>
            <div className="text-lg font-black text-emerald-600 font-mono">฿{fmt(summary.totalIn)}</div>
            <div className="text-[11px] text-muted-foreground">{summary.countIn} รายการ</div>
          </CardContent>
        </Card>
        <Card className="border-rose-300 bg-rose-50/60 dark:bg-rose-950/20">
          <CardContent className="pt-4">
            <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1">
              <ArrowUpCircle className="h-3.5 w-3.5 text-rose-600" /> เงินออก
            </div>
            <div className="text-lg font-black text-rose-600 font-mono">฿{fmt(summary.totalOut)}</div>
            <div className="text-[11px] text-muted-foreground">{summary.countOut} รายการ</div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-4">
            <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">คงเหลือสุทธิ</div>
            <div className={`text-lg font-black font-mono ${summary.net >= 0 ? "text-primary" : "text-rose-600"}`}>฿{fmt(summary.net)}</div>
            <div className="text-[11px] text-muted-foreground">เข้า − ออก</div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-4">
            <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">รายการทั้งหมด</div>
            <div className="text-2xl font-black">{ledger.length}</div>
            <div className="text-[11px] text-muted-foreground">{months.length} เดือน</div>
          </CardContent>
        </Card>
        <Card className="border-amber-300 bg-amber-50/60 dark:bg-amber-950/20">
          <CardContent className="pt-4">
            <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1">
              <HandCoins className="h-3.5 w-3.5 text-amber-600" /> ค้างเบิกคืน
            </div>
            <div className="text-lg font-black text-amber-600 font-mono">฿{fmt(reimburse.pendingTotal)}</div>
            <div className="text-[11px] text-muted-foreground">{reimburse.pendingCount} รายการสำรองจ่าย</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters + Search */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex items-center gap-1 rounded-lg border border-border/60 p-1 bg-card/40 w-fit">
          {filterButton("all", "ทั้งหมด", ledger.length)}
          {filterButton("in", "เงินเข้า", summary.countIn)}
          {filterButton("out", "เงินออก", summary.countOut)}
          {reimburse.pendingCount > 0 && filterButton("pending", "ค้างเบิก", reimburse.pendingCount)}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="ค้นหาคู่ค้า / อ้างอิง / รายละเอียด..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 sm:max-w-xs" />
        </div>
      </div>

      {/* Table */}
      <Card className="border-border/50 bg-card/50">
        <CardContent className="pt-4">
          <div className="overflow-x-auto -mx-2 sm:mx-0">
            <Table className="min-w-[820px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[110px]">วันที่</TableHead>
                  <TableHead>หมวด</TableHead>
                  <TableHead className="min-w-[160px]">คู่ค้า / รายละเอียด</TableHead>
                  <TableHead className="text-center">slip</TableHead>
                  <TableHead className="text-right min-w-[120px]">จำนวน</TableHead>
                  <TableHead className="text-center w-[100px]">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground text-sm">
                      {searchQuery || filter !== "all"
                        ? "ไม่พบรายการที่ตรงกับเงื่อนไข"
                        : "ยังไม่มีรายการเดินบัญชี กดปุ่ม 'เพิ่มรายการ' เพื่อเริ่มต้น"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((e) => {
                    const isIn = e.direction === "in";
                    let dateLabel = e.date;
                    try { dateLabel = format(parseISO(e.date), "dd/MM/yy"); } catch {}
                    return (
                      <TableRow key={e.id} className="hover:bg-muted/30">
                        <TableCell className="text-xs font-mono text-muted-foreground">{dateLabel}</TableCell>
                        <TableCell>
                          <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-muted border border-border/60">
                            {LEDGER_CATEGORY_LABELS[e.category]}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="font-semibold flex items-center gap-1.5">
                            {e.counterparty || <span className="text-muted-foreground italic">—</span>}
                            {e.reimbursable && (
                              e.reimbursementStatus === "reimbursed" ? (
                                <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 font-normal" title={e.reimbursedDate ? `เบิกคืนแล้ว ${e.reimbursedDate}` : "เบิกคืนแล้ว"}>
                                  <CheckCircle2 className="h-2.5 w-2.5" /> เบิกคืนแล้ว
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 font-normal" title={e.paidBy ? `สำรองจ่ายโดย ${e.paidBy}` : "สำรองจ่าย รอเบิกคืน"}>
                                  <HandCoins className="h-2.5 w-2.5" /> ค้างเบิก
                                </span>
                              )
                            )}
                          </div>
                          {e.description && <div className="text-muted-foreground truncate max-w-[220px]" title={e.description}>{e.description}</div>}
                          {e.reference && <div className="text-[10px] text-muted-foreground font-mono">อ้างอิง: {e.reference}</div>}
                        </TableCell>
                        <TableCell className="text-center">
                          {e.attachments?.length ? (
                            <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground">
                              <Paperclip className="h-3 w-3" />{e.attachments.length}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )}
                        </TableCell>
                        <TableCell className={`text-right font-mono text-sm font-bold ${isIn ? "text-emerald-600" : "text-rose-600"}`}>
                          {isIn ? "+" : "−"}฿{fmt(e.amount)}
                        </TableCell>
                        <TableCell>
                          <EditGate fallback={<span className="text-muted-foreground/40">—</span>}>
                            <div className="flex justify-center gap-1">
                              {isPendingReimbursement(e) && (
                                <Button size="icon" variant="ghost" onClick={() => handleMarkReimbursed(e)} className="h-7 w-7 text-emerald-600 hover:bg-emerald-500/10" title="ทำเครื่องหมายเบิกคืนแล้ว">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <Button size="icon" variant="ghost" onClick={() => handleStartEdit(e)} className="h-7 w-7" title="แก้ไข">
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => handleDelete(e)} className="h-7 w-7 text-destructive hover:bg-destructive/10" title="ลบ">
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

      {/* Monthly breakdown */}
      {months.length > 0 && (
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-4">
            <div className="text-sm font-bold mb-3">สรุปรายเดือน</div>
            <div className="overflow-x-auto -mx-2 sm:mx-0">
              <Table className="min-w-[520px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>เดือน</TableHead>
                    <TableHead className="text-right">เงินเข้า</TableHead>
                    <TableHead className="text-right">เงินออก</TableHead>
                    <TableHead className="text-right">สุทธิ</TableHead>
                    <TableHead className="text-right">ยอดสะสม</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {months.map((m) => (
                    <TableRow key={m.monthKey} className="hover:bg-muted/30">
                      <TableCell className="text-xs font-semibold">{m.monthLabel}</TableCell>
                      <TableCell className="text-right font-mono text-xs text-emerald-600">฿{fmt(m.inflow)}</TableCell>
                      <TableCell className="text-right font-mono text-xs text-rose-600">฿{fmt(m.outflow)}</TableCell>
                      <TableCell className={`text-right font-mono text-xs font-bold ${m.net >= 0 ? "text-primary" : "text-rose-600"}`}>฿{fmt(m.net)}</TableCell>
                      <TableCell className={`text-right font-mono text-xs ${m.cumulative >= 0 ? "" : "text-rose-600"}`}>฿{fmt(m.cumulative)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={(open) => { setIsEditOpen(open); if (!open) { setEditing(null); resetForm(); } }}>
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
          {editing && (
            <form onSubmit={handleEditSubmit}>
              <DialogHeader>
                <DialogTitle>แก้ไขรายการเดินบัญชี</DialogTitle>
                <DialogDescription>ปรับรายละเอียด หรือเพิ่ม/ลบไฟล์แนบ</DialogDescription>
              </DialogHeader>
              {renderFormBody()}
              <DialogFooter>
                <Button type="submit" disabled={uploading}>บันทึก</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
