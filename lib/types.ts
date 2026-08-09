export interface PositionRate {
  id: string
  title: string
  salary: number
  dailyRate: number
  isCustomRate: boolean
  // จำนวนพนักงานจริงในตำแหน่งนี้ (ใช้คำนวณ capacity ของบริษัท)
  headcount: number
  // % สวัสดิการ/ภาษีนายจ้าง (โบนัส, กองทุน, อื่นๆ) บวกเข้าต้นทุนแรงงานจริง
  benefitPercent: number
  // ค่าประกันสังคม (บาท/เดือน/คน) — มาตรฐานไทยฝั่งนายจ้าง 5% ของฐาน max 750
  socialSecurityAmount: number
}

export interface OverheadItem {
  id: string
  name: string
  cost: number
  period: "monthly" | "yearly"
  // วันที่เริ่มมีผล (ISO yyyy-mm-dd) — โปรเจกต์ที่ quotationDate < effectiveFrom จะไม่ใช้รายการนี้
  effectiveFrom: string
  // วันที่สิ้นสุด (ISO yyyy-mm-dd, optional) — null/undefined = ยังใช้อยู่ในปัจจุบัน
  effectiveTo?: string
}

// ====================================================
// Employee — actual person on payroll
// (different from PositionRate which is a *rate template*)
// ====================================================
export interface Employee {
  id: string
  name: string
  // ผูกกับตำแหน่ง (optional) เพื่อ reporting/วิเคราะห์
  positionId?: string
  // เงินเดือนพื้นฐาน (บาท/เดือน)
  monthlySalary: number
  // % สวัสดิการ/ภาษีนายจ้าง บวกเข้าต้นทุนจริง
  benefitPercent: number
  // ค่าประกันสังคม (บาท/เดือน) ที่นายจ้างจ่าย
  socialSecurityAmount: number
  // วันที่เริ่มงาน (ISO yyyy-mm-dd)
  startDate: string
  // วันที่ลาออก (optional) — null/undefined = ยังทำงานอยู่
  endDate?: string
  // โบนัสประจำปี (บาท) — จ่ายเดือน 12 ของแต่ละปี
  annualBonus?: number
  notes?: string
}

export interface ProjectPositionAllocation {
  positionId: string
  mandays: number
  customDailyRate?: number
}

// โมดูลงาน — ใช้เมื่อ estimationMode = 'module'
// แบ่งโปรเจกต์เป็นโมดูลย่อย (เช่น Auth, Report, Payment) แล้วประเมิน mandays/ตำแหน่ง ต่อโมดูล
// project.allocations = ผลรวม mandays ของทุกโมดูล (สร้างอัตโนมัติ) เพื่อให้ส่วนคำนวณเดิมใช้ได้ไม่ต้องแก้
export interface ProjectModule {
  id: string
  name: string
  description?: string
  allocations: ProjectPositionAllocation[]
}

export interface DirectCostItem {
  id: string
  name: string
  cost: number
  category?: "license" | "hosting" | "outsource" | "travel" | "other"
}

export type ProjectStatus =
  | "draft"
  | "quoted"
  | "won"
  | "lost"
  | "in_progress"
  | "completed"

export type PricingMode = "cost_plus" | "fixed_price"

export interface ClientInfo {
  name: string
  taxId?: string // เลขผู้เสียภาษี 13 หลัก
  address?: string
  contactPerson?: string // ชื่อผู้ติดต่อ
  contactEmail?: string
  contactPhone?: string
}

export interface CompanyInfo {
  name: string
  taxId?: string
  address?: string
  phone?: string
  email?: string
  website?: string
  // ผู้ลงนามฝั่งบริษัทออกใบเสนอราคา
  signerName?: string
  signerTitle?: string
}

