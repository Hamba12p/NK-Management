# OBX Operations

## Applying schema changes

Review and apply the four OBX migrations in the order documented in `Docs/OBX.md`. They are SQL files under `supabase/migrations/`. Confirm the resulting migration ledger and schema in the correct Supabase project. Do not assume a successful website build applies SQL.

## Initial setup

Set the Supabase URL and publishable key already used by the hub. Add `SUPABASE_SERVICE_ROLE_KEY`, `OBX_SESSION_SECRET`, and `OBX_IP_SALT` to the server environment. Generate separate random secrets for the two OBX values. Redeploy after setting production variables.

## Managing course settings

Review `src/content/obx/config.ts` before launch. It contains the course and MOU versions, pass marks, privacy link, contacts, optional video and Pocket Card feature flag. All blank or confirmation values need a named owner and approval before public invitations are sent.

## Failure response

Public handlers return a generic connection message when configuration or the database is unavailable. For `/api/obx/request-link`, the server logs a stage and Supabase error code without logging contact data or secret values. Check the matching Vercel function log:

- `configuration missing or invalid`: configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and an `OBX_IP_SALT` of at least 32 characters in the production environment, then redeploy.
- `rate-limit lookup` or `rate-limit attempt logging`: apply the OBX database migrations in the documented order and verify service-role grants.
- `roster lookup`: apply the phone-and-random-number migration, which adds the `phone` column, and confirm the roster table is available.
- `Supabase Auth user provisioning` or `Supabase verification delivery`: check Supabase Auth configuration, email SMTP and redirect allow-list, or the SMS provider, using the logged error code.

If the existing deployment does not have stage-specific logs, deploy the diagnostic endpoint before retrying. Never include a volunteer email, phone, or number in support logs or URLs, and never paste secret values into tickets.

## Verification messages not arriving

An HTTP `202` from `/api/obx/request-link` is deliberately generic to prevent contact enumeration. It does **not** confirm that the contact was on the roster or that a message reached the inbox/device. Check the Vercel function logs for either `Supabase accepted verification request` or `Supabase verification request failed`; these records include only the channel, status, and safe error identifiers, never the contact.

If Supabase accepted the request but nothing arrives:

1. In the Supabase Dashboard, inspect **Logs → Auth** at the time of the request. Supabase API acceptance means it attempted/queued delivery, not that an email reached an inbox or an SMS reached a handset.
2. For email, configure a production SMTP provider under **Authentication → SMTP Settings**. Supabase's built-in sender is for testing: it only sends to project-team addresses and is rate-limited (currently 2 emails/hour). Configure a verified sender/domain and SPF/DKIM/DMARC with that provider. Check its delivery, bounce, and suppression logs. Confirm the Magic Link template contains `{{ .ConfirmationURL }}`.
3. In **Authentication → URL Configuration**, set the Site URL to `https://staffhub.the-nkfoundation.org` and allow `https://staffhub.the-nkfoundation.org/obx/verify` as a redirect URL.
4. For SMS, enable phone authentication and configure a supported SMS provider in **Authentication → Providers → Phone**. Check provider credentials, account balance/trial restrictions, Uganda (`+256`) destination permissions, sender configuration, and delivery logs. Confirm the SMS template contains `{{ .Code }}`.
5. Check Supabase Auth rate limits and the provider's own rate limits. The app also applies a request limit; wait for its 15-minute window if repeated attempts were made.
6. After changing Auth settings, test one approved contact on an inbox/phone you control. Do not repeatedly resend during troubleshooting.

Supabase setup references: [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [phone sign-in and SMS providers](https://supabase.com/docs/guides/auth/phone-login), and [email OTP/magic-link behavior](https://supabase.com/docs/reference/javascript/auth-signinwithotp).

Roster editing/import, CSV export, progress summary, nudge list, administrator reset, badge image download, print certificate and Pocket Card are available from the Onboarding dashboard and badge page. The roster import accepts `Name` or `Full name`, `Email`, and optional `Phone`; it can be used with the `Name`, `Phone`, `Email`, `No.` columns in `NK_Udada_Volunteers.xlsx` after saving a local CSV copy. The spreadsheet's `No.` values are ignored because they are not NKV IDs. Missing volunteer numbers are randomly assigned from `NKV-100` through `NKV-9999` by the database. Check import errors and duplicates before sending invites. Keep volunteer contact spreadsheets out of source control and do not include contact data in logs or support messages.

Generated numbers use a database transaction lock so simultaneous admin imports do not allocate the same number. Apply `supabase/migrations/20261024145000_obx_volunteer_phone_and_random_numbers.sql` before deploying this version of roster import. Volunteers enter an approved roster email or phone on `/obx`; Supabase sends an email magic link or SMS code. After verification, the server displays the assigned volunteer number and starts the passport session. Set up Supabase email SMTP, allow `/obx/verify` in the Auth redirect URL list, and configure an SMS provider before enabling phone sign-in.

The dashboard uses copyable invite messages and displays nudge text for inactive volunteers. Activity entries are written for roster additions, deactivations, resets and completions. Content approval and live database migration remain launch prerequisites.
