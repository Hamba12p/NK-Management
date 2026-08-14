-- Recoverable, creator-owned deletion.
-- Content is never hard-deleted by the client: this migration preserves an
-- immutable snapshot, records an audit event, and places an in-app notice in
-- every administrator's inbox before hiding the source record.

create table if not exists public.deleted_content_archive (
  id uuid primary key default gen_random_uuid(),
  resource_type text not null check (resource_type in ('document', 'announcement', 'meeting', 'agenda_item', 'workspace_document', 'workspace_comment', 'task', 'processing_activity')),
  resource_id uuid not null,
  original_file_path text,
  content_snapshot jsonb not null,
  deleted_by uuid not null references public.profiles(id) on delete restrict,
  deleted_at timestamptz not null default now()
);

create index if not exists idx_deleted_content_archive_deleted_at on public.deleted_content_archive(deleted_at desc);
create index if not exists idx_deleted_content_archive_resource on public.deleted_content_archive(resource_type, resource_id);

alter table public.deleted_content_archive enable row level security;
drop policy if exists "deleted_content_archive_read_compliance" on public.deleted_content_archive;
create policy "deleted_content_archive_read_compliance" on public.deleted_content_archive
  for select to authenticated
  using ((select role from public.profiles where id = auth.uid()) in ('admin', 'dpo'));

create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  archive_id uuid not null references public.deleted_content_archive(id) on delete cascade,
  event_type text not null default 'content_deleted',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists idx_admin_notifications_recipient_created on public.admin_notifications(recipient_id, created_at desc);
alter table public.admin_notifications enable row level security;
drop policy if exists "admin_notifications_read_own" on public.admin_notifications;
drop policy if exists "admin_notifications_mark_read_own" on public.admin_notifications;
create policy "admin_notifications_read_own" on public.admin_notifications
  for select to authenticated using (recipient_id = auth.uid());
create policy "admin_notifications_mark_read_own" on public.admin_notifications
  for update to authenticated using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

-- Soft-deleted records stay retained for the archive but disappear from normal
-- product views. The original document blob also remains in private storage.
alter table public.documents add column if not exists deleted_at timestamptz;
alter table public.documents add column if not exists deleted_by uuid references public.profiles(id) on delete set null;
alter table public.announcements add column if not exists deleted_at timestamptz;
alter table public.announcements add column if not exists deleted_by uuid references public.profiles(id) on delete set null;
alter table public.meetings add column if not exists deleted_at timestamptz;
alter table public.meetings add column if not exists deleted_by uuid references public.profiles(id) on delete set null;
alter table public.agenda_items add column if not exists created_by uuid references public.profiles(id) on delete set null;
alter table public.agenda_items add column if not exists deleted_at timestamptz;
alter table public.agenda_items add column if not exists deleted_by uuid references public.profiles(id) on delete set null;
alter table public.workspace_docs add column if not exists deleted_at timestamptz;
alter table public.workspace_docs add column if not exists deleted_by uuid references public.profiles(id) on delete set null;
alter table public.workspace_comments add column if not exists deleted_at timestamptz;
alter table public.workspace_comments add column if not exists deleted_by uuid references public.profiles(id) on delete set null;
alter table public.tasks add column if not exists deleted_at timestamptz;
alter table public.tasks add column if not exists deleted_by uuid references public.profiles(id) on delete set null;
alter table public.processing_activities add column if not exists deleted_at timestamptz;
alter table public.processing_activities add column if not exists deleted_by uuid references public.profiles(id) on delete set null;

-- Existing agenda rows predate creator attribution; their meeting creator is
-- the only defensible owner for those legacy entries.
update public.agenda_items agenda
set created_by = meetings.created_by
from public.meetings
where agenda.meeting_id = meetings.id and agenda.created_by is null;

