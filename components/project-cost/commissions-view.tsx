"use client";

import React, { useMemo, useState } from "react";
import {
  Commission, CommissionPayee, CommissionStatus, CommissionSourceType,
  CommissionBasis, SubscriptionCommissionMode,
  Project, Subscription, Product, PositionRate, OverheadItem,
} from "@/lib/types";
import { calculateProjectCosts } from "@/lib/calculations";
import { estimateCommissionTotal, summarizeCommissions, ScoredCommission } from "@/lib/commissions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Edit2, Percent, Search } from "lucide-react";
import { EditGate } from "@/components/project-cost/edit-gate";
import { toast } from "sonner";

interface CommissionsViewProps {
  commissions: Commission[];
  payees: CommissionPayee[];
  projects: Project[];
  subscriptions: Subscription[];
  products: Product[];
  positions: PositionRate[];
  overheads: OverheadItem[];
  onAddCommission: (item: Omit<Commission, "id">) => void;
  onUpdateCommission: (item: Commission) => void;
  onDeleteCommission: (id: string) => void;
}

const fmt = (v: number) => new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(v);

type FilterId = "all" | "pending" | "paid" | "cancelled";

const statusBadge: Record<CommissionStatus, { label: string; cls: string }> = {
  pending: { label: "ค้างจ่าย", cls: "bg-amber-100 text-amber-800 border-amber-200" },
  paid: { label: "จ่ายแล้ว", cls: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-900" },
  cancelled: { label: "ยกเลิก", cls: "bg-slate-100 text-slate-700 border-slate-200" },
};

export function CommissionsView({
  commissions,
  payees,
  projects,
  subscriptions,
  products,
  positions,
  overheads,
  onAddCommission,
  onUpdateCommission,
  onDeleteCommission,
}: CommissionsViewProps) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editing, setEditing] = useState<Commission | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<FilterId>("all");

  // Form state
  const [payeeId, setPayeeId] = useState("");
  const [sourceType, setSourceType] = useState<CommissionSourceType>("project");
  const [sourceId, setSourceId] = useState("");
  const [basis, setBasis] = useState<CommissionBasis>("percent");
  const [ratePercent, setRatePercent] = useState<number>(0);
  const [fixedAmount, setFixedAmount] = useState<number>(0);
  const [subscriptionMode, setSubscriptionMode] = useState<SubscriptionCommissionMode>("one_time");
  const [recurringMaxPayments, setRecurringMaxPayments] = useState<number>(0);
  const [status, setStatus] = useState<CommissionStatus>("pending");
  const [payoutDate, setPayoutDate] = useState("");
  const [notes, setNotes] = useState("");

  const payeeById = useMemo(() => new Map(payees.map((p) => [p.id, p])), [payees]);
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const subById = useMemo(() => new Map(subscriptions.map((s) => [s.id, s])), [subscriptions]);
  const productName = useMemo(() => new Map(products.map((p) => [p.id, p.name])), [products]);

  // ยอดขายโครงการ (ก่อน VAT) ใช้เป็นฐานคิดคอม
  const projectBaseById = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of projects) {
      m.set(p.id, calculateProjectCosts(p, positions, overheads).priceBeforeTax);
    }
    return m;
  }, [projects, positions, overheads]);

  const resetForm = () => {
    setPayeeId("");
    setSourceType("project");
    setSourceId("");
    setBasis("percent");
    setRatePercent(0);
    setFixedAmount(0);
    setSubscriptionMode("one_time");
    setRecurringMaxPayments(0);
    setStatus("pending");
    setPayoutDate("");
    setNotes("");
  };

  const buildPayload = (): Omit<Commission, "id"> => ({
    payeeId,
    sourceType,
    sourceId,
    basis,
    ratePercent: basis === "percent" ? ratePercent : undefined,
    fixedAmount: basis === "fixed" ? fixedAmount : undefined,
    subscriptionMode: sourceType === "subscription" ? subscriptionMode : undefined,
    recurringMaxPayments:
      sourceType === "subscription" && subscriptionMode === "recurring" && recurringMaxPayments > 0
        ? recurringMaxPayments
        : undefined,
    status,
    payoutDate: payoutDate || undefined,
    notes: notes.trim() || undefined,
  });

  // ประเมินคอมจาก commission object + แหล่งที่มา
  const amountOf = (c: Commission): number => {
    if (c.sourceType === "project") {
      return estimateCommissionTotal(c, { projectBaseAmount: projectBaseById.get(c.sourceId) ?? 0 });
    }
    return estimateCommissionTotal(c, { subscription: subById.get(c.sourceId) });
  };

  const sourceLabel = (c: Commission): string => {
    if (c.sourceType === "project") {
      const p = projectById.get(c.sourceId);
      return p ? p.name : "(ไม่พบโครงการ)";
    }
    const s = subById.get(c.sourceId);
    if (!s) return "(ไม่พบ subscription)";
    return `${s.customer.name} · ${productName.get(s.productId) ?? "—"}`;
  };

  const handlePayeeChange = (v: string) => {
    setPayeeId(v);
    const p = payeeById.get(v);
    if (p?.defaultRatePercent && basis === "percent" && !ratePercent) {
      setRatePercent(p.defaultRatePercent);
    }
  };

  const enriched = useMemo(() => {
    return commissions.map((c) => ({
      commission: c,
      payee: payeeById.get(c.payeeId),
      label: sourceLabel(c),
      amount: amountOf(c),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commissions, payeeById, projectById, subById, productName, projectBaseById]);

  const summary = useMemo(
    () => summarizeCommissions(enriched.map<ScoredCommission>((e) => ({
      payeeId: e.commission.payeeId, status: e.commission.status, amount: e.amount,
    }))),
    [enriched]
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return enriched.filter((e) => {
      if (filter !== "all" && e.commission.status !== filter) return false;
      if (q) {
        const payeeName = e.payee?.name.toLowerCase() ?? "";
        if (!payeeName.includes(q) && !e.label.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [enriched, filter, searchQuery]);

  // preview ยอดคอมในฟอร์ม
  const formPreview = useMemo(() => {
    if (!sourceId) return 0;
    const pseudo: Commission = {
      id: "_preview", payeeId, sourceType, sourceId, basis,
      ratePercent: basis === "percent" ? ratePercent : undefined,
      fixedAmount: basis === "fixed" ? fixedAmount : undefined,
      subscriptionMode: sourceType === "subscription" ? subscriptionMode : undefined,
      recurringMaxPayments: recurringMaxPayments > 0 ? recurringMaxPayments : undefined,
      status: "pending",
    };
    return amountOf(pseudo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payeeId, sourceType, sourceId, basis, ratePercent, fixedAmount, subscriptionMode, recurringMaxPayments, projectBaseById, subById]);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payeeId) { toast.error("กรุณาเลือกผู้รับคอม"); return; }
    if (!sourceId) { toast.error("กรุณาเลือกแหล่งที่มา (โครงการ/subscription)"); return; }
    onAddCommission(buildPayload());
    resetForm();
    setIsAddOpen(false);
    toast.success("เพิ่มรายการคอมเรียบร้อย");
  };

  const handleStartEdit = (c: Commission) => {
    setEditing(c);
    setPayeeId(c.payeeId);
    setSourceType(c.sourceType);
    setSourceId(c.sourceId);
    setBasis(c.basis);
    setRatePercent(c.ratePercent ?? 0);
    setFixedAmount(c.fixedAmount ?? 0);
    setSubscriptionMode(c.subscriptionMode ?? "one_time");
    setRecurringMaxPayments(c.recurringMaxPayments ?? 0);
    setStatus(c.status);
    setPayoutDate(c.payoutDate ?? "");
    setNotes(c.notes ?? "");
    setIsEditOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !payeeId || !sourceId) return;
    onUpdateCommission({ ...editing, ...buildPayload() });
    setIsEditOpen(false);
    setEditing(null);
    toast.success("อัปเดตรายการคอมเรียบร้อย");
  };

  const handleDelete = (c: Commission) => {
    if (confirm("ลบรายการค่าคอมนี้ใช่หรือไม่?")) {
      onDeleteCommission(c.id);
      toast.success("ลบรายการคอมเรียบร้อย");
    }
  };

  const renderFormBody = () => (
    <div className="grid gap-4 py-4">
      <div className="grid gap-2">
        <Label htmlFor="comm-payee">ผู้รับคอม</Label>
        <Select value={payeeId} onValueChange={handlePayeeChange}>
          <SelectTrigger id="comm-payee"><SelectValue placeholder="-- เลือกผู้รับคอม --" /></SelectTrigger>
          <SelectContent>
            {payees.length === 0 ? (
              <SelectItem value="_none" disabled>ยังไม่มีผู้รับคอม — เพิ่มที่หน้า “ผู้รับคอม” ก่อน</SelectItem>
            ) : (
              payees.filter((p) => p.active).map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="comm-srctype">คิดจาก</Label>
          <Select value={sourceType} onValueChange={(v) => { setSourceType(v as CommissionSourceType); setSourceId(""); }}>
            <SelectTrigger id="comm-srctype"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="project">โครงการ</SelectItem>
              <SelectItem value="subscription">รายรับประจำ (subscription)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="comm-status">สถานะ</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as CommissionStatus)}>
            <SelectTrigger id="comm-status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">ค้างจ่าย</SelectItem>
              <SelectItem value="paid">จ่ายแล้ว</SelectItem>
              <SelectItem value="cancelled">ยกเลิก</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="comm-source">{sourceType === "project" ? "เลือกโครงการ" : "เลือก subscription"}</Label>
        <Select value={sourceId} onValueChange={setSourceId}>
          <SelectTrigger id="comm-source"><SelectValue placeholder="-- เลือก --" /></SelectTrigger>
          <SelectContent>
            {sourceType === "project"
              ? projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}{p.client?.name ? ` · ${p.client.name}` : ""}
                  </SelectItem>
                ))
              : subscriptions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.customer.name} · {productName.get(s.productId) ?? "—"}
                  </SelectItem>
                ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="comm-basis">ฐานคิดคอม</Label>
          <Select value={basis} onValueChange={(v) => setBasis(v as CommissionBasis)}>
            <SelectTrigger id="comm-basis"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="percent">% ของยอดขาย</SelectItem>
              <SelectItem value="fixed">จำนวนเงินคงที่</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {basis === "percent" ? (
          <div className="grid gap-2">
            <Label htmlFor="comm-rate">เรต (%)</Label>
            <Input id="comm-rate" type="number" min={0} max={100} step={0.5} value={ratePercent} onChange={(e) => setRatePercent(Number(e.target.value) || 0)} />
          </div>
        ) : (
          <div className="grid gap-2">
            <Label htmlFor="comm-fixed">จำนวนเงิน (฿)</Label>
            <Input id="comm-fixed" type="number" min={0} value={fixedAmount} onChange={(e) => setFixedAmount(Number(e.target.value) || 0)} />
          </div>
        )}
      </div>

      {sourceType === "subscription" && (
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="comm-mode">รูปแบบ</Label>
            <Select value={subscriptionMode} onValueChange={(v) => setSubscriptionMode(v as SubscriptionCommissionMode)}>
              <SelectTrigger id="comm-mode"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="one_time">ครั้งเดียว (ตอนขาย)</SelectItem>
                <SelectItem value="recurring">ทุกงวด (recurring)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {subscriptionMode === "recurring" && (
            <div className="grid gap-2">
              <Label htmlFor="comm-maxpay">จำกัดจำนวนงวด</Label>
              <Input id="comm-maxpay" type="number" min={0} value={recurringMaxPayments} onChange={(e) => setRecurringMaxPayments(Number(e.target.value) || 0)} placeholder="0 = ไม่จำกัด" />
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="comm-payout">วันจ่ายคอม (optional)</Label>
          <Input id="comm-payout" type="date" value={payoutDate} onChange={(e) => setPayoutDate(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label>คอมประเมิน (ตลอดสัญญา)</Label>
          <div className="h-9 flex items-center font-mono font-bold text-primary">฿{fmt(formPreview)}</div>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="comm-notes">หมายเหตุ</Label>
        <Textarea id="comm-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
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
            <Percent className="h-6 w-6 text-primary" /> ค่าคอมมิชชั่น
          </h2>
          <p className="text-sm text-muted-foreground">
            คิดค่าคอมจากยอดขายโครงการและรายรับประจำ — ผูกกับผู้ขาย/พาร์ทเนอร์ ติดตามค้างจ่าย/จ่ายแล้ว
          </p>
        </div>

        <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) resetForm(); }}>
          <EditGate>
            <DialogTrigger asChild>
              <Button className="gap-2 font-semibold">
                <Plus className="h-4 w-4" /> เพิ่มรายการคอม
              </Button>
            </DialogTrigger>
          </EditGate>
          <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleAddSubmit}>
              <DialogHeader>
                <DialogTitle>เพิ่มรายการค่าคอม</DialogTitle>
                <DialogDescription>เลือกผู้รับคอม + แหล่งที่มา แล้วระบบจะประเมินยอดคอมให้</DialogDescription>
              </DialogHeader>
              {renderFormBody()}
              <DialogFooter>
                <Button type="submit">เพิ่มรายการ</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-4">
            <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">ค่าคอมรวม</div>
            <div className="text-lg font-black text-primary font-mono">฿{fmt(summary.totalAll)}</div>
            <div className="text-[11px] text-muted-foreground">ค้างจ่าย + จ่ายแล้ว</div>
          </CardContent>
        </Card>
        <Card className="border-amber-300 bg-amber-50/60 dark:bg-amber-950/20">
          <CardContent className="pt-4">
            <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">ค้างจ่าย</div>
            <div className="text-lg font-black text-amber-600 font-mono">฿{fmt(summary.totalPending)}</div>
            <div className="text-[11px] text-muted-foreground">{summary.countPending} รายการ</div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-4">
            <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">จ่ายแล้ว</div>
            <div className="text-lg font-black text-emerald-600 font-mono">฿{fmt(summary.totalPaid)}</div>
            <div className="text-[11px] text-muted-foreground">{summary.countPaid} รายการ</div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-4">
            <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">ผู้รับคอม</div>
            <div className="text-2xl font-black">{summary.byPayee.length}</div>
            <div className="text-[11px] text-muted-foreground">คน/ราย ที่มีคอม</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters + Search */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex items-center gap-1 rounded-lg border border-border/60 p-1 bg-card/40 w-fit">
          {filterButton("all", "ทั้งหมด", commissions.length)}
          {filterButton("pending", "ค้างจ่าย", summary.countPending)}
          {filterButton("paid", "จ่ายแล้ว", summary.countPaid)}
          {filterButton("cancelled", "ยกเลิก")}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="ค้นหาผู้รับคอม หรือแหล่งที่มา..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 sm:max-w-xs" />
        </div>
      </div>

      {/* Table */}
      <Card className="border-border/50 bg-card/50">
        <CardContent className="pt-4">
          <div className="overflow-x-auto -mx-2 sm:mx-0">
            <Table className="min-w-[760px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[150px]">ผู้รับคอม</TableHead>
                  <TableHead className="min-w-[180px]">แหล่งที่มา</TableHead>
                  <TableHead>ฐาน/เรต</TableHead>
                  <TableHead className="text-right">คอม (ประเมิน)</TableHead>
                  <TableHead className="text-center">สถานะ</TableHead>
                  <TableHead className="text-center w-[100px]">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground text-sm">
                      {searchQuery || filter !== "all"
                        ? "ไม่พบรายการที่ตรงกับเงื่อนไข"
                        : "ยังไม่มีรายการคอม กดปุ่ม 'เพิ่มรายการคอม' เพื่อเริ่มต้น"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map(({ commission: c, payee, label, amount }) => {
                    const badge = statusBadge[c.status];
                    const rateText = c.basis === "percent" ? `${c.ratePercent ?? 0}%` : `฿${fmt(c.fixedAmount ?? 0)}`;
                    const modeText = c.sourceType === "subscription"
                      ? c.subscriptionMode === "recurring" ? " · ทุกงวด" : " · ครั้งเดียว"
                      : "";
                    return (
                      <TableRow key={c.id} className={c.status === "cancelled" ? "opacity-60 hover:bg-muted/20" : "hover:bg-muted/30"}>
                        <TableCell className="font-semibold text-sm">
                          {payee?.name ?? <span className="italic text-rose-500">ไม่พบผู้รับคอม</span>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted border border-border/60 mr-1">
                            {c.sourceType === "project" ? "โครงการ" : "subscription"}
                          </span>
                          {label}
                        </TableCell>
                        <TableCell className="text-xs font-mono">{rateText}<span className="text-muted-foreground">{modeText}</span></TableCell>
                        <TableCell className="text-right font-mono text-xs text-primary font-bold">฿{fmt(amount)}</TableCell>
                        <TableCell className="text-center">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${badge.cls}`}>{badge.label}</span>
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
                <DialogTitle>แก้ไขรายการค่าคอม</DialogTitle>
                <DialogDescription>ปรับผู้รับคอม แหล่งที่มา เรต หรือสถานะ</DialogDescription>
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
