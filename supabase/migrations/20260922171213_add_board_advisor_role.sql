begin;
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin', 'manager', 'dpo', 'volunteer', 'volunteer_senior', 'volunteer_lead', 'board_advisor'));
commit;
