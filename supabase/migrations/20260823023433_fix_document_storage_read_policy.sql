-- Documents are shared across the authenticated staff hub. Keep object access
-- aligned with the documents table instead of using a cross-table RLS lookup,
-- which can hide valid objects when Storage evaluates the policy.
drop policy if exists "storage_authenticated_read" on storage.objects;
drop policy if exists "storage_read_active_documents" on storage.objects;
drop policy if exists "storage_authenticated_read_documents" on storage.objects;

create policy "storage_authenticated_read_documents"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'documents'
  and (select auth.uid()) is not null
  and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
);
