-- ====================================================================
-- Migration 0005: Commission Payees + Commissions
-- ค่าคอมมิชชั่นการขาย — ผู้รับคอม (พนักงาน/พาร์ทเนอร์) และรายการคอม
-- ที่ผูกกับโครงการหรือ subscription (one-time / recurring)
-- ====================================================================
-- วิธีรัน: Supabase Dashboard → SQL Editor → New Query → paste → Run
-- (รันซ้ำได้ปลอดภัย) ต้องรัน 0001 มาก่อน (พึ่งฟังก์ชัน set_updated_at())
-- ====================================================================

-- ---------- TABLES ----------

-- ผู้รับคอม (master)
create table if not exists commission_payees (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  data jsonb not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- รายการคอม: 1 row = 1 การจ่ายคอมที่ผูกกับโครงการ/subscription
create table if not exists commissions (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  data jsonb not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ---------- INDEXES ----------

create index if not exists idx_commission_payees_user on commission_payees(user_id);
create index if not exists idx_commissions_user on commissions(user_id);

-- ---------- TRIGGERS ----------

drop trigger if exists trg_commission_payees_updated on commission_payees;
create trigger trg_commission_payees_updated
  before update on commission_payees
  for each row execute function set_updated_at();

drop trigger if exists trg_commissions_updated on commissions;
create trigger trg_commissions_updated
  before update on commissions
  for each row execute function set_updated_at();

-- ---------- ROW LEVEL SECURITY ----------

alter table commission_payees enable row level security;
alter table commissions enable row level security;

-- commission_payees policies
drop policy if exists "commission_payees_select_own" on commission_payees;
create policy "commission_payees_select_own" on commission_payees for select
  using (auth.uid() = user_id);

drop policy if exists "commission_payees_insert_own" on commission_payees;
create policy "commission_payees_insert_own" on commission_payees for insert
  with check (auth.uid() = user_id);

drop policy if exists "commission_payees_update_own" on commission_payees;
create policy "commission_payees_update_own" on commission_payees for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "commission_payees_delete_own" on commission_payees;
create policy "commission_payees_delete_own" on commission_payees for delete
  using (auth.uid() = user_id);

-- commissions policies
drop policy if exists "commissions_select_own" on commissions;
create policy "commissions_select_own" on commissions for select
  using (auth.uid() = user_id);

drop policy if exists "commissions_insert_own" on commissions;
create policy "commissions_insert_own" on commissions for insert
  with check (auth.uid() = user_id);

drop policy if exists "commissions_update_own" on commissions;
create policy "commissions_update_own" on commissions for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "commissions_delete_own" on commissions;
create policy "commissions_delete_own" on commissions for delete
  using (auth.uid() = user_id);