export interface PaymentInstallment {
  id: string
  name: string // เช่น "Deposit", "Milestone 1", "On Delivery"
  percent: number // % ของยอดราคารวม
  dueAfterDays: number // ครบกำหนดหลังเซ็นสัญญา X วัน (0 = ทันที)
  description?: string
  // ผูกกับ phase id ถ้าต้องการ (เฟส 2B)
  phaseId?: string
}

export interface PaymentTerms {
  installments: PaymentInstallment[]
  // จำนวนวันที่ลูกค้าต้องชำระหลังออกใบแจ้งหนี้
  paymentDueDays: number
  // ค่าปรับล่าช้า % ต่อเดือน
  lateFeePercent: number
  notes?: string
}

export interface ProjectPhase {
  id: string
  name: string // เช่น "Design Phase", "Development Sprint 1"
  description?: string
  // % ของ mandays ทั้งหมดของโปรเจกต์ที่ใช้ใน phase นี้
  // (วิธีนี้ง่ายและ flexible กว่า assign mandays ต่อตำแหน่งต่อ phase)
  mandayPercent: number
  // กำหนดส่งมอบ (optional)
  milestoneDate?: string // ISO yyyy-mm-dd
  // ผลลัพธ์ที่ส่งมอบใน phase นี้
  deliverables: string[]
}

// ====================================================
// Customer (Master Data)
// ข้อมูลลูกค้ากลาง — เก็บครั้งเดียว แล้วให้ Subscription / Project อ้างอิงด้วย customerId
// ====================================================
export interface Customer {
  id: string
  name: string
  taxId?: string // เลขผู้เสียภาษี 13 หลัก
  address?: string
  contactPerson?: string
  contactEmail?: string
  contactPhone?: string
  active: boolean // ยังใช้งานอยู่/เลิกใช้
  notes?: string
  tags?: string[] // ป้ายกำกับสำหรับจัดกลุ่ม
}

// ====================================================
// Recurring Revenue — Products & Subscriptions
// (สำหรับการขายระบบซ้ำ เช่น white-label CRM ให้สำนักงานบัญชี)
// ====================================================

// license = จ่ายก้อนเดียว ใช้ได้ถึงวันหมดอายุ (เช่น ขายเป็นรายปี)
// subscription = เก็บเงินเป็นรอบต่อเนื่อง (รายเดือน/รายปี)
export type ProductBillingType = "license" | "subscription"
export type BillingCycle = "monthly" | "yearly"

export interface Product {
  id: string
  name: string // เช่น "CRM สำนักงานบัญชี – Pro"
  description?: string
  billingType: ProductBillingType
  // ใช้เมื่อ billingType = 'subscription' — รอบการเก็บเงิน
  billingCycle?: BillingCycle
  // ใช้เมื่อ billingType = 'license' — อายุ license เริ่มต้น (เดือน) เช่น 12
  defaultTermMonths?: number
  // ราคาตั้งต้น (ก่อน VAT) — ต่อรอบ (subscription) หรือต่อ license (license)
  defaultPrice: number
  active: boolean
  notes?: string
}

export type SubscriptionStatus = "active" | "expired" | "cancelled" | "trial"

// ข้อมูลลูกค้าของ subscription — โครงเดียวกับ ClientInfo แต่แยกไว้เพื่ออิสระ
export interface SubscriptionCustomer {
  name: string
  taxId?: string
  contactPerson?: string
  contactEmail?: string
  contactPhone?: string
}

export interface Subscription {
  id: string
  productId: string // ผูกกับ Product
  // อ้างอิง Customer master (optional) — ถ้าเว้นว่างใช้ snapshot ใน customer
  customerId?: string
  customer: SubscriptionCustomer // snapshot ข้อมูลลูกค้า ณ ตอนขาย
  // snapshot จาก product ตอนขาย (override ได้รายราย)
  billingType: ProductBillingType
  billingCycle?: BillingCycle // ใช้เมื่อ billingType = 'subscription'
  startDate: string // ISO yyyy-mm-dd — วันซื้อ/เริ่มใช้งาน
  endDate: string // ISO yyyy-mm-dd — วันหมดอายุ
  // ราคาที่ขายจริง (ก่อน VAT) ต่อรอบ (subscription) หรือต่องวด license
  amount: number
  seats?: number // จำนวน user/license (optional)
  status: SubscriptionStatus
  autoRenew: boolean // ต่ออายุอัตโนมัติหรือไม่
  // วันที่รับเงินจริง (ใช้ลง cashflow) — ถ้าเว้นว่างใช้ startDate
  paymentReceivedDate?: string
  notes?: string
}

