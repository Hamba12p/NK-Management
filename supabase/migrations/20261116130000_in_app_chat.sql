begin;

alter table public.profiles
  add column if not exists is_founder boolean not null default false;

-- Run manually for the founder account after confirming its profile id:
-- update public.profiles set is_founder = true where id = '<founder-profile-uuid>';

create or replace function public.protect_profile_is_founder()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.is_founder is distinct from old.is_founder
    and current_user not in ('service_role', 'postgres') then
    raise exception 'Only trusted database operators can change is_founder';
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_protect_is_founder on public.profiles;
create trigger profiles_protect_is_founder
before update on public.profiles
for each row execute function public.protect_profile_is_founder();

create table if not exists public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('dm', 'general')),
  room_key text not null unique,
  created_at timestamptz not null default now()
);
create table if not exists public.chat_participants (
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (room_id, user_id)
);
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  sender_id uuid not null default auth.uid() references public.profiles(id),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_room_created_idx
  on public.chat_messages(room_id, created_at desc);
create table if not exists public.chat_reads (
  user_id uuid not null references public.profiles(id) on delete cascade,
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, room_id)
);

alter table public.chat_rooms enable row level security;
alter table public.chat_participants enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_reads enable row level security;

insert into public.chat_rooms(kind, room_key) values ('general', 'general')
on conflict (room_key) do nothing;

