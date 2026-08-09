-- ====================================================================
-- Migration 0007: Organizations + Memberships (RBAC) — per-user → per-org
-- ====================================================================
-- เปลี่ยนโมเดลข้อมูลจาก "1 user 1 ชุดข้อมูล" → "ทีมแชร์ข้อมูลใน org เดียว"
-- พร้อมสิทธิ์ตาม role และ data_scope (เห็นทั้งหมด / เห็นเฉพาะของตัวเอง)
--
-- โมเดล: org เดียวร่วมกัน (single shared org) + auto-join
--   - ผู้ใช้เดิม → owner (เห็นทั้งหมด)
--   - ผู้ใช้ใหม่ที่ sign up → viewer/own (รอ admin ปรับสิทธิ์)
--
-- ⚠️ จุดเสี่ยงสูง: แก้ RLS ทุกตาราง — ทดสอบบน Supabase project สำรองก่อน
-- ====================================================================
-- วิธีรัน: Supabase Dashboard → SQL Editor → New Query → paste → Run
-- (รันซ้ำได้ปลอดภัย) ต้องรัน 0001–0006 มาก่อน
-- ====================================================================

-- ---------- 1) CORE TABLES ----------

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'My Company',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table if not exists memberships (
  org_id uuid references organizations(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null default 'viewer',         -- owner | admin | accountant | sales | viewer
  data_scope text not null default 'own',       -- all | own
  active boolean not null default true,
  created_at timestamptz default now() not null,
  primary key (org_id, user_id)
);

create index if not exists idx_memberships_user on memberships(user_id);

drop trigger if exists trg_organizations_updated on organizations;
create trigger trg_organizations_updated
  before update on organizations
  for each row execute function set_updated_at();

grant select, insert, update, delete on organizations to authenticated;
grant select, insert, update, delete on memberships to authenticated;

-- ---------- 2) HELPER FUNCTIONS (security definer → bypass RLS, กัน recursion) ----------

create or replace function current_org_id()
  returns uuid language sql stable security definer set search_path = public as $$
  select org_id from memberships where user_id = auth.uid() and active limit 1
$$;

create or replace function current_data_scope()
  returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select data_scope from memberships where user_id = auth.uid() and active limit 1),
    'own'
  )
$$;

create or replace function is_org_admin()
  returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from memberships
    where user_id = auth.uid() and active and role in ('owner', 'admin')
  )
$$;

-- Auto-join: เรียกจาก client หลัง login — สร้าง membership ถ้ายังไม่มี
--   - ถ้ายังไม่มี org เลย → caller สร้าง org และเป็น owner (bootstrap)
--   - ถ้ามี org แล้ว → join เป็น viewer/own
create or replace function ensure_membership()
  returns void language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
begin
  if auth.uid() is null then return; end if;
  if exists (select 1 from memberships where user_id = auth.uid()) then return; end if;

  select id into v_org from organizations order by created_at limit 1;
  if v_org is null then
    insert into organizations(name) values ('My Company') returning id into v_org;
    insert into memberships(org_id, user_id, role, data_scope, active)
      values (v_org, auth.uid(), 'owner', 'all', true);
  else
    insert into memberships(org_id, user_id, role, data_scope, active)
      values (v_org, auth.uid(), 'viewer', 'own', true)
      on conflict (org_id, user_id) do nothing;
  end if;
end;
$$;

-- รายชื่อสมาชิกใน org ปัจจุบัน (join อีเมลจาก auth.users — client query auth.users ตรง ๆ ไม่ได้)
create or replace function list_org_members()
  returns table(user_id uuid, email text, role text, data_scope text, active boolean)
  language sql stable security definer set search_path = public as $$
  select m.user_id, u.email::text, m.role, m.data_scope, m.active
  from memberships m
  join auth.users u on u.id = m.user_id
  where m.org_id = current_org_id()
  order by m.created_at
$$;

