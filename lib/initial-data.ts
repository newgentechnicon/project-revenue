import { PositionRate, OverheadItem, Project, Employee, Product, Subscription, Customer, CommissionPayee, Commission, LedgerEntry, Loan } from "./types";

// วันที่อ้างอิงเริ่มต้นของ overhead ทั้งหมด (สามารถปรับใน UI ภายหลัง)
const DEFAULT_EFFECTIVE_FROM = "2024-01-01";

export const DEFAULT_POSITIONS: PositionRate[] = [
  { id: "1", title: "Project Manager (PM)",   salary: 65000, dailyRate: 3250, isCustomRate: false, headcount: 1, benefitPercent: 15, socialSecurityAmount: 750 },
  { id: "2", title: "System Analyst (SA)",    salary: 50000, dailyRate: 2500, isCustomRate: false, headcount: 1, benefitPercent: 15, socialSecurityAmount: 750 },
  { id: "3", title: "UX/UI Designer",         salary: 40000, dailyRate: 2000, isCustomRate: false, headcount: 2, benefitPercent: 15, socialSecurityAmount: 750 },
  { id: "4", title: "Senior Developer",       salary: 75000, dailyRate: 3750, isCustomRate: false, headcount: 2, benefitPercent: 15, socialSecurityAmount: 750 },
  { id: "5", title: "Junior Developer",       salary: 32000, dailyRate: 1600, isCustomRate: false, headcount: 3, benefitPercent: 15, socialSecurityAmount: 750 },
  { id: "6", title: "QA / Tester",            salary: 35000, dailyRate: 1750, isCustomRate: false, headcount: 2, benefitPercent: 15, socialSecurityAmount: 750 },
  { id: "7", title: "DevOps Engineer",        salary: 60000, dailyRate: 3000, isCustomRate: false, headcount: 1, benefitPercent: 15, socialSecurityAmount: 750 },
];

export const DEFAULT_EMPLOYEES: Employee[] = [];

export const DEFAULT_OVERHEADS: OverheadItem[] = [
  { id: "o1", name: "ค่าเช่าออฟฟิศ (Office Rent)", cost: 35000, period: "monthly", effectiveFrom: DEFAULT_EFFECTIVE_FROM },
  { id: "o2", name: "ค่าน้ำ ค่าไฟ และอินเทอร์เน็ต (Utilities & Net)", cost: 8000, period: "monthly", effectiveFrom: DEFAULT_EFFECTIVE_FROM },
  { id: "o3", name: "ค่าซอฟต์แวร์ลิขสิทธิ์ (Figma, GitHub, AWS, Slack)", cost: 12000, period: "monthly", effectiveFrom: DEFAULT_EFFECTIVE_FROM },
  { id: "o4", name: "เงินเดือนพนักงานธุรการและบัญชี (Admin Salaries)", cost: 45000, period: "monthly", effectiveFrom: DEFAULT_EFFECTIVE_FROM },
  { id: "o5", name: "ค่าเสื่อมราคาและค่าใช้จ่ายจิปาถะ (Misc & Depreciation)", cost: 5000, period: "monthly", effectiveFrom: DEFAULT_EFFECTIVE_FROM },
];

// ====================================================
// Recurring Revenue — Products & Subscriptions (ตัวอย่างเริ่มต้น)
// ====================================================
export const DEFAULT_PRODUCTS: Product[] = [
  {
    id: "prod_crm_pro",
    name: "CRM สำนักงานบัญชี – Pro",
    description: "White-label CRM สำหรับสำนักงานบัญชี (แพ็กเกจ Pro)",
    billingType: "subscription",
    billingCycle: "yearly",
    defaultPrice: 36000,
    active: true,
  },
  {
    id: "prod_crm_basic",
    name: "CRM สำนักงานบัญชี – Basic",
    description: "White-label CRM แพ็กเกจเริ่มต้น เก็บเงินรายเดือน",
    billingType: "subscription",
    billingCycle: "monthly",
    defaultPrice: 1500,
    active: true,
  },
  {
    id: "prod_crm_license",
    name: "CRM สำนักงานบัญชี – License 1 ปี",
    description: "ขายขาดเป็น license ใช้งานได้ 1 ปี",
    billingType: "license",
    defaultTermMonths: 12,
    defaultPrice: 30000,
    active: true,
  },
];

