"use client";

import React, { useMemo, useState } from "react";
import { Product, ProductBillingType, BillingCycle } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Edit2, Package, Search } from "lucide-react";
import { EditGate } from "@/components/project-cost/edit-gate";
import { toast } from "sonner";

interface ProductsViewProps {
  products: Product[];
  onAddProduct: (item: Omit<Product, "id">) => void;
  onUpdateProduct: (item: Product) => void;
  onDeleteProduct: (id: string) => void;
}

const fmt = (v: number) => new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(v);

const billingTypeLabel: Record<ProductBillingType, string> = {
  license: "License (จ่ายก้อน)",
  subscription: "Subscription (รายรอบ)",
};
const cycleLabel: Record<BillingCycle, string> = {
  monthly: "รายเดือน",
  yearly: "รายปี",
};

export function ProductsView({
  products,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
}: ProductsViewProps) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [billingType, setBillingType] = useState<ProductBillingType>("subscription");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("yearly");
  const [defaultTermMonths, setDefaultTermMonths] = useState<number>(12);
  const [defaultPrice, setDefaultPrice] = useState<number>(0);
  const [active, setActive] = useState(true);
  const [notes, setNotes] = useState("");

  const resetForm = () => {
    setName("");
    setDescription("");
    setBillingType("subscription");
    setBillingCycle("yearly");
    setDefaultTermMonths(12);
    setDefaultPrice(0);
    setActive(true);
    setNotes("");
  };

  const buildPayload = (): Omit<Product, "id"> => ({
    name: name.trim(),
    description: description.trim() || undefined,
    billingType,
    billingCycle: billingType === "subscription" ? billingCycle : undefined,
    defaultTermMonths: billingType === "license" ? defaultTermMonths : undefined,
    defaultPrice,
    active,
    notes: notes.trim() || undefined,
  });

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.description ?? "").toLowerCase().includes(q)
    );
  }, [products, searchQuery]);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAddProduct(buildPayload());
    resetForm();
    setIsAddOpen(false);
    toast.success("เพิ่มสินค้า/แพ็กเกจเรียบร้อย");
  };

  const handleStartEdit = (p: Product) => {
    setEditing(p);
    setName(p.name);
    setDescription(p.description ?? "");
    setBillingType(p.billingType);
    setBillingCycle(p.billingCycle ?? "yearly");
    setDefaultTermMonths(p.defaultTermMonths ?? 12);
    setDefaultPrice(p.defaultPrice);
    setActive(p.active);
    setNotes(p.notes ?? "");
    setIsEditOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !name.trim()) return;
    onUpdateProduct({ ...editing, ...buildPayload() });
    setIsEditOpen(false);
    setEditing(null);
    toast.success("อัปเดตสินค้า/แพ็กเกจเรียบร้อย");
  };

  const handleDelete = (p: Product) => {
    if (confirm(`ลบ "${p.name}" ใช่หรือไม่?\nรายการขายที่ผูกอยู่จะยังคงเดิมแต่จะหาชื่อสินค้าไม่เจอ`)) {
      onDeleteProduct(p.id);
      toast.success("ลบสินค้า/แพ็กเกจเรียบร้อย");
    }
  };

  const renderFormBody = () => (
    <div className="grid gap-4 py-4">
      <div className="grid gap-2">
        <Label htmlFor="prod-name">ชื่อสินค้า/แพ็กเกจ</Label>
        <Input id="prod-name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="prod-desc">รายละเอียด (optional)</Label>
        <Textarea id="prod-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="prod-type">รูปแบบการเก็บเงิน</Label>
          <Select value={billingType} onValueChange={(v) => setBillingType(v as ProductBillingType)}>
            <SelectTrigger id="prod-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="subscription">Subscription (รายรอบ)</SelectItem>
              <SelectItem value="license">License (จ่ายก้อน)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {billingType === "subscription" ? (
          <div className="grid gap-2">
            <Label htmlFor="prod-cycle">รอบการเก็บเงิน</Label>
            <Select value={billingCycle} onValueChange={(v) => setBillingCycle(v as BillingCycle)}>
              <SelectTrigger id="prod-cycle">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">รายเดือน</SelectItem>
                <SelectItem value="yearly">รายปี</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="grid gap-2">
            <Label htmlFor="prod-term">อายุ License (เดือน)</Label>
            <Input
              id="prod-term"
              type="number"
              min={1}
              value={defaultTermMonths}
              onChange={(e) => setDefaultTermMonths(Number(e.target.value) || 1)}
            />
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4 items-end">
        <div className="grid gap-2">
          <Label htmlFor="prod-price">
            ราคาตั้งต้น (฿){billingType === "subscription" ? ` / ${cycleLabel[billingCycle]}` : ""}
          </Label>
          <Input
            id="prod-price"
            type="number"
            min={0}
            value={defaultPrice}
            onChange={(e) => setDefaultPrice(Number(e.target.value) || 0)}
            required
          />
        </div>
        <div className="flex items-center gap-2 pb-2">
          <Switch id="prod-active" checked={active} onCheckedChange={setActive} />
          <Label htmlFor="prod-active" className="cursor-pointer">เปิดขายอยู่</Label>
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="prod-notes">หมายเหตุ</Label>
        <Textarea id="prod-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" /> สินค้า/แพ็กเกจ
          </h2>
          <p className="text-sm text-muted-foreground">
            กำหนดสินค้าที่ขายแบบรายรับซ้ำ (license / subscription) — ใช้ผูกกับรายการขายในหน้ารายรับประจำ
          </p>
        </div>

        <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) resetForm(); }}>
          <EditGate>
            <DialogTrigger asChild>
              <Button className="gap-2 font-semibold">
                <Plus className="h-4 w-4" /> เพิ่มสินค้า
              </Button>
            </DialogTrigger>
          </EditGate>
          <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleAddSubmit}>
              <DialogHeader>
                <DialogTitle>เพิ่มสินค้า/แพ็กเกจใหม่</DialogTitle>
                <DialogDescription>กำหนดรูปแบบการเก็บเงินและราคาตั้งต้น</DialogDescription>
              </DialogHeader>
              {renderFormBody()}
              <DialogFooter>
                <Button type="submit">เพิ่มสินค้า</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="ค้นหาสินค้า/แพ็กเกจ..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 max-w-md"
        />
      </div>

      <Card className="border-border/50 bg-card/50">
        <CardContent className="pt-4">
          <div className="overflow-x-auto -mx-2 sm:mx-0">
            <Table className="min-w-[680px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">ชื่อ</TableHead>
                  <TableHead>รูปแบบ</TableHead>
                  <TableHead>รอบ/อายุ</TableHead>
                  <TableHead className="text-right">ราคาตั้งต้น</TableHead>
                  <TableHead className="text-center">สถานะ</TableHead>
                  <TableHead className="text-center w-[100px]">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground text-sm">
                      {searchQuery ? "ไม่พบสินค้าที่ตรงกับเงื่อนไข" : "ยังไม่มีสินค้า กดปุ่ม 'เพิ่มสินค้า' เพื่อเริ่มต้น"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((p) => (
                    <TableRow key={p.id} className={p.active ? "hover:bg-muted/30" : "opacity-60 hover:bg-muted/20"}>
                      <TableCell>
                        <div className="font-semibold text-sm">{p.name}</div>
                        {p.description && (
                          <div className="text-[11px] text-muted-foreground line-clamp-1">{p.description}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{billingTypeLabel[p.billingType]}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {p.billingType === "subscription"
                          ? cycleLabel[p.billingCycle ?? "yearly"]
                          : `${p.defaultTermMonths ?? 12} เดือน`}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-primary font-bold">
                        ฿{fmt(p.defaultPrice)}
                      </TableCell>
                      <TableCell className="text-center">
                        {p.active ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium border bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-900">
                            เปิดขาย
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium border bg-slate-100 text-slate-700 border-slate-200">
                            ปิด
                          </span>
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
                <DialogTitle>แก้ไขสินค้า/แพ็กเกจ</DialogTitle>
                <DialogDescription>ปรับรูปแบบการเก็บเงิน ราคา หรือสถานะ</DialogDescription>
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
