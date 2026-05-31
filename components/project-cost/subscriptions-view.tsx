"use client";

import React, { useMemo, useState } from "react";
import {
  Product, Subscription, SubscriptionStatus, ProductBillingType, BillingCycle, Customer,
} from "@/lib/types";
import {
  summarizeRevenue, effectiveStatus, daysUntilExpiry, todayISO,
} from "@/lib/subscriptions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Edit2, Repeat, Search, AlertTriangle } from "lucide-react";
import { EditGate } from "@/components/project-cost/edit-gate";
import { toast } from "sonner";

interface SubscriptionsViewProps {
  subscriptions: Subscription[];
  products: Product[];
  customers: Customer[];
  onAddSubscription: (item: Omit<Subscription, "id">) => void;
  onUpdateSubscription: (item: Subscription) => void;
  onDeleteSubscription: (id: string) => void;
}

const NEW_CUSTOMER = "_new";

const fmt = (v: number) => new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(v);

const EXPIRY_THRESHOLD = 30;

type FilterId = "all" | "active" | "expiring" | "expired";

const statusBadge: Record<SubscriptionStatus, { label: string; cls: string }> = {
  active: { label: "ใช้งาน", cls: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-900" },
  trial: { label: "ทดลองใช้", cls: "bg-blue-100 text-blue-800 border-blue-200" },
  expired: { label: "หมดอายุ", cls: "bg-slate-100 text-slate-700 border-slate-200" },
  cancelled: { label: "ยกเลิก", cls: "bg-rose-100 text-rose-800 border-rose-200" },
};

/** บวกเดือนแบบ UTC-safe คืน ISO yyyy-mm-dd */
function addMonthsISO(iso: string, months: number): string {
  const d = new Date(iso + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return iso;
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().split("T")[0];
}

export function SubscriptionsView({
  subscriptions,
  products,
  customers,
  onAddSubscription,
  onUpdateSubscription,
  onDeleteSubscription,
}: SubscriptionsViewProps) {
  const today = todayISO();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<FilterId>("all");

  // Form state
  const [productId, setProductId] = useState("");
  const [customerId, setCustomerId] = useState<string>("");
  const [customerName, setCustomerName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [billingType, setBillingType] = useState<ProductBillingType>("subscription");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("yearly");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(addMonthsISO(today, 12));
  const [amount, setAmount] = useState(0);
  const [seats, setSeats] = useState(0);
  const [status, setStatus] = useState<SubscriptionStatus>("active");
  const [autoRenew, setAutoRenew] = useState(true);
  const [paymentReceivedDate, setPaymentReceivedDate] = useState("");
  const [notes, setNotes] = useState("");

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const customerById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);

  // เลือกลูกค้าจาก master → เติม snapshot ให้ฟอร์ม
  const handleCustomerChange = (value: string) => {
    if (value === NEW_CUSTOMER) {
      setCustomerId("");
      return;
    }
    const c = customerById.get(value);
    if (!c) return;
    setCustomerId(c.id);
    setCustomerName(c.name);
    setTaxId(c.taxId ?? "");
    setContactPerson(c.contactPerson ?? "");
    setContactEmail(c.contactEmail ?? "");
    setContactPhone(c.contactPhone ?? "");
  };

  const resetForm = () => {
    setProductId("");
    setCustomerId("");
    setCustomerName("");
    setTaxId("");
    setContactPerson("");
    setContactEmail("");
    setContactPhone("");
    setBillingType("subscription");
    setBillingCycle("yearly");
    setStartDate(today);
    setEndDate(addMonthsISO(today, 12));
    setAmount(0);
    setSeats(0);
    setStatus("active");
    setAutoRenew(true);
    setPaymentReceivedDate("");
    setNotes("");
  };

  // เมื่อเลือกสินค้า → auto-fill รูปแบบเก็บเงิน ราคา และวันหมดอายุ
  const applyProductDefaults = (pid: string, fromDate: string) => {
    const p = productById.get(pid);
    if (!p) return;
    setBillingType(p.billingType);
    setAmount(p.defaultPrice);
    if (p.billingType === "subscription") {
      const cyc = p.billingCycle ?? "yearly";
      setBillingCycle(cyc);
      setEndDate(addMonthsISO(fromDate, cyc === "yearly" ? 12 : 1));
    } else {
      setEndDate(addMonthsISO(fromDate, p.defaultTermMonths ?? 12));
    }
  };

  const handleProductChange = (pid: string) => {
    setProductId(pid);
    applyProductDefaults(pid, startDate);
  };

  const handleStartDateChange = (d: string) => {
    setStartDate(d);
    // เลื่อนวันหมดอายุตามรอบของสินค้า/รอบที่เลือกไว้
    const months = billingType === "license"
      ? productById.get(productId)?.defaultTermMonths ?? 12
      : billingCycle === "yearly" ? 12 : 1;
    setEndDate(addMonthsISO(d, months));
  };

  const buildPayload = (): Omit<Subscription, "id"> => ({
    productId,
    customerId: customerId || undefined,
    customer: {
      name: customerName.trim(),
      taxId: taxId.trim() || undefined,
      contactPerson: contactPerson.trim() || undefined,
      contactEmail: contactEmail.trim() || undefined,
      contactPhone: contactPhone.trim() || undefined,
    },
    billingType,
    billingCycle: billingType === "subscription" ? billingCycle : undefined,
    startDate,
    endDate,
    amount,
    seats: seats > 0 ? seats : undefined,
    status,
    autoRenew,
    paymentReceivedDate: paymentReceivedDate || undefined,
    notes: notes.trim() || undefined,
  });

  const summary = useMemo(
    () => summarizeRevenue(subscriptions, today, EXPIRY_THRESHOLD),
    [subscriptions, today]
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return subscriptions.filter((s) => {
      const st = effectiveStatus(s, today);
      const days = daysUntilExpiry(s, today);
      if (filter === "active" && !(st === "active" || st === "trial")) return false;
      if (filter === "expiring" && !(days >= 0 && days <= EXPIRY_THRESHOLD && st !== "expired" && st !== "cancelled")) return false;
      if (filter === "expired" && st !== "expired") return false;
      if (q) {
        const productName = productById.get(s.productId)?.name ?? "";
        if (!s.customer.name.toLowerCase().includes(q) && !productName.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [subscriptions, searchQuery, filter, today, productById]);

  // เรียง: ใกล้หมดอายุก่อน (active/expiring) → หมดอายุไว้ท้าย
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => a.endDate.localeCompare(b.endDate));
  }, [filtered]);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId) { toast.error("กรุณาเลือกสินค้า/แพ็กเกจ"); return; }
    if (!customerName.trim()) { toast.error("กรุณากรอกชื่อลูกค้า"); return; }
    onAddSubscription(buildPayload());
    resetForm();
    setIsAddOpen(false);
    toast.success("เพิ่มรายการขายเรียบร้อย");
  };

  const handleStartEdit = (s: Subscription) => {
    setEditing(s);
    setProductId(s.productId);
    setCustomerId(s.customerId ?? "");
    setCustomerName(s.customer.name);
    setTaxId(s.customer.taxId ?? "");
    setContactPerson(s.customer.contactPerson ?? "");
    setContactEmail(s.customer.contactEmail ?? "");
    setContactPhone(s.customer.contactPhone ?? "");
    setBillingType(s.billingType);
    setBillingCycle(s.billingCycle ?? "yearly");
    setStartDate(s.startDate);
    setEndDate(s.endDate);
    setAmount(s.amount);
    setSeats(s.seats ?? 0);
    setStatus(s.status);
    setAutoRenew(s.autoRenew);
    setPaymentReceivedDate(s.paymentReceivedDate ?? "");
    setNotes(s.notes ?? "");
    setIsEditOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !productId || !customerName.trim()) return;
    onUpdateSubscription({ ...editing, ...buildPayload() });
    setIsEditOpen(false);
    setEditing(null);
    toast.success("อัปเดตรายการขายเรียบร้อย");
  };

  const handleDelete = (s: Subscription) => {
    if (confirm(`ลบรายการขายของ "${s.customer.name}" ใช่หรือไม่?\nข้อมูลจะหายไปถาวร`)) {
      onDeleteSubscription(s.id);
      toast.success("ลบรายการขายเรียบร้อย");
    }
  };

  const renderFormBody = () => (
    <div className="grid gap-4 py-4">
      <div className="grid gap-2">
        <Label htmlFor="sub-product">สินค้า/แพ็กเกจ</Label>
        <Select value={productId} onValueChange={handleProductChange}>
          <SelectTrigger id="sub-product">
            <SelectValue placeholder="-- เลือกสินค้า --" />
          </SelectTrigger>
          <SelectContent>
            {products.length === 0 ? (
              <SelectItem value="_none" disabled>ยังไม่มีสินค้า — เพิ่มที่หน้า สินค้า/แพ็กเกจ ก่อน</SelectItem>
            ) : (
              products.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      {customers.length > 0 && (
        <div className="grid gap-2">
          <Label htmlFor="sub-customer-master">เลือกจากลูกค้าที่มี (optional)</Label>
          <Select value={customerId || NEW_CUSTOMER} onValueChange={handleCustomerChange}>
            <SelectTrigger id="sub-customer-master">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NEW_CUSTOMER}>— กรอกลูกค้าใหม่เอง —</SelectItem>
              {customers.filter((c) => c.active).map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {customerId && (
            <p className="text-[11px] text-emerald-600">เชื่อมกับลูกค้าใน master — แก้ช่องด้านล่างได้ (จะเก็บเป็น snapshot)</p>
          )}
        </div>
      )}

      {customerId ? (
        /* ผูก master แล้ว → อ่านอย่างเดียว (แก้ที่หน้าลูกค้า แล้วอัปเดตทุกที่) */
        <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm space-y-1">
          <div className="font-bold">{customerName || "—"}</div>
          {taxId && <div className="text-[12px] text-muted-foreground">เลขผู้เสียภาษี: {taxId}</div>}
          {(contactPerson || contactPhone) && (
            <div className="text-[12px] text-muted-foreground">
              ผู้ติดต่อ: {contactPerson || "—"}{contactPhone && ` • ${contactPhone}`}
            </div>
          )}
          {contactEmail && <div className="text-[12px] text-muted-foreground">{contactEmail}</div>}
          <p className="text-[11px] text-emerald-600 pt-1">
            ดึงจากลูกค้าใน master — แก้ที่หน้า “ลูกค้า” แล้วอัปเดตทุกที่ให้อัตโนมัติ
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="sub-customer">ชื่อบริษัทลูกค้า</Label>
              <Input id="sub-customer" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sub-taxid">เลขผู้เสียภาษี</Label>
              <Input id="sub-taxid" value={taxId} onChange={(e) => setTaxId(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="sub-contact">ผู้ติดต่อ</Label>
              <Input id="sub-contact" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sub-phone">เบอร์โทร</Label>
              <Input id="sub-phone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sub-email">อีเมล</Label>
            <Input id="sub-email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
          </div>
        </>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="sub-type">รูปแบบเก็บเงิน</Label>
          <Select value={billingType} onValueChange={(v) => setBillingType(v as ProductBillingType)}>
            <SelectTrigger id="sub-type"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="subscription">Subscription (รายรอบ)</SelectItem>
              <SelectItem value="license">License (จ่ายก้อน)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {billingType === "subscription" && (
          <div className="grid gap-2">
            <Label htmlFor="sub-cycle">รอบ</Label>
            <Select value={billingCycle} onValueChange={(v) => setBillingCycle(v as BillingCycle)}>
              <SelectTrigger id="sub-cycle"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">รายเดือน</SelectItem>
                <SelectItem value="yearly">รายปี</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="sub-start">วันซื้อ/เริ่มใช้</Label>
          <Input id="sub-start" type="date" value={startDate} onChange={(e) => handleStartDateChange(e.target.value)} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="sub-end">วันหมดอายุ</Label>
          <Input id="sub-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="sub-amount">
            ราคา (฿){billingType === "subscription" ? ` / ${billingCycle === "yearly" ? "ปี" : "เดือน"}` : ""}
          </Label>
          <Input id="sub-amount" type="number" min={0} value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="sub-seats">จำนวน user/seat (optional)</Label>
          <Input id="sub-seats" type="number" min={0} value={seats} onChange={(e) => setSeats(Number(e.target.value) || 0)} placeholder="0 = ไม่ระบุ" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="sub-status">สถานะ</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as SubscriptionStatus)}>
            <SelectTrigger id="sub-status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">ใช้งาน</SelectItem>
              <SelectItem value="trial">ทดลองใช้</SelectItem>
              <SelectItem value="cancelled">ยกเลิก</SelectItem>
              <SelectItem value="expired">หมดอายุ</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="sub-received">วันรับเงิน (optional)</Label>
          <Input id="sub-received" type="date" value={paymentReceivedDate} onChange={(e) => setPaymentReceivedDate(e.target.value)} />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Switch id="sub-autorenew" checked={autoRenew} onCheckedChange={setAutoRenew} />
        <Label htmlFor="sub-autorenew" className="cursor-pointer">ต่ออายุอัตโนมัติ</Label>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="sub-notes">หมายเหตุ</Label>
        <Textarea id="sub-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>
    </div>
  );

  const filterButton = (id: FilterId, label: string, count?: number) => (
    <Button
      variant={filter === id ? "secondary" : "ghost"}
      size="sm"
      onClick={() => setFilter(id)}
      className="h-8 text-xs"
    >
      {label}{count !== undefined ? ` (${count})` : ""}
    </Button>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Repeat className="h-6 w-6 text-primary" /> รายรับประจำ
          </h2>
          <p className="text-sm text-muted-foreground">
            ติดตามการขายระบบซ้ำ — บริษัทไหนซื้อวันไหน หมดอายุวันไหน พร้อมคำนวณ MRR/ARR
          </p>
        </div>

        <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) resetForm(); }}>
          <EditGate>
            <DialogTrigger asChild>
              <Button className="gap-2 font-semibold">
                <Plus className="h-4 w-4" /> เพิ่มรายการขาย
              </Button>
            </DialogTrigger>
          </EditGate>
          <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleAddSubmit}>
              <DialogHeader>
                <DialogTitle>เพิ่มรายการขายใหม่</DialogTitle>
                <DialogDescription>เลือกสินค้าแล้วระบบจะเติมราคา/วันหมดอายุให้อัตโนมัติ (แก้ไขได้)</DialogDescription>
              </DialogHeader>
              {renderFormBody()}
              <DialogFooter>
                <Button type="submit">เพิ่มรายการ</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-4">
            <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">MRR (รายได้ต่อเดือน)</div>
            <div className="text-lg font-black text-primary font-mono">฿{fmt(summary.mrr)}</div>
            <div className="text-[11px] text-muted-foreground">เฉพาะ subscription ที่ใช้งาน</div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-4">
            <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">ARR (รายได้ต่อปี)</div>
            <div className="text-lg font-black text-emerald-600 font-mono">฿{fmt(summary.arr)}</div>
            <div className="text-[11px] text-muted-foreground">MRR × 12</div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-4">
            <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">ลูกค้าที่ใช้งาน</div>
            <div className="text-2xl font-black">{summary.activeCount}</div>
            <div className="text-[11px] text-muted-foreground">
              subscription {summary.recurringCount} · license {summary.activeLicenseCount}
            </div>
          </CardContent>
        </Card>
        <Card className={summary.expiringSoonCount > 0 ? "border-amber-300 bg-amber-50/60 dark:bg-amber-950/20" : "border-border/50 bg-card/50"}>
          <CardContent className="pt-4">
            <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1">
              {summary.expiringSoonCount > 0 && <AlertTriangle className="h-3 w-3 text-amber-600" />}
              ใกล้หมดอายุ (≤{EXPIRY_THRESHOLD} วัน)
            </div>
            <div className="text-2xl font-black text-amber-600">{summary.expiringSoonCount}</div>
            <div className="text-[11px] text-muted-foreground">หมดอายุแล้ว {summary.expiredCount} ราย</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters + Search */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex items-center gap-1 rounded-lg border border-border/60 p-1 bg-card/40 w-fit">
          {filterButton("all", "ทั้งหมด", subscriptions.length)}
          {filterButton("active", "ใช้งาน")}
          {filterButton("expiring", "ใกล้หมด", summary.expiringSoonCount)}
          {filterButton("expired", "หมดอายุ", summary.expiredCount)}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ค้นหาบริษัท หรือสินค้า..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 sm:max-w-xs"
          />
        </div>
      </div>

      {/* Table */}
      <Card className="border-border/50 bg-card/50">
        <CardContent className="pt-4">
          <div className="overflow-x-auto -mx-2 sm:mx-0">
            <Table className="min-w-[820px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px]">บริษัทลูกค้า</TableHead>
                  <TableHead className="hidden md:table-cell">สินค้า/แพ็กเกจ</TableHead>
                  <TableHead className="hidden lg:table-cell">วันซื้อ</TableHead>
                  <TableHead>วันหมดอายุ</TableHead>
                  <TableHead className="text-right">ราคา</TableHead>
                  <TableHead className="text-center">สถานะ</TableHead>
                  <TableHead className="text-center w-[100px]">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground text-sm">
                      {searchQuery || filter !== "all"
                        ? "ไม่พบรายการที่ตรงกับเงื่อนไข"
                        : "ยังไม่มีรายการขาย กดปุ่ม 'เพิ่มรายการขาย' เพื่อเริ่มต้น"}
                    </TableCell>
                  </TableRow>
                ) : (
                  sorted.map((s) => {
                    const st = effectiveStatus(s, today);
                    const days = daysUntilExpiry(s, today);
                    const product = productById.get(s.productId);
                    const expiringSoon = days >= 0 && days <= EXPIRY_THRESHOLD && st !== "expired" && st !== "cancelled";
                    const badge = statusBadge[st];
                    const cycleSuffix = s.billingType === "subscription"
                      ? `/${s.billingCycle === "yearly" ? "ปี" : "เดือน"}`
                      : "";
                    return (
                      <TableRow key={s.id} className={st === "expired" || st === "cancelled" ? "opacity-60 hover:bg-muted/20" : "hover:bg-muted/30"}>
                        <TableCell>
                          <div className="font-semibold text-sm">{s.customer.name || "—"}</div>
                          <div className="text-[11px] text-muted-foreground md:hidden">
                            {product?.name ?? "—"}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                          {product?.name ?? <span className="italic text-rose-500">ไม่พบสินค้า</span>}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs font-mono">{s.startDate}</TableCell>
                        <TableCell className="text-xs font-mono">
                          {s.endDate}
                          {expiringSoon && (
                            <div className="text-[10px] text-amber-600 font-semibold">เหลือ {days} วัน</div>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-primary font-bold">
                          ฿{fmt(s.amount)}<span className="text-muted-foreground font-normal">{cycleSuffix}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </TableCell>
                        <TableCell>
                          <EditGate fallback={<span className="text-muted-foreground/40">—</span>}>
                            <div className="flex justify-center gap-1">
                              <Button size="icon" variant="ghost" onClick={() => handleStartEdit(s)} className="h-7 w-7" title="แก้ไข">
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => handleDelete(s)} className="h-7 w-7 text-destructive hover:bg-destructive/10" title="ลบ">
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
                <DialogTitle>แก้ไขรายการขาย</DialogTitle>
                <DialogDescription>ปรับข้อมูลลูกค้า วันหมดอายุ ราคา หรือสถานะ</DialogDescription>
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
