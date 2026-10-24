# OBX Operations

## Applying schema changes

Review and apply the four OBX migrations in the order documented in `Docs/OBX.md`. They are SQL files under `supabase/migrations/`. Confirm the resulting migration ledger and schema in the correct Supabase project. Do not assume a successful website build applies SQL.

## Initial setup

Set the Supabase URL and publishable key already used by the hub. Add `SUPABASE_SERVICE_ROLE_KEY`, `OBX_SESSION_SECRET`, and `OBX_IP_SALT` to the server environment. Generate separate random secrets for the two OBX values. Redeploy after setting production variables.

## Managing course settings

Review `src/content/obx/config.ts` before launch. It contains the course and MOU versions, pass marks, privacy link, contacts, optional video and Pocket Card feature flag. All blank or confirmation values need a named owner and approval before public invitations are sent.

## Failure response

Public handlers return a generic connection message when configuration or the database is unavailable. For `/api/obx/lookup`, the server logs a stage and database error code without logging contact data or secret values. Check the matching Vercel function log:

- `Required server configuration is missing or invalid`: configure `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OBX_SESSION_SECRET`, and `OBX_IP_SALT` (each secret at least 32 characters) in the production environment, then redeploy.
- `lookup rate-limit check` or `lookup attempt logging`: apply the OBX database migrations in the documented order and verify service-role grants.
- `active volunteer lookup`: confirm the volunteer has an active roster row with the matching email and phone.
- `Volunteer session start failed`: check the matching OBX progress schema and database error code.

Never include a volunteer email, phone, or number in support logs or URLs, and never paste secret values into tickets.

## Public volunteer lookup

The public passport sends no email or SMS. It matches the supplied email and phone against an active roster row, returns only the volunteer's name and number, and sets a five-minute signed, HTTP-only pending cookie. The user must then click **Start my OBX** to exchange that short-lived lookup state for an eight-hour passport session. Lookup requests are rate-limited by IP and a keyed hash of the contact pair; raw contact details are not written to the attempt log.
The former `/api/obx/request-link` endpoint is retained only as a `410 Gone` response; it does not send email or SMS.
Adding or editing a local workbook does not update the production roster. A coordinator must import the CSV through **Dashboard → Onboarding → Import existing volunteers** and resolve any row errors before volunteers can use lookup.

This does not prove that the person entering those details owns the email account or phone. A match intentionally reveals the name and volunteer number and allows passport access. Do not reuse this lookup as authentication for unrelated sensitive operations.

Roster editing/import, CSV export, progress summary, nudge list, administrator reset, badge image download, print certificate and Pocket Card are available from the Onboarding dashboard and badge page. The roster import requires `Name` or `Full name`, `Email`, and `Phone`; both contacts are required for public OBX lookup. It can be used with the `Name`, `Phone`, `Email`, `No.` columns in `NK_Udada_Volunteers.xlsx` after saving a local CSV copy. The spreadsheet's `No.` values are ignored because they are not NKV IDs. Missing volunteer numbers are randomly assigned from `NKV-100` through `NKV-9999` by the database. Check import errors and duplicates. Keep volunteer contact spreadsheets out of source control and do not include contact data in logs or support messages.

Generated numbers use a database transaction lock so simultaneous admin imports do not allocate the same number. Apply `supabase/migrations/20261024145000_obx_volunteer_phone_and_random_numbers.sql` before deploying this version of roster import. Volunteers enter their rostered email and phone on `/obx`; an exact active-row match displays their name and number, then the volunteer can choose **Start my OBX**. No Auth email or SMS provider is required for this flow.

The dashboard uses copyable invite messages and displays nudge text for inactive volunteers. Activity entries are written for roster additions, deactivations, resets and completions. Content approval and live database migration remain launch prerequisites.
