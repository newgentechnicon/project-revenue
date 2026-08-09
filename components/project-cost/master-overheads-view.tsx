"use client";

import React, { useState } from "react";
import { OverheadItem } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Edit2, Landmark } from "lucide-react";
import { EditGate } from "@/components/project-cost/edit-gate";
import { toast } from "sonner";

interface MasterOverheadsViewProps {
  overheads: OverheadItem[];
  onAddOverhead: (item: Omit<OverheadItem, "id">) => void;
  onUpdateOverhead: (item: OverheadItem) => void;
  onDeleteOverhead: (id: string) => void;
}

export function MasterOverheadsView({
  overheads,
  onAddOverhead,
  onUpdateOverhead,
  onDeleteOverhead,
}: MasterOverheadsViewProps) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingOverhead, setEditingOverhead] = useState<OverheadItem | null>(null);

  // Form States
  const [name, setName] = useState("");
  const [cost, setCost] = useState<number>(0);
  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly");
  const [effectiveFrom, setEffectiveFrom] = useState<string>(new Date().toISOString().split("T")[0]);
  const [effectiveTo, setEffectiveTo] = useState<string>("");

  const today = new Date().toISOString().split("T")[0];
  const isActive = (item: OverheadItem) => {
    if (item.effectiveFrom && today < item.effectiveFrom) return false;
    if (item.effectiveTo && today > item.effectiveTo) return false;
    return true;
  };

  const [searchQuery, setSearchQuery] = useState("");

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onAddOverhead({
      name,
      cost,
      period,
      effectiveFrom: effectiveFrom || new Date().toISOString().split("T")[0],
      effectiveTo: effectiveTo || undefined,
    });

    setName("");
    setCost(0);
    setPeriod("monthly");
    setEffectiveFrom(new Date().toISOString().split("T")[0]);
    setEffectiveTo("");
    setIsAddOpen(false);
    toast.success("เพิ่มรายการค่าใช้จ่ายส่วนกลางเข้าระบบ Master Data แล้ว");
  };

  const handleStartEdit = (item: OverheadItem) => {
    setEditingOverhead(item);
    setName(item.name);
    setCost(item.cost);
    setPeriod(item.period);
    setEffectiveFrom(item.effectiveFrom || new Date().toISOString().split("T")[0]);
    setEffectiveTo(item.effectiveTo || "");
    setIsEditOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOverhead || !name.trim()) return;

    onUpdateOverhead({
      id: editingOverhead.id,
      name,
      cost,
      period,
      effectiveFrom: effectiveFrom || new Date().toISOString().split("T")[0],
      effectiveTo: effectiveTo || undefined,
    });

    setEditingOverhead(null);
    setIsEditOpen(false);
    toast.success("อัปเดตรายการค่าใช้จ่ายเรียบร้อยแล้ว");
  };

  const handleDeleteClick = (id: string, name: string) => {
    if (confirm(`คุณต้องการลบค่าใช้จ่ายส่วนกลาง "${name}" หรือไม่?\nการลบนี้จะมีผลต่อการปันส่วนของทุกโครงการโดยทันที`)) {
      onDeleteOverhead(id);
      toast.success("ลบรายการค่าใช้จ่ายแล้ว");
    }
  };

  const filteredOverheads = overheads.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalMonthlyOverhead = overheads.filter(isActive).reduce((sum, item) => {
    const monthlyCost = item.period === "yearly" ? item.cost / 12 : item.cost;
    return sum + monthlyCost;
  }, 0);

  const totalYearlyOverhead = totalMonthlyOverhead * 12;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">ข้อมูลค่าใช้จ่ายส่วนกลาง (Company Overheads Master)</h2>
          <p className="text-sm text-muted-foreground">
            จัดการค่าเช่า ค่าบิลสาธารณูปโภค ค่าซอฟต์แวร์ และค่าใช้จ่ายดำเนินงานส่วนกลางเพื่อใช้ปันส่วนเข้าโปรเจกต์
          </p>
        </div>

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <EditGate>
            <DialogTrigger asChild>
              <Button className="gap-2 font-semibold">
                <Plus className="h-4 w-4" /> เพิ่มค่าใช้จ่ายหลัก
              </Button>
            </DialogTrigger>
          </EditGate>
          <DialogContent className="sm:max-w-[425px]">
            <form onSubmit={handleAddSubmit}>
              <DialogHeader>
                <DialogTitle>เพิ่มค่าใช้จ่ายบริษัท (Master)</DialogTitle>
                <DialogDescription>
                  เพิ่มรายการต้นทุนโสหุ้ยทั่วไปที่จะนำไปร่วมหารเฉลี่ยเป็นต้นทุนโครงการซอฟต์แวร์
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="oh-name">ชื่อรายการค่าใช้จ่าย</Label>
                  <Input
                    id="oh-name"
                    placeholder="เช่น ค่าไฟฟ้าสาขา หรือ ลิขสิทธิ์ Figma Team"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="oh-cost">จำนวนเงิน (บาท)</Label>
                    <Input
                      id="oh-cost"
                      type="number"
                      placeholder="10000"
                      value={cost || ""}
                      onChange={(e) => setCost(parseFloat(e.target.value) || 0)}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="oh-period">รอบบิลชำระ</Label>
                    <Select
                      value={period}
                      onValueChange={(val: "monthly" | "yearly") => setPeriod(val)}
                    >
                      <SelectTrigger id="oh-period">
                        <SelectValue placeholder="เลือก..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">รายเดือน</SelectItem>
                        <SelectItem value="yearly">รายปี</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="oh-eff-from">เริ่มมีผลตั้งแต่</Label>
                    <Input
                      id="oh-eff-from"
                      type="date"
                      value={effectiveFrom}
                      onChange={(e) => setEffectiveFrom(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="oh-eff-to">สิ้นสุด (เว้นว่าง = ยังใช้อยู่)</Label>
                    <Input
                      id="oh-eff-to"
                      type="date"
                      value={effectiveTo}
                      onChange={(e) => setEffectiveTo(e.target.value)}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground -mt-1">
                  โปรเจกต์ที่วันออกใบเสนอราคาอยู่ในช่วงนี้จะใช้ค่ารายการนี้ในการปันส่วน
                </p>
              </div>
              <DialogFooter>
                <Button type="submit">บันทึกเป็นข้อมูลหลัก</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="py-4 flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">โสหุ้ยปัจจุบัน (Active) ต่อเดือน</CardTitle>
            <Landmark className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-primary">฿{formatNumber(totalMonthlyOverhead)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              นับเฉพาะรายการที่มีผลในปัจจุบัน ~฿{formatNumber(totalMonthlyOverhead / 20)} / วันทำงาน
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardHeader className="py-4 flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">ยอดรวมโสหุ้ยดำเนินงานต่อปี</CardTitle>
            <Landmark className="h-4 w-4 text-primary/80" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">฿{formatNumber(totalYearlyOverhead)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              คำนวณรวมค่าใช้จ่ายรายปีและรายเดือนทั้งหมดคูณ 12 เดือน
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader className="pb-3 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <CardTitle>รายการค่าใช้จ่ายโสหุ้ยทั้งหมด</CardTitle>
            <CardDescription>
              รายการสรุปค่าใช้จ่ายหลักของบริษัทที่นำมาคิดคำนวณร่วมในการปันส่วนในโปรเจกต์
            </CardDescription>
          </div>
          <div className="w-full md:w-72">
            <Input
              placeholder="ค้นหาค่าใช้จ่าย..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[5%] text-center">#</TableHead>
                  <TableHead>รายการค่าใช้จ่าย</TableHead>
                  <TableHead className="text-right">จำนวนเงิน</TableHead>
                  <TableHead className="text-center">รอบ</TableHead>
                  <TableHead className="text-center">ช่วงเวลา</TableHead>
                  <TableHead className="text-right">เฉลี่ย/เดือน</TableHead>
                  <TableHead className="text-center w-[100px]">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOverheads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-sm">
                      {searchQuery ? "ไม่พบรายการค่าใช้จ่ายที่ค้นหา" : "ไม่มีข้อมูลรายจ่ายหลักในระบบ กรุณากดปุ่มเพิ่มค่าใช้จ่ายหลัก"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOverheads.map((item, index) => {
                    const monthlyEquivalent = item.period === "yearly" ? item.cost / 12 : item.cost;
                    const active = isActive(item);
                    return (
                      <TableRow key={item.id} className={`hover:bg-muted/40 transition-colors ${!active ? "opacity-60" : ""}`}>
                        <TableCell className="text-center font-mono text-xs text-muted-foreground">
                          {index + 1}
                        </TableCell>
                        <TableCell className="font-semibold text-slate-800 dark:text-slate-200">
                          <div className="flex items-center gap-2">
                            <span>{item.name}</span>
                            {!active && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 border border-slate-300">
                                ไม่ active
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ฿{formatNumber(item.cost)}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            item.period === "monthly"
                              ? "bg-blue-100 text-blue-800 border border-blue-200"
                              : "bg-purple-100 text-purple-800 border border-purple-200"
                          }`}>
                            {item.period === "monthly" ? "เดือน" : "ปี"}
                          </span>
                        </TableCell>
                        <TableCell className="text-center text-[11px] font-mono">
                          <div>{item.effectiveFrom || "-"}</div>
                          <div className="text-muted-foreground">
                            → {item.effectiveTo || "ปัจจุบัน"}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-bold text-slate-700 dark:text-slate-300">
                          ฿{formatNumber(monthlyEquivalent)}
                        </TableCell>
                        <TableCell className="text-center">
                          <EditGate fallback={<span className="text-muted-foreground/40">—</span>}>
                            <div className="flex justify-center gap-1.5">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleStartEdit(item)}
                                className="h-7 w-7"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDeleteClick(item.id, item.name)}
                                className="h-7 w-7 text-destructive hover:bg-destructive/10"
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
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[425px]">
          {editingOverhead && (
            <form onSubmit={handleEditSubmit}>
              <DialogHeader>
                <DialogTitle>แก้ไขข้อมูลค่าใช้จ่ายส่วนกลาง</DialogTitle>
                <DialogDescription>
                  ปรับจำนวนเงินและรอบการจ่ายเงิน ค่าเฉลี่ยจะถูกนำส่งไปปันส่วนในระดับโครงการ
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-oh-name">ชื่อรายการค่าใช้จ่าย</Label>
                  <Input
                    id="edit-oh-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-oh-cost">จำนวนเงิน (บาท)</Label>
                    <Input
                      id="edit-oh-cost"
                      type="number"
                      value={cost || ""}
                      onChange={(e) => setCost(parseFloat(e.target.value) || 0)}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-oh-period">รอบบิลชำระ</Label>
                    <Select
                      value={period}
                      onValueChange={(val: "monthly" | "yearly") => setPeriod(val)}
                    >
                      <SelectTrigger id="edit-oh-period">
                        <SelectValue placeholder="เลือก..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">รายเดือน</SelectItem>
                        <SelectItem value="yearly">รายปี</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-oh-eff-from">เริ่มมีผลตั้งแต่</Label>
                    <Input
                      id="edit-oh-eff-from"
                      type="date"
                      value={effectiveFrom}
                      onChange={(e) => setEffectiveFrom(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-oh-eff-to">สิ้นสุด (เว้นว่าง = ยังใช้อยู่)</Label>
                    <Input
                      id="edit-oh-eff-to"
                      type="date"
                      value={effectiveTo}
                      onChange={(e) => setEffectiveTo(e.target.value)}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground -mt-1">
                  หากต้องการ &ldquo;ปรับราคา&rdquo; ในอนาคต ให้ใส่วันสิ้นสุดของรายการเดิม แล้วเพิ่มรายการใหม่ที่มีเริ่มมีผลถัดไป
                </p>
              </div>
              <DialogFooter>
                <Button type="submit">บันทึกการแก้ไข</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