drop policy if exists "documents_read_all" on public.documents;
drop policy if exists "documents_update" on public.documents;
drop policy if exists "documents_delete" on public.documents;
drop policy if exists "documents_read_active" on public.documents;
create policy "documents_read_active" on public.documents for select to authenticated using (deleted_at is null);
drop policy if exists "documents_update_active" on public.documents;
create policy "documents_update_active" on public.documents for update to authenticated
  using (deleted_at is null and (auth.uid() = uploaded_by or (select role from public.profiles where id = auth.uid()) = 'admin'))
  with check (deleted_at is null and (auth.uid() = uploaded_by or (select role from public.profiles where id = auth.uid()) = 'admin'));

drop policy if exists "storage_authenticated_read" on storage.objects;
drop policy if exists "storage_delete_own" on storage.objects;
drop policy if exists "storage_read_active_documents" on storage.objects;
create policy "storage_read_active_documents" on storage.objects for select to authenticated
  using (
    bucket_id = 'documents' and (
      exists (select 1 from public.documents where file_path = name and deleted_at is null)
      or (select role from public.profiles where id = auth.uid()) = 'admin'
    )
  );

drop policy if exists "announcements_read_all" on public.announcements;
drop policy if exists "announcements_update" on public.announcements;
drop policy if exists "announcements_delete" on public.announcements;
drop policy if exists "announcements_read_active" on public.announcements;
create policy "announcements_read_active" on public.announcements for select to authenticated using (deleted_at is null);
drop policy if exists "announcements_update_active" on public.announcements;
create policy "announcements_update_active" on public.announcements for update to authenticated
  using (deleted_at is null and (auth.uid() = author_id or (select role from public.profiles where id = auth.uid()) = 'admin'))
  with check (deleted_at is null and (auth.uid() = author_id or (select role from public.profiles where id = auth.uid()) = 'admin'));

drop policy if exists "meetings_read_all" on public.meetings;
drop policy if exists "meetings_update" on public.meetings;
drop policy if exists "meetings_delete" on public.meetings;
drop policy if exists "meetings_read_active" on public.meetings;
create policy "meetings_read_active" on public.meetings for select to authenticated using (deleted_at is null);
drop policy if exists "meetings_update_active" on public.meetings;
create policy "meetings_update_active" on public.meetings for update to authenticated
  using (deleted_at is null and (auth.uid() = created_by or (select role from public.profiles where id = auth.uid()) in ('admin', 'manager')))
  with check (deleted_at is null and (auth.uid() = created_by or (select role from public.profiles where id = auth.uid()) in ('admin', 'manager')));

drop policy if exists "agenda_items_read" on public.agenda_items;
drop policy if exists "agenda_items_insert" on public.agenda_items;
drop policy if exists "agenda_items_update" on public.agenda_items;
drop policy if exists "agenda_items_delete" on public.agenda_items;
drop policy if exists "agenda_items_read_active" on public.agenda_items;
create policy "agenda_items_read_active" on public.agenda_items for select to authenticated using (deleted_at is null);
drop policy if exists "agenda_items_insert_own" on public.agenda_items;
create policy "agenda_items_insert_own" on public.agenda_items for insert to authenticated with check (created_by = auth.uid());
drop policy if exists "agenda_items_update_active" on public.agenda_items;
create policy "agenda_items_update_active" on public.agenda_items for update to authenticated
  using (deleted_at is null and (created_by = auth.uid() or (select role from public.profiles where id = auth.uid()) = 'admin'))
  with check (deleted_at is null and (created_by = auth.uid() or (select role from public.profiles where id = auth.uid()) = 'admin'));

drop policy if exists "workspace_docs_read" on public.workspace_docs;
drop policy if exists "workspace_docs_update" on public.workspace_docs;
drop policy if exists "workspace_docs_read_active" on public.workspace_docs;
create policy "workspace_docs_read_active" on public.workspace_docs for select to authenticated using (deleted_at is null);
drop policy if exists "workspace_docs_update_active" on public.workspace_docs;
create policy "workspace_docs_update_active" on public.workspace_docs for update to authenticated
  using (deleted_at is null and (author_id = auth.uid() or (select role from public.profiles where id = auth.uid()) in ('admin', 'manager')))
  with check (deleted_at is null and (author_id = auth.uid() or (select role from public.profiles where id = auth.uid()) in ('admin', 'manager')));

