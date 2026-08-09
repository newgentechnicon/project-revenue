import type { SupabaseClient } from "@supabase/supabase-js";
import { StorageRepository } from "./storage-repository";
import { CURRENT_SCHEMA_VERSION } from "../schemas";

// ============================================================
// Key → Table mapping
// ============================================================

const MULTI_ROW_TABLES: Record<string, string> = {
  cost_est_projects: "projects",
  cost_est_positions: "positions",
  cost_est_overheads: "overheads",
  cost_est_employees: "employees",
  cost_est_products: "products",
  cost_est_subscriptions: "subscriptions",
  cost_est_customers: "customers",
  cost_est_commission_payees: "commission_payees",
  cost_est_commissions: "commissions",
  cost_est_ledger: "ledger",
  cost_est_loans: "loans",
};

const SINGLETON_TABLES: Record<string, string> = {
  cost_est_company_info: "company_info",
  cost_est_cashflow_settings: "cashflow_settings",
};

interface EnvelopeShape {
  version: number;
  data: unknown;
}

function parseEnvelope(raw: string): EnvelopeShape | null {
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof parsed.version === "number" &&
      "data" in parsed
    ) {
      return parsed as EnvelopeShape;
    }
    return null;
  } catch {
    return null;
  }
}

function wrapEnvelope(data: unknown): string {
  return JSON.stringify({ version: CURRENT_SCHEMA_VERSION, data });
}

interface PgError {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
  status?: number;
  statusCode?: number;
  name?: string;
}

/**
 * Robustly extract everything we can from a Supabase / fetch / generic error.
 *
 * Standard PostgrestError has message/details/hint/code as own properties but
 * sometimes errors come back as empty objects when the underlying fetch failed
 * (e.g. network drop, CORS, aborted). We pull every property we can find.
 */
function describeError(err: unknown): Record<string, unknown> {
  if (err == null) return { _raw: String(err) };
  if (typeof err !== "object") return { _raw: err };

  const e = err as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  // Standard PostgrestError fields
  for (const k of ["message", "details", "hint", "code", "status", "statusCode", "name"]) {
    const v = e[k];
    if (v !== undefined) out[k] = v;
  }

  // Every own property (enumerable + non-enumerable, e.g. Error.message)
  const allKeys = Object.getOwnPropertyNames(err);
  if (allKeys.length > 0) out._keys = allKeys;
  for (const k of allKeys) {
    if (out[k] === undefined) {
      try {
        out[k] = (err as Record<string, unknown>)[k];
      } catch {}
    }
  }

  // Constructor / class name (helps identify FetchError vs PostgrestError vs ...)
  const ctor = (err as { constructor?: { name?: string } }).constructor?.name;
  if (ctor && ctor !== "Object") out._type = ctor;

  // JSON dump including non-enumerable own props as a last-ditch fallback
  try {
    const stringified = JSON.stringify(err, Object.getOwnPropertyNames(err));
    if (stringified && stringified !== "{}") out._json = stringified;
  } catch {}

  // If still empty, surface the raw object so devtools can inspect it
  if (Object.keys(out).length === 0) {
    return { _empty: true, _rawObject: err };
  }
  return out;
}

function isMissingTableError(err: unknown, table: string): boolean {
  if (err == null) return false;
  if (typeof err !== "object") return false;
  const e = err as PgError;
  // PG code 42P01 = "undefined_table"
  if (e.code === "42P01") return true;
  // Some Supabase deployments wrap it differently
  if (
    typeof e.message === "string" &&
    e.message.includes(`relation "${table}"`) &&
    e.message.includes("does not exist")
  ) {
    return true;
  }
  // 404 from PostgREST when table doesn't exist in schema
  if (e.status === 404 || e.statusCode === 404) return true;
  // Heuristic: PostgREST returns a 404 with an empty/non-JSON body when the
  // table is missing — supabase-js then exposes the error as a plain `{}`.
  // If we can't extract any property at all, assume the table doesn't exist
  // (or the PostgREST schema cache is stale and hasn't picked up new tables).
  const allKeys = Object.getOwnPropertyNames(err);
  if (allKeys.length === 0) return true;
  return false;
}

// ============================================================
// SupabaseStorageRepository
// ============================================================

export class SupabaseStorageRepository implements StorageRepository {
  constructor(private supabase: SupabaseClient) {}

  isAvailable(): boolean {
    return true;
  }

  async read(key: string): Promise<string | null> {
    const userId = await this.getUserId();
    if (!userId) return null;
    const orgId = await this.getOrgId();
    if (!orgId) return null;

    if (MULTI_ROW_TABLES[key]) {
      return this.readMultiRow(MULTI_ROW_TABLES[key], userId);
    }
    if (SINGLETON_TABLES[key]) {
      return this.readSingleton(SINGLETON_TABLES[key], orgId);
    }
    // Unknown key → no remote storage
    return null;
  }

