begin;

create table public.document_access_requests (
  id uuid primary key default gen_random_uuid(),
  access_code text not null unique check (access_code ~ '^[A-F0-9]{8}$'),
  document_id uuid not null references public.documents(id) on delete cascade,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint document_access_requests_review_state_check check (
    (status = 'pending' and reviewed_by is null and reviewed_at is null)
    or (status <> 'pending' and reviewed_by is not null and reviewed_at is not null)
  )
);

create unique index document_access_requests_one_pending_per_user
  on public.document_access_requests (document_id, requester_id)
  where status = 'pending';
create index document_access_requests_created_at
  on public.document_access_requests (created_at desc);

alter table public.document_access_requests enable row level security;
create policy document_access_requests_read_requester_or_admin
  on public.document_access_requests
  for select to authenticated
  using (
    requester_id = (select auth.uid())
    or (select role from public.profiles where id = (select auth.uid())) = 'admin'
  );
grant select on public.document_access_requests to authenticated;

create or replace function public.request_document_access(
  p_document_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_requester_id uuid := (select auth.uid());
  v_requester_role text;
  v_requester_name text;
  v_reason text := coalesce(nullif(btrim(p_reason), ''), 'Requested from chat attachment');
  v_document public.documents%rowtype;
  v_request public.document_access_requests%rowtype;
  v_code text;
  v_attempt integer;
  v_already_accessible boolean;
begin
  if v_requester_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if char_length(v_reason) > 500 then
    raise exception 'Request details must be 500 characters or fewer' using errcode = '22023';
  end if;

  select profile.role, profile.full_name
  into v_requester_role, v_requester_name
  from public.profiles as profile
  where profile.id = v_requester_id;
  if not found then
    raise exception 'Unable to verify requester profile' using errcode = '28000';
  end if;
  if v_requester_role = 'intern' and not public.intern_access_active() then
    raise exception 'Your access is not currently active' using errcode = '42501';
  end if;

  select document.*
  into v_document
  from public.documents as document
  where document.id = p_document_id
    and document.deleted_at is null;
  if not found then
    raise exception 'Document is unavailable' using errcode = 'P0002';
  end if;

  if v_requester_role = 'intern' then
    v_already_accessible :=
      (v_document.uploaded_by = v_requester_id
        and v_document.file_path like ('interns/' || v_requester_id::text || '/%'))
      or (v_document.intern_visible and v_document.visibility = 'standard')
      or v_requester_id = any(v_document.assigned_to);
  else
    v_already_accessible :=
      (v_document.visibility = 'standard'
        and (
          cardinality(v_document.assigned_to) = 0
          or v_requester_id = any(v_document.assigned_to)
          or v_document.uploaded_by = v_requester_id
          or v_requester_role in ('admin', 'board_advisor')
        ))
      or (v_document.visibility = 'restricted'
        and (
          v_requester_id = any(v_document.assigned_to)
          or v_requester_role in ('admin', 'board_advisor')
        ));
  end if;
  if v_already_accessible then
    raise exception 'You already have access to this document' using errcode = 'P0001';
  end if;

  for v_attempt in 1..10 loop
    v_code := substr(replace(upper(gen_random_uuid()::text), '-', ''), 1, 8);
    begin
      insert into public.document_access_requests (
        access_code, document_id, requester_id, reason
      )
      values (v_code, p_document_id, v_requester_id, v_reason)
      on conflict (document_id, requester_id) where status = 'pending' do nothing
      returning * into v_request;
    exception when unique_violation then
      continue;
    end;

    if found then
      insert into public.activity_log (
        user_id, action_type, resource_type, resource_id, details
      )
      values (
        v_requester_id,
        'document_access_requested',
        'document',
        p_document_id,
        jsonb_build_object(
          'request_id', v_request.id,
          'request_code', v_request.access_code,
          'document_name', v_document.name,
          'requester_id', v_requester_id,
          'requester_name', v_requester_name,
          'reason', v_reason
        )
      );
      return jsonb_build_object('id', v_request.id, 'status', v_request.status);
    end if;

    select request.*
    into v_request
    from public.document_access_requests as request
    where request.document_id = p_document_id
      and request.requester_id = v_requester_id
      and request.status = 'pending';
    if found then
      return jsonb_build_object('id', v_request.id, 'status', v_request.status);
    end if;
  end loop;

  raise exception 'Unable to create an access request code' using errcode = 'P0001';
end;
$$;

create or replace function public.review_document_access_request(
  p_request_id uuid,
  p_approve boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reviewer_id uuid := (select auth.uid());
  v_reviewer_name text;
  v_request public.document_access_requests%rowtype;
  v_document_name text;
begin
  if v_reviewer_id is null
    or not exists (
      select 1 from public.profiles as profile
      where profile.id = v_reviewer_id and profile.role = 'admin'
    ) then
    raise exception 'Only administrators can review document access requests' using errcode = '42501';
  end if;

  select profile.full_name into v_reviewer_name
  from public.profiles as profile
  where profile.id = v_reviewer_id;

  select request.*
  into v_request
  from public.document_access_requests as request
  where request.id = p_request_id
  for update;
  if not found then
    raise exception 'Access request not found' using errcode = 'P0002';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'This access request has already been reviewed' using errcode = 'P0001';
  end if;

  select document.name into v_document_name
  from public.documents as document
  where document.id = v_request.document_id
    and document.deleted_at is null
  for update;
  if p_approve and not found then
    raise exception 'The document is no longer available' using errcode = 'P0002';
  end if;

  if p_approve then
    update public.documents as document
    set assigned_to = case
      when v_request.requester_id = any(document.assigned_to) then document.assigned_to
      else array_append(document.assigned_to, v_request.requester_id)
    end
    where document.id = v_request.document_id
      and document.deleted_at is null;
  end if;

  update public.document_access_requests as request
  set status = case when p_approve then 'approved' else 'denied' end,
      reviewed_by = v_reviewer_id,
      reviewed_at = now()
  where request.id = v_request.id
  returning * into v_request;

  insert into public.activity_log (
    user_id, action_type, resource_type, resource_id, details
  )
  values (
    v_reviewer_id,
    case when p_approve then 'document_access_granted' else 'document_access_denied' end,
    'document',
    v_request.document_id,
    jsonb_build_object(
      'request_id', v_request.id,
      'request_code', v_request.access_code,
      'document_name', coalesce(v_document_name, 'Unavailable document'),
      'requester_id', v_request.requester_id,
      'requester_name', (
        select profile.full_name from public.profiles as profile
        where profile.id = v_request.requester_id
      ),
      'request_reason', v_request.reason,
      'reviewer_id', v_reviewer_id,
      'reviewer_name', v_reviewer_name,
      'decision', v_request.status
    )
  );

  return jsonb_build_object(
    'id', v_request.id,
    'status', v_request.status,
    'requester_id', v_request.requester_id
  );
end;
$$;

revoke all on function public.request_document_access(uuid, text) from public, anon, authenticated;
grant execute on function public.request_document_access(uuid, text) to authenticated;
revoke all on function public.review_document_access_request(uuid, boolean) from public, anon, authenticated;
grant execute on function public.review_document_access_request(uuid, boolean) to authenticated;

do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'document_access_requests'
  ) then
    alter publication supabase_realtime add table public.document_access_requests;
  end if;
end;
$$;

commit;
