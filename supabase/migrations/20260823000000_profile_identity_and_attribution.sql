-- Durable profile identity and creator wayfinding for shared Hub content.

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists job_title text;
alter table public.profiles add column if not exists account_type text not null default 'person';
alter table public.profiles add column if not exists display_tag text;
alter table public.profiles add column if not exists display_color text not null default 'burgundy';

alter table public.profiles drop constraint if exists profiles_account_type_check;
alter table public.profiles add constraint profiles_account_type_check
  check (account_type in ('person', 'organization', 'shared'));
alter table public.profiles drop constraint if exists profiles_display_tag_check;
alter table public.profiles add constraint profiles_display_tag_check
  check (display_tag is null or display_tag ~ '^[A-Za-z0-9]{2,4}$');
alter table public.profiles drop constraint if exists profiles_display_color_check;
alter table public.profiles add constraint profiles_display_color_check
  check (display_color in ('burgundy', 'soft-burgundy', 'magenta', 'rust', 'ink'));

create or replace function public.profile_initials(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(left(coalesce(string_agg(left(part, 1), '' order by ordinal), 'NK'), 4))
  from unnest(regexp_split_to_array(trim(coalesce(p_name, 'NK')), '\s+')) with ordinality as words(part, ordinal)
  where ordinal <= 2;
$$;

update public.profiles as profile
set email = auth_user.email
from auth.users as auth_user
where auth_user.id = profile.id
  and profile.email is distinct from auth_user.email;

update public.profiles
set display_tag = public.profile_initials(full_name)
where display_tag is null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));
  v_account_type text := coalesce(new.raw_user_meta_data->>'account_type', 'person');
begin
  if v_account_type not in ('person', 'organization', 'shared') then
    v_account_type := 'person';
  end if;

  insert into public.profiles (id, full_name, email, role, job_title, account_type, display_tag, display_color)
  values (
    new.id,
    v_name,
    new.email,
    case when new.raw_user_meta_data->>'role' in ('admin', 'manager', 'dpo', 'volunteer', 'volunteer_senior', 'volunteer_lead')
      then new.raw_user_meta_data->>'role' else 'volunteer' end,
    nullif(new.raw_user_meta_data->>'job_title', ''),
    v_account_type,
    coalesce(nullif(new.raw_user_meta_data->>'display_tag', ''), public.profile_initials(v_name)),
    case when new.raw_user_meta_data->>'display_color' in ('burgundy', 'soft-burgundy', 'magenta', 'rust', 'ink')
      then new.raw_user_meta_data->>'display_color' else 'burgundy' end
  ) on conflict (id) do update set
    email = excluded.email,
    updated_at = now();
  return new;
end;
$$;

alter table public.documents add column if not exists contributor_name text;
alter table public.documents add column if not exists contributor_tag text;
alter table public.workspace_docs add column if not exists contributor_name text;
alter table public.workspace_docs add column if not exists contributor_tag text;
alter table public.tasks add column if not exists contributor_name text;
alter table public.tasks add column if not exists contributor_tag text;
alter table public.meetings add column if not exists contributor_name text;
alter table public.meetings add column if not exists contributor_tag text;
alter table public.announcements add column if not exists contributor_name text;
alter table public.announcements add column if not exists contributor_tag text;

alter table public.documents drop constraint if exists documents_contributor_tag_check;
alter table public.documents add constraint documents_contributor_tag_check
  check (contributor_tag is null or contributor_tag ~ '^[A-Za-z0-9]{2,4}$');
alter table public.workspace_docs drop constraint if exists workspace_docs_contributor_tag_check;
alter table public.workspace_docs add constraint workspace_docs_contributor_tag_check
  check (contributor_tag is null or contributor_tag ~ '^[A-Za-z0-9]{2,4}$');
alter table public.tasks drop constraint if exists tasks_contributor_tag_check;
alter table public.tasks add constraint tasks_contributor_tag_check
  check (contributor_tag is null or contributor_tag ~ '^[A-Za-z0-9]{2,4}$');
alter table public.meetings drop constraint if exists meetings_contributor_tag_check;
alter table public.meetings add constraint meetings_contributor_tag_check
  check (contributor_tag is null or contributor_tag ~ '^[A-Za-z0-9]{2,4}$');
alter table public.announcements drop constraint if exists announcements_contributor_tag_check;
alter table public.announcements add constraint announcements_contributor_tag_check
  check (contributor_tag is null or contributor_tag ~ '^[A-Za-z0-9]{2,4}$');

alter table public.documents drop constraint if exists documents_contributor_name_check;
alter table public.documents add constraint documents_contributor_name_check
  check (contributor_name is null or char_length(contributor_name) between 1 and 100);
alter table public.workspace_docs drop constraint if exists workspace_docs_contributor_name_check;
alter table public.workspace_docs add constraint workspace_docs_contributor_name_check
  check (contributor_name is null or char_length(contributor_name) between 1 and 100);
alter table public.tasks drop constraint if exists tasks_contributor_name_check;
alter table public.tasks add constraint tasks_contributor_name_check
  check (contributor_name is null or char_length(contributor_name) between 1 and 100);
alter table public.meetings drop constraint if exists meetings_contributor_name_check;
alter table public.meetings add constraint meetings_contributor_name_check
  check (contributor_name is null or char_length(contributor_name) between 1 and 100);
alter table public.announcements drop constraint if exists announcements_contributor_name_check;
alter table public.announcements add constraint announcements_contributor_name_check
  check (contributor_name is null or char_length(contributor_name) between 1 and 100);
