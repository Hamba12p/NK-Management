begin;

alter table public.profiles add column if not exists access_starts_on date;

-- Existing intern accounts retain their current availability. New intern rows
-- must explicitly receive a start date through the trusted provisioning flow.
update public.profiles
set access_starts_on = (now() at time zone 'Africa/Nairobi')::date
where role = 'intern' and access_starts_on is null;

create or replace function public.intern_access_active()
returns boolean language sql stable security definer set search_path = ''
as $$
  select case when public.current_role() <> 'intern' then true
    else coalesce((select p.access_starts_on <= (now() at time zone 'Africa/Nairobi')::date
      and p.access_expires_at > now()
      from public.profiles p where p.id = (select auth.uid())), false) end
$$;

-- Let an intern read their own access status so the application can show the
-- start/expiry screen. All other intern data continues to use intern_access_active().
drop policy if exists intern_profiles_read on public.profiles;
create policy intern_profiles_read on public.profiles as restrictive for select to authenticated
  using (not public.is_intern() or id = (select auth.uid()));

create or replace function public.intern_profile_protected_fields()
returns trigger language plpgsql set search_path = '' as $$
begin
  if public.is_intern() and (
    new.role is distinct from old.role
    or new.access_starts_on is distinct from old.access_starts_on
    or new.access_expires_at is distinct from old.access_expires_at
    or new.must_change_password is distinct from old.must_change_password
    or new.email is distinct from old.email
    or new.job_title is distinct from old.job_title
    or new.account_type is distinct from old.account_type
  ) then
    raise exception 'Interns cannot change account access details';
  end if;
  return new;
end;
$$;

commit;
