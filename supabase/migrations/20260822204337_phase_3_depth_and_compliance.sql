-- Phase 3: document versions, compliance deadlines, and pinned-announcement
-- acknowledgements.

create table if not exists public.workspace_doc_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.workspace_docs(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  content jsonb not null,
  status text not null check (status in ('draft', 'final')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  restore_of_version_id uuid references public.workspace_doc_versions(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (document_id, version_number)
);

create index if not exists idx_workspace_doc_versions_document_created
  on public.workspace_doc_versions(document_id, created_at desc);
create index if not exists idx_workspace_doc_versions_created_by
  on public.workspace_doc_versions(created_by);

alter table public.workspace_doc_versions enable row level security;
drop policy if exists "workspace_doc_versions_read" on public.workspace_doc_versions;
drop policy if exists "workspace_doc_versions_insert" on public.workspace_doc_versions;
create policy "workspace_doc_versions_read" on public.workspace_doc_versions
  for select to authenticated using (
    exists (
      select 1 from public.workspace_docs document
      where document.id = public.workspace_doc_versions.document_id
        and (document.author_id = (select auth.uid())
          or (select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager'))
    )
  );
create policy "workspace_doc_versions_insert" on public.workspace_doc_versions
  for insert to authenticated with check (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.workspace_docs document
      where document.id = public.workspace_doc_versions.document_id
        and (document.author_id = (select auth.uid())
          or (select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager'))
    )
  );

create or replace function public.save_workspace_document(
  p_document_id uuid,
  p_content jsonb,
  p_status text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_document public.workspace_docs%rowtype;
  v_version_id uuid;
  v_version integer;
  v_status text;
begin
  if v_actor is null then raise exception 'You must be signed in'; end if;
  if p_content is null then raise exception 'Document content is required'; end if;
  select * into v_document from public.workspace_docs where id = p_document_id and deleted_at is null for update;
  if v_document.id is null then raise exception 'Document not found'; end if;
  if v_document.author_id <> v_actor
    and coalesce((select role from public.profiles where id = v_actor), '') not in ('admin', 'manager') then
    raise exception 'You cannot edit this document';
  end if;
  v_status := coalesce(p_status, v_document.status);
  if v_status not in ('draft', 'final') then raise exception 'Invalid document status'; end if;
  select coalesce(max(version_number), 0) + 1 into v_version
  from public.workspace_doc_versions where document_id = p_document_id;
  insert into public.workspace_doc_versions (document_id, version_number, content, status, created_by)
  values (p_document_id, v_version, p_content, v_status, v_actor)
  returning id into v_version_id;
  update public.workspace_docs
  set content = p_content, status = v_status, updated_at = now()
  where id = p_document_id;
  return v_version_id;
end;
$$;

create or replace function public.restore_workspace_document_version(p_version_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_source public.workspace_doc_versions%rowtype;
  v_document public.workspace_docs%rowtype;
  v_new_id uuid;
  v_version integer;
begin
  if v_actor is null then raise exception 'You must be signed in'; end if;
  select * into v_source from public.workspace_doc_versions where id = p_version_id;
  if v_source.id is null then raise exception 'Version not found'; end if;
  select * into v_document from public.workspace_docs where id = v_source.document_id and deleted_at is null for update;
  if v_document.id is null then raise exception 'Document not found'; end if;
  if v_document.author_id <> v_actor
    and coalesce((select role from public.profiles where id = v_actor), '') not in ('admin', 'manager') then
    raise exception 'You cannot restore this document';
  end if;
  select coalesce(max(version_number), 0) + 1 into v_version
  from public.workspace_doc_versions where document_id = v_source.document_id;
  insert into public.workspace_doc_versions (document_id, version_number, content, status, created_by, restore_of_version_id)
  values (v_source.document_id, v_version, v_source.content, v_source.status, v_actor, v_source.id)
  returning id into v_new_id;
  update public.workspace_docs
  set content = v_source.content, status = v_source.status, updated_at = now()
  where id = v_source.document_id;
  return v_new_id;
end;
$$;

alter table public.dpo_incidents add column if not exists status text not null default 'open';
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'dpo_incidents_status_check'
      and conrelid = 'public.dpo_incidents'::regclass
  ) then
    alter table public.dpo_incidents add constraint dpo_incidents_status_check
      check (status in ('open', 'contained', 'resolved'));
  end if;
end $$;
create index if not exists idx_dpo_incidents_open_severity
  on public.dpo_incidents(status, severity, occurred_at) where status <> 'resolved';
create index if not exists idx_data_subject_requests_open_received
  on public.data_subject_requests(status, received_at) where status in ('open', 'in_progress');
drop policy if exists "dpo_incidents_update" on public.dpo_incidents;
create policy "dpo_incidents_update" on public.dpo_incidents
  for update to authenticated
  using ((select role from public.profiles where id = (select auth.uid())) in ('admin', 'dpo'))
  with check ((select role from public.profiles where id = (select auth.uid())) in ('admin', 'dpo'));

create table if not exists public.announcement_acknowledgements (
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  acknowledged_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

create index if not exists idx_announcement_acknowledgements_user
  on public.announcement_acknowledgements(user_id, acknowledged_at desc);

alter table public.announcement_acknowledgements enable row level security;
drop policy if exists "announcement_acknowledgements_read" on public.announcement_acknowledgements;
drop policy if exists "announcement_acknowledgements_insert_own" on public.announcement_acknowledgements;
drop policy if exists "announcement_acknowledgements_update_own" on public.announcement_acknowledgements;
create policy "announcement_acknowledgements_read" on public.announcement_acknowledgements
  for select to authenticated using (
    user_id = (select auth.uid())
    or (select role from public.profiles where id = (select auth.uid())) = 'admin'
  );
create policy "announcement_acknowledgements_insert_own" on public.announcement_acknowledgements
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "announcement_acknowledgements_update_own" on public.announcement_acknowledgements
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert on public.workspace_doc_versions to authenticated;
grant execute on function public.save_workspace_document(uuid, jsonb, text) to authenticated;
grant execute on function public.restore_workspace_document_version(uuid) to authenticated;
grant select, insert, update on public.dpo_incidents to authenticated;
grant select, insert, update on public.announcement_acknowledgements to authenticated;

notify pgrst, 'reload schema';
