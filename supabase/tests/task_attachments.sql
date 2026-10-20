-- Run only in an empty disposable PostgreSQL database:
-- psql -X -v ON_ERROR_STOP=1 -f supabase/tests/task_attachments.sql
create role authenticated nologin;
create schema auth;
create schema storage;
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table public.profiles (id uuid primary key, role text);
create table public.tasks (
  id uuid primary key,
  created_by uuid not null,
  assignee_id uuid,
  deleted_at timestamptz
);
create table storage.objects (bucket_id text, name text);

insert into public.profiles values
  ('00000000-0000-4000-8000-000000000001', 'manager'),
  ('00000000-0000-4000-8000-000000000002', 'volunteer'),
  ('00000000-0000-4000-8000-000000000003', 'volunteer');
insert into public.tasks values
  ('10000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002', null);

alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table storage.objects enable row level security;
create policy profiles_read_authenticated on public.profiles
  for select to authenticated using (true);
create policy tasks_read_authenticated on public.tasks
  for select to authenticated using (true);
grant usage on schema public, auth, storage to authenticated;
grant select on public.profiles, public.tasks, storage.objects to authenticated;

\ir ../migrations/20261020230000_task_attachments.sql

begin;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
set local role authenticated;
insert into public.task_attachments (
  task_id, file_name, file_path, file_size, mime_type, uploaded_by
) values (
  '10000000-0000-4000-8000-000000000001',
  'work.pdf',
  '10000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000002/work.pdf',
  128,
  'application/pdf',
  '00000000-0000-4000-8000-000000000002'
);
insert into storage.objects (bucket_id, name) values (
  'documents',
  '10000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000002/work.pdf'
);
select 1 / case when count(*) = 1 then 1 else 0 end as assignee_can_read
from public.task_attachments;
select 1 / case when count(*) = 1 then 1 else 0 end as assignee_can_read_storage
from storage.objects;
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select 1 / case when count(*) = 1 then 1 else 0 end as assigner_can_read
from public.task_attachments;
select 1 / case when count(*) = 1 then 1 else 0 end as assigner_can_read_storage
from storage.objects;
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
set local role authenticated;
select 1 / case when count(*) = 0 then 1 else 0 end as unrelated_user_cannot_read
from public.task_attachments;
select 1 / case when count(*) = 0 then 1 else 0 end as unrelated_user_cannot_read_storage
from storage.objects;
reset role;
rollback;

select 'PASS: assignee upload, assignee/assigner access, unrelated user denied' as result;
