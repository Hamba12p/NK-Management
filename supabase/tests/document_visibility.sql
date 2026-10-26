-- Run only in an empty disposable PostgreSQL database:
-- psql -X -v ON_ERROR_STOP=1 -f supabase/tests/document_visibility.sql
-- Minimal Supabase auth/Storage fixtures; this is not a live Storage API test.
create role authenticated nologin;
create role anon nologin;
create schema auth;
create schema storage;
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as
  $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create table public.profiles (id uuid primary key, role text);
create table public.documents (
  id uuid primary key default gen_random_uuid(), name text,
  intern_visible boolean not null default false,
  file_path text, deleted_at timestamptz, uploaded_by uuid
);
create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
alter table public.profiles enable row level security;
alter table public.documents enable row level security;
alter table storage.objects enable row level security;
create policy profiles_read_all on public.profiles for select to authenticated using (true);
create policy documents_read_active on public.documents for select to authenticated using (deleted_at is null);
create policy documents_insert_own on public.documents for insert to authenticated
  with check (auth.uid() = uploaded_by);
create policy documents_update_active on public.documents for update to authenticated
  using (deleted_at is null and (auth.uid() = uploaded_by or (select role from public.profiles where id = auth.uid()) = 'admin'))
  with check (deleted_at is null and (auth.uid() = uploaded_by or (select role from public.profiles where id = auth.uid()) = 'admin'));
create policy storage_authenticated_read_documents on storage.objects for select to authenticated
  using (bucket_id = 'documents' and auth.uid() is not null
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false);
create function public.is_intern() returns boolean language sql stable as
  $$ select coalesce((select role from public.profiles where id = auth.uid()) = 'intern', false) $$;
create function public.intern_access_active() returns boolean language sql stable as
  $$ select true $$;
grant usage on schema public, auth, storage to authenticated, anon;
grant select on public.profiles, public.documents, storage.objects to authenticated, anon;
insert into public.documents (name, file_path) values ('Existing document', 'standard.pdf');
create temp table original_write_policies as
  select policyname, cmd, qual, with_check from pg_policies
  where schemaname = 'public' and tablename = 'documents' and cmd <> 'SELECT';

\ir ../migrations/20260922170751_restrict_document_visibility.sql
\ir ../migrations/20261026140000_document_individual_assignments.sql

do $$ begin
  if (select visibility from public.documents where file_path = 'standard.pdf') <> 'standard' then
    raise exception 'Existing row default changed';
  end if;
  if exists (
    (select * from original_write_policies except
      select policyname, cmd, qual, with_check from pg_policies
      where schemaname = 'public' and tablename = 'documents' and cmd <> 'SELECT')
  ) then raise exception 'Write policies changed'; end if;
  begin
    insert into public.documents (visibility) values ('invalid');
    raise exception 'Invalid visibility accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.documents (visibility) values (null);
    raise exception 'Null visibility accepted';
  exception when not_null_violation then null;
  end;
end $$;
insert into public.documents (file_path, visibility, deleted_at) values
  ('restricted.pdf', 'restricted', null),
  ('deleted-standard.pdf', 'standard', now()),
  ('deleted-restricted.pdf', 'restricted', now());
insert into storage.objects (bucket_id, name)
  select 'documents', file_path from public.documents;
insert into storage.objects (bucket_id, name) values
  ('documents', 'orphan.pdf'), ('other-bucket', 'standard.pdf');
insert into public.profiles values ('00000000-0000-0000-0000-000000000001', 'admin');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);

