-- ====================================================================
-- Migration 0004: Customers (Master Data)
-- แยกข้อมูลลูกค้าออกมาเป็น master กลาง — เก็บลูกค้าแต่ละบริษัทครั้งเดียว
-- แล้วให้ Subscriptions / Projects อ้างอิงด้วย customerId
-- (ของเดิมที่ฝัง customer/client snapshot ไว้ยังคงอยู่เป็น fallback)
-- ====================================================================
-- วิธีรัน: Supabase Dashboard → SQL Editor → New Query → paste → Run
-- (รันซ้ำได้ปลอดภัย) ต้องรัน 0001 มาก่อน (พึ่งฟังก์ชัน set_updated_at())
-- ====================================================================

-- ---------- TABLES ----------

create table if not exists customers (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  data jsonb not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ---------- INDEXES ----------

create index if not exists idx_customers_user on customers(user_id);

-- ---------- TRIGGERS ----------

drop trigger if exists trg_customers_updated on customers;
create trigger trg_customers_updated
  before update on customers
  for each row execute function set_updated_at();

-- ---------- ROW LEVEL SECURITY ----------

alter table customers enable row level security;

drop policy if exists "customers_select_own" on customers;
create policy "customers_select_own" on customers for select
  using (auth.uid() = user_id);

drop policy if exists "customers_insert_own" on customers;
create policy "customers_insert_own" on customers for insert
  with check (auth.uid() = user_id);

drop policy if exists "customers_update_own" on customers;
create policy "customers_update_own" on customers for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "customers_delete_own" on customers;
create policy "customers_delete_own" on customers for delete
  using (auth.uid() = user_id);
