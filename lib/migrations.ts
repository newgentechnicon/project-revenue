/**
 * Versioned localStorage migration system.
 *
 * Convention:
 *   Each storage key is wrapped as { version: N, data: <payload> }.
 *   To support evolving schema across releases, we keep a list of migrations
 *   `migrate_X_to_Y` and chain them up to CURRENT_SCHEMA_VERSION.
 *
 * Legacy data (without envelope) is treated as version 1.
 */

import {
  CURRENT_SCHEMA_VERSION,
  StorageEnvelope,
} from "./schemas";

type RawRecord = Record<string, unknown>;

// ============================================================
// Migration steps for PROJECT
// ============================================================

// v1 → v2: เพิ่ม headcount, benefitPercent ใน positions / durationMonths, directCosts, contingency, WHT ใน projects
// v2 → v3: เพิ่ม socialSecurityAmount, effectiveFrom/To, quotationDate, client object, paymentTerms, phases, scenarios
// v3 → v4: เพิ่ม pricingMode + fixedPrice (default = cost_plus, fixedPrice = 0)
// v4 → v5: เพิ่ม startDate (optional) — สำหรับ Resource Planning Gantt

function migrateProject_v1_to_v2(p: RawRecord): RawRecord {
  return {
    ...p,
    durationMonths: typeof p.durationMonths === "number" ? p.durationMonths : 1,
    directCosts: Array.isArray(p.directCosts) ? p.directCosts : [],
    contingencyPercent: typeof p.contingencyPercent === "number" ? p.contingencyPercent : 10,
    withholdingTaxPercent: typeof p.withholdingTaxPercent === "number" ? p.withholdingTaxPercent : 3,
    status: typeof p.status === "string" ? p.status : "draft",
  };
}

function migrateProject_v3_to_v4(p: RawRecord): RawRecord {
  return {
    ...p,
    pricingMode: p.pricingMode === "fixed_price" ? "fixed_price" : "cost_plus",
    fixedPrice: typeof p.fixedPrice === "number" ? p.fixedPrice : 0,
  };
}

function migrateProject_v4_to_v5(p: RawRecord): RawRecord {
  // startDate เป็น optional — ไม่ใส่ค่า default
  // อ่านอย่างปลอดภัย: ถ้ามีอยู่แล้วเป็น string ก็ใช้, ไม่งั้น undefined
  return {
    ...p,
    startDate: typeof p.startDate === "string" ? p.startDate : undefined,
  };
}

function migrateProject_v2_to_v3(p: RawRecord): RawRecord {
  // v2 → v3: รวบ legacy clientName เป็น client object, เพิ่ม payment terms / phases / quotationDate
  const createdAt = typeof p.createdAt === "string" ? p.createdAt : new Date().toISOString();
  const legacyClientName = typeof p.clientName === "string" ? p.clientName : "";
  const existingClient = (p.client && typeof p.client === "object") ? p.client as RawRecord : null;

  return {
    ...p,
    quotationDate: typeof p.quotationDate === "string" ? p.quotationDate : createdAt.split("T")[0],
    client: existingClient ?? { name: legacyClientName },
    paymentTerms: (p.paymentTerms && typeof p.paymentTerms === "object")
      ? p.paymentTerms
      : {
          installments: [
            { id: "inst_1", name: "เงินมัดจำ (Deposit)", percent: 30, dueAfterDays: 0, description: "ชำระเมื่อเซ็นสัญญา" },
            { id: "inst_2", name: "ส่งมอบงาน (On Delivery)", percent: 70, dueAfterDays: 30, description: "ชำระเมื่อส่งมอบงานครบ" },
          ],
          paymentDueDays: 30,
          lateFeePercent: 1.5,
        },
    phases: Array.isArray(p.phases) ? p.phases : [],
  };
}

function migratePosition_v1_to_v2(p: RawRecord): RawRecord {
  return {
    ...p,
    headcount: typeof p.headcount === "number" ? p.headcount : 1,
    benefitPercent: typeof p.benefitPercent === "number" ? p.benefitPercent : 15,
  };
}

function migratePosition_v2_to_v3(p: RawRecord): RawRecord {
  return {
    ...p,
    socialSecurityAmount: typeof p.socialSecurityAmount === "number" ? p.socialSecurityAmount : 750,
  };
}

