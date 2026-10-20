-- Keep contributor tags compatible with single-name volunteers using legacy clients.
alter table public.documents drop constraint if exists documents_contributor_tag_check;
alter table public.documents add constraint documents_contributor_tag_check
  check (contributor_tag is null or contributor_tag ~ '^[A-Za-z0-9]{1,4}$');

alter table public.workspace_docs drop constraint if exists workspace_docs_contributor_tag_check;
alter table public.workspace_docs add constraint workspace_docs_contributor_tag_check
  check (contributor_tag is null or contributor_tag ~ '^[A-Za-z0-9]{1,4}$');

alter table public.tasks drop constraint if exists tasks_contributor_tag_check;
alter table public.tasks add constraint tasks_contributor_tag_check
  check (contributor_tag is null or contributor_tag ~ '^[A-Za-z0-9]{1,4}$');

alter table public.meetings drop constraint if exists meetings_contributor_tag_check;
alter table public.meetings add constraint meetings_contributor_tag_check
  check (contributor_tag is null or contributor_tag ~ '^[A-Za-z0-9]{1,4}$');

alter table public.announcements drop constraint if exists announcements_contributor_tag_check;
alter table public.announcements add constraint announcements_contributor_tag_check
  check (contributor_tag is null or contributor_tag ~ '^[A-Za-z0-9]{1,4}$');
