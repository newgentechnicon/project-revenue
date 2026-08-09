-- ====================================================================
-- Migration 0003: Products + Subscriptions (Recurring Revenue)
-- เพิ่มตารางสินค้า/แพ็กเกจ (white-label CRM ฯลฯ) และรายการขายแบบรายรับซ้ำ
-- (license รายปี / subscription รายเดือน-ปี) เพื่อติดตามว่าบริษัทไหนซื้อ
-- วันไหน หมดอายุวันไหน และคำนวณ MRR/ARR
-- ====================================================================
-- วิธีรัน: Supabase Dashboard → SQL Editor → New Query → paste → Run
-- (รันซ้ำได้ปลอดภัย — ใช้ if not exists / drop policy if exists)
-- ต้องรัน 0001 มาก่อน (พึ่งฟังก์ชัน set_updated_at())
-- ====================================================================

-- ---------- TABLES ----------

-- Products: 1 row = 1 สินค้า/แพ็กเกจที่ขาย (master data)
create table if not exists products (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  data jsonb not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Subscriptions: 1 row = 1 การขายให้ลูกค้า 1 ราย (license หรือ subscription)
create table if not exists subscriptions (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  data jsonb not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ---------- INDEXES ----------

create index if not exists idx_products_user on products(user_id);
create index if not exists idx_subscriptions_user on subscriptions(user_id);

-- ---------- TRIGGERS ----------

drop trigger if exists trg_products_updated on products;
create trigger trg_products_updated
  before update on products
  for each row execute function set_updated_at();

drop trigger if exists trg_subscriptions_updated on subscriptions;
create trigger trg_subscriptions_updated
  before update on subscriptions
  for each row execute function set_updated_at();

-- ---------- ROW LEVEL SECURITY ----------

alter table products enable row level security;
alter table subscriptions enable row level security;

-- Products policies
drop policy if exists "products_select_own" on products;
create policy "products_select_own" on products for select
  using (auth.uid() = user_id);

drop policy if exists "products_insert_own" on products;
create policy "products_insert_own" on products for insert
  with check (auth.uid() = user_id);

drop policy if exists "products_update_own" on products;
create policy "products_update_own" on products for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "products_delete_own" on products;
create policy "products_delete_own" on products for delete
  using (auth.uid() = user_id);

-- Subscriptions policies
drop policy if exists "subscriptions_select_own" on subscriptions;
create policy "subscriptions_select_own" on subscriptions for select
  using (auth.uid() = user_id);

drop policy if exists "subscriptions_insert_own" on subscriptions;
create policy "subscriptions_insert_own" on subscriptions for insert
  with check (auth.uid() = user_id);

drop policy if exists "subscriptions_update_own" on subscriptions;
create policy "subscriptions_update_own" on subscriptions for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "subscriptions_delete_own" on subscriptions;
create policy "subscriptions_delete_own" on subscriptions for delete
  using (auth.uid() = user_id);
