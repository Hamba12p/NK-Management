# Staff Hub notifications setup

This guide configures generic push alerts and the in-app notification inbox. Push messages contain only the notification type, an inbox identifier and a relative Hub URL. The service worker supplies the generic branded text. Comment text, document titles, task titles and personal information are never sent to a push provider.

## 1. Generate VAPID keys

Run this locally:

```sh
npx web-push generate-vapid-keys
```

Keep the private key secret. Configure these variables in the hosting environment and in local development when testing:

```text
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<generated public key>
VAPID_PRIVATE_KEY=<generated private key>
VAPID_SUBJECT=mailto:admin@the-nkfoundation.org
PUSH_DISPATCH_SECRET=<long random shared secret>
CRON_SECRET=<long random scheduled-job secret>
```

`NEXT_PUBLIC_VAPID_PUBLIC_KEY` is intentionally public. Keep all other values server-side. Do not commit their values. The Vercel cron job uses `CRON_SECRET`; Vercel sends it as a bearer token.

## 2. Apply the additive migration

Apply `supabase/migrations/20261026160000_staffhub_push_notifications.sql` to the hosted database. It adds device subscriptions, user notification settings, an in-app inbox, recipient-scoped RLS, Realtime publication, and guarded event triggers. It does not alter or remove existing tables or policies.

The Supabase Database Webhooks feature uses the `pg_net` extension. Before configuring the webhook, confirm it is enabled for the hosted project. The repository environment could not verify the linked project's extension state because the Supabase Management API returned 403 for the available account. Do not enable production delivery until the project owner confirms the extension and webhook are available.

## 3. Configure the Supabase Database Webhook

In the Supabase Dashboard, open **Database → Webhooks** and create an HTTP webhook:

- Name: `staffhub-push-dispatch`
- Table: `public.notifications`
- Event: `INSERT`
- Method: `POST`
- URL: `https://app.the-nkfoundation.org/api/push/dispatch`
- Header: `x-push-dispatch-secret: <the exact PUSH_DISPATCH_SECRET value>`
- Content type: `application/json`; the default webhook payload must include the inserted row in its `record` field.

Use the same secret in the hosting environment and in the webhook header. Do not put the secret in the URL. The route accepts only authenticated webhook requests and has no CORS allowance. Allow enough time for the route to dispatch push messages to registered devices; there is no app-specific webhook timeout requirement.

If the project's hosted plan or configuration does not provide Database Webhooks, use a trusted server-side Supabase Edge Function or a `pg_net` HTTP trigger to POST the same insert record to this route with the same secret header. Do not call the route from the browser.

## 4. Scheduled quiet-hour delivery

`vercel.json` schedules `/api/push/dispatch` at 04:00 UTC, which is 07:00 in Kampala. Vercel must have `CRON_SECRET` configured. The route verifies the Vercel bearer token and dispatches notifications held during quiet hours, plus eligible retries. The in-app notification is written immediately, even when push delivery is deferred.

## 5. Settings and privacy checks

- The browser asks for notification permission only after a user presses **Turn on notifications** or enables the device in Settings.
- Each signed-in user can review and remove their own registered devices.
- Signing out removes the current device subscription and unsubscribes the browser.
- Push payloads contain only `type`, `id` and a same-origin relative `url`.
- The inbox stores generic notification type, entity identifier, relative URL and timestamps. It does not store message preview text.
- Review the device-storage explanation in Settings with the Data Protection Officer before launch.
- Check that Settings defaults, role-based upload notification defaults, and the old in-app master preference match the organisation's policy.

## 6. Manual test checklist

Use test accounts with different roles and documents with different visibility/assignment settings. Avoid using real learner, health or volunteer details.

1. **Desktop Chrome and Edge:** sign in, confirm the banner appears without a permission prompt, enable notifications by button, send a test notification, then disable and remove the device.
2. **Desktop Firefox and Safari:** confirm the notification bell and in-app inbox work. Where push is supported, test enable, test alert, remove, and sign-out cleanup. Unsupported browsers should show the bell without errors.
3. **Android Chrome and Samsung Internet:** test in a browser tab and after adding the Hub to the Home Screen. Test test-notification delivery, tapping a notification while the Hub is open and closed, and sign-out.
4. **Firefox for Android:** verify the in-app inbox works and push degrades clearly if unavailable in the installed browser.
5. **iPhone and iPad on iOS 16.4 or later:** in Safari, check the Add to Home Screen instructions. Open the installed Hub, enable push, send a test, tap it, then sign out and confirm the device subscription is removed.
6. **Comments:** add a comment as a second user. Confirm only the document owner and prior commenters receive a generic inbox alert, the author receives none, and interns are notified only when they own the document. Add several comments within two minutes and confirm they collapse to one notification per recipient.
7. **Assignments:** create a task assigned to another account and confirm the assignee receives one alert. Confirm self-assignment and label-only tasks do not notify. Change the assignee and confirm only the new assignee receives an alert.
8. **Uploads:** upload a standard, assigned and restricted document. Verify recipients exactly match the access rules, the uploader and interns receive no upload alert, and deleted rows do not send alerts.
9. **Preferences:** disable each category and the in-app master switch separately. Verify disabled categories do not create new inbox entries or push alerts. Test default settings for an admin, manager, DPO, volunteer and intern.
10. **Quiet hours:** create an eligible event during 21:00–07:00 Africa/Kampala. Confirm the inbox entry appears immediately, push waits until after 07:00, and a setting with quiet hours disabled sends promptly.
11. **Access and privacy:** attempt to read another account's subscriptions, settings and notifications. Confirm RLS denies access and direct inbox insertion is denied. Inspect a captured push payload and verify it contains no titles, names or message text.
12. **Realtime and recovery:** keep the bell open while a second user creates an event, then test focus refresh after temporarily disconnecting Realtime. Confirm mark-read and mark-all-read affect only the signed-in user's inbox.
