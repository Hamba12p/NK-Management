-- OBX roster and rate-limit storage. Access is restricted to trusted server handlers
-- and management readers. No email address or volunteer number is stored in logs.
create table public.volunteer_roster (
  id uuid primary key default gen_random_uuid(),
  volunteer_number text not null unique check (volunteer_number ~ '^NKV-[0-9]{3,4}$'),
  full_name text not null check (char_length(btrim(full_name)) between 1 and 160),
  email text not null check (char_length(btrim(email)) between 3 and 320),
  status text not null default 'active' check (status in ('active', 'inactive')),
  is_founding boolean not null default false,
  volunteer_profile_id uuid null references public.volunteer_profiles(profile_id) on delete set null,
  issued_at timestamptz not null default now(),
  issued_by uuid null references public.profiles(id) on delete set null,
  notes text null
);
create unique index volunteer_roster_email_lower_unique on public.volunteer_roster (lower(email));
create index volunteer_roster_status_number_idx on public.volunteer_roster (status, volunteer_number);
alter table public.volunteer_roster enable row level security;
revoke all on public.volunteer_roster from anon, authenticated;
grant select on public.volunteer_roster to authenticated;
grant all on public.volunteer_roster to service_role;

create table public.obx_auth_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null check (ip_hash ~ '^[a-f0-9]{64}$'),
  volunteer_number_hash text not null check (volunteer_number_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  success boolean not null,
  blocked_until timestamptz null
);
create index obx_auth_attempts_ip_created_idx on public.obx_auth_attempts (ip_hash, created_at desc);
create index obx_auth_attempts_number_created_idx on public.obx_auth_attempts (volunteer_number_hash, created_at desc);
create index obx_auth_attempts_blocked_until_idx on public.obx_auth_attempts (blocked_until) where blocked_until is not null;
alter table public.obx_auth_attempts enable row level security;
revoke all on public.obx_auth_attempts from anon, authenticated;
grant all on public.obx_auth_attempts to service_role;
