-- Phase 2: close the workflow loops between meetings, tasks, personal work,
-- and auditable volunteer events/hours.

alter table public.agenda_items add column if not exists carried_from_id uuid references public.agenda_items(id) on delete set null;
alter table public.tasks add column if not exists source_meeting_id uuid references public.meetings(id) on delete set null;
alter table public.tasks add column if not exists source_agenda_item_id uuid references public.agenda_items(id) on delete set null;

create index if not exists idx_agenda_items_presenter_meeting on public.agenda_items(presenter, meeting_id);
create index if not exists idx_agenda_items_carried_from on public.agenda_items(carried_from_id);
create index if not exists idx_tasks_assignee_status_due on public.tasks(assignee_id, status, due_date);
create index if not exists idx_tasks_source_meeting on public.tasks(source_meeting_id);
create unique index if not exists idx_tasks_source_agenda_unique
  on public.tasks(source_agenda_item_id) where source_agenda_item_id is not null;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 3 and 200),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text check (char_length(location) < 300),
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  meeting_id uuid unique references public.meetings(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists idx_events_starts_at on public.events(starts_at desc);
create index if not exists idx_events_created_by on public.events(created_by);

alter table public.events enable row level security;
drop policy if exists "events_read_authenticated" on public.events;
drop policy if exists "events_create_leadership" on public.events;
drop policy if exists "events_update_leadership" on public.events;
create policy "events_read_authenticated" on public.events
  for select to authenticated using (true);
create policy "events_create_leadership" on public.events
  for insert to authenticated with check (
    created_by = (select auth.uid())
    and (select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager')
  );
create policy "events_update_leadership" on public.events
  for update to authenticated
  using ((select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager'))
  with check ((select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager'));

insert into public.events (name, starts_at, ends_at, location, status, meeting_id, created_by)
select
  title,
  scheduled_at,
  scheduled_at + make_interval(mins => duration_min),
  location,
  case when status = 'completed' then 'completed' else 'scheduled' end,
  id,
  created_by
from public.meetings
where status <> 'cancelled' and created_by is not null
on conflict (meeting_id) do update
set name = excluded.name,
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    location = excluded.location,
    status = excluded.status;

create or replace function public.sync_meeting_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'cancelled' then
    update public.events set status = 'cancelled' where meeting_id = new.id;
  else
    insert into public.events (name, starts_at, ends_at, location, status, meeting_id, created_by)
    values (new.title, new.scheduled_at, new.scheduled_at + make_interval(mins => new.duration_min), new.location,
      case when new.status = 'completed' then 'completed' else 'scheduled' end, new.id, new.created_by)
    on conflict (meeting_id) do update
    set name = excluded.name,
        starts_at = excluded.starts_at,
        ends_at = excluded.ends_at,
        location = excluded.location,
        status = excluded.status;
  end if;
  return new;
end;
$$;

revoke execute on function public.sync_meeting_event() from public, anon, authenticated, service_role;
drop trigger if exists sync_meeting_event_after_change on public.meetings;
create trigger sync_meeting_event_after_change
after insert or update of title, scheduled_at, duration_min, location, status on public.meetings
for each row execute function public.sync_meeting_event();

create table if not exists public.volunteer_hours (
  id uuid primary key default gen_random_uuid(),
  volunteer_id uuid not null references public.volunteer_profiles(profile_id) on delete restrict,
  event_id uuid not null references public.events(id) on delete restrict,
  hours numeric(5,2) not null check (hours > 0 and hours <= 24),
  notes text check (char_length(notes) <= 1000),
  logged_at timestamptz not null default now(),
  unique (volunteer_id, event_id)
);

create index if not exists idx_volunteer_hours_volunteer_logged on public.volunteer_hours(volunteer_id, logged_at desc);
create index if not exists idx_volunteer_hours_event on public.volunteer_hours(event_id);

alter table public.volunteer_hours enable row level security;
drop policy if exists "volunteer_hours_read_own" on public.volunteer_hours;
drop policy if exists "volunteer_hours_read_leadership" on public.volunteer_hours;
drop policy if exists "volunteer_hours_insert_own" on public.volunteer_hours;
drop policy if exists "volunteer_hours_update_own" on public.volunteer_hours;
create policy "volunteer_hours_read_own" on public.volunteer_hours
  for select to authenticated using (volunteer_id = (select auth.uid()));
create policy "volunteer_hours_read_leadership" on public.volunteer_hours
  for select to authenticated using (
    (select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager', 'dpo')
  );
create policy "volunteer_hours_insert_own" on public.volunteer_hours
  for insert to authenticated with check (volunteer_id = (select auth.uid()));
create policy "volunteer_hours_update_own" on public.volunteer_hours
  for update to authenticated
  using (volunteer_id = (select auth.uid()))
  with check (volunteer_id = (select auth.uid()));

create or replace function public.refresh_volunteer_hours_total()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
begin
  v_profile_id := case when tg_op = 'DELETE' then old.volunteer_id else new.volunteer_id end;
  update public.volunteer_profiles
  set hours_total = coalesce((select sum(hours) from public.volunteer_hours where volunteer_id = v_profile_id), 0),
      updated_at = now()
  where profile_id = v_profile_id;
  return null;
end;
$$;

revoke execute on function public.refresh_volunteer_hours_total() from public, anon, authenticated, service_role;
drop trigger if exists refresh_volunteer_hours_total_after_change on public.volunteer_hours;
create trigger refresh_volunteer_hours_total_after_change
after insert or update or delete on public.volunteer_hours
for each row execute function public.refresh_volunteer_hours_total();

create or replace function public.complete_meeting_and_carry_forward(p_meeting_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_role text;
  v_meeting public.meetings%rowtype;
  v_next_meeting_id uuid;
begin
  if v_actor is null then raise exception 'You must be signed in'; end if;
  select role into v_role from public.profiles where id = v_actor;
  select * into v_meeting from public.meetings where id = p_meeting_id for update;
  if v_meeting.id is null then raise exception 'Meeting not found'; end if;
  if v_actor <> v_meeting.created_by and coalesce(v_role, '') not in ('admin', 'manager') then raise exception 'You cannot complete this meeting'; end if;

  if exists (select 1 from public.agenda_items where meeting_id = p_meeting_id and done = false and deleted_at is null) then
    select id into v_next_meeting_id
    from public.meetings
    where id <> p_meeting_id
      and status = 'upcoming'
      and deleted_at is null
      and scheduled_at > greatest(now(), v_meeting.scheduled_at)
    order by scheduled_at
    limit 1;

    if v_next_meeting_id is null then
      insert into public.meetings (title, description, scheduled_at, duration_min, location, status, created_by)
      values ('Follow-up: ' || v_meeting.title, 'Automatically created to carry forward unfinished agenda items.', greatest(now(), v_meeting.scheduled_at) + interval '7 days', v_meeting.duration_min, v_meeting.location, 'upcoming', v_actor)
      returning id into v_next_meeting_id;
    end if;

    insert into public.agenda_items (meeting_id, content, order_index, presenter, done, created_by, carried_from_id)
    select v_next_meeting_id, item.content,
      coalesce((select max(order_index) from public.agenda_items where meeting_id = v_next_meeting_id), 0) + (row_number() over (order by item.order_index))::integer,
      item.presenter, false, v_actor, item.id
    from public.agenda_items item
    where item.meeting_id = p_meeting_id and item.done = false and item.deleted_at is null
      and not exists (select 1 from public.agenda_items existing where existing.carried_from_id = item.id);
  end if;

  update public.meetings set status = 'completed' where id = p_meeting_id;
  update public.events set status = 'completed' where meeting_id = p_meeting_id;
  return v_next_meeting_id;
end;
$$;

grant select, insert, update on public.events to authenticated;
grant select, insert, update on public.volunteer_hours to authenticated;
grant execute on function public.complete_meeting_and_carry_forward(uuid) to authenticated;

notify pgrst, 'reload schema';