do $$
declare test_role text; expected_count integer; actual_count integer;
begin
  foreach test_role in array array['admin', 'board_advisor', 'manager', 'dpo',
    'volunteer', 'volunteer_senior', 'volunteer_lead', 'unknown'] loop
    update public.profiles set role = test_role;
    expected_count := case when test_role in ('admin', 'board_advisor') then 2 else 1 end;
    set local role authenticated;
    select count(*) into actual_count from public.documents;
    if actual_count <> expected_count then raise exception 'Document leak/denial: % (% rows)', test_role, actual_count; end if;
    select count(*) into actual_count from storage.objects;
    if actual_count <> expected_count then raise exception 'Storage leak/denial: % (% rows)', test_role, actual_count; end if;
    reset role;
  end loop;
  delete from public.profiles;
  set local role authenticated;
  if (select count(*) from public.documents) <> 1 or (select count(*) from storage.objects) <> 1 then
    raise exception 'Missing profile must only see standard documents';
  end if;
  perform set_config('request.jwt.claims', '{"is_anonymous":true}', true);
  if exists (select from storage.objects) then raise exception 'Anonymous sign-in Storage leak'; end if;
  reset role;
  set local role anon;
  if exists (select from public.documents) or exists (select from storage.objects) then
    raise exception 'Unauthenticated read leak';
  end if;
  reset role;
end $$;

insert into public.profiles values
  ('00000000-0000-0000-0000-000000000002', 'volunteer'),
  ('00000000-0000-0000-0000-000000000003', 'volunteer'),
  ('00000000-0000-0000-0000-000000000004', 'intern');
insert into public.documents (name, file_path, uploaded_by, assigned_to) values
  ('Assigned document', 'assigned.pdf', '00000000-0000-0000-0000-000000000001',
   array['00000000-0000-0000-0000-000000000002'::uuid]),
  ('Assigned intern document', 'assigned-intern.pdf', '00000000-0000-0000-0000-000000000001',
   array['00000000-0000-0000-0000-000000000004'::uuid]),
  ('Assigned restricted document', 'assigned-restricted.pdf', '00000000-0000-0000-0000-000000000001',
   array['00000000-0000-0000-0000-000000000002'::uuid]);
update public.documents set visibility = 'restricted' where file_path = 'assigned-restricted.pdf';
insert into storage.objects (bucket_id, name) values
  ('documents', 'assigned.pdf'), ('documents', 'assigned-intern.pdf'), ('documents', 'assigned-restricted.pdf');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
set role authenticated;
do $$ begin
  if not exists (select from public.documents where file_path = 'assigned.pdf') then
    raise exception 'Assigned individual cannot read assigned document';
  end if;
  if not exists (select from storage.objects where name = 'assigned.pdf') then
    raise exception 'Assigned individual cannot read assigned file';
  end if;
  if not exists (select from public.documents where file_path = 'assigned-restricted.pdf')
    or not exists (select from storage.objects where name = 'assigned-restricted.pdf') then
    raise exception 'Assigned individual cannot read assigned restricted evidence';
  end if;
  if exists (select from public.documents where file_path = 'assigned-intern.pdf') then
    raise exception 'Unassigned individual can read another person''s document';
  end if;
end $$;
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', false);
set role authenticated;
do $$ begin
  if exists (select from public.documents where file_path = 'assigned.pdf')
    or exists (select from storage.objects where name = 'assigned.pdf')
    or exists (select from public.documents where file_path = 'assigned-restricted.pdf')
    or exists (select from storage.objects where name = 'assigned-restricted.pdf') then
    raise exception 'Unassigned individual can read assigned document or file';
  end if;
  if not exists (select from public.documents where file_path = 'standard.pdf') then
    raise exception 'Unassigned document is not available to everyone';
  end if;
end $$;
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', false);
set role authenticated;
do $$ begin
  if not exists (select from public.documents where file_path = 'assigned-intern.pdf')
    or not exists (select from storage.objects where name = 'assigned-intern.pdf') then
    raise exception 'Assigned intern cannot read assigned document and file';
  end if;
end $$;
reset role;

do $$ begin
  begin
    insert into public.documents (name, file_path, assigned_to)
    values ('Invalid assignee', 'invalid-assignee.pdf', array['ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid]);
    raise exception 'Invalid document assignee accepted';
  exception when raise_exception then
    if sqlerrm = 'Invalid document assignee accepted' then raise; end if;
  end;
end $$;

select 'PASS: assignments, unassigned access, restricted assignees, intern access, visibility constraints, soft deletion, and storage access' as result;
