# OBX Operations

## Applying schema changes

Review and apply the four OBX migrations in the order documented in `Docs/OBX.md`. They are SQL files under `supabase/migrations/`. Confirm the resulting migration ledger and schema in the correct Supabase project. Do not assume a successful website build applies SQL.

## Initial setup

Set the Supabase URL and publishable key already used by the hub. Add `SUPABASE_SERVICE_ROLE_KEY`, `OBX_SESSION_SECRET`, and `OBX_IP_SALT` to the server environment. Generate separate random secrets for the two OBX values. Redeploy after setting production variables.

## Managing course settings

Review `src/content/obx/config.ts` before launch. It contains the course and MOU versions, pass marks, privacy link, contacts, optional video and Pocket Card feature flag. All blank or confirmation values need a named owner and approval before public invitations are sent.

## Failure response

Public handlers return a generic connection message when the service key or database is unavailable. Check server environment configuration, Supabase availability and migration state. Never include a volunteer email or number in support logs or URLs.

Roster editing/import, CSV export, progress summary, nudge list, administrator reset, badge image download, print certificate and Pocket Card are available from the Onboarding dashboard and badge page. The roster import accepts `Name` or `Full name`, `Email`, and optional `Phone`; it can be used with the `Name`, `Phone`, `Email`, `No.` columns in `NK_Udada_Volunteers.xlsx` after saving a local CSV copy. The spreadsheet's `No.` values are ignored because they are not NKV IDs. Missing volunteer numbers are randomly assigned from `NKV-100` through `NKV-9999` by the database. Check import errors and duplicates before sending invites. Keep volunteer contact spreadsheets out of source control and do not include contact data in logs or support messages.

Generated numbers use a database transaction lock so simultaneous admin imports do not allocate the same number. Apply `supabase/migrations/20261024145000_obx_volunteer_phone_and_random_numbers.sql` before deploying this version of roster import. Volunteers enter an approved roster email or phone on `/obx`; Supabase sends an email magic link or SMS code. After verification, the server displays the assigned volunteer number and starts the passport session. Set up Supabase email SMTP, allow `/obx/verify` in the Auth redirect URL list, and configure an SMS provider before enabling phone sign-in.

The dashboard uses copyable invite messages and displays nudge text for inactive volunteers. Activity entries are written for roster additions, deactivations, resets and completions. Content approval and live database migration remain launch prerequisites.
