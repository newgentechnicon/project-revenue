-- ====================================================================
-- Migration 0006: Ledger — รายการเดินบัญชี (เงินเข้า/ออกจริง) + ไฟล์แนบ slip
-- เก็บข้อมูลเป็น JSONB ตามแนวทางเดิม + ไฟล์ slip ใน Supabase Storage
-- ====================================================================
-- วิธีรัน: Supabase Dashboard → SQL Editor → New Query → paste → Run
-- (รันซ้ำได้ปลอดภัย) ต้องรัน 0001 มาก่อน (พึ่งฟังก์ชัน set_updated_at())
-- ====================================================================

-- ---------- TABLE ----------

-- ledger: 1 row = 1 รายการเดินบัญชี (data เก็บใน JSONB รวม attachments metadata)
create table if not exists ledger (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  data jsonb not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ---------- INDEX ----------

create index if not exists idx_ledger_user on ledger(user_id, updated_at desc);

-- ---------- TRIGGER ----------

drop trigger if exists trg_ledger_updated on ledger;
create trigger trg_ledger_updated
  before update on ledger
  for each row execute function set_updated_at();

-- ---------- ROW LEVEL SECURITY ----------

alter table ledger enable row level security;

drop policy if exists "ledger_select_own" on ledger;
create policy "ledger_select_own" on ledger for select
  using (auth.uid() = user_id);

drop policy if exists "ledger_insert_own" on ledger;
create policy "ledger_insert_own" on ledger for insert
  with check (auth.uid() = user_id);

drop policy if exists "ledger_update_own" on ledger;
create policy "ledger_update_own" on ledger for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "ledger_delete_own" on ledger;
create policy "ledger_delete_own" on ledger for delete
  using (auth.uid() = user_id);

-- ====================================================================
-- STORAGE: bucket "ledger-slips" สำหรับไฟล์ slip/ใบเสร็จ (private)
-- Path: {userId}/{ledgerId}/{uuid}-{filename}
--   → (storage.foldername(name))[1] = userId ใช้ใน RLS
-- ====================================================================

insert into storage.buckets (id, name, public)
values ('ledger-slips', 'ledger-slips', false)
on conflict (id) do nothing;

-- ผู้ใช้เข้าถึง/จัดการได้เฉพาะไฟล์ใน "โฟลเดอร์ของตัวเอง" (path segment แรก = uid)
drop policy if exists "ledger_slips_select_own" on storage.objects;
create policy "ledger_slips_select_own" on storage.objects for select
  using (
    bucket_id = 'ledger-slips'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "ledger_slips_insert_own" on storage.objects;
create policy "ledger_slips_insert_own" on storage.objects for insert
  with check (
    bucket_id = 'ledger-slips'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "ledger_slips_update_own" on storage.objects;
create policy "ledger_slips_update_own" on storage.objects for update
  using (
    bucket_id = 'ledger-slips'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "ledger_slips_delete_own" on storage.objects;
create policy "ledger_slips_delete_own" on storage.objects for delete
  using (
    bucket_id = 'ledger-slips'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
