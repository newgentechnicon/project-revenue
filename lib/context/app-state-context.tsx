"use client";

import React, { createContext, useContext, useCallback, useMemo } from "react";
import { useProjects } from "@/hooks/use-projects";
import { usePositions } from "@/hooks/use-positions";
import { useOverheads } from "@/hooks/use-overheads";
import { useEmployees } from "@/hooks/use-employees";
import { useProducts } from "@/hooks/use-products";
import { useSubscriptions } from "@/hooks/use-subscriptions";
import { useCustomers } from "@/hooks/use-customers";
import { useCommissionPayees } from "@/hooks/use-commission-payees";
import { useCommissions } from "@/hooks/use-commissions";
import { useLedger } from "@/hooks/use-ledger";
import { useLoans } from "@/hooks/use-loans";
import { useCashflowSettings, CashflowSettings } from "@/hooks/use-cashflow-settings";
import { useCompanyInfo, DEFAULT_COMPANY_INFO } from "@/hooks/use-company-info";
import { useActiveProject } from "@/hooks/use-active-project";
import {
  ProjectSchema, PositionRateSchema, OverheadItemSchema, EmployeeSchema, CompanyInfoSchema,
  ProductSchema, SubscriptionSchema, CustomerSchema,
  CommissionPayeeSchema, CommissionSchema, LedgerEntrySchema, LoanSchema,
  safeParse, safeParseArray,
} from "@/lib/schemas";
import {
  migrateProjectChain, migratePositionChain, migrateOverheadChain,
} from "@/lib/migrations";
import { Project, PositionRate, OverheadItem, Employee, CompanyInfo, Product, Subscription, Customer, CommissionPayee, Commission, LedgerEntry, Loan } from "@/lib/types";
import { extractCustomersFromRecords, toSubscriptionCustomer, toClientInfo } from "@/lib/customers";

interface AppStateContextType {
  isLoaded: boolean;
  projects: Project[];
  positions: PositionRate[];
  overheads: OverheadItem[];
  companyInfo: CompanyInfo;
  setCompanyInfo: (info: CompanyInfo) => void;
  activeProjectId: string;
  activeProject: Project | undefined;
  setActiveProjectId: (id: string) => void;
  // Project CRUD
  addProject: (name: string, description?: string, patch?: Partial<Project>) => Project;
  updateProject: (updated: Project) => void;
  deleteProject: (id: string) => void;
  duplicateProject: (id: string) => void;
  // Position CRUD
  addPosition: (pos: Omit<PositionRate, "id">) => void;
  updatePosition: (updated: PositionRate) => void;
  deletePosition: (id: string) => void;
  // Overhead CRUD
  addOverhead: (item: Omit<OverheadItem, "id">) => void;
  updateOverhead: (updated: OverheadItem) => void;
  deleteOverhead: (id: string) => void;
  // Employee CRUD
  employees: Employee[];
  addEmployee: (item: Omit<Employee, "id">) => void;
  updateEmployee: (updated: Employee) => void;
  deleteEmployee: (id: string) => void;
  // Product CRUD (recurring revenue master data)
  products: Product[];
  addProduct: (item: Omit<Product, "id">) => void;
  updateProduct: (updated: Product) => void;
  deleteProduct: (id: string) => void;
  // Subscription CRUD (recurring revenue sales)
  subscriptions: Subscription[];
  addSubscription: (item: Omit<Subscription, "id">) => void;
  updateSubscription: (updated: Subscription) => void;
  deleteSubscription: (id: string) => void;
  // Customer CRUD (master data)
  customers: Customer[];
  addCustomer: (item: Omit<Customer, "id">) => Customer;
  updateCustomer: (updated: Customer) => void;
  deleteCustomer: (id: string) => void;
  /** ดึงลูกค้าที่ฝังอยู่ใน subscription/project (ที่ยังไม่ผูก) ออกมาเป็น master + ผูก customerId — คืนจำนวนลูกค้าใหม่ */
  importCustomersFromExisting: () => number;
  // Commission payee CRUD (master)
  commissionPayees: CommissionPayee[];
  addCommissionPayee: (item: Omit<CommissionPayee, "id">) => CommissionPayee;
  updateCommissionPayee: (updated: CommissionPayee) => void;
  deleteCommissionPayee: (id: string) => void;
  // Commission CRUD
  commissions: Commission[];
  addCommission: (item: Omit<Commission, "id">) => void;
  updateCommission: (updated: Commission) => void;
  deleteCommission: (id: string) => void;
  // Ledger CRUD (รายการเดินบัญชี — เงินเข้า/ออกจริง)
  ledger: LedgerEntry[];
  addLedgerEntry: (entry: Omit<LedgerEntry, "createdAt" | "updatedAt" | "ownerId">) => void;
  updateLedgerEntry: (updated: LedgerEntry) => void;
  deleteLedgerEntry: (id: string) => void;
  // Loans CRUD (เงินกู้ยืม — หนี้สิน)
  loans: Loan[];
  addLoan: (item: Omit<Loan, "id">) => void;
  updateLoan: (updated: Loan) => void;
  deleteLoan: (id: string) => void;
  // Cashflow settings (anchor for balance carryover)
  cashflowSettings: CashflowSettings;
  setCashflowSettings: (s: CashflowSettings) => void;
  // Export/Import
  exportData: () => void;
  importData: (jsonDataStr: string) => boolean;
}

