-- ====================================================================
-- Migration 0002: Employees + Cashflow Settings
-- เพิ่มตารางพนักงานและตั้งค่า cashflow (anchor balance for carryover)
-- ====================================================================
-- วิธีรัน: Supabase Dashboard → SQL Editor → New Query → paste → Run
-- ====================================================================

-- ---------- TABLES ----------

-- Employees: 1 row = 1 พนักงาน
create table if not exists employees (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  data jsonb not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Cashflow Settings — singleton per user (anchor year + amount for balance carryover)
create table if not exists cashflow_settings (
  user_id uuid references auth.users(id) on delete cascade primary key,
  data jsonb not null,
  updated_at timestamptz default now() not null
);

-- ---------- INDEXES ----------

create index if not exists idx_employees_user on employees(user_id);

-- ---------- TRIGGERS ----------

drop trigger if exists trg_employees_updated on employees;
create trigger trg_employees_updated
  before update on employees
  for each row execute function set_updated_at();

drop trigger if exists trg_cashflow_settings_updated on cashflow_settings;
create trigger trg_cashflow_settings_updated
  before update on cashflow_settings
  for each row execute function set_updated_at();

-- ---------- ROW LEVEL SECURITY ----------

alter table employees enable row level security;
alter table cashflow_settings enable row level security;

-- Employees policies
drop policy if exists "employees_select_own" on employees;
create policy "employees_select_own" on employees for select
  using (auth.uid() = user_id);

drop policy if exists "employees_insert_own" on employees;
create policy "employees_insert_own" on employees for insert
  with check (auth.uid() = user_id);

drop policy if exists "employees_update_own" on employees;
create policy "employees_update_own" on employees for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "employees_delete_own" on employees;
create policy "employees_delete_own" on employees for delete
  using (auth.uid() = user_id);

-- Cashflow settings policies
drop policy if exists "cashflow_settings_select_own" on cashflow_settings;
create policy "cashflow_settings_select_own" on cashflow_settings for select
  using (auth.uid() = user_id);

drop policy if exists "cashflow_settings_insert_own" on cashflow_settings;
create policy "cashflow_settings_insert_own" on cashflow_settings for insert
  with check (auth.uid() = user_id);

drop policy if exists "cashflow_settings_update_own" on cashflow_settings;
create policy "cashflow_settings_update_own" on cashflow_settings for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "cashflow_settings_delete_own" on cashflow_settings;
create policy "cashflow_settings_delete_own" on cashflow_settings for delete
  using (auth.uid() = user_id);