  async write(key: string, value: string): Promise<void> {
    const userId = await this.getUserId();
    if (!userId) return;
    const orgId = await this.getOrgId();
    if (!orgId) return;

    if (MULTI_ROW_TABLES[key]) {
      await this.upsertMultiRow(MULTI_ROW_TABLES[key], userId, value);
      return;
    }
    if (SINGLETON_TABLES[key]) {
      await this.writeSingleton(SINGLETON_TABLES[key], orgId, userId, value);
      return;
    }
  }

  /** Delete one row from a multi-row table — explicit per-item delete. */
  async deleteItem(key: string, id: string): Promise<void> {
    const userId = await this.getUserId();
    if (!userId) return;
    const orgId = await this.getOrgId();
    if (!orgId) return;

    const table = MULTI_ROW_TABLES[key];
    if (!table) {
      // singleton or unknown — no per-item delete
      return;
    }

    // ไม่กรอง user_id — RLS อนุญาตลบตาม org + data_scope (admin scope=all ลบของทีมได้)
    const { error } = await this.supabase
      .from(table)
      .delete()
      .eq("id", id);

    if (error) {
      console.error(`[supabase-storage] deleteItem ${table}/${id} failed:`, describeError(error));
      return;
    }
    console.log(`[supabase-storage] ✓ deleted ${table}/${id}`);
  }

  /**
   * Explicit replace-all (import/restore semantics) — upsert items + delete
   * any server row not in the new id set. Only invoke from explicit user
   * actions (import data, restore backup). Never used by auto-sync.
   */
  async replaceAll(key: string, value: string): Promise<void> {
    const userId = await this.getUserId();
    if (!userId) return;
    const orgId = await this.getOrgId();
    if (!orgId) return;

    if (MULTI_ROW_TABLES[key]) {
      await this.replaceMultiRow(MULTI_ROW_TABLES[key], userId, value);
      return;
    }
    if (SINGLETON_TABLES[key]) {
      await this.writeSingleton(SINGLETON_TABLES[key], orgId, userId, value);
      return;
    }
  }

  async remove(key: string): Promise<void> {
    const userId = await this.getUserId();
    if (!userId) return;
    const orgId = await this.getOrgId();
    if (!orgId) return;

    // ไม่กรอง user_id — RLS เป็นตัวจำกัดขอบเขต (org + data_scope)
    if (MULTI_ROW_TABLES[key]) {
      const { error } = await this.supabase.from(MULTI_ROW_TABLES[key]).delete().not("id", "is", null);
      if (error) console.error(`[supabase-storage] remove ${key} failed:`, describeError(error));
      return;
    }
    if (SINGLETON_TABLES[key]) {
      await this.supabase.from(SINGLETON_TABLES[key]).delete().eq("org_id", orgId);
    }
  }

  // ============================================================
  // Private helpers
  // ============================================================

  private async getUserId(): Promise<string | null> {
    const { data } = await this.supabase.auth.getUser();
    console.log(`[supabase-storage] getUserId:`, data.user?.id);
    return data.user?.id ?? null;
  }

  /**
   * Organization ที่ผู้ใช้เลือกจากหน้า Portal
   * ใช้กับ singleton tables ที่ผูกกับ org แทน user
   */
  private async getOrgId(): Promise<string | null> {
    const { data, error } = await this.supabase.rpc("get_active_organization");
    if (error) {
      console.error(`[supabase-storage] getOrgId failed:`, describeError(error));
      return null;
    }
    return (data as string) ?? null;
  }

  /** Read multi-row table → JSON envelope { version, data: [...] }
   *  ไม่กรอง user_id แล้ว — RLS เป็นตัวคัดข้อมูลตาม org + data_scope */
  private async readMultiRow(table: string, userId: string): Promise<string> {
    console.log(`[supabase-storage] readMultiRow table=${table} userId=${userId}`);
    const { data, error } = await this.supabase
      .from(table)
      .select("data, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      if (isMissingTableError(error, table)) {
        console.warn(
          `[supabase-storage] ตาราง "${table}" ยังไม่ถูกสร้างใน Supabase — ` +
          `กรุณารัน migration 0002_employees_and_cashflow_settings.sql ใน Supabase Dashboard ก่อน ` +
          `(ขณะนี้ใช้ค่า default แทน)`
        );
      } else {
        console.error(`[supabase-storage] read ${table} failed:`, describeError(error));
      }
      return wrapEnvelope([]);
    }