create or replace function public.chat_intern_active(uid uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select case when (select p.role from public.profiles p where p.id = uid) <> 'intern' then true
    else coalesce((select p.intern_access_enabled
      and p.access_starts_on <= (now() at time zone 'Africa/Nairobi')::date
      and (p.access_expires_at is null or p.access_expires_at > now())
      and (not p.must_change_password
        or p.password_change_required_on > (now() at time zone 'Africa/Nairobi')::date)
      from public.profiles p where p.id = uid), false) end
$$;

create or replace function public.chat_is_manager(uid uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce((select p.role = 'manager' or p.is_founder from public.profiles p where p.id = uid), false) $$;

create or replace function public.chat_pair_allowed(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select coalesce(a is not null and b is not null and a <> b
    and public.chat_intern_active(a) and public.chat_intern_active(b)
    and exists (select 1 from public.profiles p where p.id = a)
    and exists (select 1 from public.profiles p where p.id = b)
    and (
      (public.chat_is_manager(a) and (public.chat_is_manager(b)
        or (select p.role in ('volunteer','volunteer_senior','volunteer_lead','intern') from public.profiles p where p.id=b)))
      or (public.chat_is_manager(b) and (select p.role in ('volunteer','volunteer_senior','volunteer_lead','intern') from public.profiles p where p.id=a))
      or ((select p.role in ('volunteer','volunteer_senior','volunteer_lead') from public.profiles p where p.id=a)
        and (select p.role = 'intern' from public.profiles p where p.id=b))
      or ((select p.role = 'intern' from public.profiles p where p.id=a)
        and (select p.role in ('volunteer','volunteer_senior','volunteer_lead') from public.profiles p where p.id=b))
    ), false)
$$;

create or replace function public.chat_can_access(p_room_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select coalesce((select r.kind = 'general' and public.chat_is_manager(auth.uid())
      and public.chat_intern_active(auth.uid()) from public.chat_rooms r where r.id=p_room_id), false)
    or exists (
      select 1 from public.chat_rooms r
      join public.chat_participants mine on mine.room_id=r.id and mine.user_id=auth.uid()
      join public.chat_participants other on other.room_id=r.id and other.user_id<>auth.uid()
      where r.id=p_room_id and r.kind='dm'
        and public.chat_pair_allowed(auth.uid(), other.user_id)
    )
$$;

create or replace function public.chat_open_dm(other_user uuid)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_room uuid; v_key text;
begin
  if not public.chat_pair_allowed(auth.uid(), other_user) then
    raise exception 'You are not allowed to start a chat with this user';
  end if;
  v_key := least(auth.uid(), other_user)::text || ':' || greatest(auth.uid(), other_user)::text;
  insert into public.chat_rooms(kind, room_key) values ('dm', v_key)
    on conflict (room_key) do nothing;
  select id into v_room from public.chat_rooms where room_key=v_key;
  insert into public.chat_participants(room_id,user_id) values (v_room,auth.uid()),(v_room,other_user)
    on conflict do nothing;
  return v_room;
end
$$;

create or replace function public.chat_contacts()
returns table(user_id uuid, display_name text, role text, is_shared_account boolean, room_id uuid)
language sql stable security definer set search_path = public
as $$
  select p.id, p.full_name, case when p.role='manager' or p.is_founder then 'manager' else p.role end,
    coalesce(p.account_type='shared',false),
    (select r.id from public.chat_rooms r
      join public.chat_participants a on a.room_id=r.id and a.user_id=auth.uid()
      join public.chat_participants b on b.room_id=r.id and b.user_id=p.id
      where r.kind='dm' limit 1)
  from public.profiles p
  where p.id <> auth.uid() and public.chat_pair_allowed(auth.uid(),p.id)
  union all
  select null::uuid, 'General', 'general', false, r.id
  from public.chat_rooms r
  where r.kind='general' and public.chat_is_manager(auth.uid()) and public.chat_intern_active(auth.uid())
$$;

create or replace function public.chat_unread_counts()
returns table(room_id uuid, unread bigint)
language sql stable security definer set search_path = public
as $$
  select r.id, count(m.id)::bigint
  from public.chat_rooms r
  left join public.chat_reads cr on cr.room_id=r.id and cr.user_id=auth.uid()
  left join public.chat_messages m on m.room_id=r.id and m.sender_id<>auth.uid()
    and m.created_at > coalesce(cr.last_read_at, '-infinity'::timestamptz)
  where public.chat_can_access(r.id)
  group by r.id
$$;

create or replace function public.chat_mark_read(p_room_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.chat_can_access(p_room_id) then raise exception 'You cannot access this chat room'; end if;
  insert into public.chat_reads(user_id,room_id,last_read_at) values (auth.uid(),p_room_id,now())
    on conflict (user_id,room_id) do update set last_read_at=excluded.last_read_at;
end
$$;

revoke all on function public.chat_intern_active(uuid), public.chat_is_manager(uuid), public.chat_pair_allowed(uuid,uuid), public.chat_can_access(uuid), public.chat_open_dm(uuid), public.chat_contacts(), public.chat_unread_counts(), public.chat_mark_read(uuid) from public, anon;
grant execute on function public.chat_intern_active(uuid), public.chat_is_manager(uuid), public.chat_pair_allowed(uuid,uuid), public.chat_can_access(uuid), public.chat_open_dm(uuid), public.chat_contacts(), public.chat_unread_counts(), public.chat_mark_read(uuid) to authenticated;

revoke all on public.chat_rooms, public.chat_participants, public.chat_messages, public.chat_reads from anon, authenticated;
grant select on public.chat_rooms, public.chat_participants to authenticated;
grant select, insert on public.chat_messages to authenticated;
grant select, insert, update on public.chat_reads to authenticated;

drop policy if exists chat_rooms_read_accessible on public.chat_rooms;
create policy chat_rooms_read_accessible on public.chat_rooms for select to authenticated
  using ((kind='general' or kind='dm') and public.chat_can_access(id));
drop policy if exists chat_participants_read_own_rooms on public.chat_participants;
create policy chat_participants_read_own_rooms on public.chat_participants for select to authenticated
  using (public.chat_can_access(room_id));
drop policy if exists chat_messages_read_accessible on public.chat_messages;
create policy chat_messages_read_accessible on public.chat_messages for select to authenticated using (public.chat_can_access(room_id));
drop policy if exists chat_messages_insert_accessible on public.chat_messages;
create policy chat_messages_insert_accessible on public.chat_messages for insert to authenticated
  with check (sender_id=auth.uid() and public.chat_can_access(room_id));
drop policy if exists chat_reads_read_own on public.chat_reads;
create policy chat_reads_read_own on public.chat_reads for select to authenticated
  using (user_id=auth.uid() and public.chat_can_access(room_id));
drop policy if exists chat_reads_insert_own on public.chat_reads;
create policy chat_reads_insert_own on public.chat_reads for insert to authenticated
  with check (user_id=auth.uid() and public.chat_can_access(room_id));
drop policy if exists chat_reads_update_own on public.chat_reads;
create policy chat_reads_update_own on public.chat_reads for update to authenticated
  using (user_id=auth.uid() and public.chat_can_access(room_id))
  with check (user_id=auth.uid() and public.chat_can_access(room_id));

do $$ begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime')
    and not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='chat_messages') then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end $$;

commit;
