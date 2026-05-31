import { z } from "zod";

// ====================================================
// Position Rate
// ====================================================
export const PositionRateSchema = z.object({
  id: z.string(),
  title: z.string(),
  salary: z.number().min(0),
  dailyRate: z.number().min(0),
  isCustomRate: z.boolean(),
  headcount: z.number().int().min(0),
  benefitPercent: z.number().min(0).max(100),
  socialSecurityAmount: z.number().min(0),
});
export type PositionRateInput = z.infer<typeof PositionRateSchema>;

// ====================================================
// Overhead Item
// ====================================================
export const OverheadItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  cost: z.number().min(0),
  period: z.enum(["monthly", "yearly"]),
  effectiveFrom: z.string(), // ISO yyyy-mm-dd
  effectiveTo: z.string().optional(),
});
export type OverheadItemInput = z.infer<typeof OverheadItemSchema>;

// ====================================================
// Employee
// ====================================================
export const EmployeeSchema = z.object({
  id: z.string(),
  name: z.string(),
  positionId: z.string().optional(),
  monthlySalary: z.number().min(0),
  benefitPercent: z.number().min(0).max(100),
  socialSecurityAmount: z.number().min(0),
  startDate: z.string(),
  endDate: z.string().optional(),
  annualBonus: z.number().min(0).optional(),
  notes: z.string().optional(),
});
export type EmployeeInput = z.infer<typeof EmployeeSchema>;

// ====================================================
// Customer (Master Data)
// ====================================================
export const CustomerSchema = z.object({
  id: z.string(),
  name: z.string(),
  taxId: z.string().optional(),
  address: z.string().optional(),
  contactPerson: z.string().optional(),
  contactEmail: z.string().optional(),
  contactPhone: z.string().optional(),
  active: z.boolean(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
});
export type CustomerInput = z.infer<typeof CustomerSchema>;

// ====================================================
// Recurring Revenue — Products & Subscriptions
// ====================================================
export const ProductBillingTypeSchema = z.enum(["license", "subscription"]);
export const BillingCycleSchema = z.enum(["monthly", "yearly"]);

export const ProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  billingType: ProductBillingTypeSchema,
  billingCycle: BillingCycleSchema.optional(),
  defaultTermMonths: z.number().int().min(1).optional(),
  defaultPrice: z.number().min(0),
  active: z.boolean(),
  notes: z.string().optional(),
});
export type ProductInput = z.infer<typeof ProductSchema>;

export const SubscriptionStatusSchema = z.enum([
  "active", "expired", "cancelled", "trial",
]);

export const SubscriptionCustomerSchema = z.object({
  name: z.string(),
  taxId: z.string().optional(),
  contactPerson: z.string().optional(),
  contactEmail: z.string().optional(),
  contactPhone: z.string().optional(),
});

export const SubscriptionSchema = z.object({
  id: z.string(),
  productId: z.string(),
  customerId: z.string().optional(),
  customer: SubscriptionCustomerSchema,
  billingType: ProductBillingTypeSchema,
  billingCycle: BillingCycleSchema.optional(),
  startDate: z.string(),
  endDate: z.string(),
  amount: z.number().min(0),
  seats: z.number().int().min(0).optional(),
  status: SubscriptionStatusSchema,
  autoRenew: z.boolean(),
  paymentReceivedDate: z.string().optional(),
  notes: z.string().optional(),
});
export type SubscriptionInput = z.infer<typeof SubscriptionSchema>;

// ====================================================
// Commission — ผู้รับคอม + รายการคอม
// ====================================================
export const PayeeTypeSchema = z.enum(["employee", "partner"]);

export const CommissionPayeeSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: PayeeTypeSchema,
  employeeId: z.string().optional(),
  defaultRatePercent: z.number().min(0).max(100).optional(),
  contactEmail: z.string().optional(),
  contactPhone: z.string().optional(),
  active: z.boolean(),
  notes: z.string().optional(),
});
export type CommissionPayeeInput = z.infer<typeof CommissionPayeeSchema>;

export const CommissionSourceTypeSchema = z.enum(["project", "subscription"]);
export const CommissionBasisSchema = z.enum(["percent", "fixed"]);
export const SubscriptionCommissionModeSchema = z.enum(["one_time", "recurring"]);
export const CommissionStatusSchema = z.enum(["pending", "paid", "cancelled"]);

export const CommissionSchema = z.object({
  id: z.string(),
  payeeId: z.string(),
  sourceType: CommissionSourceTypeSchema,
  sourceId: z.string(),
  basis: CommissionBasisSchema,
  ratePercent: z.number().min(0).max(100).optional(),
  fixedAmount: z.number().min(0).optional(),
  subscriptionMode: SubscriptionCommissionModeSchema.optional(),
  recurringMaxPayments: z.number().int().min(1).optional(),
  status: CommissionStatusSchema,
  payoutDate: z.string().optional(),
  notes: z.string().optional(),
});
export type CommissionInput = z.infer<typeof CommissionSchema>;

// ====================================================
// Ledger — รายการเดินบัญชี (เงินเข้า/ออกจริง) + ไฟล์แนบ
// ====================================================
export const LedgerDirectionSchema = z.enum(["in", "out"]);

export const LedgerCategorySchema = z.enum([
  "project_payment", "subscription", "commission",
  "salary", "overhead", "tax", "refund", "other",
]);

