-- ====================================================================
-- Migration 0008: Feature-level access (per-role matrix)
-- เก็บ matrix สิทธิ์ระดับ feature ต่อ role ไว้ใน organizations.feature_access (JSONB)
--   รูปแบบ: { "<role>": { "<feature>": "none" | "view" | "edit" } }
--   - ค่าที่ไม่ระบุ → ใช้ default ในโค้ด (viewer=view, อื่น ๆ =edit)
--   - owner = edit ทุก feature เสมอ (กัน lockout — ไม่เก็บใน matrix)
-- ====================================================================
-- วิธีรัน: Supabase Dashboard → SQL Editor → paste → Run (รันซ้ำได้ปลอดภัย)
-- ต้องรัน 0007 มาก่อน
-- ====================================================================

alter table organizations add column if not exists feature_access jsonb;

-- RLS ของ organizations (select=สมาชิก, update=admin) ครอบคลุมคอลัมน์นี้อยู่แล้ว (จาก 0007)