const AppStateContext = createContext<AppStateContextType | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const {
    projects,
    hydrated: projectsHydrated,
    addProject: addProjectRaw,
    updateProject,
    deleteProject: deleteProjectRaw,
    duplicateProject: duplicateProjectRaw,
    replaceAllProjects,
    cleanupPositionReferences,
  } = useProjects();

  const positionsApi = usePositions();
  const { positions, deletePosition: deletePositionRaw, replaceAllPositions } = positionsApi;

  const overheadsApi = useOverheads();
  const { overheads, replaceAllOverheads } = overheadsApi;

  const employeesApi = useEmployees();
  const { employees, replaceAllEmployees } = employeesApi;

  const productsApi = useProducts();
  const { products, replaceAllProducts } = productsApi;

  const subscriptionsApi = useSubscriptions();
  const { subscriptions, replaceAllSubscriptions } = subscriptionsApi;

  const customersApi = useCustomers();
  const { customers, replaceAllCustomers } = customersApi;

  const commissionPayeesApi = useCommissionPayees();
  const { payees: commissionPayees, replaceAllPayees: replaceAllCommissionPayees } = commissionPayeesApi;

  const commissionsApi = useCommissions();
  const { commissions, replaceAllCommissions } = commissionsApi;

  const ledgerApi = useLedger();
  const { ledger, replaceAllLedger } = ledgerApi;

  const loansApi = useLoans();
  const { loans, replaceAllLoans } = loansApi;

  const { cashflowSettings, setCashflowSettings, hydrated: cashflowHydrated } = useCashflowSettings();

  const { companyInfo, setCompanyInfo, hydrated: companyHydrated } = useCompanyInfo();

  const { activeProjectId, activeProject, setActiveProjectId } = useActiveProject(
    projects,
    projectsHydrated
  );

  // Cross-cutting actions
  const addProject = useCallback(
    (name: string, description?: string, patch?: Partial<Project>): Project => {
      const newProject = addProjectRaw(name, description);
      const finalProject = patch ? { ...newProject, ...patch } : newProject;
      if (patch) updateProject(finalProject);
      setActiveProjectId(newProject.id);
      return finalProject;
    },
    [addProjectRaw, updateProject, setActiveProjectId]
  );

  const deleteProject = useCallback(
    (id: string) => {
      deleteProjectRaw(id);
      if (activeProjectId === id) {
        const remaining = projects.filter((p) => p.id !== id);
        setActiveProjectId(remaining.length > 0 ? remaining[0].id : "");
      }
    },
    [deleteProjectRaw, activeProjectId, projects, setActiveProjectId]
  );

  const duplicateProject = useCallback(
    (id: string) => {
      const duplicated = duplicateProjectRaw(id);
      if (duplicated) setActiveProjectId(duplicated.id);
    },
    [duplicateProjectRaw, setActiveProjectId]
  );

  const deletePosition = useCallback(
    (id: string) => {
      deletePositionRaw(id);
      cleanupPositionReferences(id);
    },
    [deletePositionRaw, cleanupPositionReferences]
  );

  // แก้ลูกค้าใน master → cascade อัปเดต snapshot ของทุกรายการที่ผูกไว้
  // (ทำให้แก้ที่เดียวสะท้อนทุกหน้า โดยโค้ดแสดงผลเดิมไม่ต้องเปลี่ยน)
  const updateCustomer = useCallback(
    (updated: Customer) => {
      customersApi.updateCustomer(updated);
      for (const s of subscriptions) {
        if (s.customerId === updated.id) {
          subscriptionsApi.updateSubscription({ ...s, customer: toSubscriptionCustomer(updated) });
        }
      }
      for (const p of projects) {
        if (p.customerId === updated.id) {
          updateProject({ ...p, client: toClientInfo(updated) });
        }
      }
    },
    [customersApi, subscriptions, subscriptionsApi, projects, updateProject]
  );

  // ลบลูกค้าใน master → ปลดการเชื่อม (customerId) ของรายการที่ผูกไว้
  // โดยคง snapshot เดิมไว้ (รายการเก่ายังแสดงข้อมูลลูกค้าได้)
  const deleteCustomer = useCallback(
    (id: string) => {
      customersApi.deleteCustomer(id);
      for (const s of subscriptions) {
        if (s.customerId === id) {
          subscriptionsApi.updateSubscription({ ...s, customerId: undefined });
        }
      }
      for (const p of projects) {
        if (p.customerId === id) {
          updateProject({ ...p, customerId: undefined });
        }
      }
    },
    [customersApi, subscriptions, subscriptionsApi, projects, updateProject]
  );

  const importCustomersFromExisting = useCallback((): number => {
    const baseId = Date.now();
    const result = extractCustomersFromRecords(
      subscriptions,
      projects,
      customers,
      (i) => `cust_${baseId}_${i}`
    );
    if (
      result.newCustomers.length === 0 &&
      result.subscriptionLinks.length === 0 &&
      result.projectLinks.length === 0
    ) {
      return 0;
    }
    // 1. เพิ่มลูกค้าใหม่เข้า master (รักษา id ที่ gen ไว้)
    if (result.newCustomers.length > 0) {
      replaceAllCustomers([...customers, ...result.newCustomers]);
    }
    // 2. ผูก customerId กลับไปยัง subscription / project
    const subLink = new Map(result.subscriptionLinks.map((l) => [l.subscriptionId, l.customerId]));
    const projLink = new Map(result.projectLinks.map((l) => [l.projectId, l.customerId]));
    for (const sub of subscriptions) {
      const cid = subLink.get(sub.id);
      if (cid) subscriptionsApi.updateSubscription({ ...sub, customerId: cid });
    }
    for (const proj of projects) {
      const cid = projLink.get(proj.id);
      if (cid) updateProject({ ...proj, customerId: cid });
    }
    return result.newCustomers.length;
  }, [subscriptions, projects, customers, replaceAllCustomers, subscriptionsApi, updateProject]);

  const exportData = useCallback(() => {
    const dataStr = JSON.stringify({ projects, positions, overheads, employees, products, subscriptions, customers, commissionPayees, commissions, ledger, loans, companyInfo, cashflowSettings });
    const dataUri = "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);
    const filename = `software_cost_estimation_backup_${new Date().toISOString().split("T")[0]}.json`;
    const link = document.createElement("a");
    link.setAttribute("href", dataUri);
    link.setAttribute("download", filename);
    link.click();
  }, [projects, positions, overheads, employees, products, subscriptions, customers, commissionPayees, commissions, ledger, loans, companyInfo, cashflowSettings]);

  const importData = useCallback(
    (jsonDataStr: string): boolean => {
      try {
        const parsed = JSON.parse(jsonDataStr);
        if (!parsed?.projects || !parsed?.positions || !parsed?.overheads) {
          return false;
        }
        const rawProjects = Array.isArray(parsed.projects) ? parsed.projects : [];
        const rawPositions = Array.isArray(parsed.positions) ? parsed.positions : [];
        const rawOverheads = Array.isArray(parsed.overheads) ? parsed.overheads : [];

        const migratedProjects = rawProjects.map((p: Record<string, unknown>) =>
          migrateProjectChain(p, 1)
        );
        const migratedPositions = rawPositions.map((p: Record<string, unknown>) =>
          migratePositionChain(p, 1)
        );
        const migratedOverheads = rawOverheads.map((o: Record<string, unknown>) =>
          migrateOverheadChain(o, 1)
        );

        replaceAllProjects(safeParseArray(ProjectSchema, migratedProjects, "import.projects"));
        replaceAllPositions(safeParseArray(PositionRateSchema, migratedPositions, "import.positions"));
        replaceAllOverheads(safeParseArray(OverheadItemSchema, migratedOverheads, "import.overheads"));
        if (Array.isArray(parsed.employees)) {
          replaceAllEmployees(safeParseArray(EmployeeSchema, parsed.employees, "import.employees"));
        }
        if (Array.isArray(parsed.products)) {
          replaceAllProducts(safeParseArray(ProductSchema, parsed.products, "import.products"));
        }
        if (Array.isArray(parsed.subscriptions)) {
          replaceAllSubscriptions(safeParseArray(SubscriptionSchema, parsed.subscriptions, "import.subscriptions"));
        }
        if (Array.isArray(parsed.customers)) {
          replaceAllCustomers(safeParseArray(CustomerSchema, parsed.customers, "import.customers"));
        }
        if (Array.isArray(parsed.commissionPayees)) {
          replaceAllCommissionPayees(safeParseArray(CommissionPayeeSchema, parsed.commissionPayees, "import.commissionPayees"));
        }
        if (Array.isArray(parsed.commissions)) {
          replaceAllCommissions(safeParseArray(CommissionSchema, parsed.commissions, "import.commissions"));
        }
        if (Array.isArray(parsed.ledger)) {
          replaceAllLedger(safeParseArray(LedgerEntrySchema, parsed.ledger, "import.ledger"));
        }
        if (Array.isArray(parsed.loans)) {
          replaceAllLoans(safeParseArray(LoanSchema, parsed.loans, "import.loans"));
        }
        if (parsed.companyInfo) {
          setCompanyInfo(
            safeParse(CompanyInfoSchema, parsed.companyInfo, DEFAULT_COMPANY_INFO, "import.companyInfo")
          );
        }
        if (Array.isArray(parsed.projects) && parsed.projects.length > 0) {
          setActiveProjectId(parsed.projects[0].id);
        }
        return true;
      } catch (e) {
        console.error("[AppStateProvider] importData failed:", e);
        return false;
      }
    },
    [replaceAllProjects, replaceAllPositions, replaceAllOverheads, replaceAllEmployees, replaceAllProducts, replaceAllSubscriptions, replaceAllCustomers, replaceAllCommissionPayees, replaceAllCommissions, replaceAllLedger, replaceAllLoans, setCompanyInfo, setActiveProjectId]
  );

  const isLoaded = projectsHydrated && companyHydrated && positionsApi.hydrated && overheadsApi.hydrated && employeesApi.hydrated && productsApi.hydrated && subscriptionsApi.hydrated && customersApi.hydrated && commissionPayeesApi.hydrated && commissionsApi.hydrated && ledgerApi.hydrated && loansApi.hydrated && cashflowHydrated;

  const value = useMemo(() => ({
    isLoaded,
    projects,
    positions,
    overheads,
    employees,
    companyInfo,
    setCompanyInfo,
    activeProjectId,
    activeProject,
    setActiveProjectId,
    addProject,
    updateProject,
    deleteProject,
    duplicateProject,
    addPosition: positionsApi.addPosition,
    updatePosition: positionsApi.updatePosition,
    deletePosition,
    addOverhead: overheadsApi.addOverhead,
    updateOverhead: overheadsApi.updateOverhead,
    deleteOverhead: overheadsApi.deleteOverhead,
    addEmployee: employeesApi.addEmployee,
    updateEmployee: employeesApi.updateEmployee,
    deleteEmployee: employeesApi.deleteEmployee,
    products,
    addProduct: productsApi.addProduct,
    updateProduct: productsApi.updateProduct,
    deleteProduct: productsApi.deleteProduct,
    subscriptions,
    addSubscription: subscriptionsApi.addSubscription,
    updateSubscription: subscriptionsApi.updateSubscription,
    deleteSubscription: subscriptionsApi.deleteSubscription,
    customers,
    addCustomer: customersApi.addCustomer,
    updateCustomer,
    deleteCustomer,
    importCustomersFromExisting,
    commissionPayees,
    addCommissionPayee: commissionPayeesApi.addPayee,
    updateCommissionPayee: commissionPayeesApi.updatePayee,
    deleteCommissionPayee: commissionPayeesApi.deletePayee,
    commissions,
    addCommission: commissionsApi.addCommission,
    updateCommission: commissionsApi.updateCommission,
    deleteCommission: commissionsApi.deleteCommission,
    ledger,
    addLedgerEntry: ledgerApi.addLedgerEntry,
    updateLedgerEntry: ledgerApi.updateLedgerEntry,
    deleteLedgerEntry: ledgerApi.deleteLedgerEntry,
    loans,
    addLoan: loansApi.addLoan,
    updateLoan: loansApi.updateLoan,
    deleteLoan: loansApi.deleteLoan,
    cashflowSettings,
    setCashflowSettings,
    exportData,
    importData,
  }), [
    isLoaded, projects, positions, overheads, employees, companyInfo, setCompanyInfo,
    activeProjectId, activeProject, setActiveProjectId, addProject, updateProject,
    deleteProject, duplicateProject, positionsApi.addPosition, positionsApi.updatePosition,
    deletePosition, overheadsApi.addOverhead, overheadsApi.updateOverhead,
    overheadsApi.deleteOverhead, employeesApi.addEmployee, employeesApi.updateEmployee,
    employeesApi.deleteEmployee, products, productsApi.addProduct, productsApi.updateProduct,
    productsApi.deleteProduct, subscriptions, subscriptionsApi.addSubscription,
    subscriptionsApi.updateSubscription, subscriptionsApi.deleteSubscription,
    customers, customersApi.addCustomer, updateCustomer,
    deleteCustomer, importCustomersFromExisting,
    commissionPayees, commissionPayeesApi.addPayee, commissionPayeesApi.updatePayee,
    commissionPayeesApi.deletePayee, commissions, commissionsApi.addCommission,
    commissionsApi.updateCommission, commissionsApi.deleteCommission,
    ledger, ledgerApi.addLedgerEntry, ledgerApi.updateLedgerEntry, ledgerApi.deleteLedgerEntry,
    loans, loansApi.addLoan, loansApi.updateLoan, loansApi.deleteLoan,
    cashflowSettings, setCashflowSettings, exportData, importData
  ]);

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error("useAppState must be used within AppStateProvider");
  }
  return context;
}
