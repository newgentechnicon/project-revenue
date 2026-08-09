"use client";

import React, { useMemo } from "react";
import { PaymentTerms, PaymentInstallment } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreditCard, Plus, Trash2, AlertCircle } from "lucide-react";

interface PaymentTermsSectionProps {
  terms: PaymentTerms;
  onUpdate: (patch: Partial<PaymentTerms>) => void;
}

export function PaymentTermsSection({ terms, onUpdate }: PaymentTermsSectionProps) {
  const installmentTotal = useMemo(
    () => terms.installments.reduce((s, i) => s + (i.percent || 0), 0),
    [terms.installments]
  );
  const installmentsBalanced = Math.abs(installmentTotal - 100) < 0.001;

  const handleAdd = () => {
    const newInst: PaymentInstallment = {
      id: "inst_" + Date.now(),
      name: `งวดที่ ${terms.installments.length + 1}`,
      percent: 0,
      dueAfterDays: 0,
    };
    onUpdate({ installments: [...terms.installments, newInst] });
  };

  const handleUpdate = (id: string, patch: Partial<PaymentInstallment>) => {
    onUpdate({
      installments: terms.installments.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    });
  };

  const handleRemove = (id: string) => {
    onUpdate({ installments: terms.installments.filter((i) => i.id !== id) });
  };

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" /> เงื่อนไขการชำระเงิน
            </CardTitle>
            <CardDescription>กำหนดงวดเงิน วันครบกำหนด และค่าปรับล่าช้า</CardDescription>
          </div>
          <div className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
            installmentsBalanced
              ? "bg-emerald-50 border-emerald-200 text-emerald-700"
              : "bg-amber-50 border-amber-200 text-amber-700"
          }`}>
            รวมงวด: {installmentTotal.toFixed(1)}%
            {!installmentsBalanced && " (ควรเท่ากับ 100%)"}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="pt-due">เงื่อนไขเครดิตหลังออกใบแจ้งหนี้ (วัน)</Label>
            <Input
              id="pt-due"
              type="number"
              min={0}
              value={terms.paymentDueDays}
              onChange={(e) => onUpdate({ paymentDueDays: parseInt(e.target.value) || 0 })}
            />
            <p className="text-[10px] text-muted-foreground">เช่น 30 = Net 30</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pt-late">ค่าปรับล่าช้า (% ต่อเดือน)</Label>
            <Input
              id="pt-late"
              type="number"
              min={0}
              step={0.1}
              value={terms.lateFeePercent}
              onChange={(e) => onUpdate({ lateFeePercent: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div className="space-y-1.5 md:col-span-1">
            <Label className="opacity-0">.</Label>
            <Button onClick={handleAdd} className="w-full gap-2">
              <Plus className="h-4 w-4" /> เพิ่มงวด
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[8%] text-center">#</TableHead>
                <TableHead>ชื่องวด</TableHead>
                <TableHead className="text-center w-[100px]">% ของยอด</TableHead>
                <TableHead className="text-center w-[150px]">ครบกำหนด<br /><span className="text-[10px] text-muted-foreground">(วันหลังเซ็นสัญญา)</span></TableHead>
                <TableHead>รายละเอียด</TableHead>
                <TableHead className="text-center w-[60px]">ลบ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {terms.installments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-6 text-muted-foreground text-sm">
                    ยังไม่มีงวดเงิน — กดปุ่ม &ldquo;เพิ่มงวด&rdquo; ด้านบน
                  </TableCell>
                </TableRow>
              ) : (
                terms.installments.map((inst, idx) => (
                  <TableRow key={inst.id}>
                    <TableCell className="text-center font-mono text-xs text-muted-foreground">
                      {idx + 1}
                    </TableCell>
                    <TableCell>
                      <Input
                        value={inst.name}
                        onChange={(e) => handleUpdate(inst.id, { name: e.target.value })}
                        className="h-8"
                        placeholder="เช่น เงินมัดจำ"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={inst.percent || ""}
                        onChange={(e) => handleUpdate(inst.id, { percent: parseFloat(e.target.value) || 0 })}
                        className="h-8 text-center"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        value={inst.dueAfterDays}
                        onChange={(e) => handleUpdate(inst.id, { dueAfterDays: parseInt(e.target.value) || 0 })}
                        className="h-8 text-center"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={inst.description ?? ""}
                        onChange={(e) => handleUpdate(inst.id, { description: e.target.value })}
                        className="h-8"
                        placeholder="เช่น ชำระเมื่อส่งมอบ MVP"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleRemove(inst.id)}
                        className="h-7 w-7 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {!installmentsBalanced && terms.installments.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              ผลรวม % ของงวดเงินคือ <strong>{installmentTotal.toFixed(1)}%</strong> ควรเท่ากับ 100% เพื่อให้ครอบคลุมยอดเสนอราคาทั้งหมด
            </span>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="pt-notes">หมายเหตุเพิ่มเติม</Label>
          <Textarea
            id="pt-notes"
            value={terms.notes ?? ""}
            onChange={(e) => onUpdate({ notes: e.target.value })}
            rows={2}
            placeholder="เช่น โอนเข้าบัญชีธนาคารกสิกรไทย เลขที่ XXX-X-XXXXX-X ชื่อบัญชี..."
          />
        </div>
      </CardContent>
    </Card>
  );
}