function migrateOverhead_v1_to_v2(o: RawRecord): RawRecord {
  return o; // no change
}

function migrateOverhead_v2_to_v3(o: RawRecord): RawRecord {
  return {
    ...o,
    effectiveFrom: typeof o.effectiveFrom === "string" ? o.effectiveFrom : "2024-01-01",
  };
}

// ============================================================
// Public API
// ============================================================

export interface MigrationOptions<T> {
  /** ชื่อ storage key (สำหรับ log) */
  context: string;
  /** ค่าเริ่มต้นถ้า read fail */
  defaultValue: T;
  /** Migration runners */
  migrateItem?: (item: RawRecord, fromVersion: number) => RawRecord;
}

/**
 * อ่านข้อมูลจาก localStorage โดยรองรับทั้ง legacy format (raw array/object)
 * และ envelope format ใหม่ ({ version, data })
 * แล้ว migrate ขึ้นไปยัง CURRENT_SCHEMA_VERSION
 */
export function readVersioned<T>(
  raw: string | null,
  options: MigrationOptions<T>
): { data: unknown; migrated: boolean } {
  if (!raw) {
    return { data: options.defaultValue, migrated: false };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn(`[migrations] ${options.context}: JSON parse failed, using default`);
    return { data: options.defaultValue, migrated: false };
  }

  // ตรวจว่ามี envelope หรือไม่
  const envelope = StorageEnvelopeSafeRead(parsed);
  const version = envelope ? envelope.version : 1;
  const data = envelope ? envelope.data : parsed;

  if (version === CURRENT_SCHEMA_VERSION) {
    return { data, migrated: false };
  }

  // ถ้ามี migrateItem และ data เป็น array → migrate ทีละ item
  if (options.migrateItem && Array.isArray(data)) {
    const migrate = options.migrateItem;
    let migrated = data as RawRecord[];
    let currentVersion = version;
    while (currentVersion < CURRENT_SCHEMA_VERSION) {
      const nextVersion = currentVersion + 1;
      migrated = migrated.map((item) => migrate(item, currentVersion));
      currentVersion = nextVersion;
    }
    return { data: migrated, migrated: true };
  }

  return { data, migrated: version !== CURRENT_SCHEMA_VERSION };
}

function StorageEnvelopeSafeRead(parsed: unknown): StorageEnvelope | null {
  if (
    parsed &&
    typeof parsed === "object" &&
    !Array.isArray(parsed) &&
    "version" in parsed &&
    "data" in parsed &&
    typeof (parsed as RawRecord).version === "number"
  ) {
    return parsed as StorageEnvelope;
  }
  return null;
}

/**
 * เขียน data ใน envelope format
 */
export function writeVersioned(data: unknown): string {
  const envelope: StorageEnvelope = {
    version: CURRENT_SCHEMA_VERSION,
    data,
  };
  return JSON.stringify(envelope);
}

// ============================================================
// Per-entity migrate chains (chained v1 → v2 → v3)
// ============================================================

export function migrateProjectChain(item: RawRecord, fromVersion: number): RawRecord {
  let result = item;
  let v = fromVersion;
  if (v < 2) {
    result = migrateProject_v1_to_v2(result);
    v = 2;
  }
  if (v < 3) {
    result = migrateProject_v2_to_v3(result);
    v = 3;
  }
  if (v < 4) {
    result = migrateProject_v3_to_v4(result);
    v = 4;
  }
  if (v < 5) {
    result = migrateProject_v4_to_v5(result);
    v = 5;
  }
  return result;
}

export function migratePositionChain(item: RawRecord, fromVersion: number): RawRecord {
  let result = item;
  let v = fromVersion;
  if (v < 2) {
    result = migratePosition_v1_to_v2(result);
    v = 2;
  }
  if (v < 3) {
    result = migratePosition_v2_to_v3(result);
    v = 3;
  }
  return result;
}

export function migrateOverheadChain(item: RawRecord, fromVersion: number): RawRecord {
  let result = item;
  let v = fromVersion;
  if (v < 2) {
    result = migrateOverhead_v1_to_v2(result);
    v = 2;
  }
  if (v < 3) {
    result = migrateOverhead_v2_to_v3(result);
    v = 3;
  }
  return result;
}
