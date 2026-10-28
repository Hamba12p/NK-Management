begin;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  device_label text not null check (char_length(device_label) between 1 and 80),
  platform text not null check (char_length(platform) between 1 and 80),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  failure_count integer not null default 0 check (failure_count >= 0)
);

create index push_subscriptions_user_seen_idx
  on public.push_subscriptions(user_id, last_seen_at desc);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from public, anon, authenticated;
grant all on public.push_subscriptions to service_role;
create policy push_subscriptions_read_own on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
create policy push_subscriptions_insert_own on public.push_subscriptions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy push_subscriptions_delete_own on public.push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));

create table public.notification_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  comments_enabled boolean not null default true,
  assignments_enabled boolean not null default true,
  uploads_enabled boolean not null default false,
  quiet_hours_enabled boolean not null default true,
  quiet_start time not null default time '21:00' check (quiet_start = time '21:00'),
  quiet_end time not null default time '07:00' check (quiet_end = time '07:00'),
  timezone text not null default 'Africa/Kampala' check (timezone = 'Africa/Kampala'),
  banner_snoozed_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.notification_settings enable row level security;
grant select, insert, update on public.notification_settings to authenticated;
grant all on public.notification_settings to service_role;
create policy notification_settings_read_own on public.notification_settings
  for select to authenticated using (user_id = (select auth.uid()));
create policy notification_settings_insert_own on public.notification_settings
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy notification_settings_update_own on public.notification_settings
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('comment', 'assignment', 'upload')),
  entity_id uuid not null,
  url text not null check (url like '/dashboard/%' and url not like '//%'),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  push_delivered_at timestamptz,
  push_next_attempt_at timestamptz not null default now(),
  push_attempts integer not null default 0 check (push_attempts >= 0)
);

create index notifications_recipient_created_idx
  on public.notifications(recipient_id, created_at desc);
create index notifications_pending_push_idx
  on public.notifications(push_next_attempt_at)
  where push_delivered_at is null;

alter table public.notifications enable row level security;
alter table public.notifications replica identity full;
grant select, update (read_at) on public.notifications to authenticated;
grant all on public.notifications to service_role;
create policy notifications_read_own on public.notifications
  for select to authenticated using (recipient_id = (select auth.uid()));
create policy notifications_mark_read_own on public.notifications
  for update to authenticated using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

create or replace function public.create_notification(
  p_recipient_id uuid,
  p_type text,
  p_entity_id uuid,
  p_url text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_enabled boolean;
  v_category_enabled boolean;
begin
  select p.role
  into v_role
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id = p_recipient_id
    and u.deleted_at is null
    and (u.banned_until is null or u.banned_until < now());

  if v_role is null then
    return;
  end if;

  select coalesce(preferences.notifications_enabled, true)
  into v_enabled
  from public.profiles p
  left join public.user_preferences preferences on preferences.profile_id = p.id
  where p.id = p_recipient_id;

  if not coalesce(v_enabled, true) then
    return;
  end if;

  select case p_type
    when 'comment' then coalesce(settings.comments_enabled, true)
    when 'assignment' then coalesce(settings.assignments_enabled, true)
    when 'upload' then coalesce(settings.uploads_enabled, v_role in ('admin', 'manager', 'dpo'))
    else false
  end
  into v_category_enabled
  from public.profiles p
  left join public.notification_settings settings on settings.user_id = p.id
  where p.id = p_recipient_id;

  if not coalesce(v_category_enabled, false) then
    return;
  end if;

  if p_url not like '/dashboard/%' or p_url like '//%' then
    return;
  end if;

  if p_type = 'comment' then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(p_recipient_id::text || p_entity_id::text, 0)
    );
    if exists (
      select 1 from public.notifications n
      where n.recipient_id = p_recipient_id
        and n.type = 'comment'
        and n.entity_id = p_entity_id
        and n.created_at >= now() - interval '2 minutes'
    ) then
      return;
    end if;
  end if;

  delete from public.notifications n
  where n.recipient_id = p_recipient_id
    and (
      (n.read_at is not null and n.created_at < now() - interval '30 days')
      or n.created_at < now() - interval '90 days'
    );

  insert into public.notifications (recipient_id, type, entity_id, url)
  values (
    p_recipient_id,
    p_type,
    p_entity_id,
    p_url
  );