// ====================================================
// Commission — ค่าคอมมิชชั่นการขาย
// ====================================================
export type PayeeType = "employee" | "partner"

export interface CommissionPayee {
  id: string
  name: string
  type: PayeeType
  // ผูกกับ Employee เมื่อ type = 'employee' (optional)
  employeeId?: string
  // เรตคอมตั้งต้น % — ใช้ prefill ตอนสร้างรายการคอม
  defaultRatePercent?: number
  contactEmail?: string
  contactPhone?: string
  active: boolean
  notes?: string
}

export type CommissionSourceType = "project" | "subscription"
export type CommissionBasis = "percent" | "fixed"
// one_time = จ่ายคอมครั้งเดียวตอนขาย, recurring = จ่ายทุกงวดที่ลูกค้าจ่าย
export type SubscriptionCommissionMode = "one_time" | "recurring"
export type CommissionStatus = "pending" | "paid" | "cancelled"

export interface Commission {
  id: string
  payeeId: string
  sourceType: CommissionSourceType
  sourceId: string // projectId หรือ subscriptionId
  basis: CommissionBasis
  ratePercent?: number // ใช้เมื่อ basis = 'percent'
  fixedAmount?: number // ใช้เมื่อ basis = 'fixed'
  // ใช้เมื่อ sourceType = 'subscription'
  subscriptionMode?: SubscriptionCommissionMode
  // จำกัดจำนวนงวดที่จ่ายคอม (optional) — ใช้เมื่อ recurring
  recurringMaxPayments?: number
  status: CommissionStatus
  // วันจ่ายคอม (สำหรับ one-time) — ใช้ลง cashflow
  payoutDate?: string
  notes?: string
}

// ====================================================
// Loans — เงินกู้ยืม (หนี้สิน) จากธนาคาร/บริษัทเพื่อน/บุคคล
// บันทึกเงินต้น + อัตราดอกเบี้ย + การผ่อนชำระแต่ละงวด (แยกเงินต้น/ดอก)
// เพื่อติดตาม "ยอดหนี้คงเหลือ" — แยกจาก ledger ที่บันทึกเงินสดเข้า/ออกจริง
// ====================================================
export type LoanLenderType = "bank" | "related_company" | "individual" | "other"
export type LoanStatus = "active" | "paid_off"

// สถานะการจ่ายของงวดผ่อน — ทำตารางล่วงหน้าแล้วค่อยกดว่าจ่ายแล้ว
// (รายการเก่าที่ไม่มี status ถือว่า 'paid' เพื่อ backward-compat)
export type RepaymentStatus = "pending" | "paid"

// การผ่อนชำระ 1 งวด — แยกส่วนเงินต้นกับดอกเบี้ย + สถานะจ่ายแล้ว/ยัง
export interface LoanRepayment {
  id: string
  date: string // วันครบกำหนด/วันนัดจ่าย (ISO yyyy-mm-dd)
  principal: number // ส่วนที่ตัดเงินต้น
  interest: number // ส่วนดอกเบี้ย
  status?: RepaymentStatus // 'pending' = ยังไม่จ่าย, 'paid'/undefined = จ่ายแล้ว
  paidDate?: string // วันที่จ่ายจริง (เมื่อ status = 'paid')
  note?: string
}

