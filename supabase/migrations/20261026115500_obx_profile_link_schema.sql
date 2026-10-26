alter table public.volunteer_roster
  add column if not exists hub_profile_id uuid null
  references public.profiles(id) on delete set null;

create unique index if not exists volunteer_roster_hub_profile_unique
  on public.volunteer_roster (hub_profile_id)
  where hub_profile_id is not null;

do $$
declare
  staff_profile public.profiles%rowtype;
  roster_record public.volunteer_roster%rowtype;
begin
  select profile.* into staff_profile
  from public.profiles as profile
  where lower(profile.email) = 'shabehamba@gmail.com'
    and lower(profile.full_name) = 'hamba shabil';

  if not found or staff_profile.role <> 'manager' then
    raise exception 'Hamba Shabil''s expected StaffHub manager profile was not found.';
  end if;

  select roster.* into roster_record
  from public.volunteer_roster as roster
  where lower(roster.email) = lower(staff_profile.email)
    and roster.volunteer_number = 'NKV-346'
    and roster.status = 'active'
  for update;

  if not found then
    raise exception 'Hamba Shabil''s active OBX roster record was not found.';
  end if;

  if roster_record.hub_profile_id is not null
    and roster_record.hub_profile_id <> staff_profile.id then
    raise exception 'Hamba Shabil''s OBX record is linked to a different StaffHub profile.';
  end if;

  if exists (
    select 1 from public.volunteer_roster as roster
    where roster.hub_profile_id = staff_profile.id
      and roster.id <> roster_record.id
  ) then
    raise exception 'Hamba Shabil''s StaffHub profile is already linked to a different OBX record.';
  end if;

  update public.volunteer_roster
  set hub_profile_id = staff_profile.id,
      full_name = staff_profile.full_name
  where id = roster_record.id;
end;
$$;
