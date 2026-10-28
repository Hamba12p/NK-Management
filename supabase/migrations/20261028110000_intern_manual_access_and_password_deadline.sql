begin;

alter table public.profiles
  add column if not exists intern_access_enabled boolean not null default false,
  add column if not exists password_change_required_on date;

-- Preserve the effective access state of existing interns; new intern accounts
-- are enabled explicitly by the trusted provisioning flow.
update public.profiles
set intern_access_enabled = true
where role = 'intern'
  and access_expires_at > now();

create or replace function public.intern_access_active()
returns boolean language sql stable security definer set search_path = ''
as $$
  select case when public.current_role() <> 'intern' then true
    else coalesce((select p.intern_access_enabled
      and p.access_starts_on <= (now() at time zone 'Africa/Nairobi')::date
      and (p.access_expires_at is null or p.access_expires_at > now())
      and (not p.must_change_password
        or p.password_change_required_on > (now() at time zone 'Africa/Nairobi')::date)
      from public.profiles p where p.id = (select auth.uid())), false) end
$$;

create or replace function public.intern_profile_protected_fields()
returns trigger language plpgsql set search_path = '' as $$
begin
  if public.is_intern() and (
    new.role is distinct from old.role
    or new.access_starts_on is distinct from old.access_starts_on
    or new.access_expires_at is distinct from old.access_expires_at
    or new.intern_access_enabled is distinct from old.intern_access_enabled
    or new.must_change_password is distinct from old.must_change_password
    or new.password_change_required_on is distinct from old.password_change_required_on
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