end;
$$;

revoke all on function public.create_notification(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.create_notification(uuid, text, uuid, text) to service_role;

create or replace function public.notify_workspace_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipient_id uuid;
begin
  if new.deleted_at is not null then
    return new;
  end if;

  for v_recipient_id in
    select distinct candidates.user_id
    from (
      select document.author_id as user_id, true as is_owner
      from public.workspace_docs document
      where document.id = new.document_id and document.deleted_at is null
      union
      select comment.author_id, false
      from public.workspace_comments comment
      where comment.document_id = new.document_id
        and comment.deleted_at is null
        and comment.id <> new.id
    ) candidates
    join public.profiles profile on profile.id = candidates.user_id
    where candidates.user_id <> new.author_id
      and (profile.role <> 'intern' or candidates.is_owner)
  loop
    perform public.create_notification(v_recipient_id, 'comment', new.document_id, '/dashboard/workspace');
  end loop;

  return new;
exception when others then
  return new;
end;
$$;

revoke all on function public.notify_workspace_comment() from public, anon, authenticated, service_role;
create trigger notify_workspace_comment_after_insert
  after insert on public.workspace_comments
  for each row execute function public.notify_workspace_comment();

create or replace function public.notify_task_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.deleted_at is null
    and new.assignee_id is not null
    and new.assignee_id <> new.created_by
    and (
      tg_op = 'INSERT'
      or old.assignee_id is distinct from new.assignee_id
    ) then
    perform public.create_notification(new.assignee_id, 'assignment', new.id, '/dashboard/workspace');
  end if;

  return new;
exception when others then
  return new;
end;
$$;

revoke all on function public.notify_task_assignment() from public, anon, authenticated, service_role;
create trigger notify_task_assignment_after_write
  after insert or update of assignee_id on public.tasks
  for each row execute function public.notify_task_assignment();

create or replace function public.notify_document_upload()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipient_id uuid;
begin
  if new.deleted_at is not null then
    return new;
  end if;

  for v_recipient_id in
    select profile.id
    from public.profiles profile
    join auth.users account on account.id = profile.id
    where profile.id <> new.uploaded_by
      and profile.role <> 'intern'
      and account.deleted_at is null
      and (account.banned_until is null or account.banned_until < now())
      and (
        (
          new.visibility = 'standard'
          and (
            cardinality(new.assigned_to) = 0
            or profile.id = any(new.assigned_to)
            or profile.role in ('admin', 'board_advisor')
          )
        )
        or (
          new.visibility = 'restricted'
          and (
            profile.id = any(new.assigned_to)
            or profile.role in ('admin', 'board_advisor')
          )
        )
      )
  loop
    perform public.create_notification(v_recipient_id, 'upload', new.id, '/dashboard/documents');
  end loop;

  return new;
exception when others then
  return new;
end;
$$;

revoke all on function public.notify_document_upload() from public, anon, authenticated, service_role;
create trigger notify_document_upload_after_insert
  after insert on public.documents
  for each row execute function public.notify_document_upload();

create or replace function public.create_default_notification_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notification_settings (user_id, uploads_enabled)
  values (new.id, new.role in ('admin', 'manager', 'dpo'))
  on conflict (user_id) do nothing;
  return new;
exception when others then
  return new;
end;
$$;

revoke all on function public.create_default_notification_settings() from public, anon, authenticated, service_role;
create trigger create_default_notification_settings_after_profile_insert
  after insert on public.profiles
  for each row execute function public.create_default_notification_settings();

insert into public.notification_settings (user_id, uploads_enabled)
select id, role in ('admin', 'manager', 'dpo')
from public.profiles
on conflict (user_id) do nothing;

do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;

commit;

notify pgrst, 'reload schema';