export interface Loan {
  id: string
  lender: string // ชื่อเจ้าหนี้/ผู้ให้กู้
  lenderType: LoanLenderType // ประเภทเจ้าหนี้
  principal: number // เงินต้นที่กู้มา (ยอดตั้งต้น)
  annualInterestRate: number // อัตราดอกเบี้ยต่อปี (%)
  startDate: string // วันที่รับเงินกู้ (ISO yyyy-mm-dd)
  termMonths?: number // ระยะเวลา (เดือน) — optional
  reference?: string // เลขที่สัญญา/อ้างอิง
  status: LoanStatus
  notes?: string
  repayments: LoanRepayment[] // ประวัติการผ่อนชำระ
}

// ====================================================
// Ledger — รายการเดินบัญชี (เงินเข้า/เงินออกจริง)
// บันทึกกระแสเงินจริงที่เกิดขึ้น แยกจาก projection ใน cashflow.ts
// (ใช้เทียบ "ประมาณการ vs จริง" ได้)
// ====================================================
export type LedgerDirection = "in" | "out"

export type LedgerCategory =
  | "project_payment" // รับเงินจากโครงการ
  | "subscription" // รับเงินค่า subscription/license
  | "commission" // จ่ายค่าคอม
  | "salary" // เงินเดือน/ค่าแรง
  | "overhead" // ค่าใช้จ่ายส่วนกลาง
  | "tax" // ภาษี
  | "refund" // คืนเงิน
  | "loan_received" // รับเงินกู้เข้ามา
  | "loan_principal" // จ่ายคืนเงินต้น
  | "loan_interest" // ดอกเบี้ยจ่าย
  | "other" // อื่น ๆ

// ไฟล์แนบ (slip โอนเงิน/ใบเสร็จ) — เก็บไฟล์จริงใน Supabase Storage
export interface LedgerAttachment {
  id: string
  fileName: string
  // path ภายใน bucket "ledger-slips" เช่น {userId}/{ledgerId}/{uuid}-{name}
  storagePath: string
  mimeType: string
  sizeBytes: number
  uploadedAt: string
}

export interface LedgerEntry {
  id: string
  date: string // วันที่เกิดรายการ (ISO yyyy-mm-dd)
  direction: LedgerDirection
  // จำนวนเงินสุทธิที่เคลื่อนไหวจริง (บาท)
  amount: number
  vatAmount?: number // VAT แยก (ถ้ามี)
  whtAmount?: number // หัก ณ ที่จ่าย (ถ้ามี)
  category: LedgerCategory
  account?: string // บัญชี/ธนาคารที่ใช้
  counterparty?: string // ลูกค้า/ผู้รับเงิน/คู่ค้า
  reference?: string // เลขที่ใบเสร็จ/อ้างอิง
  description?: string
  // ผูกกับแหล่งที่มาเพื่อ reconcile กับ projection (optional)
  sourceType?:
    | "project"
    | "subscription"
    | "commission"
    | "payroll"
    | "overhead"
    | "manual"
  sourceId?: string
  // เคสสำรองจ่าย: จ่ายเงินส่วนตัวออกไปก่อนแทนบริษัท แล้วค่อยเบิกคืน
  // (ใช้กับรายการเงินออกเป็นหลัก) — บันทึกเป็นรายการเดียว แล้วติดธง + สถานะเบิกคืน
  reimbursable?: boolean // true = เป็นรายการสำรองจ่าย รอเบิกคืนบริษัท
  paidBy?: string // ผู้สำรองจ่าย (ใครออกเงินส่วนตัวก่อน)
  reimbursementStatus?: "pending" | "reimbursed" // รอเบิก / เบิกคืนแล้ว
  reimbursedDate?: string // วันที่บริษัทจ่ายคืน (ISO yyyy-mm-dd)
  attachments: LedgerAttachment[]
  // ผู้บันทึก — เตรียมไว้สำหรับ RBAC (เฟส B); เฟส A ใช้ user id ปัจจุบัน
  ownerId?: string
  createdAt: string
  updatedAt: string
}