drop policy if exists "workspace_comments_read" on public.workspace_comments;
drop policy if exists "workspace_comments_delete_own" on public.workspace_comments;
drop policy if exists "workspace_comments_read_active" on public.workspace_comments;
create policy "workspace_comments_read_active" on public.workspace_comments for select to authenticated using (deleted_at is null);

drop policy if exists "tasks_read" on public.tasks;
drop policy if exists "tasks_manage" on public.tasks;
drop policy if exists "tasks_read_active" on public.tasks;
create policy "tasks_read_active" on public.tasks for select to authenticated using (deleted_at is null);
drop policy if exists "tasks_manage_active" on public.tasks;
create policy "tasks_manage_active" on public.tasks for all to authenticated
  using (deleted_at is null and (select role from public.profiles where id = auth.uid()) in ('admin', 'manager'))
  with check (deleted_at is null and (select role from public.profiles where id = auth.uid()) in ('admin', 'manager'));

drop policy if exists "dpo_processing_access" on public.processing_activities;
drop policy if exists "dpo_processing_read_active" on public.processing_activities;
create policy "dpo_processing_read_active" on public.processing_activities for select to authenticated
  using (deleted_at is null and (select role from public.profiles where id = auth.uid()) in ('admin', 'dpo'));
drop policy if exists "dpo_processing_write_active" on public.processing_activities;
create policy "dpo_processing_write_active" on public.processing_activities for insert to authenticated
  with check ((select role from public.profiles where id = auth.uid()) in ('admin', 'dpo') and created_by = auth.uid());
drop policy if exists "dpo_processing_update_active" on public.processing_activities;
create policy "dpo_processing_update_active" on public.processing_activities for update to authenticated
  using (deleted_at is null and (created_by = auth.uid() or (select role from public.profiles where id = auth.uid()) = 'admin'))
  with check (deleted_at is null and (created_by = auth.uid() or (select role from public.profiles where id = auth.uid()) = 'admin'));