export const DEFAULT_SUBSCRIPTIONS: Subscription[] = [];

export const DEFAULT_CUSTOMERS: Customer[] = [];

export const DEFAULT_COMMISSION_PAYEES: CommissionPayee[] = [];

export const DEFAULT_COMMISSIONS: Commission[] = [];

export const DEFAULT_LEDGER: LedgerEntry[] = [];

export const DEFAULT_LOANS: Loan[] = [];

export const DEFAULT_PROJECTS: Project[] = [
  {
    id: "p1",
    name: "โปรเจกต์ระบบ E-Commerce Platform",
    description: "ระบบซื้อขายสินค้าออนไลน์ครบวงจร มีหน้าเว็บ ระบบจัดการหลังบ้าน และเชื่อมต่อระบบชำระเงิน",
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    quotationDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    workingDaysPerMonth: 20,
    durationMonths: 4,
    allocations: [
      { positionId: "1", mandays: 12 },
      { positionId: "2", mandays: 10 },
      { positionId: "3", mandays: 15 },
      { positionId: "4", mandays: 25 },
      { positionId: "5", mandays: 35 },
      { positionId: "6", mandays: 18 },
      { positionId: "7", mandays: 6 },
    ],
    directCosts: [
      { id: "dc1", name: "Cloud Hosting (AWS) ตลอดโครงการ", cost: 18000, category: "hosting" },
      { id: "dc2", name: "ค่าใช้บริการ Payment Gateway", cost: 8000, category: "license" },
    ],
    overheadAllocationMethod: "proportional",
    overheadAllocationValue: 20,
    contingencyPercent: 10,
    pricingMode: "cost_plus",
    fixedPrice: 0,
    markupPercentage: 35,
    taxRate: 7,
    withholdingTaxPercent: 3,
    status: "quoted",
    quotationNumber: "QT-202405-001",
    client: {
      name: "บริษัท ลูกค้าตัวอย่าง จำกัด",
      taxId: "0105561234567",
      contactPerson: "คุณสมชาย ใจดี",
      contactEmail: "somchai@example.com",
      contactPhone: "081-234-5678",
    },
    paymentTerms: {
      installments: [
        { id: "i1", name: "เงินมัดจำ", percent: 30, dueAfterDays: 0, description: "ชำระเมื่อเซ็นสัญญา" },
        { id: "i2", name: "ส่งงาน Phase 1", percent: 40, dueAfterDays: 60, description: "ส่งมอบ MVP" },
        { id: "i3", name: "ส่งมอบงานสมบูรณ์", percent: 30, dueAfterDays: 120, description: "หลัง UAT ผ่าน" },
      ],
      paymentDueDays: 30,
      lateFeePercent: 1.5,
    },
    phases: [],
  },
  {
    id: "p2",
    name: "ระบบ Mobile App Delivery MVP",
    description: "แอปพลิเคชันจัดส่งอาหารเวอร์ชันแรกสำหรับทดสอบตลาด รองรับ iOS และ Android",
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    quotationDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    workingDaysPerMonth: 20,
    durationMonths: 3,
    allocations: [
      { positionId: "1", mandays: 8 },
      { positionId: "3", mandays: 10 },
      { positionId: "4", mandays: 20 },
      { positionId: "5", mandays: 15 },
      { positionId: "6", mandays: 10 },
      { positionId: "7", mandays: 4 },
    ],
    directCosts: [],
    overheadAllocationMethod: "percentage",
    overheadAllocationValue: 15,
    contingencyPercent: 15,
    pricingMode: "cost_plus",
    fixedPrice: 0,
    markupPercentage: 30,
    taxRate: 7,
    withholdingTaxPercent: 3,
    status: "draft",
    quotationNumber: "QT-202405-002",
    client: { name: "" },
    paymentTerms: {
      installments: [
        { id: "j1", name: "เงินมัดจำ", percent: 50, dueAfterDays: 0, description: "ชำระเมื่อเซ็นสัญญา" },
        { id: "j2", name: "ส่งมอบ MVP", percent: 50, dueAfterDays: 60, description: "ส่งมอบ MVP สำเร็จ" },
      ],
      paymentDueDays: 30,
      lateFeePercent: 1.5,
    },
    phases: [],
  },
];
