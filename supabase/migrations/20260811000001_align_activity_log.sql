-- Compatibility migration for projects that applied the first Hub schema
-- before activity_log was standardized on user_id/action_type/details.
-- Safe on fresh projects too.

alter table public.activity_log add column if not exists user_id uuid references public.profiles(id) on delete set null;
alter table public.activity_log add column if not exists action_type text;
alter table public.activity_log add column if not exists resource_type text;
alter table public.activity_log add column if not exists resource_id uuid;
alter table public.activity_log add column if not exists details jsonb not null default '{}'::jsonb;

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'activity_log' and column_name = 'actor_id') then
    update public.activity_log set user_id = coalesce(user_id, actor_id) where user_id is null;
    alter table public.activity_log alter column actor_id drop not null;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'activity_log' and column_name = 'action') then
    update public.activity_log set action_type = coalesce(action_type, action) where action_type is null;
    alter table public.activity_log alter column action drop not null;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'activity_log' and column_name = 'target_type') then
    update public.activity_log set resource_type = coalesce(resource_type, target_type, 'system') where resource_type is null;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'activity_log' and column_name = 'target_id') then
    update public.activity_log set resource_id = coalesce(resource_id, target_id) where resource_id is null;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'activity_log' and column_name = 'meta') then
    update public.activity_log set details = coalesce(details, meta, '{}'::jsonb) where details = '{}'::jsonb;
  end if;
end $$;

create index if not exists idx_activity_log_user_id on public.activity_log(user_id);
create index if not exists idx_activity_log_action_type on public.activity_log(action_type);

drop policy if exists "activity_log_insert_own" on public.activity_log;
drop policy if exists "activity_log_insert_authenticated" on public.activity_log;
create policy "activity_log_insert_authenticated"
  on public.activity_log for insert to authenticated
  with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
