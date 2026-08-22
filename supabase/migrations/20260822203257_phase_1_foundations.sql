-- Phase 1 foundations: durable volunteer data, persisted preferences,
-- protected-route role contracts, and canonical-only activity logging.

create table if not exists public.volunteer_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  tier text not null default 'volunteer'
    check (tier in ('volunteer', 'volunteer_senior', 'volunteer_lead')),
  department text not null default 'General' check (char_length(department) between 1 and 120),
  status text not null default 'onboarding' check (status in ('active', 'inactive', 'onboarding')),
  join_date date not null default current_date,
  hours_total numeric(8,2) not null default 0 check (hours_total >= 0),
  updated_at timestamptz not null default now()
);

create index if not exists idx_volunteer_profiles_status_tier
  on public.volunteer_profiles(status, tier);

alter table public.volunteer_profiles enable row level security;
drop policy if exists "volunteer_profiles_read_own" on public.volunteer_profiles;
drop policy if exists "volunteer_profiles_read_leadership" on public.volunteer_profiles;
drop policy if exists "volunteer_profiles_insert_own" on public.volunteer_profiles;
drop policy if exists "volunteer_profiles_update_own" on public.volunteer_profiles;
drop policy if exists "volunteer_profiles_update_leadership" on public.volunteer_profiles;
create policy "volunteer_profiles_read_own" on public.volunteer_profiles
  for select to authenticated using (profile_id = (select auth.uid()));
create policy "volunteer_profiles_read_leadership" on public.volunteer_profiles
  for select to authenticated using (
    (select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager', 'dpo')
  );
create policy "volunteer_profiles_insert_own" on public.volunteer_profiles
  for insert to authenticated with check (
    profile_id = (select auth.uid())
    and tier = (select role from public.profiles where id = (select auth.uid()))
  );
create policy "volunteer_profiles_update_own" on public.volunteer_profiles
  for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (
    profile_id = (select auth.uid())
    and tier = (select role from public.profiles where id = (select auth.uid()))
  );
create policy "volunteer_profiles_update_leadership" on public.volunteer_profiles
  for update to authenticated
  using ((select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager'))
  with check (
    (select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager')
    and tier in ('volunteer', 'volunteer_senior', 'volunteer_lead')
  );

insert into public.volunteer_profiles (profile_id, tier, status, join_date)
select id, role, 'active', created_at::date
from public.profiles
where role in ('volunteer', 'volunteer_senior', 'volunteer_lead')
on conflict (profile_id) do update
set tier = excluded.tier,
    updated_at = now();

create table if not exists public.user_preferences (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  notifications_enabled boolean not null default true,
  dark_mode boolean not null default false,
  email_digest boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;
drop policy if exists "user_preferences_read_own" on public.user_preferences;
drop policy if exists "user_preferences_insert_own" on public.user_preferences;
drop policy if exists "user_preferences_update_own" on public.user_preferences;
create policy "user_preferences_read_own" on public.user_preferences
  for select to authenticated using (profile_id = (select auth.uid()));
create policy "user_preferences_insert_own" on public.user_preferences
  for insert to authenticated with check (profile_id = (select auth.uid()));
create policy "user_preferences_update_own" on public.user_preferences
  for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

insert into public.user_preferences (profile_id)
select id from public.profiles
on conflict (profile_id) do nothing;

create or replace function public.sync_profile_foundations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_preferences (profile_id)
  values (new.id)
  on conflict (profile_id) do nothing;

  if new.role in ('volunteer', 'volunteer_senior', 'volunteer_lead') then
    insert into public.volunteer_profiles (profile_id, tier, status, join_date)
    values (new.id, new.role, 'active', new.created_at::date)
    on conflict (profile_id) do update
      set tier = excluded.tier,
          updated_at = now();
  end if;
  return new;
end;
$$;

revoke execute on function public.sync_profile_foundations() from public, anon, authenticated, service_role;
drop trigger if exists sync_profile_foundations_after_profile_change on public.profiles;
create trigger sync_profile_foundations_after_profile_change
after insert or update of role on public.profiles
for each row execute function public.sync_profile_foundations();

grant select on public.volunteer_profiles to authenticated;
grant insert (profile_id, tier, department, status, join_date) on public.volunteer_profiles to authenticated;
grant update (department, status, join_date, updated_at) on public.volunteer_profiles to authenticated;
grant select, insert, update on public.user_preferences to authenticated;

-- Finish the legacy activity-log transition and remove the obsolete shape.
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'activity_log' and column_name = 'actor_id') then
    update public.activity_log set user_id = coalesce(user_id, actor_id) where user_id is null;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'activity_log' and column_name = 'action') then
    update public.activity_log set action_type = coalesce(action_type, action, 'activity') where action_type is null;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'activity_log' and column_name = 'target_type') then
    update public.activity_log set resource_type = coalesce(resource_type, target_type, 'system') where resource_type is null;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'activity_log' and column_name = 'target_id') then
    update public.activity_log set resource_id = coalesce(resource_id, target_id) where resource_id is null;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'activity_log' and column_name = 'meta') then
    update public.activity_log set details = coalesce(nullif(details, '{}'::jsonb), meta, '{}'::jsonb);
  end if;
end $$;

update public.activity_log set action_type = 'activity' where action_type is null;
update public.activity_log set resource_type = 'system' where resource_type is null;
update public.activity_log set details = '{}'::jsonb where details is null;
alter table public.activity_log alter column action_type set not null;
alter table public.activity_log alter column resource_type set not null;
alter table public.activity_log alter column details set default '{}'::jsonb;
alter table public.activity_log alter column details set not null;

drop policy if exists "activity_log_insert_own" on public.activity_log;
drop policy if exists "activity_log_insert_authenticated" on public.activity_log;
create policy "activity_log_insert_authenticated" on public.activity_log
  for insert to authenticated with check ((select auth.uid()) = user_id);

alter table public.activity_log drop column if exists actor_id;
alter table public.activity_log drop column if exists action;
alter table public.activity_log drop column if exists target_type;
alter table public.activity_log drop column if exists target_id;
alter table public.activity_log drop column if exists meta;

notify pgrst, 'reload schema';