    const items = (data ?? []).map((row) => row.data);
    return wrapEnvelope(items);
  }

  /**
   * UPSERT-ONLY write for multi-row tables.
   * Never deletes any row — uses deleteItem() for explicit per-row delete
   * or replaceAll() for explicit "import/restore" full-replace semantics.
   */
  private async upsertMultiRow(table: string, userId: string, value: string): Promise<void> {
    const envelope = parseEnvelope(value);
    if (!envelope || !Array.isArray(envelope.data)) {
      console.warn(`[supabase-storage] write ${table}: invalid envelope, skip`);
      return;
    }

    const items = envelope.data as Array<{ id: string }>;
    if (items.length === 0) {
      // Nothing to upsert — explicitly do NOT delete (caller may have just
      // hydrated empty / had a race). Use deleteItem or replaceAll instead.
      return;
    }

    const rows = items.map((item) => ({
      id: item.id,
      user_id: userId,
      data: item,
      updated_at: new Date().toISOString(),
    }));

    const { error: upsertError } = await this.supabase
      .from(table)
      .upsert(rows, { onConflict: "id" });

    if (upsertError) {
      if (isMissingTableError(upsertError, table)) {
        console.error(
          `[supabase-storage] ❌ บันทึก "${table}" ไม่ได้: ตารางยังไม่ถูกสร้างใน Supabase\n` +
          `→ กรุณารัน supabase/migrations/0002_employees_and_cashflow_settings.sql ใน Supabase Dashboard → SQL Editor`
        );
      } else {
        console.error(`[supabase-storage] upsert ${table} failed:`, describeError(upsertError));
      }
      return;
    }
    console.log(`[supabase-storage] ✓ upsert ${table}: ${items.length} rows saved`);
  }

  /**
   * EXPLICIT full-replace for multi-row tables (import/restore only).
   * Upserts all incoming items, then deletes any server row not in the new id set.
   * NEVER called by auto-sync — only by explicit user import action.
   */
  private async replaceMultiRow(table: string, userId: string, value: string): Promise<void> {
    const envelope = parseEnvelope(value);
    if (!envelope || !Array.isArray(envelope.data)) {
      console.warn(`[supabase-storage] replaceAll ${table}: invalid envelope, skip`);
      return;
    }

    const items = envelope.data as Array<{ id: string }>;
    const newIds = items.map((i) => i.id).filter(Boolean);

    console.log(`[supabase-storage] replaceAll ${table}: ${items.length} items`);

    // 1. Upsert new set
    if (items.length > 0) {
      const rows = items.map((item) => ({
        id: item.id,
        user_id: userId,
        data: item,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await this.supabase.from(table).upsert(rows, { onConflict: "id" });
      if (error) {
        console.error(`[supabase-storage] replaceAll upsert ${table} failed:`, describeError(error));
        return;
      }
    }

    // 2. Fetch server-side ids and delete the ones not in the new set
    const { data: existingRows, error: fetchError } = await this.supabase
      .from(table)
      .select("id");

    if (fetchError) {
      console.error(`[supabase-storage] replaceAll fetch ${table} failed:`, describeError(fetchError));
      return;
    }

    const existingIds = (existingRows ?? []).map((r) => r.id);
    const idsToDelete = existingIds.filter((id) => !newIds.includes(id));
    if (idsToDelete.length === 0) return;

    console.log(`[supabase-storage] replaceAll deleting ${idsToDelete.length} rows from ${table}`);
    const { error: deleteError } = await this.supabase
      .from(table)
      .delete()
      .in("id", idsToDelete);

    if (deleteError) {
      console.error(`[supabase-storage] replaceAll delete ${table} failed:`, describeError(deleteError));
    }
  }

  /** Read singleton row → JSON envelope (ผูกกับ org แทน user) */
  private async readSingleton(table: string, orgId: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .from(table)
      .select("data")
      .eq("org_id", orgId)
      .maybeSingle();

    if (error) {
      if (isMissingTableError(error, table)) {
        console.warn(
          `[supabase-storage] ตาราง "${table}" ยังไม่ถูกสร้างใน Supabase — ใช้ค่า default`
        );
      } else {
        console.error(`[supabase-storage] read ${table} failed:`, describeError(error));
      }
      return null;
    }

    if (!data) return null;
    return wrapEnvelope(data.data);
  }

  /** Write singleton: upsert by org_id (แชร์ระดับ org) — user_id = ผู้แก้ล่าสุด */
  private async writeSingleton(table: string, orgId: string, userId: string, value: string): Promise<void> {
    const envelope = parseEnvelope(value);
    if (!envelope) {
      console.warn(`[supabase-storage] write ${table}: invalid envelope, skip`);
      return;
    }

    const { error } = await this.supabase.from(table).upsert(
      { org_id: orgId, user_id: userId, data: envelope.data },
      { onConflict: "org_id" }
    );

    if (error) {
      if (isMissingTableError(error, table)) {
        console.error(
          `[supabase-storage] ❌ บันทึก "${table}" ไม่ได้: ตารางยังไม่ถูกสร้างใน Supabase หรือ schema cache ยังไม่ refresh\n` +
          `   ขั้นที่ 1: รัน supabase/migrations/0002_employees_and_cashflow_settings.sql ใน SQL Editor\n` +
          `   ขั้นที่ 2: ไป Settings → API → กด "Restart server" (หรือรอ ~1 นาทีให้ schema cache refresh)\n` +
          `   ขั้นที่ 3: refresh หน้านี้`
        );
      } else {
        console.error(`[supabase-storage] upsert ${table} failed:`, describeError(error));
      }
    }
  }
}
