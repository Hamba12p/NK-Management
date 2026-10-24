begin;

-- Remove only this migration's previously-created policies so it can be
-- safely reapplied without touching any pre-existing policy.
do $$
declare p record;
begin
  for p in select schemaname, tablename, policyname from pg_catalog.pg_policies
    where (policyname like 'intern\_%' escape '\')
      or (policyname like 'dpo\_%\_intern\_%' escape '\')
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end;
$$;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin', 'manager', 'dpo', 'volunteer', 'volunteer_senior', 'volunteer_lead', 'board_advisor', 'intern'));

alter table public.profiles add column if not exists access_expires_at timestamptz;
alter table public.profiles add column if not exists must_change_password boolean not null default false;
alter table public.documents add column if not exists intern_visible boolean not null default false;
alter table public.meetings add column if not exists intern_visible boolean not null default false;
alter table public.meetings add column if not exists intern_check_in boolean not null default false;
alter table public.announcements add column if not exists intern_visible boolean not null default false;
alter table public.announcements add column if not exists acknowledgement_required boolean not null default false;

create table if not exists public.intern_workspace_areas (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  intern_visible boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.intern_workspace_areas enable row level security;
grant select, insert, update on public.intern_workspace_areas to authenticated;
alter table public.documents add column if not exists intern_area_id uuid references public.intern_workspace_areas(id) on delete set null;
alter table public.workspace_docs add column if not exists intern_area_id uuid references public.intern_workspace_areas(id) on delete set null;

create or replace function public.current_role()
returns text language sql stable security definer set search_path = ''
as $$ select p.role from public.profiles p where p.id = (select auth.uid()) $$;

create or replace function public.is_intern()
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce(public.current_role() = 'intern', false) $$;

create or replace function public.intern_access_active()
returns boolean language sql stable security definer set search_path = ''
as $$
  select case when public.current_role() <> 'intern' then true
    else coalesce((select p.access_expires_at > now()
      from public.profiles p where p.id = (select auth.uid())), false) end
$$;

revoke all on function public.current_role() from public, anon;
revoke all on function public.is_intern() from public, anon;
revoke all on function public.intern_access_active() from public, anon;
grant execute on function public.current_role() to authenticated;
grant execute on function public.is_intern() to authenticated;
grant execute on function public.intern_access_active() to authenticated;

create or replace function public.staff_directory()
returns table (id uuid, full_name text, role text)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.full_name, p.role from public.profiles p
  where (select auth.uid()) is not null
    and (not public.is_intern() or public.intern_access_active())
  order by p.full_name
$$;
revoke all on function public.staff_directory() from public, anon;
grant execute on function public.staff_directory() to authenticated;

create policy intern_areas_staff_read on public.intern_workspace_areas as permissive for select to authenticated using (not public.is_intern());
create policy intern_areas_visible_read on public.intern_workspace_areas as permissive for select to authenticated
  using (intern_visible and public.intern_access_active());
create policy intern_areas_staff_manage on public.intern_workspace_areas as permissive for all to authenticated
  using (public.current_role() in ('admin', 'manager', 'dpo'))
  with check (public.current_role() in ('admin', 'manager', 'dpo'));
create policy intern_areas_intern_read_restrict on public.intern_workspace_areas as restrictive for select to authenticated
  using (not public.is_intern() or (public.intern_access_active() and intern_visible));
create policy intern_areas_intern_insert_restrict on public.intern_workspace_areas as restrictive for insert to authenticated
  with check (not public.is_intern());
create policy intern_areas_intern_update_restrict on public.intern_workspace_areas as restrictive for update to authenticated
  using (not public.is_intern()) with check (not public.is_intern());
create policy intern_areas_intern_delete_restrict on public.intern_workspace_areas as restrictive for delete to authenticated
  using (not public.is_intern());

-- Preserve the latest profile trigger and accept intern metadata.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_name text := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));
  v_account_type text := coalesce(new.raw_user_meta_data->>'account_type', 'person');
begin
  if v_account_type not in ('person', 'organization', 'shared') then v_account_type := 'person'; end if;
  insert into public.profiles (id, full_name, email, role, job_title, account_type, display_tag, display_color)
  values (new.id, v_name, new.email,
    case when new.raw_user_meta_data->>'role' in ('admin', 'manager', 'dpo', 'volunteer', 'volunteer_senior', 'volunteer_lead', 'intern')
      then new.raw_user_meta_data->>'role' else 'volunteer' end,
    nullif(new.raw_user_meta_data->>'job_title', ''), v_account_type,
    coalesce(nullif(new.raw_user_meta_data->>'display_tag', ''), public.profile_initials(v_name)),
    case when new.raw_user_meta_data->>'display_color' in ('burgundy', 'soft-burgundy', 'magenta', 'rust', 'ink')
      then new.raw_user_meta_data->>'display_color' else 'burgundy' end
  ) on conflict (id) do update set email = excluded.email, updated_at = now();
  return new;
end;
$$;

-- Same logic as the current function: intern profiles get preferences, but
-- only the three volunteer role values create volunteer_profiles rows.
create or replace function public.sync_profile_foundations()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.user_preferences (profile_id) values (new.id) on conflict (profile_id) do nothing;
  if new.role in ('volunteer', 'volunteer_senior', 'volunteer_lead') then
    insert into public.volunteer_profiles (profile_id, tier, status, join_date)
    values (new.id, new.role, 'active', new.created_at::date)
    on conflict (profile_id) do update set tier = excluded.tier, updated_at = now();
  end if;
  return new;
end;
$$;

-- Closed by default for the intern across every already-RLS-enabled public table.
do $$
declare item record;
begin
  for item in select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
      and table_name not in ('profiles', 'documents', 'meetings', 'agenda_items', 'announcements',
        'announcement_acknowledgements', 'workspace_docs', 'workspace_comments',
        'workspace_doc_versions', 'tasks', 'user_preferences', 'intern_workspace_areas')
  loop
    if not exists (select 1 from pg_catalog.pg_policy
      where polrelid = format('public.%I', item.table_name)::regclass and polname = 'intern_closed_access') then
      execute format('create policy intern_closed_access on public.%I as restrictive for all to authenticated using (not public.is_intern()) with check (not public.is_intern())', item.table_name);
    end if;
  end loop;
end;
$$;

create policy intern_profiles_read on public.profiles as restrictive for select to authenticated
  using (not public.is_intern() or (public.intern_access_active() and id = (select auth.uid())));
create policy intern_profiles_update on public.profiles as restrictive for update to authenticated
  using (not public.is_intern() or (public.intern_access_active() and id = (select auth.uid())))
  with check (not public.is_intern() or (public.intern_access_active() and id = (select auth.uid())));
create policy intern_profiles_insert on public.profiles as restrictive for insert to authenticated with check (not public.is_intern());
create policy intern_profiles_delete on public.profiles as restrictive for delete to authenticated using (not public.is_intern());

create policy intern_documents_read on public.documents as restrictive for select to authenticated
  using (not public.is_intern() or (public.intern_access_active() and deleted_at is null
    and ((intern_visible and visibility = 'standard') or uploaded_by = (select auth.uid()))));
create policy intern_documents_insert on public.documents as restrictive for insert to authenticated
  with check (not public.is_intern() or (public.intern_access_active() and uploaded_by = (select auth.uid())
    and intern_visible = false and file_path like ('interns/' || (select auth.uid())::text || '/%')
    and (intern_area_id is null or exists (select 1 from public.intern_workspace_areas a where a.id = intern_area_id and a.intern_visible))));
create policy intern_documents_update on public.documents as restrictive for update to authenticated
  using (not public.is_intern() or (public.intern_access_active() and uploaded_by = (select auth.uid()) and deleted_at is null))
  with check (not public.is_intern() or (public.intern_access_active() and uploaded_by = (select auth.uid())
    and intern_visible = false and file_path like ('interns/' || (select auth.uid())::text || '/%')
    and (intern_area_id is null or exists (select 1 from public.intern_workspace_areas a where a.id = intern_area_id and a.intern_visible))));
create policy intern_documents_delete on public.documents as restrictive for delete to authenticated
  using (not public.is_intern() or (public.intern_access_active() and uploaded_by = (select auth.uid())));

create policy dpo_insert_intern_tasks on public.tasks as permissive for insert to authenticated with check (
  public.current_role() = 'dpo' and created_by = (select auth.uid())
  and exists (select 1 from public.profiles p where p.id = assignee_id and p.role = 'intern'));
create policy dpo_update_intern_tasks on public.tasks as permissive for update to authenticated
  using (public.current_role() = 'dpo' and exists (select 1 from public.profiles p where p.id = assignee_id and p.role = 'intern'))
  with check (public.current_role() = 'dpo' and exists (select 1 from public.profiles p where p.id = assignee_id and p.role = 'intern'));
create policy intern_tasks_read on public.tasks as restrictive for select to authenticated
  using (not public.is_intern() or (public.intern_access_active() and deleted_at is null
    and (assignee_id = (select auth.uid()) or created_by = (select auth.uid()))));
create policy intern_tasks_insert on public.tasks as restrictive for insert to authenticated
  with check (not public.is_intern() or (public.intern_access_active() and created_by = (select auth.uid())
    and (assignee_id is null or assignee_id = (select auth.uid()))));
create policy intern_tasks_update on public.tasks as restrictive for update to authenticated
  using (not public.is_intern() or (public.intern_access_active() and deleted_at is null and assignee_id = (select auth.uid())))
  with check (not public.is_intern() or (public.intern_access_active() and assignee_id = (select auth.uid())));
create policy intern_tasks_delete on public.tasks as restrictive for delete to authenticated using (not public.is_intern());

create or replace function public.intern_task_status_only()
returns trigger language plpgsql set search_path = '' as $$
begin
  if public.is_intern() and (to_jsonb(new) - 'status') is distinct from (to_jsonb(old) - 'status') then
    raise exception 'Interns may only update task status';
  end if;
  return new;
end;
$$;
drop trigger if exists intern_task_status_only on public.tasks;
create trigger intern_task_status_only before update on public.tasks for each row execute function public.intern_task_status_only();

create or replace function public.intern_profile_protected_fields()
returns trigger language plpgsql set search_path = '' as $$
begin
  if public.is_intern() and (
    new.role is distinct from old.role
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
drop trigger if exists intern_profile_protected_fields on public.profiles;
create trigger intern_profile_protected_fields before update on public.profiles
for each row execute function public.intern_profile_protected_fields();

create policy intern_meetings_read on public.meetings as restrictive for select to authenticated
  using (not public.is_intern() or (public.intern_access_active() and deleted_at is null and intern_visible));
create policy intern_meetings_insert on public.meetings as restrictive for insert to authenticated
  with check (not public.is_intern());
create policy intern_meetings_update on public.meetings as restrictive for update to authenticated
  using (not public.is_intern()) with check (not public.is_intern());
create policy intern_meetings_delete on public.meetings as restrictive for delete to authenticated using (not public.is_intern());
create policy dpo_insert_intern_meetings on public.meetings as permissive for insert to authenticated
  with check (public.current_role() = 'dpo' and created_by = (select auth.uid()) and intern_visible);
create policy dpo_update_intern_meetings on public.meetings as permissive for update to authenticated
  using (public.current_role() = 'dpo' and created_by = (select auth.uid()) and intern_visible)
  with check (public.current_role() = 'dpo' and created_by = (select auth.uid()) and intern_visible);

create policy intern_agenda_read on public.agenda_items as restrictive for select to authenticated
  using (not public.is_intern() or (public.intern_access_active() and deleted_at is null and exists (
    select 1 from public.meetings m where m.id = meeting_id and m.intern_visible)));
create policy intern_agenda_insert on public.agenda_items as restrictive for insert to authenticated
  with check (not public.is_intern() or (public.intern_access_active() and created_by = (select auth.uid()) and exists (
    select 1 from public.meetings m where m.id = meeting_id and m.intern_visible and m.intern_check_in)));
create policy intern_agenda_update on public.agenda_items as restrictive for update to authenticated
  using (not public.is_intern() or (public.intern_access_active() and created_by = (select auth.uid()) and deleted_at is null and exists (
    select 1 from public.meetings m where m.id = meeting_id and m.intern_visible and m.intern_check_in)))
  with check (not public.is_intern() or (public.intern_access_active() and created_by = (select auth.uid()) and exists (
    select 1 from public.meetings m where m.id = meeting_id and m.intern_visible and m.intern_check_in)));
create policy intern_agenda_delete on public.agenda_items as restrictive for delete to authenticated
  using (not public.is_intern() or (public.intern_access_active() and created_by = (select auth.uid())));

create policy intern_announcements_read on public.announcements as restrictive for select to authenticated
  using (not public.is_intern() or (public.intern_access_active() and deleted_at is null and intern_visible));
create policy intern_announcements_insert on public.announcements as restrictive for insert to authenticated with check (not public.is_intern());
create policy intern_announcements_update on public.announcements as restrictive for update to authenticated
  using (not public.is_intern()) with check (not public.is_intern());
create policy intern_announcements_delete on public.announcements as restrictive for delete to authenticated using (not public.is_intern());
create policy dpo_insert_intern_announcements on public.announcements as permissive for insert to authenticated
  with check (public.current_role() = 'dpo' and author_id = (select auth.uid()) and intern_visible);
create policy dpo_update_intern_announcements on public.announcements as permissive for update to authenticated
  using (public.current_role() = 'dpo' and author_id = (select auth.uid()) and intern_visible)
  with check (public.current_role() = 'dpo' and author_id = (select auth.uid()) and intern_visible);

create policy intern_ack_read on public.announcement_acknowledgements as restrictive for select to authenticated
  using (not public.is_intern() or (public.intern_access_active() and user_id = (select auth.uid()) and exists (
    select 1 from public.announcements a where a.id = announcement_id and a.intern_visible and a.deleted_at is null)));
create policy intern_ack_insert on public.announcement_acknowledgements as restrictive for insert to authenticated
  with check (not public.is_intern() or (public.intern_access_active() and user_id = (select auth.uid()) and exists (
    select 1 from public.announcements a where a.id = announcement_id and a.intern_visible and a.deleted_at is null)));
create policy intern_ack_update on public.announcement_acknowledgements as restrictive for update to authenticated
  using (not public.is_intern() or (public.intern_access_active() and user_id = (select auth.uid())))
  with check (not public.is_intern() or (public.intern_access_active() and user_id = (select auth.uid()) and exists (
    select 1 from public.announcements a where a.id = announcement_id and a.intern_visible and a.deleted_at is null)));
create policy intern_ack_delete on public.announcement_acknowledgements as restrictive for delete to authenticated using (not public.is_intern());

create policy intern_workspace_docs_read on public.workspace_docs as restrictive for select to authenticated
  using (not public.is_intern() or (public.intern_access_active() and deleted_at is null and author_id = (select auth.uid())));
create policy intern_workspace_docs_insert on public.workspace_docs as restrictive for insert to authenticated
  with check (not public.is_intern() or (public.intern_access_active() and author_id = (select auth.uid())
    and (intern_area_id is null or exists (select 1 from public.intern_workspace_areas a where a.id = intern_area_id and a.intern_visible))));
create policy intern_workspace_docs_update on public.workspace_docs as restrictive for update to authenticated
  using (not public.is_intern() or (public.intern_access_active() and author_id = (select auth.uid()) and deleted_at is null))
  with check (not public.is_intern() or (public.intern_access_active() and author_id = (select auth.uid())
    and (intern_area_id is null or exists (select 1 from public.intern_workspace_areas a where a.id = intern_area_id and a.intern_visible))));
create policy intern_workspace_docs_delete on public.workspace_docs as restrictive for delete to authenticated
  using (not public.is_intern() or (public.intern_access_active() and author_id = (select auth.uid())));
create policy intern_workspace_comments_read on public.workspace_comments as restrictive for select to authenticated
  using (not public.is_intern() or (public.intern_access_active() and deleted_at is null and exists (
    select 1 from public.workspace_docs d where d.id = document_id and d.author_id = (select auth.uid()))));
create policy intern_workspace_comments_insert on public.workspace_comments as restrictive for insert to authenticated
  with check (not public.is_intern() or (public.intern_access_active() and author_id = (select auth.uid()) and exists (
    select 1 from public.workspace_docs d where d.id = document_id and d.author_id = (select auth.uid()))));
create policy intern_workspace_comments_update on public.workspace_comments as restrictive for update to authenticated
  using (not public.is_intern()) with check (not public.is_intern());
create policy intern_workspace_comments_delete on public.workspace_comments as restrictive for delete to authenticated
  using (not public.is_intern() or (public.intern_access_active() and author_id = (select auth.uid())));
create policy intern_versions_read on public.workspace_doc_versions as restrictive for select to authenticated
  using (not public.is_intern() or (public.intern_access_active() and exists (
    select 1 from public.workspace_docs d where d.id = document_id and d.author_id = (select auth.uid()))));
create policy intern_versions_insert on public.workspace_doc_versions as restrictive for insert to authenticated
  with check (not public.is_intern() or (public.intern_access_active() and created_by = (select auth.uid()) and exists (
    select 1 from public.workspace_docs d where d.id = document_id and d.author_id = (select auth.uid()))));
create policy intern_versions_update on public.workspace_doc_versions as restrictive for update to authenticated
  using (not public.is_intern()) with check (not public.is_intern());
create policy intern_versions_delete on public.workspace_doc_versions as restrictive for delete to authenticated using (not public.is_intern());

create policy intern_preferences_read on public.user_preferences as restrictive for select to authenticated
  using (not public.is_intern() or (public.intern_access_active() and profile_id = (select auth.uid())));
create policy intern_preferences_insert on public.user_preferences as restrictive for insert to authenticated
  with check (not public.is_intern() or (public.intern_access_active() and profile_id = (select auth.uid())));
create policy intern_preferences_update on public.user_preferences as restrictive for update to authenticated
  using (not public.is_intern() or (public.intern_access_active() and profile_id = (select auth.uid())))
  with check (not public.is_intern() or (public.intern_access_active() and profile_id = (select auth.uid())));
create policy intern_preferences_delete on public.user_preferences as restrictive for delete to authenticated using (not public.is_intern());

create policy intern_storage_read on storage.objects as restrictive for select to authenticated
  using (not public.is_intern() or (public.intern_access_active() and bucket_id = 'documents' and (
    name like ('interns/' || (select auth.uid())::text || '/%') or exists (
      select 1 from public.documents d where d.file_path = storage.objects.name and d.intern_visible
        and d.visibility = 'standard' and d.deleted_at is null))));
create policy intern_storage_insert on storage.objects as restrictive for insert to authenticated
  with check (not public.is_intern() or (public.intern_access_active() and bucket_id = 'documents'
    and name like ('interns/' || (select auth.uid())::text || '/%')));
create policy intern_storage_update on storage.objects as restrictive for update to authenticated
  using (not public.is_intern() or (public.intern_access_active() and bucket_id = 'documents' and name like ('interns/' || (select auth.uid())::text || '/%')))
  with check (not public.is_intern() or (public.intern_access_active() and bucket_id = 'documents' and name like ('interns/' || (select auth.uid())::text || '/%')));
create policy intern_storage_delete on storage.objects as restrictive for delete to authenticated
  using (not public.is_intern() or (public.intern_access_active() and bucket_id = 'documents' and name like ('interns/' || (select auth.uid())::text || '/%')));

-- Inject an in-function guard without replacing the remaining reviewed bodies.
-- The matching source is also documented as five individual diffs for review.
do $$
declare
  signature regprocedure;
  original_definition text;
  guarded_definition text;
begin
  foreach signature in array array[
    'public.archive_owned_content(text,uuid)'::regprocedure,
    'public.sync_meeting_event()'::regprocedure,
    'public.refresh_volunteer_hours_total()'::regprocedure,
    'public.complete_meeting_and_carry_forward(uuid)'::regprocedure,
    'public.generate_hub_rotation(uuid,timestamptz,integer,text,text)'::regprocedure,
    'public.complete_hub_class_session(uuid)'::regprocedure,
    'public.enrol_hub_learner(text,uuid,date,text)'::regprocedure
  ] loop
    original_definition := pg_get_functiondef(signature);
    if position('public.is_intern()' in original_definition) = 0 then
      guarded_definition := regexp_replace(
        original_definition,
        E'\nBEGIN\n',
        E'\nBEGIN\n  if public.is_intern() then raise exception ''Intern access to this operation is denied''; end if;\n',
        'i'
      );
      if guarded_definition = original_definition then
        raise exception 'Could not add the intern guard to %', signature;
      end if;
      execute guarded_definition;
    end if;
  end loop;
end;
$$;

commit;
