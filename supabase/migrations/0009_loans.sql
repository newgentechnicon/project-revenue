-- ====================================================================
-- Migration 0009: Loans — เงินกู้ยืม (หนี้สิน) + การผ่อนชำระ
-- เก็บข้อมูลเป็น JSONB (รวม repayments) ตามแนวทางเดิม
-- สร้างตารางพร้อม org-scope (org_id/owner_id + trigger set_org_owner)
-- ให้เข้ากับ RBAC ที่ตั้งไว้ใน migration 0007
-- ====================================================================
-- วิธีรัน: Supabase Dashboard → SQL Editor → New Query → paste → Run
-- (รันซ้ำได้ปลอดภัย) ต้องรัน 0001 + 0007 มาก่อน
--   - 0001: ฟังก์ชัน set_updated_at()
--   - 0007: ฟังก์ชัน set_org_owner(), current_org_id(), current_data_scope()
-- ====================================================================

-- ---------- TABLE ----------
-- loans: 1 row = 1 ก้อนเงินกู้ (data เก็บใน JSONB รวม repayments)
create table if not exists loans (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  org_id uuid references organizations(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete set null,
  data jsonb not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ---------- INDEXES ----------
create index if not exists idx_loans_user on loans(user_id, updated_at desc);
create index if not exists idx_loans_org on loans(org_id);

-- ---------- TRIGGERS ----------
drop trigger if exists trg_loans_updated on loans;
create trigger trg_loans_updated
  before update on loans
  for each row execute function set_updated_at();

-- บังคับ org_id/owner_id ตอน insert (กันการปลอมค่า) — ฟังก์ชันจาก 0007
drop trigger if exists trg_loans_org on loans;
create trigger trg_loans_org
  before insert on loans
  for each row execute function set_org_owner();

-- backfill org ให้ row เดิม (ถ้ามี) จาก org แรกในระบบ
do $$
declare v_org uuid;
begin
  select id into v_org from organizations order by created_at limit 1;
  update loans set owner_id = user_id where owner_id is null;
  if v_org is not null then
    update loans set org_id = v_org where org_id is null;
  end if;
end;
$$;

-- ---------- ROW LEVEL SECURITY (org-scoped + data_scope) ----------
alter table loans enable row level security;

drop policy if exists "loans_org_select" on loans;
create policy "loans_org_select" on loans for select
  using (org_id = current_org_id() and (current_data_scope() = 'all' or owner_id = auth.uid()));

drop policy if exists "loans_org_insert" on loans;
create policy "loans_org_insert" on loans for insert
  with check (user_id = auth.uid());

drop policy if exists "loans_org_update" on loans;
create policy "loans_org_update" on loans for update
  using (org_id = current_org_id() and (current_data_scope() = 'all' or owner_id = auth.uid()))
  with check (org_id = current_org_id());

drop policy if exists "loans_org_delete" on loans;
create policy "loans_org_delete" on loans for delete
  using (org_id = current_org_id() and (current_data_scope() = 'all' or owner_id = auth.uid()));