// ====================================================
// Organization & Membership (RBAC — เฟส B)
// org เดียวร่วมกัน: ทีมแชร์ข้อมูล + คุมสิทธิ์ตาม role และ data_scope
// ====================================================
export type OrgRole = "owner" | "admin" | "accountant" | "sales" | "viewer"

// all = เห็นข้อมูลทั้งหมดของ org, own = เห็นเฉพาะข้อมูลที่ตัวเองสร้าง
export type DataScope = "all" | "own"

export interface Organization {
  id: string
  name: string
}

export interface OrganizationOption extends Organization {
  role: OrgRole
  dataScope: DataScope
  active: boolean
}

export interface OrganizationOption extends Organization {
  role: OrgRole
  dataScope: DataScope
  active: boolean
}

export interface Membership {
  orgId: string
  userId: string
  role: OrgRole
  dataScope: DataScope
  active: boolean
  // อีเมล (จาก auth) — เติมฝั่ง client เพื่อแสดงผล (ไม่ได้เก็บใน memberships)
  email?: string
}

export type ScenarioId = "best" | "realistic" | "worst"

export interface Scenario {
  id: ScenarioId
  // ตัวคูณกับ mandays ทั้งหมดในสถานการณ์นี้
  mandayMultiplier: number
  // override markup % (ถ้าเว้นว่าง = ใช้ markup หลักของโปรเจกต์)
  markupOverride?: number
  // override contingency % (ถ้าเว้นว่าง = ใช้ contingency หลัก)
  contingencyOverride?: number
  notes?: string
}

export interface Project {
  id: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
  // วันที่ออกใบเสนอราคา — ใช้กรอง overheads ที่ active ในช่วงนั้น
  quotationDate: string
  // วันที่เริ่มงานจริง (ใช้ใน Resource Planning) — ถ้าเว้นว่างจะใช้ quotationDate
  startDate?: string
  // เลขที่ใบเสนอราคา
  quotationNumber?: string
  // วันหมดอายุของราคา
  validUntil?: string
  workingDaysPerMonth: number
  durationMonths: number
  // โหมดประเมินค่าแรง: 'simple' = ตารางเดียวทั้งโครงการ (default), 'module' = แบ่งราย Module
  estimationMode?: "simple" | "module"
  // allocations = ผลรวมที่ใช้คำนวณจริง (โหมด module จะ rebuild จากผลรวมของ modules อัตโนมัติ)
  allocations: ProjectPositionAllocation[]
  // โมดูลงาน — เก็บไว้เพื่อแก้ไขในโหมด module (downstream อ่าน allocations ที่ถูกรวมแล้ว)
  modules?: ProjectModule[]
  directCosts: DirectCostItem[]
  overheadAllocationMethod: "proportional" | "percentage" | "fixed"
  overheadAllocationValue: number
  contingencyPercent: number
  // โหมดการกำหนดราคา:
  // - cost_plus: priceBeforeTax = ต้นทุน × (1 + markupPercentage%)
  // - fixed_price: priceBeforeTax = fixedPrice (ขายเหมา)
  pricingMode: PricingMode
  // ราคาขายโครงการ (ก่อน VAT) — ใช้เมื่อ pricingMode = fixed_price
  fixedPrice: number
  // % markup — ใช้เมื่อ pricingMode = cost_plus
  markupPercentage: number
  taxRate: number
  withholdingTaxPercent: number
  status: ProjectStatus
  // อ้างอิง Customer master (optional) — ถ้าเว้นว่างใช้ snapshot ใน client
  customerId?: string
  // ข้อมูลลูกค้า (snapshot — เปลี่ยนจาก clientName เป็น object เต็ม)
  client: ClientInfo
  // เงื่อนไขการชำระเงิน
  paymentTerms: PaymentTerms
  // เฟสและ milestones
  phases: ProjectPhase[]
  // สถานการณ์เปรียบเทียบ
  scenarios?: Scenario[]
}
