-- Upgrade the existing Shopping list project; preserves every app_state payload.
begin;
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

alter table public.app_state add column owner_id uuid references auth.users(id);
alter table public.app_state add column name text not null default 'Espace partagÃ©' check (length(trim(name)) between 1 and 100);
alter table public.app_state add column revision bigint not null default 0;
alter table public.app_state alter column id set default gen_random_uuid()::text;
update public.app_state set owner_id = (
  select u.id from auth.users u join public.allowed_emails a on lower(a.email)=lower(u.email)
  order by u.created_at limit 1
);
-- Fail rather than silently orphan existing data if there is no legacy owner.
alter table public.app_state alter column owner_id set not null;
alter table public.app_state alter column owner_id set default auth.uid();
alter table public.app_state add constraint personal_space_owner check (id not like 'personal:%' or id='personal:'||owner_id::text);
create index app_state_owner_idx on public.app_state(owner_id);

create table public.space_invitations (
  space_id text not null references public.app_state(id) on delete cascade,
  email text not null check (email=lower(trim(email)) and length(email) between 3 and 320),
  user_id uuid references auth.users(id) on delete cascade,
  primary key(space_id,email)
);
create index space_invitations_user_idx on public.space_invitations(user_id,space_id);
create index space_invitations_email_idx on public.space_invitations(email);
alter table public.space_invitations enable row level security;
insert into public.space_invitations(space_id,email,user_id)
select s.id,lower(a.email),u.id from public.app_state s cross join public.allowed_emails a
left join auth.users u on lower(u.email)=lower(a.email)
where u.id is distinct from s.owner_id;

-- Internal owner lookup prevents recursive policies. Never exposed as an RPC.
create function private.owns_space(space text) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.app_state where id=space and owner_id=auth.uid()
  );
$$;
revoke all on function private.owns_space(text) from public,anon;
grant execute on function private.owns_space(text) to authenticated;

drop policy app_state_select on public.app_state;
drop policy app_state_insert on public.app_state;
drop policy app_state_update on public.app_state;
alter table public.app_state enable row level security;
create policy space_read on public.app_state for select to authenticated using (
  owner_id=(select auth.uid()) or id in (
    select space_id from public.space_invitations where user_id=(select auth.uid())
  )
);
create policy space_create on public.app_state for insert to authenticated
with check (owner_id=(select auth.uid()));
create policy space_edit on public.app_state for update to authenticated
using (owner_id=(select auth.uid()) or id in (
  select space_id from public.space_invitations where user_id=(select auth.uid())
)) with check (owner_id=(select auth.uid()) or id in (
  select space_id from public.space_invitations where user_id=(select auth.uid())
));
revoke all on public.app_state from anon,authenticated;
grant select,insert on public.app_state to authenticated;
grant update(payload,name) on public.app_state to authenticated;

create policy invitation_read on public.space_invitations for select to authenticated
using (email=lower((select auth.jwt())->>'email') or user_id=(select auth.uid()) or private.owns_space(space_id));
create policy invitation_create on public.space_invitations for insert to authenticated
with check (private.owns_space(space_id) and user_id is null and space_id not like 'personal:%');
create policy invitation_accept on public.space_invitations for update to authenticated
using (email=lower((select auth.jwt())->>'email') and user_id is null)
with check (email=lower((select auth.jwt())->>'email') and user_id=(select auth.uid()));
create policy invitation_remove on public.space_invitations for delete to authenticated
using (private.owns_space(space_id) or user_id=(select auth.uid()) or email=lower((select auth.jwt())->>'email'));
revoke all on public.space_invitations from anon,authenticated;
grant select,insert,delete on public.space_invitations to authenticated;
grant update(user_id) on public.space_invitations to authenticated;

create function private.stamp_space() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  new.revision := old.revision+1;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;
revoke all on function private.stamp_space() from public,anon,authenticated;
create trigger stamp_space before update on public.app_state for each row execute function private.stamp_space();

drop trigger enforce_allowed_email on auth.users;
-- Keep compatibility with old login clients, without privileged public functions.
create or replace function public.is_email_allowed(check_email text) returns boolean
language sql stable security invoker set search_path='' as $$ select true; $$;
create or replace function public.is_allowed_user() returns boolean
language sql stable security invoker set search_path='' as $$ select auth.uid() is not null; $$;
revoke all on function public.enforce_allowed_email() from public,anon,authenticated;
-- The Auth hook may still be configured in the dashboard: make it allow signups.
create or replace function public.hook_restrict_signup(event jsonb) returns jsonb
language sql security invoker set search_path='' as $$ select '{}'::jsonb; $$;
revoke all on function public.hook_restrict_signup(jsonb) from public,anon,authenticated;
grant execute on function public.hook_restrict_signup(jsonb) to supabase_auth_admin;
alter table public.allowed_emails set schema private;
revoke all on private.allowed_emails from public,anon,authenticated;
commit;
