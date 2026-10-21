create or replace function public.complete_assigned_task(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.tasks task
    where task.id = p_task_id
      and task.assignee_id = v_actor
      and task.deleted_at is null
  ) then
    raise exception 'Task is not assigned to the current user';
  end if;

  if not exists (
    select 1
    from public.task_attachments attachment
    where attachment.task_id = p_task_id
  ) then
    raise exception 'Upload work before marking the task complete';
  end if;

  update public.tasks task
  set status = 'done',
      updated_at = pg_catalog.now()
  where task.id = p_task_id
    and task.assignee_id = v_actor
    and task.deleted_at is null;

  if not found then
    raise exception 'Task could not be completed';
  end if;
end;
$$;

revoke all on function public.complete_assigned_task(uuid) from public, anon;
grant execute on function public.complete_assigned_task(uuid) to authenticated;
