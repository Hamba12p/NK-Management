create table public.obx_legal_consents (
  roster_id uuid primary key references public.volunteer_roster(id) on delete cascade,
  privacy_accepted_at timestamptz not null,
  mou_accepted_at timestamptz not null,
  legal_version text not null check (char_length(legal_version) between 1 and 40),
  recorded_at timestamptz not null default now()
);

alter table public.obx_legal_consents enable row level security;
revoke all on public.obx_legal_consents from anon, authenticated;
grant select on public.obx_legal_consents to authenticated;
grant all on public.obx_legal_consents to service_role;

create policy obx_legal_consents_management_read
  on public.obx_legal_consents
  for select
  to authenticated
  using ((select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager', 'dpo'));
