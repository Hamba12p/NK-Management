-- Run after all migrations in a disposable Supabase database.
\set ON_ERROR_STOP on
begin;

insert into auth.users(id, email) values
  ('72000000-0000-4000-8000-000000000001', 'notification-a@example.invalid'),
  ('72000000-0000-4000-8000-000000000002', 'notification-b@example.invalid');

insert into public.notifications (recipient_id, type, entity_id, url)
values (
  '72000000-0000-4000-8000-000000000001',
  'comment',
  '73000000-0000-4000-8000-000000000001',
  '/dashboard/workspace'
);

select 1 / case
  when not has_table_privilege('authenticated', 'public.push_subscriptions', 'select')
    and not has_table_privilege('authenticated', 'public.push_subscriptions', 'insert')
  then 1 else 0 end as subscriptions_service_role_only;

select set_config('request.jwt.claim.sub', '72000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select 1 / case when count(*) = 1 then 1 else 0 end as own_notification_read
from public.notifications;
select 1 / case when count(*) = 1 then 1 else 0 end as own_settings_read
from public.notification_settings;
update public.notifications set read_at = now()
where recipient_id = auth.uid();
update public.notification_settings set comments_enabled = false
where user_id = auth.uid();
reset role;

select set_config('request.jwt.claim.sub', '72000000-0000-4000-8000-000000000002', true);
set local role authenticated;
select 1 / case when count(*) = 0 then 1 else 0 end as other_notification_hidden
from public.notifications;
select 1 / case when count(*) = 0 then 1 else 0 end as other_settings_hidden
from public.notification_settings
where user_id = '72000000-0000-4000-8000-000000000001';
update public.notification_settings set comments_enabled = true
where user_id = '72000000-0000-4000-8000-000000000001';
do $$
begin
  begin
    insert into public.push_subscriptions (
      user_id, endpoint, p256dh, auth, device_label, platform
    ) values (
      '72000000-0000-4000-8000-000000000001',
      'https://fcm.googleapis.com/fcm/send/example',
      'p256dh',
      'auth',
      'Other device',
      'Desktop'
    );
    raise exception 'An authenticated user inserted a push subscription directly';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.notifications (recipient_id, type, entity_id, url)
    values (
      '72000000-0000-4000-8000-000000000002',
      'upload',
      '73000000-0000-4000-8000-000000000002',
      '/dashboard/documents'
    );
    raise exception 'An authenticated user inserted an inbox notification';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select 1 / case when comments_enabled then 0 else 1 end as other_settings_unchanged
from public.notification_settings
where user_id = '72000000-0000-4000-8000-000000000001';
rollback;

select 'PASS: subscription secrets are service-role only; inbox and settings access are recipient scoped' as result;
