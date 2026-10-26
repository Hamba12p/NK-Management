alter table public.volunteer_roster
  add column if not exists hub_profile_id uuid null references public.profiles(id) on delete set null;

create unique index if not exists volunteer_roster_hub_profile_unique
  on public.volunteer_roster (hub_profile_id)
  where hub_profile_id is not null;

drop function if exists public.register_obx_volunteer(text, text, text);
drop function if exists public.issue_next_volunteer_number();
drop function if exists public.register_obx_volunteer(text, text, text, uuid, boolean);

create function public.issue_next_volunteer_number(p_management boolean default false)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  low_number integer := case when p_management then 1 else 100 end;
  high_number integer := case when p_management then 99 else 9999 end;
  candidate integer;
  generated_number text;
  attempt integer;
begin
  perform pg_advisory_xact_lock(
    hashtext('public.volunteer_roster'),
    hashtext('random-number-allocation')
  );
  candidate := low_number + floor(random() * (high_number - low_number + 1))::integer;

  for attempt in 1..(high_number - low_number + 1) loop
    generated_number := 'NKV-' || lpad(candidate::text, 3, '0');
    if not exists (
      select 1
      from public.volunteer_roster as roster
      where roster.volunteer_number = generated_number
    ) then
      return generated_number;
    end if;
    candidate := case when candidate = high_number then low_number else candidate + 1 end;
  end loop;

  raise exception 'No volunteer numbers remain in the requested range.'
    using errcode = 'P0001';
end;
$$;

create function public.register_obx_volunteer(
  p_full_name text,
  p_email text,
  p_phone text,
  p_hub_profile_id uuid default null,
  p_management boolean default false,
  p_issued_by uuid default null
)
returns table (
  id uuid,
  full_name text,
  volunteer_number text,
  is_new boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := nullif(btrim(p_full_name), '');
  v_email text := nullif(lower(btrim(p_email)), '');
  v_phone text := nullif(btrim(p_phone), '');
  existing public.volunteer_roster%rowtype;
  generated_number text;
begin
  if v_name is not null and char_length(v_name) > 160 then
    raise exception 'Invalid volunteer name.' using errcode = '22023';
  end if;
  if v_email is not null and (
    char_length(v_email) > 320 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ) then
    raise exception 'Invalid volunteer email.' using errcode = '22023';
  end if;
  if v_phone is not null and v_phone !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'Invalid volunteer phone.' using errcode = '22023';
  end if;

  if p_hub_profile_id is null then
    if (case when v_name is not null then 1 else 0 end)
      + (case when v_email is not null then 1 else 0 end)
      + (case when v_phone is not null then 1 else 0 end) < 2 then
      raise exception 'Provide at least two of name, email, and phone.'
        using errcode = '22023';
    end if;
  else
    if v_email is null then
      raise exception 'A StaffHub account must have an email address.'
        using errcode = '22023';
    end if;
    if not exists (
      select 1
      from public.profiles as profile
      where profile.id = p_hub_profile_id
        and lower(profile.email) = v_email
        and profile.role in ('admin', 'manager', 'dpo', 'volunteer', 'volunteer_senior', 'volunteer_lead', 'board_advisor', 'intern')
    ) then
      raise exception 'StaffHub identity could not be verified.'
        using errcode = '28000';
    end if;
    if v_name is null then
      select profile.full_name into v_name
      from public.profiles as profile
      where profile.id = p_hub_profile_id;
    end if;
  end if;

  perform pg_advisory_xact_lock(
    hashtext('public.volunteer_roster'),
    hashtext('random-number-allocation')
  );

  select roster.* into existing
  from public.volunteer_roster as roster
  where (p_hub_profile_id is not null and (
      roster.hub_profile_id = p_hub_profile_id
      or lower(roster.email) = v_email
    ))
    or (
      case when v_name is not null and lower(roster.full_name) = lower(v_name) then 1 else 0 end
      + case when v_email is not null and lower(roster.email) = v_email then 1 else 0 end
      + case when v_phone is not null and lower(roster.phone) = lower(v_phone) then 1 else 0 end
    ) >= 2
  order by case when roster.hub_profile_id = p_hub_profile_id and p_hub_profile_id is not null then 0 else 1 end
  limit 1
  for update;

  if found then
    if existing.status <> 'active'
      or (p_hub_profile_id is not null and existing.hub_profile_id is not null and existing.hub_profile_id <> p_hub_profile_id) then
      raise exception 'Contact details are already associated with an unavailable volunteer record.'
        using errcode = 'P0002';
    end if;

    if p_hub_profile_id is not null then
      update public.volunteer_roster as roster
      set hub_profile_id = p_hub_profile_id,
          full_name = coalesce(v_name, roster.full_name),
          email = coalesce(v_email, roster.email)
      where roster.id = existing.id
      returning roster.* into existing;
    end if;

    return query select existing.id, existing.full_name, existing.volunteer_number, false;
    return;
  end if;

  generated_number := public.issue_next_volunteer_number(p_management);
  return query
    insert into public.volunteer_roster (
      volunteer_number,
      full_name,
      email,
      phone,
      status,
      is_founding,
      hub_profile_id,
      issued_by
    )
    values (
      generated_number,
      coalesce(v_name, 'OBX Volunteer'),
      v_email,
      v_phone,
      'active',
      false,
      p_hub_profile_id,
      p_issued_by
    )
    returning
      volunteer_roster.id,
      volunteer_roster.full_name,
      volunteer_roster.volunteer_number,
      true;
end;
$$;

revoke all on function public.issue_next_volunteer_number(boolean) from public, anon, authenticated;
grant execute on function public.issue_next_volunteer_number(boolean) to service_role;
revoke all on function public.register_obx_volunteer(text, text, text, uuid, boolean, uuid) from public, anon, authenticated;
grant execute on function public.register_obx_volunteer(text, text, text, uuid, boolean, uuid) to service_role;

do $$
declare
  existing_id uuid;
  intern_profile_id uuid;
begin
  select roster.id into existing_id
  from public.volunteer_roster as roster
  where lower(roster.email) = 'regesnakitto@gmail.com'
  limit 1;

  if existing_id is null then
    perform public.register_obx_volunteer(
      'Nakitto Reges',
      'regesnakitto@gmail.com',
      null,
      null,
      false,
      null
    );
  else
    update public.volunteer_roster
    set full_name = 'Nakitto Reges',
        status = 'active'
    where id = existing_id;
  end if;

  select profile.id into intern_profile_id
  from public.profiles as profile
  where lower(profile.email) = 'regesnakitto@gmail.com'
    and profile.role = 'intern'
  order by profile.created_at
  limit 1;

  if intern_profile_id is not null then
    update public.volunteer_roster
    set hub_profile_id = intern_profile_id
    where lower(email) = 'regesnakitto@gmail.com'
      and (hub_profile_id is null or hub_profile_id = intern_profile_id);
  end if;
end;
$$;