create or replace function public.archive_owned_content(p_resource_type text, p_resource_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_is_admin boolean := false;
  v_owner uuid;
  v_snapshot jsonb;
  v_file_path text;
  v_title text;
  v_archive_id uuid;
begin
  if v_actor is null then
    raise exception 'You must be signed in to delete content';
  end if;

  select role = 'admin' into v_is_admin from public.profiles where id = v_actor;
  v_is_admin := coalesce(v_is_admin, false);

  case p_resource_type
    when 'document' then
      select uploaded_by, to_jsonb(d), file_path, name into v_owner, v_snapshot, v_file_path, v_title from public.documents d where id = p_resource_id and deleted_at is null for update;
      if v_owner is null or (v_owner <> v_actor and not v_is_admin) then raise exception 'You can only delete documents you uploaded'; end if;
      update public.documents set deleted_at = now(), deleted_by = v_actor where id = p_resource_id;
    when 'announcement' then
      select author_id, to_jsonb(a), null, title into v_owner, v_snapshot, v_file_path, v_title from public.announcements a where id = p_resource_id and deleted_at is null for update;
      if v_owner is null or (v_owner <> v_actor and not v_is_admin) then raise exception 'You can only delete announcements you created'; end if;
      update public.announcements set deleted_at = now(), deleted_by = v_actor where id = p_resource_id;
    when 'meeting' then
      select m.created_by, jsonb_build_object('meeting', to_jsonb(m), 'agenda_items', coalesce((select jsonb_agg(to_jsonb(ai) order by ai.order_index) from public.agenda_items ai where ai.meeting_id = m.id and ai.deleted_at is null), '[]'::jsonb)), null, m.title into v_owner, v_snapshot, v_file_path, v_title from public.meetings m where m.id = p_resource_id and m.deleted_at is null for update;
      if v_owner is null or (v_owner <> v_actor and not v_is_admin) then raise exception 'You can only delete meetings you created'; end if;
      update public.meetings set deleted_at = now(), deleted_by = v_actor where id = p_resource_id;
      update public.agenda_items set deleted_at = now(), deleted_by = v_actor where meeting_id = p_resource_id and deleted_at is null;
    when 'agenda_item' then
      select created_by, to_jsonb(ai), null, content into v_owner, v_snapshot, v_file_path, v_title from public.agenda_items ai where id = p_resource_id and deleted_at is null for update;
      if v_owner is null or (v_owner <> v_actor and not v_is_admin) then raise exception 'You can only delete agenda items you created'; end if;
      update public.agenda_items set deleted_at = now(), deleted_by = v_actor where id = p_resource_id;
    when 'workspace_document' then
      select author_id, to_jsonb(w), null, title into v_owner, v_snapshot, v_file_path, v_title from public.workspace_docs w where id = p_resource_id and deleted_at is null for update;
      if v_owner is null or (v_owner <> v_actor and not v_is_admin) then raise exception 'You can only delete workspace documents you created'; end if;
      update public.workspace_docs set deleted_at = now(), deleted_by = v_actor where id = p_resource_id;
    when 'workspace_comment' then
      select author_id, to_jsonb(c), null, left(body, 120) into v_owner, v_snapshot, v_file_path, v_title from public.workspace_comments c where id = p_resource_id and deleted_at is null for update;
      if v_owner is null or (v_owner <> v_actor and not v_is_admin) then raise exception 'You can only delete comments you created'; end if;
      update public.workspace_comments set deleted_at = now(), deleted_by = v_actor where id = p_resource_id;
    when 'task' then
      select created_by, to_jsonb(t), null, title into v_owner, v_snapshot, v_file_path, v_title from public.tasks t where id = p_resource_id and deleted_at is null for update;
      if v_owner is null or (v_owner <> v_actor and not v_is_admin) then raise exception 'You can only delete tasks you created'; end if;
      update public.tasks set deleted_at = now(), deleted_by = v_actor where id = p_resource_id;
    when 'processing_activity' then
      select created_by, to_jsonb(p), null, activity_name into v_owner, v_snapshot, v_file_path, v_title from public.processing_activities p where id = p_resource_id and deleted_at is null for update;
      if v_owner is null or (v_owner <> v_actor and not v_is_admin) then raise exception 'You can only delete processing activities you created'; end if;
      update public.processing_activities set deleted_at = now(), deleted_by = v_actor where id = p_resource_id;
    else
      raise exception 'Unsupported resource type: %', p_resource_type;
  end case;

  if v_snapshot is null then
    raise exception 'Content was not found or has already been deleted';
  end if;

  insert into public.deleted_content_archive (resource_type, resource_id, original_file_path, content_snapshot, deleted_by)
  values (p_resource_type, p_resource_id, v_file_path, v_snapshot, v_actor)
  returning id into v_archive_id;

  insert into public.activity_log (user_id, action_type, resource_type, resource_id, details)
  values (v_actor, 'content.delete', p_resource_type, p_resource_id, jsonb_build_object('archive_id', v_archive_id, 'title', v_title, 'retained', true));

  insert into public.admin_notifications (recipient_id, archive_id, payload)
  select id, v_archive_id, jsonb_build_object('resource_type', p_resource_type, 'resource_id', p_resource_id, 'title', v_title, 'deleted_by', v_actor, 'retained', true)
  from public.profiles where role = 'admin';

  return v_archive_id;
end;
$$;

revoke all on function public.archive_owned_content(text, uuid) from public;
grant execute on function public.archive_owned_content(text, uuid) to authenticated;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'admin_notifications') then
    alter publication supabase_realtime add table public.admin_notifications;
  end if;
end $$;
