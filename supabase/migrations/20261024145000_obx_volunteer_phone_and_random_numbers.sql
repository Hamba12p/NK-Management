alter table public.volunteer_roster
  add column phone text null;

alter table public.volunteer_roster
  alter column email drop not null,
  add constraint volunteer_roster_contact_required check (email is not null or phone is not null);

create unique index volunteer_roster_phone_unique
  on public.volunteer_roster (lower(phone))
  where phone is not null;

create or replace function public.issue_next_volunteer_number()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate integer;
  generated_number text;
  attempt integer;
begin
  perform pg_advisory_xact_lock(hashtext('public.volunteer_roster'), hashtext('random-number-allocation'));
  candidate := 100 + floor(random() * 9900)::integer;

  for attempt in 1..9900 loop
    generated_number := 'NKV-' || lpad(candidate::text, 3, '0');
    if not exists (
      select 1
      from public.volunteer_roster roster
      where roster.volunteer_number = generated_number
    ) then
      return generated_number;
    end if;
    candidate := case when candidate = 9999 then 100 else candidate + 1 end;
  end loop;

  raise exception 'No volunteer numbers remain.'
    using errcode = 'P0001';
end;
$$;

revoke all on function public.issue_next_volunteer_number() from public, anon, authenticated;
grant execute on function public.issue_next_volunteer_number() to service_role;
