begin;

do $$
declare
  volunteer_name text := 'OBX Registration Test';
  volunteer_email text := 'obx-test-' || txid_current()::text || '@example.invalid';
  volunteer_number text;
  repeated_number text;
  generated_general text;
  generated_management text;
  was_new boolean;
begin
  generated_general := public.issue_next_volunteer_number(false);
  generated_management := public.issue_next_volunteer_number(true);
  if generated_general !~ '^NKV-[1-9][0-9]{2,3}$' then
    raise exception 'general volunteer number is outside NKV-100 through NKV-9999';
  end if;
  if generated_management !~ '^NKV-0[0-9]{2}$' then
    raise exception 'management number is outside NKV-001 through NKV-099';
  end if;

  select registered.volunteer_number, registered.is_new
  into volunteer_number, was_new
  from public.register_obx_volunteer(
    volunteer_name,
    volunteer_email,
    null,
    null,
    false,
    null
  ) as registered;
  if not was_new or volunteer_number !~ '^NKV-[1-9][0-9]{2,3}$' then
    raise exception 'name and email should create a general volunteer record';
  end if;

  select registered.volunteer_number, registered.is_new
  into repeated_number, was_new
  from public.register_obx_volunteer(
    volunteer_name,
    volunteer_email,
    null,
    null,
    false,
    null
  ) as registered;
  if was_new or repeated_number <> volunteer_number then
    raise exception 'repeated name and email should return the existing volunteer record';
  end if;
end;
$$;

rollback;
