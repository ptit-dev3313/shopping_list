-- Run with the SQL editor / execute_sql as postgres. All fixtures roll back.
begin;
insert into auth.users(id,email,aud,role,email_confirmed_at) values
('10000000-0000-4000-8000-000000000001','space-owner@example.invalid','authenticated','authenticated',now()),
('10000000-0000-4000-8000-000000000002','space-member@example.invalid','authenticated','authenticated',now()),
('10000000-0000-4000-8000-000000000003','space-other@example.invalid','authenticated','authenticated',now());
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","email":"space-owner@example.invalid","role":"authenticated"}',true);
insert into public.app_state(id,name) values('security-test-space','Test');
insert into public.space_invitations(space_id,email) values('security-test-space','space-member@example.invalid');
do $$ begin
  begin
    insert into public.space_invitations(space_id,email,user_id) values('security-test-space','space-other@example.invalid','10000000-0000-4000-8000-000000000003');
    raise exception 'FAIL: owner can bypass invitation acceptance';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.app_state(id) values('personal:10000000-0000-4000-8000-000000000002');
    raise exception 'FAIL: can reserve another user personal space';
  exception when check_violation then null; end;
end $$;

select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003","email":"space-other@example.invalid","role":"authenticated"}',true);
do $$ declare changed integer; begin
  if exists(select 1 from public.app_state) then raise exception 'FAIL: outsider can read another account or legacy household'; end if;
  if exists(select 1 from public.space_invitations where space_id='security-test-space') then raise exception 'FAIL: outsider can read invitations'; end if;
  update public.app_state set name='Hacked' where id='security-test-space';
  get diagnostics changed=row_count;
  if changed<>0 then raise exception 'FAIL: outsider can edit'; end if;
  update public.space_invitations set user_id=auth.uid() where space_id='security-test-space';
  get diagnostics changed=row_count;
  if changed<>0 then raise exception 'FAIL: outsider can accept invitation'; end if;
end $$;

select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","email":"space-member@example.invalid","role":"authenticated"}',true);
do $$ begin
  if exists(select 1 from public.app_state where id='security-test-space') then raise exception 'FAIL: pending invite exposes data'; end if;
end $$;
update public.space_invitations set user_id=auth.uid() where space_id='security-test-space';
do $$ declare changed integer; begin
  if not exists(select 1 from public.app_state where id='security-test-space') then raise exception 'FAIL: accepted member cannot read'; end if;
  update public.app_state set name='Member edit' where id='security-test-space' and revision=0;
  get diagnostics changed=row_count;
  if changed<>1 then raise exception 'FAIL: member cannot save'; end if;
  update public.app_state set name='Stale overwrite' where id='security-test-space' and revision=0;
  get diagnostics changed=row_count;
  if changed<>0 then raise exception 'FAIL: stale save overwrites newer data'; end if;
  begin
    update public.app_state set owner_id=auth.uid() where id='security-test-space';
    raise exception 'FAIL: member can take ownership';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.space_invitations(space_id,email) values('security-test-space','space-other@example.invalid');
    raise exception 'FAIL: member can invite others';
  exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","email":"space-owner@example.invalid","role":"authenticated"}',true);
delete from public.space_invitations where space_id='security-test-space';
insert into public.app_state(id) values('personal:10000000-0000-4000-8000-000000000001');
do $$ begin
  begin
    insert into public.space_invitations(space_id,email) values('personal:10000000-0000-4000-8000-000000000001','space-member@example.invalid');
    raise exception 'FAIL: personal space can be shared';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","email":"space-member@example.invalid","role":"authenticated"}',true);
do $$ begin
  if exists(select 1 from public.app_state where id='security-test-space') then raise exception 'FAIL: revoked member retains access'; end if;
  if exists(select 1 from public.app_state where id like 'personal:%') then raise exception 'FAIL: member can read another personal space'; end if;
end $$;
reset role;
do $$ begin
  if has_table_privilege('anon','public.app_state','SELECT') then raise exception 'FAIL: anonymous table access'; end if;
  if has_function_privilege('anon','public.enforce_allowed_email()','EXECUTE') then raise exception 'FAIL: public privileged function'; end if;
end $$;
select 'PASS: isolation, pending invitations, acceptance, owner-only sharing, personal privacy, member editing, stale-save rejection, revocation and anonymous restrictions' as result;
rollback;
