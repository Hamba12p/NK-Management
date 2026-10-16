# Intern function guard diffs

The migration injects one guard after the first `BEGIN` in each unchanged reviewed body, preserving every remaining line. It aborts if the expected marker cannot be found. Each function change is shown separately below.

## `public.archive_owned_content(text, uuid)`

```diff
 begin
+  if public.is_intern() then raise exception 'Intern access to this operation is denied'; end if;
   if v_actor is null then
```

This `SECURITY DEFINER` function also checks authentication, row ownership and admin override before archiving each supported type.

## `public.sync_meeting_event()`

```diff
begin
+  if public.is_intern() then raise exception 'Intern access to this operation is denied'; end if;
  if new.status = 'cancelled' then
```

This trigger function has no caller role/ownership check and mirrors meetings into the closed `events` table. Interns cannot insert or update meetings, so they cannot trigger it.

## `public.refresh_volunteer_hours_total()`

```diff
begin
+  if public.is_intern() then raise exception 'Intern access to this operation is denied'; end if;
  v_profile_id := case when tg_op = 'DELETE' then old.volunteer_id else new.volunteer_id end;
```

This trigger function has no actor check and recomputes a closed volunteer profile total. Interns cannot mutate volunteer-hours rows.

## `public.complete_meeting_and_carry_forward(uuid)`

```diff
begin
+  if public.is_intern() then raise exception 'Intern access to this operation is denied'; end if;
  if v_actor is null then raise exception 'You must be signed in'; end if;
```

The existing invoker function also checks meeting creator/admin/manager authority. The added guard prevents its reads and writes to meetings, agenda items and events for interns.

## `public.generate_hub_rotation(uuid, timestamptz, integer, text, text)`

```diff
begin
+  if public.is_intern() then raise exception 'Intern access to this operation is denied'; end if;
  if v_actor is null then raise exception 'You must be signed in'; end if;
```

The existing invoker function checks admin/manager role. The added guard prevents rotation, event and session work for interns.

## `public.complete_hub_class_session(uuid)`

```diff
begin
+  if public.is_intern() then raise exception 'Intern access to this operation is denied'; end if;
  if v_actor is null then raise exception 'You must be signed in'; end if;
```

The existing invoker function checks admin/manager role. The added guard prevents session, event and volunteer-hours changes for interns.

## `public.enrol_hub_learner(text, uuid, date, text)`

```diff
begin
+  if public.is_intern() then raise exception 'Intern access to this operation is denied'; end if;
  if v_actor is null then raise exception 'You must be signed in'; end if;
```

The existing invoker function checks admin/manager role. The added guard prevents learner, enrolment and guardian-contact work for interns.

## Trigger functions intentionally not guarded

`handle_new_user()` and `sync_profile_foundations()` are security-definer triggers needed while creating an intern. Their existing auth/profile row handling remains unchanged except that the auth trigger now accepts `intern` metadata. `sync_profile_foundations()` still creates preferences for every profile and only creates volunteer profiles for the existing three volunteer roles; it therefore skips interns.

`save_workspace_document()` and `restore_workspace_document_version()` are security invoker functions. Their bodies check document ownership or admin/manager role, so an intern can use them only on their own drafts under RLS. `profile_initials(text)` is immutable and not security definer.
