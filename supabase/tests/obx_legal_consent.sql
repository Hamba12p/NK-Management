begin;

do $$
declare
  roster_id uuid;
  volunteer_id uuid;
  manager_id uuid;
begin
  select id into roster_id from public.volunteer_roster limit 1;
  select id into volunteer_id from public.profiles
    where role in ('volunteer', 'volunteer_senior', 'volunteer_lead', 'intern')
    limit 1;
  select id into manager_id from public.profiles
    where role in ('admin', 'manager', 'dpo')
    limit 1;
  if roster_id is null or volunteer_id is null or manager_id is null then
    raise exception 'Create a roster row, volunteer profile, and management profile before running OBX consent checks';
  end if;
  perform set_config('obx.test_roster_id', roster_id::text, true);
  perform set_config('obx.test_volunteer_id', volunteer_id::text, true);
  perform set_config('obx.test_manager_id', manager_id::text, true);
end;
$$;

do $$
begin
  if has_table_privilege('anon', 'public.obx_legal_consents', 'SELECT')
    or has_table_privilege('anon', 'public.obx_legal_consents', 'INSERT')
    or has_table_privilege('authenticated', 'public.obx_legal_consents', 'INSERT')
    or not has_table_privilege('service_role', 'public.obx_legal_consents', 'INSERT') then
    raise exception 'OBX legal consent table grants are incorrect';
  end if;
end;
$$;

set local role service_role;
insert into public.obx_legal_consents (
  roster_id, privacy_accepted_at, mou_accepted_at, legal_version
)
values (
  current_setting('obx.test_roster_id')::uuid,
  '2026-10-26T10:00:00Z',
  '2026-10-26T10:00:00Z',
  '2026-10-26'
)
on conflict (roster_id) do update
set privacy_accepted_at = excluded.privacy_accepted_at,
    mou_accepted_at = excluded.mou_accepted_at,
    legal_version = excluded.legal_version;
reset role;

select set_config('request.jwt.claims', json_build_object('sub', current_setting('obx.test_volunteer_id'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  if exists (
    select 1 from public.obx_legal_consents
    where roster_id = current_setting('obx.test_roster_id')::uuid
  ) then
    raise exception 'Volunteer unexpectedly read another volunteer''s legal consent';
  end if;
end;
$$;
reset role;

select set_config('request.jwt.claims', json_build_object('sub', current_setting('obx.test_manager_id'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  if not exists (
    select 1 from public.obx_legal_consents
    where roster_id = current_setting('obx.test_roster_id')::uuid
      and legal_version = '2026-10-26'
  ) then
    raise exception 'Management cannot read the recorded OBX legal consent';
  end if;
end;
$$;

rollback;
