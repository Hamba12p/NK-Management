-- OBX course state and append-only answer history.
create table public.obx_progress (
  id uuid primary key default gen_random_uuid(),
  roster_id uuid not null references public.volunteer_roster(id) on delete restrict,
  cycle integer not null default 1 check (cycle > 0),
  course_version integer not null check (course_version > 0),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  current_stop text not null default 'meet_nk_udada',
  current_question text null,
  started_at timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  completed_at timestamptz null,
  overall_score numeric(5,2) null check (overall_score between 0 and 100),
  mou_typed_name text null,
  mou_accepted_at timestamptz null,
  mou_version text null,
  role_interest text[] not null default '{}',
  hope_text text null check (hope_text is null or char_length(hope_text) <= 140),
  first_week_checklist jsonb not null default '[]'::jsonb,
  unique (roster_id, cycle)
);
create index obx_progress_status_active_idx on public.obx_progress (status, last_active_at desc);
create index obx_progress_roster_cycle_idx on public.obx_progress (roster_id, cycle desc);
alter table public.obx_progress enable row level security;
revoke all on public.obx_progress from anon, authenticated;
grant select on public.obx_progress to authenticated;
grant all on public.obx_progress to service_role;

create table public.obx_stop_results (
  roster_id uuid not null references public.volunteer_roster(id) on delete restrict,
  cycle integer not null check (cycle > 0),
  stop_key text not null,
  attempts integer not null default 0 check (attempts >= 0),
  first_try_score numeric(5,2) null check (first_try_score between 0 and 100),
  best_score numeric(5,2) null check (best_score between 0 and 100),
  passed boolean not null default false,
  completed_at timestamptz null,
  active_seconds integer not null default 0 check (active_seconds >= 0),
  primary key (roster_id, cycle, stop_key)
);
alter table public.obx_stop_results enable row level security;
revoke all on public.obx_stop_results from anon, authenticated;
grant select on public.obx_stop_results to authenticated;
grant all on public.obx_stop_results to service_role;

create table public.obx_answers (
  id uuid primary key default gen_random_uuid(),
  roster_id uuid not null references public.volunteer_roster(id) on delete restrict,
  cycle integer not null check (cycle > 0),
  stop_key text not null,
  question_key text not null,
  choice_key text not null,
  correct boolean not null,
  attempt_no integer not null check (attempt_no > 0),
  request_id uuid null,
  answered_at timestamptz not null default now(),
  unique (roster_id, cycle, stop_key, question_key, attempt_no)
);
create index obx_answers_question_idx on public.obx_answers (stop_key, question_key, answered_at desc);
create unique index obx_answers_request_id_unique on public.obx_answers (roster_id, cycle, request_id) where request_id is not null;
alter table public.obx_answers enable row level security;
revoke all on public.obx_answers from anon, authenticated;
grant select on public.obx_answers to authenticated;
grant select, insert on public.obx_answers to service_role;
