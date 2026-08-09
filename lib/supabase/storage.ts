/**
 * Supabase Storage helper — ไฟล์แนบ slip ของรายการเดินบัญชี (ledger)
 *
 * Bucket: "ledger-slips" (private)
 * Path:   {userId}/{ledgerId}/{uuid}-{filename}
 *   - foldername[1] = userId → ใช้ใน RLS policy บน storage.objects
 *
 * ดูไฟล์ผ่าน signed URL (bucket เป็น private) อายุสั้น ๆ
 */

import { getSupabaseBrowserClient } from "./client";
import type { LedgerAttachment } from "@/lib/types";

export const LEDGER_SLIPS_BUCKET = "ledger-slips";

/** จำกัดขนาดไฟล์ slip (10 MB) */
export const MAX_SLIP_SIZE_BYTES = 10 * 1024 * 1024;

/** ทำชื่อไฟล์ให้ปลอดภัยสำหรับ storage path (ตัดอักขระแปลก ๆ ออก) */
function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}_${Math.round(Math.random() * 1e9)}`;
}

async function getUserId(): Promise<string | null> {
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/**
 * อัปโหลด slip 1 ไฟล์ → คืน metadata (LedgerAttachment)
 * @throws Error เมื่อไฟล์ใหญ่เกินกำหนด, ยังไม่ login, หรืออัปโหลดล้มเหลว
 */
export async function uploadSlip(file: File, ledgerId: string): Promise<LedgerAttachment> {
  if (file.size > MAX_SLIP_SIZE_BYTES) {
    throw new Error(`ไฟล์ใหญ่เกิน ${Math.round(MAX_SLIP_SIZE_BYTES / 1024 / 1024)} MB`);
  }
  const userId = await getUserId();
  if (!userId) throw new Error("ยังไม่ได้เข้าสู่ระบบ");

  const attachmentId = newId();
  const storagePath = `${userId}/${ledgerId}/${attachmentId}-${sanitizeFileName(file.name)}`;

  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.storage
    .from(LEDGER_SLIPS_BUCKET)
    .upload(storagePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "application/octet-stream",
    });

  if (error) {
    console.error("[storage] uploadSlip failed:", error);
    throw new Error(error.message || "อัปโหลดไฟล์ไม่สำเร็จ");
  }

  return {
    id: attachmentId,
    fileName: file.name,
    storagePath,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    uploadedAt: new Date().toISOString(),
  };
}

/** สร้าง signed URL สำหรับเปิดดู/ดาวน์โหลด slip (default อายุ 1 ชั่วโมง) */
export async function getSlipUrl(storagePath: string, expiresInSec = 3600): Promise<string | null> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.storage
    .from(LEDGER_SLIPS_BUCKET)
    .createSignedUrl(storagePath, expiresInSec);
  if (error) {
    console.error("[storage] getSlipUrl failed:", error);
    return null;
  }
  return data.signedUrl;
}

/** ลบ slip ออกจาก storage (รับได้หลาย path) — ไม่ throw ถ้าลบไม่ได้ */
export async function deleteSlips(storagePaths: string[]): Promise<void> {
  if (storagePaths.length === 0) return;
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.storage.from(LEDGER_SLIPS_BUCKET).remove(storagePaths);
  if (error) {
    console.error("[storage] deleteSlips failed:", error);
  }
}
