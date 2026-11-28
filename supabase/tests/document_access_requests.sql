-- Run only in an empty disposable PostgreSQL database:
-- psql -X -v ON_ERROR_STOP=1 -f supabase/tests/document_access_requests.sql
create role authenticated nologin;
create role anon nologin;
create schema auth;
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create table public.profiles (
  id uuid primary key,
  role text not null,
  full_name text not null
);
create table public.documents (
  id uuid primary key,
  name text not null,
  file_path text not null,
  visibility text not null,
  assigned_to uuid[] not null default '{}',
  uploaded_by uuid,
  intern_visible boolean not null default false,
  deleted_at timestamptz
);
create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  action_type text not null,
  resource_type text not null,
  resource_id uuid,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create function public.intern_access_active() returns boolean
language sql stable security definer set search_path = ''
as $$ select true $$;

alter table public.profiles enable row level security;
create policy profiles_read_authenticated on public.profiles
  for select to authenticated using (true);
grant usage on schema public, auth to authenticated, anon;
grant select on public.profiles, public.documents, public.activity_log to authenticated, anon;

insert into public.profiles (id, role, full_name) values
  ('00000000-0000-0000-0000-000000000001', 'admin', 'Admin User'),
  ('00000000-0000-0000-0000-000000000002', 'volunteer', 'Requesting User'),
  ('00000000-0000-0000-0000-000000000003', 'volunteer', 'Other User');
insert into public.documents (id, name, file_path, visibility, uploaded_by) values
  ('00000000-0000-0000-0000-000000000011', 'Restricted Report', 'report.pdf', 'restricted',
   '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000012', 'Another Report', 'other.pdf', 'restricted',
   '00000000-0000-0000-0000-000000000001');

\ir ../migrations/20261128110000_document_access_requests.sql

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
set role authenticated;
do $$
declare first_request jsonb; repeated_request jsonb;
begin
  first_request := public.request_document_access(
    '00000000-0000-0000-0000-000000000011', 'Needed for the assigned task'
  );
  repeated_request := public.request_document_access(
    '00000000-0000-0000-0000-000000000011', 'Needed for the assigned task'
  );
  if first_request->>'id' <> repeated_request->>'id'
    or first_request->>'status' <> 'pending' then
    raise exception 'A repeated request did not reuse the existing pending request';
  end if;
  if (select count(*) from public.document_access_requests) <> 1
    or (select count(*) from public.activity_log where action_type = 'document_access_requested') <> 1 then
    raise exception 'A request or its audit event was duplicated';
  end if;
  if (select count(*) from public.document_access_requests) <> 1 then
    raise exception 'Requester cannot read their request';
  end if;
end $$;
do $$ begin
  begin
    perform public.review_document_access_request(
      (select id from public.document_access_requests limit 1), true
    );
    raise exception 'A non-admin reviewed an access request';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', false);
set role authenticated;
do $$ begin
  if exists (select from public.document_access_requests) then
    raise exception 'A requester can read another user''s request';
  end if;
end $$;
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
set role authenticated;
do $$
declare request_id uuid;
begin
  select id into request_id from public.document_access_requests limit 1;
  perform public.review_document_access_request(request_id, true);
  if not exists (
    select from public.documents
    where id = '00000000-0000-0000-0000-000000000011'
      and '00000000-0000-0000-0000-000000000002'::uuid = any(assigned_to)
  ) then
    raise exception 'Approval did not grant access only to the requester';
  end if;
  if not exists (
    select from public.document_access_requests
    where id = request_id and status = 'approved'
      and reviewed_by = '00000000-0000-0000-0000-000000000001'
      and access_code ~ '^[A-F0-9]{8}$'
  ) then
    raise exception 'Approval state or generated request code was not recorded';
  end if;
  if not exists (
    select from public.activity_log
    where action_type = 'document_access_granted'
      and resource_id = '00000000-0000-0000-0000-000000000011'
      and details->>'requester_id' = '00000000-0000-0000-0000-000000000002'
      and details->>'reviewer_id' = '00000000-0000-0000-0000-000000000001'
  ) then
    raise exception 'Approval audit record is missing requester or reviewer details';
  end if;
end $$;
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
set role authenticated;
select public.request_document_access(
  '00000000-0000-0000-0000-000000000012', 'Second document request'
);
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
set role authenticated;
do $$
declare request_id uuid;
begin
  select id into request_id from public.document_access_requests
  where document_id = '00000000-0000-0000-0000-000000000012';
  perform public.review_document_access_request(request_id, false);
  if exists (
    select from public.documents
    where id = '00000000-0000-0000-0000-000000000012'
      and '00000000-0000-0000-0000-000000000002'::uuid = any(assigned_to)
  ) then
    raise exception 'Denial unexpectedly granted document access';
  end if;
  if not exists (
    select from public.activity_log
    where action_type = 'document_access_denied'
      and resource_id = '00000000-0000-0000-0000-000000000012'
  ) then
    raise exception 'Denial audit record is missing';
  end if;
end $$;
reset role;

select 'PASS: request deduplication, requester isolation, admin-only review, targeted grants, generated codes, and immutable audit events' as result;
