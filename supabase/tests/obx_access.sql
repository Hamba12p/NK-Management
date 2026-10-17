begin;

do $$
declare
  volunteer_id uuid;
begin
  select id into volunteer_id from public.profiles where role in ('volunteer', 'volunteer_senior', 'volunteer_lead') limit 1;
  if volunteer_id is null then raise exception 'Create or select a test volunteer profile before running OBX RLS checks'; end if;
  perform set_config('obx.test_volunteer_id', volunteer_id::text, true);
end $$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['volunteer_roster', 'obx_progress', 'obx_stop_results', 'obx_answers', 'obx_auth_attempts'] loop
    if has_table_privilege('anon', format('public.%I', table_name), 'select') then
      raise exception 'anon unexpectedly has SELECT on public.%', table_name;
    end if;
  end loop;
end $$;

select set_config('request.jwt.claims', json_build_object('sub', current_setting('obx.test_volunteer_id'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  if exists (select 1 from public.volunteer_roster) then raise exception 'ordinary authenticated user can read roster'; end if;
  if exists (select 1 from public.obx_progress) then raise exception 'ordinary authenticated user can read progress'; end if;
  if exists (select 1 from public.obx_stop_results) then raise exception 'ordinary authenticated user can read results'; end if;
  if exists (select 1 from public.obx_answers) then raise exception 'ordinary authenticated user can read answers'; end if;
end $$;

rollback;
