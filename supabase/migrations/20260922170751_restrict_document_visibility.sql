-- Ordinary uploads keep their existing default. M&E report/evidence uploads
-- must explicitly insert visibility = 'restricted' with the document row.
begin;

alter table public.documents
  add column visibility text not null default 'standard'
  constraint documents_visibility_check check (visibility in ('standard', 'restricted'));

drop policy "documents_read_active" on public.documents;
create policy "documents_read_active" on public.documents
for select to authenticated
using (
  deleted_at is null
  and (
    visibility = 'standard'
    or (
      visibility = 'restricted'
      and (select role from public.profiles where id = (select auth.uid()))
        in ('admin', 'board_advisor')
    )
  )
);

-- Keep Storage's existing non-anonymous authentication gate. Require a
-- matching active document; unmatched uploads are unreadable until inserted.
-- Do not add a column to Supabase-managed storage.objects: the document row
-- is the single source of truth for visibility.
drop policy "storage_authenticated_read_documents" on storage.objects;
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
        d.visibility = 'standard'
        or (
          d.visibility = 'restricted'
          and (select role from public.profiles where id = (select auth.uid()))
            in ('admin', 'board_advisor')
        )
      )
  )
);

commit;
