begin;

alter table public.notifications add column if not exists actor_name text;
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('comment', 'assignment', 'upload', 'message'));

create or replace function public.create_chat_message_notification(
  p_recipient_id uuid,
  p_room_id uuid,
  p_sender_id uuid
)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_actor_name text;
begin
  if p_recipient_id is null or p_sender_id is null or p_recipient_id = p_sender_id then return; end if;
  if not exists (
    select 1 from public.profiles p join auth.users u on u.id=p.id
    where p.id=p_recipient_id and u.deleted_at is null and (u.banned_until is null or u.banned_until < now())
  ) then return; end if;
  if not coalesce((select preferences.notifications_enabled
    from public.user_preferences preferences where preferences.profile_id=p_recipient_id),true) then return; end if;

  select p.full_name into v_actor_name from public.profiles p where p.id=p_sender_id;
  if v_actor_name is null then return; end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_recipient_id::text || p_room_id::text || 'message', 0)
  );
  if exists (
    select 1 from public.notifications n
    where n.recipient_id=p_recipient_id and n.type='message' and n.entity_id=p_room_id
      and n.created_at >= now()-interval '2 minutes'
  ) then return; end if;

  delete from public.notifications n
  where n.recipient_id=p_recipient_id
    and ((n.read_at is not null and n.created_at < now()-interval '30 days') or n.created_at < now()-interval '90 days');
  insert into public.notifications(recipient_id,type,entity_id,url,actor_name)
  values (p_recipient_id,'message',p_room_id,'/dashboard/chat?room=' || p_room_id::text,v_actor_name);
end
$$;
revoke all on function public.create_chat_message_notification(uuid,uuid,uuid) from public, anon, authenticated, service_role;

create or replace function public.notify_chat_message()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_room_kind text; v_recipient uuid;
begin
  select r.kind into v_room_kind from public.chat_rooms r where r.id=new.room_id;
  if v_room_kind='dm' then
    for v_recipient in
      select cp.user_id from public.chat_participants cp
      where cp.room_id=new.room_id and cp.user_id<>new.sender_id
    loop
      perform public.create_chat_message_notification(v_recipient,new.room_id,new.sender_id);
    end loop;
  elsif v_room_kind='general' then
    for v_recipient in
      select p.id from public.profiles p
      where p.id<>new.sender_id and public.chat_is_manager(p.id) and public.chat_intern_active(p.id)
    loop
      perform public.create_chat_message_notification(v_recipient,new.room_id,new.sender_id);
    end loop;
  end if;
  return new;
exception when others then
  return new;
end
$$;
revoke all on function public.notify_chat_message() from public, anon, authenticated, service_role;
drop trigger if exists notify_chat_message_after_insert on public.chat_messages;
create trigger notify_chat_message_after_insert
  after insert on public.chat_messages
  for each row execute function public.notify_chat_message();

commit;
