-- ====================================================================
-- Migration 0010: Platform admin provisioning + strict tenant isolation
-- Flow: platform admin creates organization first, then creates accounts
--       assigned to exactly one organization.
-- ====================================================================

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

-- Platform administrators are intentionally separate from organization roles.
-- Existing organization owners are promoted once for backwards compatibility.
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

insert into public.platform_admins (user_id)
select distinct user_id
from public.memberships
where role = 'owner'
on conflict (user_id) do nothing;

alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from anon, authenticated;
grant select, insert, update, delete on public.platform_admins to service_role;

-- The current application supports one company per account. This removes the
-- ambiguity caused by the old `limit 1` membership lookup.
create unique index if not exists memberships_one_org_per_user
  on public.memberships (user_id);

create or replace function private.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select m.org_id
  from public.memberships m
  where m.user_id = (select auth.uid())
    and m.active
$$;

create or replace function private.current_data_scope()
returns text
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce(
    (select m.data_scope
     from public.memberships m
     where m.user_id = (select auth.uid()) and m.active),
    'own'
  )
$$;

create or replace function private.is_org_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.memberships m
    where m.user_id = (select auth.uid())
      and m.active
      and m.role in ('owner', 'admin')
  )
$$;

revoke all on function private.current_org_id() from public, anon;
revoke all on function private.current_data_scope() from public, anon;
revoke all on function private.is_org_admin() from public, anon;
grant execute on function private.current_org_id() to authenticated, service_role;
grant execute on function private.current_data_scope() to authenticated, service_role;
grant execute on function private.is_org_admin() to authenticated, service_role;

-- Stop the legacy behavior that automatically attached every new signup to
-- the first organization in the database.
revoke all on function public.ensure_membership() from public, anon, authenticated;
revoke all on function public.current_org_id() from public, anon, authenticated;
revoke all on function public.current_data_scope() from public, anon, authenticated;
revoke all on function public.is_org_admin() from public, anon, authenticated;
revoke all on function public.set_org_owner() from public, anon, authenticated;

create or replace function private.set_org_owner()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_org_id uuid;
begin
  v_org_id := private.current_org_id();
  if v_org_id is null or (select auth.uid()) is null then
    raise exception 'Account is not assigned to an active organization';
  end if;

  new.org_id := v_org_id;
  new.owner_id := (select auth.uid());
  new.user_id := (select auth.uid());
  return new;
end;
$$;

revoke all on function private.set_org_owner() from public, anon, authenticated;

do $$
declare
  t text;
  tables text[] := array[
    'projects','positions','overheads','employees','products','subscriptions',
    'customers','commission_payees','commissions','ledger','loans'
  ];
begin
  foreach t in array tables loop
    execute format('drop trigger if exists trg_%s_org on public.%I', t, t);
    execute format(
      'create trigger trg_%s_org before insert on public.%I for each row execute function private.set_org_owner()',
      t, t
    );

    execute format('drop policy if exists %I on public.%I', t || '_org_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_org_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_org_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_org_delete', t);

    execute format(
      'create policy %I on public.%I for select to authenticated using (org_id = (select private.current_org_id()) and ((select private.current_data_scope()) = ''all'' or owner_id = (select auth.uid())))',
      t || '_org_select', t
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (org_id = (select private.current_org_id()) and user_id = (select auth.uid()) and owner_id = (select auth.uid()))',
      t || '_org_insert', t
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (org_id = (select private.current_org_id()) and ((select private.current_data_scope()) = ''all'' or owner_id = (select auth.uid()))) with check (org_id = (select private.current_org_id()))',
      t || '_org_update', t
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (org_id = (select private.current_org_id()) and ((select private.current_data_scope()) = ''all'' or owner_id = (select auth.uid())))',
      t || '_org_delete', t
    );

    -- Required for projects created with automatic Data API exposure disabled.
    execute format('grant select, insert, update, delete on public.%I to authenticated, service_role', t);
  end loop;
end;
$$;

drop policy if exists organizations_select on public.organizations;
drop policy if exists organizations_update_admin on public.organizations;
create policy organizations_select on public.organizations
  for select to authenticated
  using (id = (select private.current_org_id()));
create policy organizations_update_admin on public.organizations
  for update to authenticated
  using (id = (select private.current_org_id()) and (select private.is_org_admin()))
  with check (id = (select private.current_org_id()));

drop policy if exists memberships_select on public.memberships;
drop policy if exists memberships_update_admin on public.memberships;
drop policy if exists memberships_delete_admin on public.memberships;
create policy memberships_select on public.memberships
  for select to authenticated
  using (org_id = (select private.current_org_id()));
create policy memberships_update_admin on public.memberships
  for update to authenticated
  using (org_id = (select private.current_org_id()) and (select private.is_org_admin()))
  with check (org_id = (select private.current_org_id()));
create policy memberships_delete_admin on public.memberships
  for delete to authenticated
  using (
    org_id = (select private.current_org_id())
    and (select private.is_org_admin())
    and user_id <> (select auth.uid())
  );

do $$
declare t text;
begin
  foreach t in array array['company_info', 'cashflow_settings'] loop
    execute format('drop policy if exists %I on public.%I', t || '_org_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_org_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_org_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_org_delete', t);
    execute format('create policy %I on public.%I for select to authenticated using (org_id = (select private.current_org_id()))', t || '_org_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (org_id = (select private.current_org_id()) and (select private.is_org_admin()))', t || '_org_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (org_id = (select private.current_org_id()) and (select private.is_org_admin())) with check (org_id = (select private.current_org_id()))', t || '_org_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (org_id = (select private.current_org_id()) and (select private.is_org_admin()))', t || '_org_delete', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated, service_role', t);
  end loop;
end;
$$;

grant select, update on public.organizations to authenticated;
grant select, update, delete on public.memberships to authenticated;
grant select, insert, update, delete on public.organizations to service_role;
grant select, insert, update, delete on public.memberships to service_role;

-- Keep the member-list RPC callable only by authenticated members and make
-- the tenant predicate explicit inside the privileged function.
create or replace function public.list_org_members()
returns table(user_id uuid, email text, role text, data_scope text, active boolean)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select m.user_id, u.email::text, m.role, m.data_scope, m.active
  from public.memberships m
  join auth.users u on u.id = m.user_id
  where m.org_id = private.current_org_id()
    and private.current_org_id() is not null
    and private.is_org_admin()
  order by m.created_at
$$;

revoke all on function public.list_org_members() from public, anon;
grant execute on function public.list_org_members() to authenticated;
