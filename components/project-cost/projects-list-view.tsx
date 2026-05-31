"use client";

import React, { useMemo, useState } from "react";
import { Project, ProjectStatus, PositionRate, OverheadItem, Customer } from "@/lib/types";
import { calculateProjectCosts } from "@/lib/calculations";
import { toClientInfo } from "@/lib/customers";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Plus, Search, Edit2, Trash2, Copy, FolderOpen, FolderKanban,
  ArrowUpDown, Calendar, FileSpreadsheet, BarChart3, List, GitCompareArrows,
} from "lucide-react";
import { toast } from "sonner";
import { EditGate } from "@/components/project-cost/edit-gate";
import { exportProjectsListToExcel } from "@/lib/excel-export";
import { CompanyAnalytics } from "./company-analytics";
import { ProjectsComparison } from "./projects-comparison";

interface ProjectsListViewProps {
  projects: Project[];
  positions: PositionRate[];
  overheads: OverheadItem[];
  customers: Customer[];
  onSelectProject: (id: string) => void;
  onAddProject: (name: string, description?: string, patch?: Partial<Project>) => void;
  onUpdateProject: (updated: Project) => void;
  onDeleteProject: (id: string) => void;
  onDuplicateProject: (id: string) => void;
  onAddCustomer: (item: Omit<Customer, "id">) => Customer;
}

const NEW_CUSTOMER = "_new";

type SortKey = "name" | "createdAt" | "quotationDate" | "finalPrice" | "status";
type SortDir = "asc" | "desc";

