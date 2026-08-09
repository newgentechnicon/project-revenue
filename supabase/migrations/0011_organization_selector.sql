-- ====================================================================
-- Migration 0011: Organization selector + multi-organization accounts
-- Flow: login -> choose organization -> choose system -> use application
-- ====================================================================

-- Accounts may now belong to more than one organization.
drop index if exists public.memberships_one_org_per_user;
create index if not exists memberships_user_active_org_idx
  on public.memberships (user_id, active, org_id);

-- The active organization is server-side authorization state. Keeping it in
-- a private schema prevents clients from editing another user's selection.
create table if not exists private.user_active_organizations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  updated_at timestamptz not null default now()
);

create index if not exists user_active_organizations_org_idx
  on private.user_active_organizations (org_id);

revoke all on private.user_active_organizations from public, anon, authenticated;

create or replace function private.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select selected.org_id
  from private.user_active_organizations selected
  join public.memberships membership
    on membership.org_id = selected.org_id
   and membership.user_id = selected.user_id
   and membership.active
  where selected.user_id = (select auth.uid())
$$;

create or replace function private.current_data_scope()
returns text
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select coalesce(
    (
      select membership.data_scope
      from public.memberships membership
      where membership.user_id = (select auth.uid())
        and membership.org_id = private.current_org_id()
        and membership.active
    ),
    'own'
  )
$$;

create or replace function private.is_org_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select exists (
    select 1
    from public.memberships membership
    where membership.user_id = (select auth.uid())
      and membership.org_id = private.current_org_id()
      and membership.active
      and membership.role in ('owner', 'admin')
  )
$$;

revoke all on function private.current_org_id() from public, anon;
revoke all on function private.current_data_scope() from public, anon;
revoke all on function private.is_org_admin() from public, anon;
grant execute on function private.current_org_id() to authenticated, service_role;
grant execute on function private.current_data_scope() to authenticated, service_role;
grant execute on function private.is_org_admin() to authenticated, service_role;

-- RPC called by the selector. The function only accepts an active membership
-- owned by the caller, so an arbitrary organization UUID cannot be selected.
create or replace function public.select_active_organization(p_org_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.memberships membership
    where membership.user_id = v_user_id
      and membership.org_id = p_org_id
      and membership.active
  ) then
    raise exception 'Organization membership not found';
  end if;

  insert into private.user_active_organizations (user_id, org_id, updated_at)
  values (v_user_id, p_org_id, now())
  on conflict (user_id) do update
    set org_id = excluded.org_id,
        updated_at = excluded.updated_at;

  return true;
end;
$$;

create or replace function public.get_active_organization()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select case
    when (select auth.uid()) is null then null
    else private.current_org_id()
  end
$$;

create or replace function public.clear_active_organization()
returns void
language sql
security definer
set search_path = pg_catalog, public, private
as $$
  delete from private.user_active_organizations
  where user_id = (select auth.uid())
$$;

revoke all on function public.select_active_organization(uuid) from public, anon;
revoke all on function public.get_active_organization() from public, anon;
revoke all on function public.clear_active_organization() from public, anon;
grant execute on function public.select_active_organization(uuid) to authenticated;
grant execute on function public.get_active_organization() to authenticated;
grant execute on function public.clear_active_organization() to authenticated;

-- A user can list all of their memberships before choosing an organization.
-- Organization admins can additionally list members of the selected company.
drop policy if exists memberships_select on public.memberships;
create policy memberships_select on public.memberships
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (
      org_id = (select private.current_org_id())
      and (select private.is_org_admin())
    )
  );

-- The selector may read every organization in which the caller has an active
-- membership. It still cannot see unrelated organizations.
drop policy if exists organizations_select on public.organizations;
create policy organizations_select on public.organizations
  for select to authenticated
  using (
    exists (
      select 1
      from public.memberships membership
      where membership.org_id = organizations.id
        and membership.user_id = (select auth.uid())
        and membership.active
    )
  );

