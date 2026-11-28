begin;

create or replace function public.notify_workspace_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipient_id uuid;
begin
  if new.deleted_at is not null then
    return new;
  end if;

  for v_recipient_id in
    select distinct candidates.user_id
    from (
      select document.author_id as user_id, true as is_owner
      from public.workspace_docs document
      where document.id = new.document_id and document.deleted_at is null
      union
      select comment.author_id, false
      from public.workspace_comments comment
      where comment.document_id = new.document_id
        and comment.deleted_at is null
        and comment.id <> new.id
    ) candidates
    join public.profiles profile on profile.id = candidates.user_id
    where candidates.user_id <> new.author_id
      and (profile.role <> 'intern' or candidates.is_owner)
  loop
    perform public.create_notification(
      v_recipient_id,
      'comment',
      new.document_id,
      '/dashboard/workspace?document=' || new.document_id::text
    );
  end loop;

  return new;
exception when others then
  return new;
end;
$$;

create or replace function public.notify_task_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.deleted_at is null
    and new.assignee_id is not null
    and new.assignee_id <> new.created_by
    and (
      tg_op = 'INSERT'
      or old.assignee_id is distinct from new.assignee_id
    ) then
    perform public.create_notification(
      new.assignee_id,
      'assignment',
      new.id,
      '/dashboard/workspace?task=' || new.id::text
    );
  end if;

  return new;
exception when others then
  return new;
end;
$$;

create or replace function public.notify_document_upload()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipient_id uuid;
begin
  if new.deleted_at is not null then
    return new;
  end if;

  for v_recipient_id in
    select profile.id
    from public.profiles profile
    join auth.users account on account.id = profile.id
    where profile.id <> new.uploaded_by
      and profile.role <> 'intern'
      and account.deleted_at is null
      and (account.banned_until is null or account.banned_until < now())
      and (
        (
          new.visibility = 'standard'
          and (
            cardinality(new.assigned_to) = 0
            or profile.id = any(new.assigned_to)
            or profile.role in ('admin', 'board_advisor')
          )
        )
        or (
          new.visibility = 'restricted'
          and (
            profile.id = any(new.assigned_to)
            or profile.role in ('admin', 'board_advisor')
          )
        )
      )
  loop
    perform public.create_notification(
      v_recipient_id,
      'upload',
      new.id,
      '/dashboard/documents?document=' || new.id::text
    );
  end loop;

  return new;
exception when others then
  return new;
end;
$$;

commit;
