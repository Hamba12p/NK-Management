begin;

alter table public.documents
  add column if not exists assigned_to uuid[] not null default '{}'::uuid[];

create or replace function public.validate_document_assignees()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1
    from unnest(new.assigned_to) as assignee(id)
    left join public.profiles profile on profile.id = assignee.id
    where profile.id is null
  ) then
    raise exception 'Document assignees must be existing profiles';
  end if;

  select coalesce(array_agg(distinct assignee_id order by assignee_id), '{}'::uuid[])
  into new.assigned_to
  from unnest(new.assigned_to) as assignee(assignee_id);

  return new;
end;
$$;

revoke all on function public.validate_document_assignees() from public, anon, authenticated;
drop trigger if exists validate_document_assignees on public.documents;
create trigger validate_document_assignees
  before insert or update of assigned_to on public.documents
  for each row execute function public.validate_document_assignees();

drop policy if exists "documents_read_active" on public.documents;
create policy "documents_read_active" on public.documents
for select to authenticated
using (
  deleted_at is null
  and (
    (
      visibility = 'standard'
      and (
        cardinality(assigned_to) = 0
        or (select auth.uid()) = any(assigned_to)
        or uploaded_by = (select auth.uid())
        or (select role from public.profiles where id = (select auth.uid()))
          in ('admin', 'board_advisor')
      )
    )
    or (
      visibility = 'restricted'
      and (
        (select auth.uid()) = any(assigned_to)
        or (select role from public.profiles where id = (select auth.uid()))
          in ('admin', 'board_advisor')
      )
    )
  )
);

drop policy if exists "storage_authenticated_read_documents" on storage.objects;
create policy "storage_authenticated_read_documents" on storage.objects
for select to authenticated
using (
  bucket_id = 'documents'
  and (select auth.uid()) is not null
  and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  and exists (
    select 1 from public.documents d
    where d.file_path = storage.objects.name
      and d.deleted_at is null
      and (
        (
          d.visibility = 'standard'
          and (
            cardinality(d.assigned_to) = 0
            or (select auth.uid()) = any(d.assigned_to)
            or d.uploaded_by = (select auth.uid())
            or (select role from public.profiles where id = (select auth.uid()))
              in ('admin', 'board_advisor')
          )
        )
        or (
          d.visibility = 'restricted'
          and (
            (select auth.uid()) = any(d.assigned_to)
            or (select role from public.profiles where id = (select auth.uid()))
              in ('admin', 'board_advisor')
          )
        )
      )
  )
);

drop policy if exists intern_documents_read on public.documents;
create policy intern_documents_read on public.documents as restrictive
for select to authenticated
using (
  not public.is_intern()
  or (
    public.intern_access_active()
    and deleted_at is null
    and (
      (intern_visible and visibility = 'standard')
      or uploaded_by = (select auth.uid())
      or (select auth.uid()) = any(assigned_to)
    )
  )
);

drop policy if exists intern_storage_read on storage.objects;
create policy intern_storage_read on storage.objects as restrictive
for select to authenticated
using (
  not public.is_intern()
  or (
    public.intern_access_active()
    and bucket_id = 'documents'
    and (
      name like ('interns/' || (select auth.uid())::text || '/%')
      or exists (
        select 1 from public.documents d
        where d.file_path = storage.objects.name
          and d.deleted_at is null
          and (
            (d.intern_visible and d.visibility = 'standard')
            or (select auth.uid()) = any(d.assigned_to)
          )
      )
    )
  )
);

commit;