grant execute on function current_org_id() to authenticated;
grant execute on function current_data_scope() to authenticated;
grant execute on function is_org_admin() to authenticated;
grant execute on function ensure_membership() to authenticated;
grant execute on function list_org_members() to authenticated;

-- Trigger: บังคับ org_id/owner_id ตอน insert (กันการปลอมค่า)
create or replace function set_org_owner()
  returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.org_id := current_org_id();
  new.owner_id := auth.uid();
  return new;
end;
$$;

-- ---------- 3) RLS: organizations + memberships ----------

alter table organizations enable row level security;
alter table memberships enable row level security;

drop policy if exists "organizations_select" on organizations;
create policy "organizations_select" on organizations for select
  using (id = current_org_id());

drop policy if exists "organizations_update_admin" on organizations;
create policy "organizations_update_admin" on organizations for update
  using (id = current_org_id() and is_org_admin())
  with check (id = current_org_id());

drop policy if exists "memberships_select" on memberships;
create policy "memberships_select" on memberships for select
  using (org_id = current_org_id());

drop policy if exists "memberships_update_admin" on memberships;
create policy "memberships_update_admin" on memberships for update
  using (org_id = current_org_id() and is_org_admin())
  with check (org_id = current_org_id());

drop policy if exists "memberships_delete_admin" on memberships;
create policy "memberships_delete_admin" on memberships for delete
  using (org_id = current_org_id() and is_org_admin() and user_id <> auth.uid());
-- หมายเหตุ: insert membership ทำผ่าน ensure_membership() (security definer) เท่านั้น

-- ---------- 4) BACKFILL: สร้าง org + membership จากผู้ใช้เดิม ----------
-- ถ้ายังไม่มี org และมีผู้ใช้เดิมอยู่ → สร้าง org เดียว, ผู้ใช้เดิมทุกคนเป็น owner/all
-- ถ้าฐานข้อมูลว่าง (ไม่มีผู้ใช้เดิม) → ปล่อยให้ ensure_membership() bootstrap ตอน login แรก
do $$
declare v_org uuid;
begin
  if exists (select 1 from organizations) then return; end if;

  create temp table _existing_users on commit drop as
    select distinct user_id from (
      select user_id from projects
      union select user_id from positions
      union select user_id from overheads
      union select user_id from employees
      union select user_id from products
      union select user_id from subscriptions
      union select user_id from customers
      union select user_id from commission_payees
      union select user_id from commissions
      union select user_id from ledger
      union select user_id from company_info
      union select user_id from cashflow_settings
    ) u
    where user_id is not null;

  if not exists (select 1 from _existing_users) then return; end if;

  insert into organizations(name) values ('My Company') returning id into v_org;
  insert into memberships(org_id, user_id, role, data_scope, active)
    select v_org, user_id, 'owner', 'all', true from _existing_users
    on conflict (org_id, user_id) do nothing;
end;
$$;

-- ---------- 5) MULTI-ROW TABLES: add org_id/owner_id + trigger + RLS ----------
do $$
declare
  t text;
  tables text[] := array[
    'projects','positions','overheads','employees','products',
    'subscriptions','customers','commission_payees','commissions','ledger'
  ];
  v_org uuid;