const STATUS_LABELS: Record<ProjectStatus, { label: string; className: string }> = {
  draft: { label: "ร่าง", className: "bg-slate-100 text-slate-700 border-slate-200" },
  quoted: { label: "เสนอราคาแล้ว", className: "bg-blue-100 text-blue-800 border-blue-200" },
  won: { label: "ปิดการขาย", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  lost: { label: "ไม่ได้งาน", className: "bg-rose-100 text-rose-800 border-rose-200" },
  in_progress: { label: "กำลังพัฒนา", className: "bg-amber-100 text-amber-800 border-amber-200" },
  completed: { label: "ส่งมอบแล้ว", className: "bg-violet-100 text-violet-800 border-violet-200" },
};

export function ProjectsListView({
  projects,
  positions,
  overheads,
  customers,
  onSelectProject,
  onAddProject,
  onUpdateProject,
  onDeleteProject,
  onDuplicateProject,
  onAddCustomer,
}: ProjectsListViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ProjectStatus>("all");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);

  // Create form state
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCustomerSel, setNewCustomerSel] = useState<string>(NEW_CUSTOMER);
  const [newCustomerName, setNewCustomerName] = useState("");

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  // customer selection: a master id, or NEW_CUSTOMER (สร้าง/กรอกใหม่)
  const [editCustomerSel, setEditCustomerSel] = useState<string>(NEW_CUSTOMER);
  const [editNewCustomerName, setEditNewCustomerName] = useState("");
  const [editStatus, setEditStatus] = useState<ProjectStatus>("draft");
  const [editQuotationDate, setEditQuotationDate] = useState("");

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

  const formatDate = (iso: string) => {
    if (!iso) return "-";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric" });
  };

  // Compute aggregate stats per project (final price)
  const enriched = useMemo(() => {
    return projects.map((p) => {
      const calc = calculateProjectCosts(p, positions, overheads);
      return { project: p, finalPrice: calc.finalPrice, totalMandays: calc.totalProjectMandays };
    });
  }, [projects, positions, overheads]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return enriched.filter(({ project }) => {
      if (statusFilter !== "all" && project.status !== statusFilter) return false;
      if (!q) return true;
      return (
        project.name.toLowerCase().includes(q) ||
        (project.description ?? "").toLowerCase().includes(q) ||
        (project.client?.name ?? "").toLowerCase().includes(q)
      );
    });
  }, [enriched, searchQuery, statusFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const A = a.project;
      const B = b.project;
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = A.name.localeCompare(B.name);
          break;
        case "createdAt":
          cmp = A.createdAt.localeCompare(B.createdAt);
          break;
        case "quotationDate":
          cmp = (A.quotationDate || "").localeCompare(B.quotationDate || "");
          break;
        case "finalPrice":
          cmp = a.finalPrice - b.finalPrice;
          break;
        case "status":
          cmp = A.status.localeCompare(B.status);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  // Stats overview
  const totalRevenue = enriched
    .filter((e) => e.project.status === "won" || e.project.status === "in_progress" || e.project.status === "completed")
    .reduce((s, e) => s + e.finalPrice, 0);
  const wonCount = projects.filter((p) => p.status === "won").length;
  const pipelineValue = enriched
    .filter((e) => e.project.status === "draft" || e.project.status === "quoted")
    .reduce((s, e) => s + e.finalPrice, 0);

  // ---- Actions ----
  // แปลงค่าที่เลือกใน picker → ลูกค้าใน master (สร้างใหม่ถ้าจำเป็น, กันชื่อซ้ำ)
  const resolveSelectedCustomer = (sel: string, typedName: string): Customer | null => {
    if (sel !== NEW_CUSTOMER) {
      return customers.find((c) => c.id === sel) ?? null;
    }
    const name = typedName.trim();
    if (!name) return null;
    const dup = customers.find((c) => c.name.trim().toLowerCase() === name.toLowerCase());
    return dup ?? onAddCustomer({ name, active: true });
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const linked = resolveSelectedCustomer(newCustomerSel, newCustomerName);
    onAddProject(
      newName.trim(),
      newDesc.trim() || undefined,
      linked ? { customerId: linked.id, client: toClientInfo(linked) } : undefined
    );
    setNewName("");
    setNewDesc("");
    setNewCustomerSel(NEW_CUSTOMER);
    setNewCustomerName("");
    setIsCreateOpen(false);
    toast.success("สร้างโครงการใหม่สำเร็จ");
  };

  const handleStartEdit = (p: Project) => {
    setEditing(p);
    setEditName(p.name);
    setEditDesc(p.description ?? "");
    // ถ้าโปรเจกต์ผูก master อยู่แล้ว → เลือกอันนั้น; ถ้ายัง → โหมดสร้าง/กรอกใหม่ (prefill ชื่อเดิม)
    if (p.customerId && customers.some((c) => c.id === p.customerId)) {
      setEditCustomerSel(p.customerId);
      setEditNewCustomerName("");
    } else {
      setEditCustomerSel(NEW_CUSTOMER);
      setEditNewCustomerName(p.client?.name ?? "");
    }
    setEditStatus(p.status);
    setEditQuotationDate(p.quotationDate || p.createdAt.split("T")[0]);
    setIsEditOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !editName.trim()) return;

    // หาว่าจะผูกกับลูกค้าใน master รายใด
    const linked = resolveSelectedCustomer(editCustomerSel, editNewCustomerName);

    onUpdateProject({
      ...editing,
      name: editName.trim(),
      description: editDesc.trim() || undefined,
      customerId: linked ? linked.id : undefined,
      client: linked ? toClientInfo(linked) : { ...(editing.client ?? { name: "" }), name: "" },
      status: editStatus,
      quotationDate: editQuotationDate || editing.quotationDate,
    });
    setIsEditOpen(false);
    setEditing(null);
    toast.success("อัปเดตข้อมูลโครงการเรียบร้อย");
  };

  const handleDelete = (p: Project) => {
    if (confirm(`คุณต้องการลบโครงการ "${p.name}" ใช่หรือไม่?\nข้อมูลทั้งหมดของโปรเจกต์นี้จะหายไปถาวร`)) {
      onDeleteProject(p.id);
      toast.success("ลบโครงการเรียบร้อย");
    }
  };

  const handleDuplicate = (p: Project) => {
    onDuplicateProject(p.id);
    toast.success("คัดลอกโครงการสำเร็จ");
  };

  const handleOpen = (id: string) => {
    onSelectProject(id);
  };

  const handleExportExcel = async () => {
    if (projects.length === 0) {
      toast.error("ยังไม่มีโครงการให้ export");
      return;
    }
    try {
      await exportProjectsListToExcel(projects, positions, overheads);
      toast.success("Export Excel เรียบร้อย");
    } catch (e) {
      console.error(e);
      toast.error("Export ไม่สำเร็จ");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FolderKanban className="h-6 w-6 text-primary" /> ทุกโครงการ
          </h2>
          <p className="text-sm text-muted-foreground">
            จัดการรายการโครงการทั้งหมด ค้นหา แก้ไข คัดลอก หรือเปิดเข้าไปประเมินต้นทุนรายโปรเจกต์
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExportExcel} className="gap-2 font-semibold">
            <FileSpreadsheet className="h-4 w-4" /> Export Excel
          </Button>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <EditGate>
            <DialogTrigger asChild>
              <Button className="gap-2 font-semibold">
                <Plus className="h-4 w-4" /> สร้างโครงการใหม่
              </Button>
            </DialogTrigger>
          </EditGate>
          <DialogContent className="sm:max-w-[480px]">
            <form onSubmit={handleCreateSubmit}>
              <DialogHeader>
                <DialogTitle>สร้างโครงการใหม่</DialogTitle>
                <DialogDescription>
                  ระบุชื่อและรายละเอียดเริ่มต้น สามารถปรับ status / ลูกค้า / วันที่ออกใบเสนอราคาทีหลังได้
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="new-proj-name">ชื่อโครงการ</Label>
                  <Input
                    id="new-proj-name"
                    placeholder="เช่น ระบบ ERP องค์กร"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="new-proj-desc">คำอธิบาย</Label>
                  <Textarea
                    id="new-proj-desc"
                    placeholder="ขอบเขตการทำงานคร่าวๆ"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="new-proj-client">ลูกค้า (optional)</Label>
                  {customers.length > 0 ? (
                    <Select value={newCustomerSel} onValueChange={setNewCustomerSel}>
                      <SelectTrigger id="new-proj-client">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {customers.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                        <SelectItem value={NEW_CUSTOMER}>➕ สร้างบริษัทใหม่…</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id="new-proj-client"
                      placeholder="บริษัท ลูกค้า จำกัด — เว้นว่างได้"
                      value={newCustomerName}
                      onChange={(e) => setNewCustomerName(e.target.value)}
                    />
                  )}
                </div>
                {customers.length > 0 && newCustomerSel === NEW_CUSTOMER && (
                  <div className="grid gap-2">
                    <Label htmlFor="new-proj-new-client">ชื่อบริษัทใหม่</Label>
                    <Input
                      id="new-proj-new-client"
                      placeholder="บริษัท ลูกค้า จำกัด — เว้นว่าง = ไม่ระบุลูกค้า"
                      value={newCustomerName}
                      onChange={(e) => setNewCustomerName(e.target.value)}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      จะถูกเพิ่มเข้าฐานข้อมูลลูกค้า (master) อัตโนมัติ แล้วผูกกับโปรเจกต์นี้
                    </p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button type="submit">สร้างโครงการ</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Tabs: รายการ vs ภาพรวม vs เปรียบเทียบ */}
      <Tabs defaultValue="list" className="space-y-4">
        <TabsList className="grid grid-cols-3 max-w-2xl">
          <TabsTrigger value="list" className="gap-2">
            <List className="h-4 w-4" /> รายการ
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2">
            <BarChart3 className="h-4 w-4" /> ภาพรวม
          </TabsTrigger>
          <TabsTrigger value="compare" className="gap-2">
            <GitCompareArrows className="h-4 w-4" /> เปรียบเทียบ
          </TabsTrigger>
        </TabsList>

        <TabsContent value="analytics" className="space-y-4">
          <CompanyAnalytics projects={projects} positions={positions} overheads={overheads} />
        </TabsContent>

        <TabsContent value="compare" className="space-y-4">
          <ProjectsComparison projects={projects} positions={positions} overheads={overheads} />
        </TabsContent>

        <TabsContent value="list" className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-4">
            <div className="text-[11px] text-muted-foreground font-semibold">ทั้งหมด</div>
            <div className="text-2xl font-black">{projects.length}</div>
            <div className="text-[11px] text-muted-foreground">โครงการ</div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-4">
            <div className="text-[11px] text-muted-foreground font-semibold">ปิดการขายแล้ว</div>
            <div className="text-2xl font-black text-emerald-600">{wonCount}</div>
            <div className="text-[11px] text-muted-foreground">โครงการ</div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-4">
            <div className="text-[11px] text-muted-foreground font-semibold">รายได้ที่รับรู้</div>
            <div className="text-lg font-black text-primary">{formatCurrency(totalRevenue)}</div>
            <div className="text-[11px] text-muted-foreground">won + in_progress + completed</div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-4">
            <div className="text-[11px] text-muted-foreground font-semibold">Pipeline</div>
            <div className="text-lg font-black text-amber-600">{formatCurrency(pipelineValue)}</div>
            <div className="text-[11px] text-muted-foreground">draft + quoted</div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Toolbar */}
      <Card className="border-border/50 bg-card/50">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ค้นหาโครงการ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v: "all" | ProjectStatus) => setStatusFilter(v)}>
              <SelectTrigger className="md:w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">สถานะทั้งหมด</SelectItem>
                {(Object.keys(STATUS_LABELS) as ProjectStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_LABELS[s].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Responsive Table */}
      <Card className="border-border/50 bg-card/50">
        <CardContent className="pt-4">
          <div className="overflow-x-auto -mx-2 sm:mx-0">
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px]">
                    <button onClick={() => toggleSort("name")} className="flex items-center gap-1 hover:text-foreground">
                      ชื่อโครงการ <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">ลูกค้า</TableHead>
                  <TableHead className="hidden xl:table-cell">โหมด</TableHead>
                  <TableHead>
                    <button onClick={() => toggleSort("status")} className="flex items-center gap-1 hover:text-foreground">
                      สถานะ <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead className="hidden md:table-cell">
                    <button onClick={() => toggleSort("quotationDate")} className="flex items-center gap-1 hover:text-foreground">
                      วันที่เสนอราคา <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead className="hidden xl:table-cell text-center">Mandays</TableHead>
                  <TableHead className="text-right">
                    <button onClick={() => toggleSort("finalPrice")} className="flex items-center gap-1 hover:text-foreground ml-auto">
                      ราคารวม <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead className="text-center w-[60px] md:w-[150px]">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground text-sm">
                      {searchQuery || statusFilter !== "all"
                        ? "ไม่พบโครงการที่ตรงกับเงื่อนไข"
                        : "ยังไม่มีโครงการ กดปุ่ม 'สร้างโครงการใหม่' เพื่อเริ่มต้น"}
                    </TableCell>
                  </TableRow>
                ) : (
                  sorted.map(({ project, finalPrice, totalMandays }) => {
                    const status = STATUS_LABELS[project.status];
                    return (
                      <TableRow key={project.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="max-w-[260px]">
                          <button
                            onClick={() => handleOpen(project.id)}
                            className="font-semibold text-slate-800 dark:text-slate-200 hover:text-primary text-left truncate block w-full"
                            title={project.name}
                          >
                            {project.name}
                          </button>
                          {/* On small screens, show client + date inline under the name */}
                          <div className="text-[11px] text-muted-foreground mt-0.5 space-y-0.5">
                            <div className="lg:hidden truncate">
                              {project.client?.name || <span className="italic">ยังไม่ระบุลูกค้า</span>}
                            </div>
                            <div className="md:hidden font-mono">
                              {formatDate(project.quotationDate)}
                            </div>
                            {project.description && (
                              <div className="hidden lg:block line-clamp-1">{project.description}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs">
                          {project.client?.name || <span className="text-muted-foreground italic">ยังไม่ระบุ</span>}
                        </TableCell>
                        <TableCell className="hidden xl:table-cell">
                          {project.pricingMode === "fixed_price" ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium border bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-900">
                              ขายเหมา
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium border bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700">
                              Markup
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border whitespace-nowrap ${status.className}`}>
                            {status.label}
                          </span>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs font-mono whitespace-nowrap">
                          {formatDate(project.quotationDate)}
                        </TableCell>
                        <TableCell className="hidden xl:table-cell text-center font-mono text-xs">
                          {totalMandays}
                        </TableCell>
                        <TableCell className="text-right font-bold text-primary font-mono whitespace-nowrap">
                          {formatCurrency(finalPrice)}
                        </TableCell>
                        <TableCell>
                          <div className="hidden md:flex justify-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleOpen(project.id)}
                              className="h-7 w-7"
                              title="เปิดโปรเจกต์"
                            >
                              <FolderOpen className="h-3.5 w-3.5" />
                            </Button>
                            <EditGate>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleStartEdit(project)}
                                className="h-7 w-7"
                                title="แก้ไข"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDuplicate(project)}
                                className="h-7 w-7"
                                title="คัดลอก"
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDelete(project)}
                                className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                title="ลบ"
                              >
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
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[520px]">
          {editing && (
            <form onSubmit={handleEditSubmit}>
              <DialogHeader>
                <DialogTitle>แก้ไขข้อมูลโครงการ</DialogTitle>
                <DialogDescription>
                  ปรับ metadata ของโครงการ การปรับ Mandays/โสหุ้ย ให้ไปที่หน้า Dashboard / Labor / Overhead ของโปรเจกต์
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="ed-name">ชื่อโครงการ</Label>
                  <Input
                    id="ed-name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ed-desc">คำอธิบาย</Label>
                  <Textarea
                    id="ed-desc"
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="ed-client">ลูกค้า</Label>
                    {customers.length > 0 ? (
                      <Select value={editCustomerSel} onValueChange={setEditCustomerSel}>
                        <SelectTrigger id="ed-client">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {customers.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                          <SelectItem value={NEW_CUSTOMER}>➕ สร้างบริษัทใหม่…</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id="ed-client"
                        placeholder="บริษัท ลูกค้า จำกัด"
                        value={editNewCustomerName}
                        onChange={(e) => setEditNewCustomerName(e.target.value)}
                      />
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="ed-status">สถานะ</Label>
                    <Select value={editStatus} onValueChange={(v: ProjectStatus) => setEditStatus(v)}>
                      <SelectTrigger id="ed-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(STATUS_LABELS) as ProjectStatus[]).map((s) => (
                          <SelectItem key={s} value={s}>{STATUS_LABELS[s].label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* เมื่อมี master แต่เลือก "สร้างบริษัทใหม่" → ให้กรอกชื่อบริษัทใหม่ */}
                {customers.length > 0 && editCustomerSel === NEW_CUSTOMER && (
                  <div className="grid gap-2">
                    <Label htmlFor="ed-new-client">ชื่อบริษัทใหม่</Label>
                    <Input
                      id="ed-new-client"
                      placeholder="บริษัท ลูกค้า จำกัด — เว้นว่าง = ไม่ระบุลูกค้า"
                      value={editNewCustomerName}
                      onChange={(e) => setEditNewCustomerName(e.target.value)}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      จะถูกเพิ่มเข้าฐานข้อมูลลูกค้า (master) อัตโนมัติ แล้วผูกกับโปรเจกต์นี้
                    </p>
                  </div>
                )}
                <div className="grid gap-2">
                  <Label htmlFor="ed-qdate" className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" /> วันที่ออกใบเสนอราคา
                  </Label>
                  <Input
                    id="ed-qdate"
                    type="date"
                    value={editQuotationDate}
                    onChange={(e) => setEditQuotationDate(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    ใช้กรองโสหุ้ยที่ active ในช่วงนั้น — ถ้าเปลี่ยนวัน ค่าโสหุ้ยปันส่วนอาจปรับ
                  </p>
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
