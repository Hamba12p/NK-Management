-- NK Udada Hub — full schema, verified against the actual repo source
-- (Docs/PHASE_1 through PHASE_6, cross-checked against src/lib/activity.ts
-- and the .insert() calls in documents/meetings/announcements pages).
-- Safe to run once, top to bottom, on an empty Supabase project.

-- ============================================================
-- PHASE 1: PROFILES
-- ============================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  role        text not null default 'volunteer',
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

do $$
declare item record;
begin
  for item in select conname from pg_constraint where conrelid = 'public.profiles'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%role%' loop
    execute format('alter table public.profiles drop constraint %I', item.conname);
  end loop;
end $$;

alter table public.profiles add constraint profiles_role_check
  check (role in ('admin', 'manager', 'dpo', 'volunteer', 'volunteer_senior', 'volunteer_lead'));

alter table public.profiles enable row level security;
drop policy if exists "profiles_read_authenticated" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_read_authenticated" on public.profiles for select to authenticated using (true);
create policy "profiles_update_own" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id and role = (select role from public.profiles where id = auth.uid()));
create policy "profiles_admin_update" on public.profiles for update to authenticated using ((select role from public.profiles where id = auth.uid()) = 'admin');

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    case when new.raw_user_meta_data->>'role' in ('admin', 'manager', 'dpo', 'volunteer', 'volunteer_senior', 'volunteer_lead')
      then new.raw_user_meta_data->>'role' else 'volunteer' end
  ) on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ============================================================
-- PHASE 3: DOCUMENTS
-- ============================================================
create table if not exists public.documents (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(name) > 0),
  description  text check (char_length(description) < 500),
  file_path    text not null,
  file_size    bigint not null,
  mime_type    text not null,
  category     text not null default 'general' check (category in ('general', 'policy', 'report', 'template', 'meeting')),
  uploaded_by  uuid not null references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists idx_documents_uploaded_by on public.documents(uploaded_by);
create index if not exists idx_documents_created_at on public.documents(created_at desc);

alter table public.documents enable row level security;
drop policy if exists "documents_read_all" on public.documents;
drop policy if exists "documents_insert_own" on public.documents;
drop policy if exists "documents_update" on public.documents;
drop policy if exists "documents_delete" on public.documents;
create policy "documents_read_all" on public.documents for select to authenticated using (true);
create policy "documents_insert_own" on public.documents for insert to authenticated with check (auth.uid() = uploaded_by);
create policy "documents_update" on public.documents for update to authenticated using (auth.uid() = uploaded_by or (select role from public.profiles where id = auth.uid()) = 'admin');
create policy "documents_delete" on public.documents for delete to authenticated using (auth.uid() = uploaded_by or (select role from public.profiles where id = auth.uid()) = 'admin');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 52428800, array[
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg', 'image/png', 'image/webp'
]) on conflict (id) do nothing;

drop policy if exists "storage_authenticated_read" on storage.objects;
drop policy if exists "storage_authenticated_insert" on storage.objects;
drop policy if exists "storage_delete_own" on storage.objects;
create policy "storage_authenticated_read" on storage.objects for select to authenticated using (bucket_id = 'documents');
create policy "storage_authenticated_insert" on storage.objects for insert to authenticated with check (bucket_id = 'documents');
-- owner is uuid in current Supabase projects; compare directly, no ::text cast
create policy "storage_delete_own" on storage.objects for delete to authenticated using (bucket_id = 'documents' and auth.uid() = owner);

