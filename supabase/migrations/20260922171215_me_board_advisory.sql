begin;

create table public.programs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0), description text,
  status text not null default 'active' check (status in ('active', 'completed', 'paused', 'cancelled')),
  start_date date, end_date date,
  owner_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz, deleted_by uuid references public.profiles(id) on delete set null,
  contributor_name text, contributor_tag text,
  check (end_date is null or start_date is null or end_date >= start_date)
);
create table public.program_kpis (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  name text not null check (length(trim(name)) > 0), description text, unit text not null,
  baseline_value numeric, target_value numeric,
  frequency text not null check (frequency in ('weekly', 'monthly', 'quarterly', 'annual', 'one_off')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz, deleted_by uuid references public.profiles(id) on delete set null
);
create table public.kpi_measurements (
  id uuid primary key default gen_random_uuid(),
  kpi_id uuid not null references public.program_kpis(id) on delete cascade,
  value numeric not null, period_start date not null, period_end date not null,
  notes text, recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz, deleted_by uuid references public.profiles(id) on delete set null,
  check (period_end >= period_start)
);
create table public.findings (
  id uuid primary key default gen_random_uuid(),
  program_id uuid references public.programs(id) on delete set null,
  title text not null check (length(trim(title)) > 0), description text not null check (length(trim(description)) > 0),
  category text not null check (category in ('monitoring', 'evaluation', 'feedback', 'audit', 'other')),
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  status text not null default 'open' check (status in ('open', 'under_review', 'resolved', 'closed')),
  source_meeting_id uuid references public.meetings(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz, deleted_by uuid references public.profiles(id) on delete set null,
  contributor_name text, contributor_tag text
);
create table public.risks (
  id uuid primary key default gen_random_uuid(),
  program_id uuid references public.programs(id) on delete set null,
  finding_id uuid references public.findings(id) on delete set null,
  title text not null check (length(trim(title)) > 0), description text not null check (length(trim(description)) > 0),
  likelihood text not null check (likelihood in ('low', 'medium', 'high')),
  impact text not null check (impact in ('low', 'medium', 'high')),
  status text not null default 'open' check (status in ('open', 'mitigating', 'closed')),
  mitigation_plan text, owner_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz, deleted_by uuid references public.profiles(id) on delete set null,
  contributor_name text, contributor_tag text
);
alter table public.tasks
  add column source_finding_id uuid references public.findings(id) on delete set null,
  add column source_risk_id uuid references public.risks(id) on delete set null,
  add column source_program_id uuid references public.programs(id) on delete set null;
create table public.evidence_links (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  program_id uuid references public.programs(id) on delete cascade,
  finding_id uuid references public.findings(id) on delete cascade,
  risk_id uuid references public.risks(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz, deleted_by uuid references public.profiles(id) on delete set null,
  check (program_id is not null or finding_id is not null or risk_id is not null)
);
create table public.board_reports (
  id uuid primary key default gen_random_uuid(), title text not null,
  period_start date, period_end date,
  program_id uuid references public.programs(id) on delete set null,
  document_id uuid references public.documents(id) on delete set null,
  summary_snapshot jsonb not null default '{}'::jsonb,
  generated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz, deleted_by uuid references public.profiles(id) on delete set null,
  check (period_end is null or period_start is null or period_end >= period_start)
);

-- Authorized readers can inspect retained rows; UI queries filter deleted_at.
-- No DELETE grant/policy: deletion is an attributed UPDATE only.
do $$
declare table_name text;
begin
  foreach table_name in array array['programs', 'program_kpis', 'kpi_measurements', 'findings', 'risks', 'evidence_links', 'board_reports'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('grant select, insert, update on public.%I to authenticated', table_name);
    execute format('revoke delete on public.%I from anon, authenticated', table_name);
    execute format('create policy %I on public.%I for select to authenticated using ((select role from public.profiles where id = (select auth.uid())) in (''admin'', ''board_advisor''))', table_name || '_read', table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select role from public.profiles where id = (select auth.uid())) in (''admin'', ''board_advisor'') and deleted_at is null and deleted_by is null)', table_name || '_insert', table_name);
    execute format('create policy %I on public.%I for update to authenticated using ((select role from public.profiles where id = (select auth.uid())) in (''admin'', ''board_advisor'')) with check ((select role from public.profiles where id = (select auth.uid())) in (''admin'', ''board_advisor'') and ((deleted_at is null and deleted_by is null) or (deleted_at is not null and deleted_by = (select auth.uid()))))', table_name || '_update', table_name);
  end loop;
end $$;

create index on public.program_kpis(program_id);
create index on public.kpi_measurements(kpi_id, period_end desc, created_at desc);
create index on public.findings(program_id);
create index on public.risks(program_id);
create index on public.risks(finding_id);
create index on public.evidence_links(program_id);
create index on public.evidence_links(finding_id);
create index on public.evidence_links(risk_id);
create index on public.evidence_links(document_id);
create index on public.board_reports(program_id, created_at desc);
create index on public.tasks(source_program_id);
create unique index tasks_source_finding_active on public.tasks(source_finding_id)
  where source_finding_id is not null and deleted_at is null;
create unique index tasks_source_risk_active on public.tasks(source_risk_id)
  where source_risk_id is not null and deleted_at is null;

-- Existing task policies stay intact. This exception only permits advisors
-- to convert an active M&E source into a task; ordinary tasks remain read-only.
create policy tasks_board_action_insert on public.tasks for insert to authenticated
with check (
  (select role from public.profiles where id = (select auth.uid())) = 'board_advisor'
  and created_by = (select auth.uid()) and deleted_at is null
  and source_meeting_id is null and source_agenda_item_id is null and linked_doc_id is null
  and (
    (source_risk_id is null and exists (select 1 from public.findings f
      where f.id = source_finding_id and f.deleted_at is null
        and f.program_id is not distinct from source_program_id))
    or (source_finding_id is null and exists (select 1 from public.risks r
      where r.id = source_risk_id and r.deleted_at is null
        and r.program_id is not distinct from source_program_id))
  )
);
commit;
