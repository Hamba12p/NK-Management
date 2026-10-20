create table public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  file_name text not null check (char_length(file_name) between 1 and 255),
  file_path text not null unique,
  file_size bigint not null check (file_size between 0 and 52428800),
  mime_type text not null,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index task_attachments_task_created_idx
  on public.task_attachments(task_id, created_at);

alter table public.task_attachments enable row level security;
grant select, insert on public.task_attachments to authenticated;

create policy task_attachments_read_assigned_work on public.task_attachments
  for select to authenticated using (
    exists (
      select 1 from public.tasks task
      where task.id = task_id
        and task.deleted_at is null
        and (
          task.created_by = (select auth.uid())
          or task.assignee_id = (select auth.uid())
          or uploaded_by = (select auth.uid())
          or (select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager')
        )
    )
  );

create policy task_attachments_insert_for_assigned_task on public.task_attachments
  for insert to authenticated with check (
    uploaded_by = (select auth.uid())
    and exists (
      select 1 from public.tasks task
      where task.id = task_id
        and task.deleted_at is null
        and task.assignee_id = (select auth.uid())
    )
  );

create policy storage_read_task_attachments on storage.objects
  for select to authenticated using (
    bucket_id = 'documents'
    and exists (
      select 1 from public.task_attachments attachment
      where attachment.file_path = storage.objects.name
    )
  );

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'task_attachments'
    ) then
    alter publication supabase_realtime add table public.task_attachments;
  end if;
end;
$$;
