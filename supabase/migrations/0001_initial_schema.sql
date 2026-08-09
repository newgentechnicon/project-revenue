-- ====================================================================
-- Software Cost Pro — Initial Database Schema
-- ใช้ JSONB approach: เก็บข้อมูลเป็น blob เพื่อยืดหยุ่นกับ schema versions
-- (validate ผ่าน Zod ใน client + versioned migrations)
-- ====================================================================
-- วิธีรัน:
--   1. Supabase Dashboard → SQL Editor → New Query
--   2. Paste ทั้งไฟล์นี้ → Run
-- ====================================================================

-- ---------- TABLES ----------

-- Projects: 1 row = 1 โปรเจกต์ (data เก็บใน JSONB)
create table if not exists projects (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  data jsonb not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Positions (Master Data)
create table if not exists positions (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  data jsonb not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Overheads (Master Data)
create table if not exists overheads (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  data jsonb not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Company Info — 1 row per user (singleton)
create table if not exists company_info (
  user_id uuid references auth.users(id) on delete cascade primary key,
  data jsonb not null,
  updated_at timestamptz default now() not null
);

-- ---------- INDEXES ----------

create index if not exists idx_projects_user on projects(user_id, updated_at desc);
create index if not exists idx_positions_user on positions(user_id);
create index if not exists idx_overheads_user on overheads(user_id);

-- ---------- TRIGGERS: auto-update updated_at ----------

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_projects_updated on projects;
create trigger trg_projects_updated
  before update on projects
  for each row execute function set_updated_at();

drop trigger if exists trg_positions_updated on positions;
create trigger trg_positions_updated
  before update on positions
  for each row execute function set_updated_at();

drop trigger if exists trg_overheads_updated on overheads;
create trigger trg_overheads_updated
  before update on overheads
  for each row execute function set_updated_at();

drop trigger if exists trg_company_info_updated on company_info;
create trigger trg_company_info_updated
  before update on company_info
  for each row execute function set_updated_at();

-- ---------- ROW LEVEL SECURITY ----------
-- User เข้าได้แค่ข้อมูลของตัวเอง (auth.uid() = user_id)

alter table projects enable row level security;
alter table positions enable row level security;
alter table overheads enable row level security;
alter table company_info enable row level security;

-- Projects policies
drop policy if exists "projects_select_own" on projects;
create policy "projects_select_own" on projects for select
  using (auth.uid() = user_id);

drop policy if exists "projects_insert_own" on projects;
create policy "projects_insert_own" on projects for insert
  with check (auth.uid() = user_id);

drop policy if exists "projects_update_own" on projects;
create policy "projects_update_own" on projects for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "projects_delete_own" on projects;
create policy "projects_delete_own" on projects for delete
  using (auth.uid() = user_id);

-- Positions policies
drop policy if exists "positions_select_own" on positions;
create policy "positions_select_own" on positions for select
  using (auth.uid() = user_id);

drop policy if exists "positions_insert_own" on positions;
create policy "positions_insert_own" on positions for insert
  with check (auth.uid() = user_id);

drop policy if exists "positions_update_own" on positions;
create policy "positions_update_own" on positions for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "positions_delete_own" on positions;
create policy "positions_delete_own" on positions for delete
  using (auth.uid() = user_id);

-- Overheads policies
drop policy if exists "overheads_select_own" on overheads;
create policy "overheads_select_own" on overheads for select
  using (auth.uid() = user_id);

drop policy if exists "overheads_insert_own" on overheads;
create policy "overheads_insert_own" on overheads for insert
  with check (auth.uid() = user_id);

drop policy if exists "overheads_update_own" on overheads;
create policy "overheads_update_own" on overheads for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "overheads_delete_own" on overheads;
create policy "overheads_delete_own" on overheads for delete
  using (auth.uid() = user_id);

-- Company info policies
drop policy if exists "company_info_select_own" on company_info;
create policy "company_info_select_own" on company_info for select
  using (auth.uid() = user_id);

drop policy if exists "company_info_upsert_own" on company_info;
create policy "company_info_upsert_own" on company_info for insert
  with check (auth.uid() = user_id);

drop policy if exists "company_info_update_own" on company_info;
create policy "company_info_update_own" on company_info for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
