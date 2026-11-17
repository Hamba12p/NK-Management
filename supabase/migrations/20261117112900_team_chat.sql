begin;

create table public.team_chat_messages (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  author_name text not null default 'Team member',
  body text not null check (char_length(body) between 1 and 2000 and char_length(btrim(body)) > 0),
  attachments jsonb not null default '[]'::jsonb
    check (
      case when jsonb_typeof(attachments) = 'array'
        then jsonb_array_length(attachments) <= 5 and octet_length(attachments::text) <= 8192
        else false
      end
    ),
  created_at timestamptz not null default now()
);

create index team_chat_messages_created_idx
  on public.team_chat_messages(created_at desc);

create table public.team_chat_reads (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now()
);

alter table public.team_chat_messages enable row level security;
alter table public.team_chat_reads enable row level security;
alter table public.team_chat_messages replica identity full;

grant select, insert on public.team_chat_messages to authenticated;
grant select, insert, update (user_id, last_read_at) on public.team_chat_reads to authenticated;
grant all on public.team_chat_messages, public.team_chat_reads to service_role;

create policy team_chat_messages_read on public.team_chat_messages
  for select to authenticated
  using (not public.is_intern() or public.intern_access_active());
create policy team_chat_messages_insert on public.team_chat_messages
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and (not public.is_intern() or public.intern_access_active())
  );
create policy team_chat_reads_read_own on public.team_chat_reads
  for select to authenticated
  using (
    user_id = (select auth.uid())
    and (not public.is_intern() or public.intern_access_active())
  );
create policy team_chat_reads_insert_own on public.team_chat_reads
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (not public.is_intern() or public.intern_access_active())
  );
create policy team_chat_reads_update_own on public.team_chat_reads
  for update to authenticated
  using (
    user_id = (select auth.uid())
    and (not public.is_intern() or public.intern_access_active())
  )
  with check (
    user_id = (select auth.uid())
    and (not public.is_intern() or public.intern_access_active())
  );

create or replace function public.mark_team_chat_read()
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null or (public.is_intern() and not public.intern_access_active()) then
    raise exception 'Active authentication is required to mark chat messages as read';
  end if;

  insert into public.team_chat_reads (user_id, last_read_at)
  values (v_user_id, now())
  on conflict (user_id) do update
    set last_read_at = excluded.last_read_at;
end;
$$;

revoke all on function public.mark_team_chat_read() from public, anon;
grant execute on function public.mark_team_chat_read() to authenticated;

create or replace function public.set_team_chat_author_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select coalesce(nullif(btrim(p.full_name), ''), 'Team member')
  into new.author_name
  from public.profiles p
  where p.id = new.author_id;

  if not found then
    raise exception 'A team profile is required to send a message';
  end if;

  return new;
end;
$$;

revoke all on function public.set_team_chat_author_name() from public, anon, authenticated;

create trigger set_team_chat_author_name_before_insert
  before insert on public.team_chat_messages
  for each row execute function public.set_team_chat_author_name();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'team_chat_messages'
    ) then
      alter publication supabase_realtime add table public.team_chat_messages;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'team_chat_reads'
    ) then
      alter publication supabase_realtime add table public.team_chat_reads;
    end if;
  end if;
end $$;

notify pgrst, 'reload schema';

commit;