export const LedgerAttachmentSchema = z.object({
  id: z.string(),
  fileName: z.string(),
  storagePath: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().min(0),
  uploadedAt: z.string(),
});

export const LedgerEntrySchema = z.object({
  id: z.string(),
  date: z.string(),
  direction: LedgerDirectionSchema,
  amount: z.number().min(0),
  vatAmount: z.number().min(0).optional(),
  whtAmount: z.number().min(0).optional(),
  category: LedgerCategorySchema,
  account: z.string().optional(),
  counterparty: z.string().optional(),
  reference: z.string().optional(),
  description: z.string().optional(),
  sourceType: z
    .enum(["project", "subscription", "commission", "payroll", "overhead", "manual"])
    .optional(),
  sourceId: z.string().optional(),
  attachments: z.array(LedgerAttachmentSchema),
  ownerId: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type LedgerEntryInput = z.infer<typeof LedgerEntrySchema>;

// ====================================================
// Project sub-types
// ====================================================
export const ProjectPositionAllocationSchema = z.object({
  positionId: z.string(),
  mandays: z.number().min(0),
  customDailyRate: z.number().min(0).optional(),
});

export const DirectCostItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  cost: z.number().min(0),
  category: z.enum(["license", "hosting", "outsource", "travel", "other"]).optional(),
});

export const ProjectStatusSchema = z.enum([
  "draft", "quoted", "won", "lost", "in_progress", "completed",
]);

export const PricingModeSchema = z.enum(["cost_plus", "fixed_price"]);

export const ClientInfoSchema = z.object({
  name: z.string(),
  taxId: z.string().optional(),
  address: z.string().optional(),
  contactPerson: z.string().optional(),
  contactEmail: z.string().optional(),
  contactPhone: z.string().optional(),
});

export const CompanyInfoSchema = z.object({
  name: z.string(),
  taxId: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  website: z.string().optional(),
  signerName: z.string().optional(),
  signerTitle: z.string().optional(),
});
export type CompanyInfoInput = z.infer<typeof CompanyInfoSchema>;

export const PaymentInstallmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  percent: z.number().min(0).max(100),
  dueAfterDays: z.number().int().min(0),
  description: z.string().optional(),
  phaseId: z.string().optional(),
});

export const PaymentTermsSchema = z.object({
  installments: z.array(PaymentInstallmentSchema),
  paymentDueDays: z.number().int().min(0),
  lateFeePercent: z.number().min(0),
  notes: z.string().optional(),
});

export const ProjectPhaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  mandayPercent: z.number().min(0).max(100),
  milestoneDate: z.string().optional(),
  deliverables: z.array(z.string()),
});

export const ScenarioSchema = z.object({
  id: z.enum(["best", "realistic", "worst"]),
  mandayMultiplier: z.number().min(0),
  markupOverride: z.number().min(0).optional(),
  contingencyOverride: z.number().min(0).optional(),
  notes: z.string().optional(),
});

export const OverheadAllocationMethodSchema = z.enum([
  "proportional", "percentage", "fixed",
]);

// ====================================================
// Project (FULL)
// ====================================================
export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  quotationDate: z.string(),
  startDate: z.string().optional(),
  quotationNumber: z.string().optional(),
  validUntil: z.string().optional(),
  workingDaysPerMonth: z.number().int().min(1).max(31),
  durationMonths: z.number().min(0),
  allocations: z.array(ProjectPositionAllocationSchema),
  directCosts: z.array(DirectCostItemSchema),
  overheadAllocationMethod: OverheadAllocationMethodSchema,
  overheadAllocationValue: z.number().min(0),
  contingencyPercent: z.number().min(0),
  pricingMode: PricingModeSchema,
  fixedPrice: z.number().min(0),
  markupPercentage: z.number(),
  taxRate: z.number().min(0).max(50),
  withholdingTaxPercent: z.number().min(0).max(50),
  status: ProjectStatusSchema,
  customerId: z.string().optional(),
  client: ClientInfoSchema,
  paymentTerms: PaymentTermsSchema,
  phases: z.array(ProjectPhaseSchema),
  scenarios: z.array(ScenarioSchema).optional(),
});
export type ProjectInput = z.infer<typeof ProjectSchema>;

// ====================================================
// Storage wrapper (versioned)
// ====================================================
export const CURRENT_SCHEMA_VERSION = 5;

export const StorageEnvelopeSchema = z.object({
  version: z.number().int().min(1),
  data: z.unknown(),
});
export type StorageEnvelope = z.infer<typeof StorageEnvelopeSchema>;

// Helper: safe parse with fallback + log
export function safeParse<T>(
  schema: z.ZodType<T>,
  data: unknown,
  fallback: T,
  context: string
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.warn(`[schemas] ${context} validation failed, using fallback:`, result.error.format());
    return fallback;
  }
  return result.data;
}

export function safeParseArray<T>(
  itemSchema: z.ZodType<T>,
  data: unknown,
  context: string
): T[] {
  if (!Array.isArray(data)) {
    console.warn(`[schemas] ${context} not an array, returning []`);
    return [];
  }
  const out: T[] = [];
  data.forEach((item, idx) => {
    const r = itemSchema.safeParse(item);
    if (r.success) {
      out.push(r.data);
    } else {
      console.warn(`[schemas] ${context}[${idx}] skipped:`, r.error.format());
    }
  });
  return out;
}
