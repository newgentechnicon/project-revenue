"use client";

import React, { useState } from "react";
import { PositionRate } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Edit2 } from "lucide-react";
import { EditGate } from "@/components/project-cost/edit-gate";
import { toast } from "sonner";

interface MasterPositionsViewProps {
  positions: PositionRate[];
  defaultWorkingDays: number;
  onAddPosition: (pos: Omit<PositionRate, "id">) => void;
  onUpdatePosition: (pos: PositionRate) => void;
  onDeletePosition: (id: string) => void;
}

export function MasterPositionsView({
  positions,
  defaultWorkingDays,
  onAddPosition,
  onUpdatePosition,
  onDeletePosition,
}: MasterPositionsViewProps) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<PositionRate | null>(null);

  // Form States
  const [title, setTitle] = useState("");
  const [salary, setSalary] = useState<number>(0);
  const [dailyRate, setDailyRate] = useState<number>(0);
  const [isCustomRate, setIsCustomRate] = useState(false);
  const [headcount, setHeadcount] = useState<number>(1);
  const [benefitPercent, setBenefitPercent] = useState<number>(15);
  const [socialSecurityAmount, setSocialSecurityAmount] = useState<number>(750);

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const rate = isCustomRate ? dailyRate : Math.round(salary / defaultWorkingDays);
    onAddPosition({
      title,
      salary: isCustomRate ? 0 : salary,
      dailyRate: rate,
      isCustomRate,
      headcount: Math.max(0, Math.floor(headcount)),
      benefitPercent: Math.max(0, benefitPercent),
      socialSecurityAmount: Math.max(0, socialSecurityAmount),
    });

    setTitle("");
    setSalary(0);
    setDailyRate(0);
    setIsCustomRate(false);
    setHeadcount(1);
    setBenefitPercent(15);
    setSocialSecurityAmount(750);
    setIsAddOpen(false);
    toast.success("เพิ่มตำแหน่งงานใหม่เข้าระบบ Master Data แล้ว");
  };

  const handleStartEdit = (pos: PositionRate) => {
    setEditingPosition(pos);
    setTitle(pos.title);
    setSalary(pos.salary);
    setDailyRate(pos.dailyRate);
    setIsCustomRate(pos.isCustomRate);
    setHeadcount(pos.headcount ?? 1);
    setBenefitPercent(pos.benefitPercent ?? 15);
    setSocialSecurityAmount(pos.socialSecurityAmount ?? 750);
    setIsEditOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPosition || !title.trim()) return;

    const rate = isCustomRate ? dailyRate : Math.round(salary / defaultWorkingDays);
    onUpdatePosition({
      id: editingPosition.id,
      title,
      salary: isCustomRate ? 0 : salary,
      dailyRate: rate,
      isCustomRate,
      headcount: Math.max(0, Math.floor(headcount)),
      benefitPercent: Math.max(0, benefitPercent),
      socialSecurityAmount: Math.max(0, socialSecurityAmount),
    });

    setEditingPosition(null);
    setIsEditOpen(false);
    toast.success("อัปเดตข้อมูลตำแหน่งงานในระบบ Master Data เรียบร้อยแล้ว");
  };

  const handleDeleteClick = (id: string, name: string) => {
    if (confirm(`คุณแน่ใจว่าต้องการลบตำแหน่ง "${name}" หรือไม่?\nการดำเนินการนี้จะลบการจัดสรรตำแหน่งนี้ออกจากโครงการทั้งหมดด้วย`)) {
      onDeletePosition(id);
      toast.success("ลบตำแหน่งงานเรียบร้อยแล้ว");
    }
  };

  const filteredPositions = positions.filter((pos) =>
    pos.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">ข้อมูลตำแหน่งงาน (Position Rates Master)</h2>
          <p className="text-sm text-muted-foreground">
            จัดการบัญชีรายชื่อตำแหน่งงาน อัตราเงินเดือน และเรตราคาต่อวันมาตรฐานของบริษัท
          </p>
        </div>

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <EditGate>
            <DialogTrigger asChild>
              <Button className="gap-2 font-semibold">
                <Plus className="h-4 w-4" /> เพิ่มตำแหน่งงานหลัก
              </Button>
            </DialogTrigger>
          </EditGate>
          <DialogContent className="sm:max-w-[425px]">
            <form onSubmit={handleAddSubmit}>
              <DialogHeader>
                <DialogTitle>เพิ่มตำแหน่งงานใหม่ (Master)</DialogTitle>
                <DialogDescription>เพิ่มรายชื่อตำแหน่งงานหลักเพื่อใช้ในการจัดทีมพัฒนาโครงการต่างๆ</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="title">ชื่อตำแหน่งงาน</Label>
                  <Input
                    id="title"
                    placeholder="เช่น Senior Frontend Developer"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="flex items-center gap-2 py-2">
                  <input
                    type="checkbox"
                    id="custom-rate"
                    checked={isCustomRate}
                    onChange={(e) => setIsCustomRate(e.target.checked)}
                    className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                  />
                  <Label htmlFor="custom-rate" className="text-sm font-medium cursor-pointer">
                    ระบุเป็นเรตรายวันคงที่โดยตรง (ไม่คำนวณจากเงินเดือน)
                  </Label>
                </div>

                {!isCustomRate ? (
                  <div className="grid gap-2">
                    <Label htmlFor="salary">เงินเดือนเฉลี่ย (บาท)</Label>
                    <Input
                      id="salary"
                      type="number"
                      placeholder="60000"
                      value={salary || ""}
                      onChange={(e) => setSalary(parseFloat(e.target.value) || 0)}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      คำนวณเรตรายวันอัตโนมัติ (หาร {defaultWorkingDays} วันทำงาน): ฿
                      {formatNumber(salary / defaultWorkingDays)} / วัน
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-2">
                    <Label htmlFor="daily-rate">ค่าจ้างรายวันมาตรฐาน (บาท)</Label>
                    <Input
                      id="daily-rate"
                      type="number"
                      placeholder="3000"
                      value={dailyRate || ""}
                      onChange={(e) => setDailyRate(parseFloat(e.target.value) || 0)}
                      required
                    />
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="headcount">จำนวนพนักงาน</Label>
                    <Input
                      id="headcount"
                      type="number"
                      min={0}
                      step={1}
                      value={headcount}
                      onChange={(e) => setHeadcount(parseInt(e.target.value) || 0)}
                    />
                    <p className="text-[10px] text-muted-foreground">ใช้คำนวณ capacity</p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="benefit-percent">สวัสดิการ (%)</Label>
                    <Input
                      id="benefit-percent"
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={benefitPercent}
                      onChange={(e) => setBenefitPercent(parseFloat(e.target.value) || 0)}
                    />
                    <p className="text-[10px] text-muted-foreground">โบนัส กองทุน อื่นๆ</p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="sso-amount">ประกันสังคม (บ./ด.)</Label>
                    <Input
                      id="sso-amount"
                      type="number"
                      min={0}
                      step={1}
                      value={socialSecurityAmount}
                      onChange={(e) => setSocialSecurityAmount(parseFloat(e.target.value) || 0)}
                    />
                    <p className="text-[10px] text-muted-foreground">ไทยฝั่งนายจ้าง max 750</p>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">บันทึกเป็นข้อมูลหลัก</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-border/50 bg-card/50">
        <CardHeader className="pb-3 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <CardTitle>บัญชีเรตราคาพนักงานทั้งหมด</CardTitle>
            <CardDescription>
              รายการข้อมูลตำแหน่งงานปัจจุบันที่พร้อมเรียกใช้ในการคิดงบประมาณผลิตซอฟต์แวร์
            </CardDescription>
          </div>
          <div className="w-full md:w-72">
            <Input
              placeholder="ค้นหาตำแหน่งงาน..."
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
                  <TableHead>ตำแหน่งงาน</TableHead>
                  <TableHead className="text-center">คน</TableHead>
                  <TableHead className="text-right">เงินเดือน</TableHead>
                  <TableHead className="text-right">SSO/ด.</TableHead>
                  <TableHead className="text-right">เรตฐาน</TableHead>
                  <TableHead className="text-right">เรต Fully-loaded</TableHead>
                  <TableHead className="text-center w-[100px]">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPositions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground text-sm">
                      {searchQuery ? "ไม่พบชื่อตำแหน่งงานที่ค้นหา" : "ไม่มีข้อมูลตำแหน่งงานหลักในระบบ กรุณากดปุ่มเพิ่มตำแหน่งงานด้านบน"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPositions.map((pos, index) => {
                    const ssoDaily = (pos.socialSecurityAmount ?? 0) / defaultWorkingDays;
                    const loadedRate = Math.round(pos.dailyRate * (1 + (pos.benefitPercent ?? 0) / 100) + ssoDaily);
                    return (
                    <TableRow key={pos.id} className="hover:bg-muted/40 transition-colors">
                      <TableCell className="text-center font-mono text-xs text-muted-foreground">
                        {index + 1}
                      </TableCell>
                      <TableCell className="font-semibold text-slate-800 dark:text-slate-200">
                        {pos.title}
                        {pos.isCustomRate && (
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                            เรตรายวัน
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-mono">
                        {pos.headcount ?? 1}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {pos.isCustomRate ? (
                          <span className="text-muted-foreground text-xs font-normal">-</span>
                        ) : (
                          <span>฿{formatNumber(pos.salary)}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        ฿{formatNumber(pos.socialSecurityAmount ?? 0)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ฿{formatNumber(pos.dailyRate)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-primary">
                        ฿{formatNumber(loadedRate)}
                        <div className="text-[10px] text-muted-foreground font-normal">
                          +{pos.benefitPercent ?? 0}% +SSO
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <EditGate fallback={<span className="text-muted-foreground/40">—</span>}>
                          <div className="flex justify-center gap-1.5">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleStartEdit(pos)}
                              className="h-7 w-7"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDeleteClick(pos.id, pos.title)}
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
          {editingPosition && (
            <form onSubmit={handleEditSubmit}>
              <DialogHeader>
                <DialogTitle>แก้ไขตำแหน่งงานหลัก</DialogTitle>
                <DialogDescription>
                  การปรับค่าตรงนี้จะส่งผลต่อการประเมินราคาโครงการทั้งหมดที่ดึงตำแหน่งนี้ไปใช้งาน
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-title">ชื่อตำแหน่งงาน</Label>
                  <Input
                    id="edit-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="flex items-center gap-2 py-2">
                  <input
                    type="checkbox"
                    id="edit-custom-rate"
                    checked={isCustomRate}
                    onChange={(e) => setIsCustomRate(e.target.checked)}
                    className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                  />
                  <Label htmlFor="edit-custom-rate" className="text-sm font-medium cursor-pointer">
                    ระบุเป็นเรตรายวันคงที่โดยตรง (ไม่คำนวณจากเงินเดือน)
                  </Label>
                </div>

                {!isCustomRate ? (
                  <div className="grid gap-2">
                    <Label htmlFor="edit-salary">เงินเดือนเฉลี่ย (บาท)</Label>
                    <Input
                      id="edit-salary"
                      type="number"
                      value={salary || ""}
                      onChange={(e) => setSalary(parseFloat(e.target.value) || 0)}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      คำนวณเรตรายวันอัตโนมัติ (หาร {defaultWorkingDays} วันทำงาน): ฿
                      {formatNumber(salary / defaultWorkingDays)} / วัน
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-2">
                    <Label htmlFor="edit-daily-rate">ค่าจ้างรายวันมาตรฐาน (บาท)</Label>
                    <Input
                      id="edit-daily-rate"
                      type="number"
                      value={dailyRate || ""}
                      onChange={(e) => setDailyRate(parseFloat(e.target.value) || 0)}
                      required
                    />
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-headcount">จำนวนพนักงาน</Label>
                    <Input
                      id="edit-headcount"
                      type="number"
                      min={0}
                      step={1}
                      value={headcount}
                      onChange={(e) => setHeadcount(parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-benefit-percent">สวัสดิการ (%)</Label>
                    <Input
                      id="edit-benefit-percent"
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={benefitPercent}
                      onChange={(e) => setBenefitPercent(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-sso-amount">ประกันสังคม (บ./ด.)</Label>
                    <Input
                      id="edit-sso-amount"
                      type="number"
                      min={0}
                      step={1}
                      value={socialSecurityAmount}
                      onChange={(e) => setSocialSecurityAmount(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
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