begin
  select id into v_org from organizations order by created_at limit 1;

  foreach t in array tables loop
    -- columns
    execute format('alter table %I add column if not exists org_id uuid references organizations(id) on delete cascade', t);
    execute format('alter table %I add column if not exists owner_id uuid references auth.users(id) on delete set null', t);

    -- backfill
    execute format('update %I set owner_id = user_id where owner_id is null', t);
    if v_org is not null then
      execute format('update %I set org_id = %L where org_id is null', t, v_org);
    end if;

    execute format('create index if not exists idx_%s_org on %I(org_id)', t, t);

    -- trigger: set org_id/owner_id on insert
    execute format('drop trigger if exists trg_%s_org on %I', t, t);
    execute format('create trigger trg_%s_org before insert on %I for each row execute function set_org_owner()', t, t);

    -- drop old per-user policies
    execute format('drop policy if exists %I on %I', t || '_select_own', t);
    execute format('drop policy if exists %I on %I', t || '_insert_own', t);
    execute format('drop policy if exists %I on %I', t || '_update_own', t);
    execute format('drop policy if exists %I on %I', t || '_delete_own', t);

    -- drop new policies (idempotent re-run)
    execute format('drop policy if exists %I on %I', t || '_org_select', t);
    execute format('drop policy if exists %I on %I', t || '_org_insert', t);
    execute format('drop policy if exists %I on %I', t || '_org_update', t);
    execute format('drop policy if exists %I on %I', t || '_org_delete', t);

    -- new org-scoped policies
    execute format(
      $f$create policy %I on %I for select using (org_id = current_org_id() and (current_data_scope() = 'all' or owner_id = auth.uid()))$f$,
      t || '_org_select', t);
    execute format(
      $f$create policy %I on %I for insert with check (user_id = auth.uid())$f$,
      t || '_org_insert', t);
    execute format(
      $f$create policy %I on %I for update using (org_id = current_org_id() and (current_data_scope() = 'all' or owner_id = auth.uid())) with check (org_id = current_org_id())$f$,
      t || '_org_update', t);
    execute format(
      $f$create policy %I on %I for delete using (org_id = current_org_id() and (current_data_scope() = 'all' or owner_id = auth.uid()))$f$,
      t || '_org_delete', t);
  end loop;
end;
$$;

-- ---------- 6) SINGLETON TABLES: per-user → per-org ----------
do $$
declare
  t text;
  tables text[] := array['company_info','cashflow_settings'];
  v_org uuid;
begin
  select id into v_org from organizations order by created_at limit 1;

  foreach t in array tables loop
    execute format('alter table %I add column if not exists org_id uuid references organizations(id) on delete cascade', t);
    if v_org is not null then
      execute format('update %I set org_id = %L where org_id is null', t, v_org);
    end if;

    -- dedupe: เก็บ 1 row ต่อ org (กรณีหลาย user เคยมี singleton คนละ row)
    execute format('delete from %I a using %I b where a.org_id = b.org_id and a.org_id is not null and a.ctid > b.ctid', t, t);

    -- swap PK (user_id) → unique(org_id) เพื่อให้ upsert onConflict org_id ทำงาน
    -- ต้อง drop PK ก่อน จึงจะ drop not null ของ user_id ได้
    execute format('alter table %I drop constraint if exists %I', t, t || '_pkey');
    execute format('alter table %I alter column user_id drop not null', t);
    execute format('drop index if exists %I', t || '_org_key');
    execute format('create unique index if not exists %I on %I(org_id)', t || '_org_key', t);

    -- RLS: ทุกคนใน org อ่านได้, เฉพาะ admin แก้ได้
    execute format('drop policy if exists %I on %I', t || '_select_own', t);
    execute format('drop policy if exists %I on %I', t || '_insert_own', t);
    execute format('drop policy if exists %I on %I', t || '_update_own', t);
    execute format('drop policy if exists %I on %I', t || '_delete_own', t);
    execute format('drop policy if exists %I on %I', t || '_org_select', t);
    execute format('drop policy if exists %I on %I', t || '_org_insert', t);
    execute format('drop policy if exists %I on %I', t || '_org_update', t);
    execute format('drop policy if exists %I on %I', t || '_org_delete', t);

    execute format($f$create policy %I on %I for select using (org_id = current_org_id())$f$, t || '_org_select', t);
    execute format($f$create policy %I on %I for insert with check (org_id = current_org_id() and is_org_admin())$f$, t || '_org_insert', t);
    execute format($f$create policy %I on %I for update using (org_id = current_org_id() and is_org_admin()) with check (org_id = current_org_id())$f$, t || '_org_update', t);
    execute format($f$create policy %I on %I for delete using (org_id = current_org_id() and is_org_admin())$f$, t || '_org_delete', t);
  end loop;
end;
$$;