-- ============================================================
-- PHASE 4: MEETINGS + AGENDA ITEMS
-- ============================================================
create table if not exists public.meetings (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (char_length(title) between 3 and 200),
  description  text check (char_length(description) < 2000),
  scheduled_at timestamptz not null,
  duration_min integer not null default 60 check (duration_min between 15 and 480),
  location     text check (char_length(location) < 300),
  status       text not null default 'upcoming' check (status in ('upcoming', 'in_progress', 'completed', 'cancelled')),
  created_by   uuid not null references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists idx_meetings_scheduled_at on public.meetings(scheduled_at desc);
create index if not exists idx_meetings_created_by on public.meetings(created_by);
create index if not exists idx_meetings_status on public.meetings(status);

alter table public.meetings enable row level security;
drop policy if exists "meetings_read_all" on public.meetings;
drop policy if exists "meetings_insert_authorized" on public.meetings;
drop policy if exists "meetings_update" on public.meetings;
drop policy if exists "meetings_delete" on public.meetings;
create policy "meetings_read_all" on public.meetings for select to authenticated using (true);
create policy "meetings_insert_authorized" on public.meetings for insert to authenticated with check ((select role from public.profiles where id = auth.uid()) in ('admin', 'manager') and auth.uid() = created_by);
create policy "meetings_update" on public.meetings for update to authenticated using (auth.uid() = created_by or (select role from public.profiles where id = auth.uid()) in ('admin', 'manager'));
create policy "meetings_delete" on public.meetings for delete to authenticated using (auth.uid() = created_by or (select role from public.profiles where id = auth.uid()) = 'admin');

create table if not exists public.agenda_items (
  id          uuid primary key default gen_random_uuid(),
  meeting_id  uuid not null references public.meetings(id) on delete cascade,
  content     text not null check (char_length(content) between 1 and 1000),
  order_index integer not null default 0,
  presenter   uuid references public.profiles(id) on delete set null,
  done        boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists idx_agenda_items_meeting_id on public.agenda_items(meeting_id);
create index if not exists idx_agenda_items_order on public.agenda_items(meeting_id, order_index);

alter table public.agenda_items enable row level security;
drop policy if exists "agenda_items_read" on public.agenda_items;
drop policy if exists "agenda_items_insert" on public.agenda_items;
drop policy if exists "agenda_items_update" on public.agenda_items;
drop policy if exists "agenda_items_delete" on public.agenda_items;
create policy "agenda_items_read" on public.agenda_items for select to authenticated using (true);
create policy "agenda_items_insert" on public.agenda_items for insert to authenticated with check (true);
create policy "agenda_items_update" on public.agenda_items for update to authenticated using (true) with check (true);
create policy "agenda_items_delete" on public.agenda_items for delete to authenticated using ((select created_by from public.meetings where id = meeting_id) = auth.uid() or (select role from public.profiles where id = auth.uid()) = 'admin');

-- ============================================================
-- PHASE 5: ANNOUNCEMENTS
-- ============================================================
create table if not exists public.announcements (
  id         uuid primary key default gen_random_uuid(),
  title      text not null check (char_length(title) between 3 and 200),
  body       text not null check (char_length(body) between 1 and 5000),
  pinned     boolean not null default false,
  author_id  uuid not null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_announcements_pinned on public.announcements(pinned desc, created_at desc);
create index if not exists idx_announcements_author_id on public.announcements(author_id);
create index if not exists idx_announcements_created_at on public.announcements(created_at desc);

alter table public.announcements enable row level security;
drop policy if exists "announcements_read_all" on public.announcements;
drop policy if exists "announcements_insert_authorized" on public.announcements;
drop policy if exists "announcements_update" on public.announcements;
drop policy if exists "announcements_delete" on public.announcements;
create policy "announcements_read_all" on public.announcements for select to authenticated using (true);
create policy "announcements_insert_authorized" on public.announcements for insert to authenticated with check ((select role from public.profiles where id = auth.uid()) in ('admin', 'manager') and auth.uid() = author_id);
create policy "announcements_update" on public.announcements for update to authenticated using (auth.uid() = author_id or (select role from public.profiles where id = auth.uid()) = 'admin');
create policy "announcements_delete" on public.announcements for delete to authenticated using (auth.uid() = author_id or (select role from public.profiles where id = auth.uid()) = 'admin');

-- ============================================================
-- PHASE 6: ACTIVITY LOG
-- Matches src/lib/activity.ts (actor_id/action/target_type/target_id/meta),
-- the file actually wired into Sidebar.tsx, auth/callback, meetings,
-- announcements, documents — not the older naming in PHASE_6_SETUP.md.
-- Uses user_id/action_type/resource_type/details, matching src/lib/activity.ts.
-- ============================================================
create table if not exists public.activity_log (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references public.profiles(id) on delete set null,
  action_type   text not null check (char_length(action_type) between 1 and 100),
  resource_type text not null check (char_length(resource_type) between 1 and 100),
  resource_id   uuid,
  details       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists idx_activity_log_user_id on public.activity_log(user_id);
create index if not exists idx_activity_log_action_type on public.activity_log(action_type);
create index if not exists idx_activity_log_created_at on public.activity_log(created_at desc);

alter table public.activity_log enable row level security;
drop policy if exists "activity_log_read_compliance" on public.activity_log;
drop policy if exists "activity_log_insert_authenticated" on public.activity_log;
drop policy if exists "activity_log_deny_all_updates" on public.activity_log;
drop policy if exists "activity_log_deny_all_deletes" on public.activity_log;
create policy "activity_log_read_compliance" on public.activity_log for select to authenticated using ((select role from public.profiles where id = auth.uid()) in ('admin', 'dpo'));
create policy "activity_log_insert_authenticated" on public.activity_log for insert to authenticated with check (auth.uid() = user_id);
create policy "activity_log_deny_all_updates" on public.activity_log for update to authenticated using (false);
create policy "activity_log_deny_all_deletes" on public.activity_log for delete to authenticated using (false);

-- ============================================================
-- DPO MODULES
-- ============================================================
create table if not exists public.processing_activities (
  id uuid primary key default gen_random_uuid(),
  activity_name text not null check (char_length(activity_name) between 3 and 200),
  personal_data text not null,
  purpose text not null,
  storage_location text not null,
  created_by uuid not null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.data_subject_requests (
  id uuid primary key default gen_random_uuid(),
  requester text not null,
  request_type text not null check (request_type in ('access', 'deletion', 'correction')),
  received_at date not null default current_date,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'rejected')),
  resolution_notes text,
  created_by uuid not null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.dpo_incidents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  occurred_at timestamptz not null,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  description text not null,
  containment_notes text,
  reported_by uuid not null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.processing_activities enable row level security;
alter table public.data_subject_requests enable row level security;
alter table public.dpo_incidents enable row level security;
create policy "dpo_processing_access" on public.processing_activities for all to authenticated using ((select role from public.profiles where id = auth.uid()) in ('admin', 'dpo')) with check ((select role from public.profiles where id = auth.uid()) in ('admin', 'dpo'));
create policy "dpo_requests_access" on public.data_subject_requests for all to authenticated using ((select role from public.profiles where id = auth.uid()) in ('admin', 'dpo')) with check ((select role from public.profiles where id = auth.uid()) in ('admin', 'dpo'));
create policy "dpo_incidents_read" on public.dpo_incidents for select to authenticated using ((select role from public.profiles where id = auth.uid()) in ('admin', 'dpo'));
create policy "dpo_incidents_append" on public.dpo_incidents for insert to authenticated with check (auth.uid() = reported_by and (select role from public.profiles where id = auth.uid()) in ('admin', 'dpo'));

-- ============================================================
-- WORKSPACE (docs, comments, tasks — the email replacement)
-- ============================================================
create table if not exists public.workspace_docs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  author_id uuid not null references public.profiles(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'final')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.workspace_comments (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.workspace_docs(id) on delete cascade,
  parent_id uuid references public.workspace_comments(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  author_id uuid not null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  assignee_id uuid references public.profiles(id) on delete set null,
  assignee_label text,
  due_date date,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  linked_doc_id uuid references public.workspace_docs(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (assignee_id is not null or assignee_label is not null)
);
alter table public.workspace_docs enable row level security;
alter table public.workspace_comments enable row level security;
alter table public.tasks enable row level security;
create policy "workspace_docs_read" on public.workspace_docs for select to authenticated using (true);
create policy "workspace_docs_create" on public.workspace_docs for insert to authenticated with check (auth.uid() = author_id);
create policy "workspace_docs_update" on public.workspace_docs for update to authenticated using (author_id = auth.uid() or (select role from public.profiles where id = auth.uid()) in ('admin', 'manager')) with check (author_id = auth.uid() or (select role from public.profiles where id = auth.uid()) in ('admin', 'manager'));
create policy "workspace_comments_read" on public.workspace_comments for select to authenticated using (true);
create policy "workspace_comments_create" on public.workspace_comments for insert to authenticated with check (auth.uid() = author_id);
create policy "workspace_comments_delete_own" on public.workspace_comments for delete to authenticated using (author_id = auth.uid() or (select role from public.profiles where id = auth.uid()) in ('admin', 'manager'));
create policy "tasks_read" on public.tasks for select to authenticated using (true);
create policy "tasks_manage" on public.tasks for all to authenticated using ((select role from public.profiles where id = auth.uid()) in ('admin', 'manager')) with check ((select role from public.profiles where id = auth.uid()) in ('admin', 'manager'));

-- ============================================================
-- REALTIME
-- ============================================================
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'documents') then alter publication supabase_realtime add table public.documents; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'meetings') then alter publication supabase_realtime add table public.meetings; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'agenda_items') then alter publication supabase_realtime add table public.agenda_items; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'announcements') then alter publication supabase_realtime add table public.announcements; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'activity_log') then alter publication supabase_realtime add table public.activity_log; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'workspace_comments') then alter publication supabase_realtime add table public.workspace_comments; end if;
end $$;

notify pgrst, 'reload schema';
