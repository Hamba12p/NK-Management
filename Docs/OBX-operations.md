# OBX Operations

## Applying schema changes

Review and apply the OBX migrations in the order documented in `Docs/OBX.md`. They are SQL files under `supabase/migrations/`. Confirm the resulting migration ledger and schema in the correct Supabase project. Do not assume a successful website build applies SQL.

## Initial setup

Set the Supabase URL and publishable key already used by the hub. Add `SUPABASE_SERVICE_ROLE_KEY`, `OBX_SESSION_SECRET`, and `OBX_IP_SALT` to the server environment. Generate separate random secrets for the two OBX values. Redeploy after setting production variables.

## Managing course settings

Review `src/lib/obx/legal-content.ts` before launch. The Privacy Notice and Volunteer MOU are served in-page and require separate recorded consent for the current legal version. Apply the additive consent migration before deploying this flow. The Pocket Card remains unavailable until approved safeguarding and privacy contacts can be published with it.

## Failure response

Public handlers return a generic connection message when configuration or the database is unavailable. For `/api/obx/lookup`, the server logs a stage and database error code without logging contact data or secret values. Check the matching Vercel function log:

- `Required server configuration is missing or invalid`: configure `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OBX_SESSION_SECRET`, and `OBX_IP_SALT` (each secret at least 32 characters) in the production environment, then redeploy.
- `lookup rate-limit check` or `lookup attempt logging`: apply the OBX database migrations in the documented order and verify service-role grants.
- `volunteer registration or lookup`: confirm the registration migration and database function are current; public entry requires any two of name, email, and phone.
- `Volunteer session start failed`: check the matching OBX progress schema and database error code.

Never include a volunteer email, phone, or number in support logs or URLs, and never paste secret values into tickets.

## Public volunteer lookup

The public passport sends no email or SMS. It accepts any two of name, email, and phone, creates or matches an active roster row, and sets a five-minute signed, HTTP-only pending cookie. New users start their passport immediately; returning public users confirm and start it. Lookup requests are rate-limited by IP and a keyed hash of the supplied identity pair; raw contact details are not written to the attempt log.
StaffHub users should choose **Continue with my StaffHub account**. The server validates the Supabase Auth session, links the user's profile to their OBX roster record, issues a management-range number for admin/manager/DPO/board-advisor roles, and logs `obx.started` against the authenticated StaffHub profile. Intern accounts with expired access are rejected; start-date restrictions do not block the requested OBX onboarding route.
Volunteer, senior-volunteer and volunteer-lead StaffHub roles are redirected to OBX and cannot call non-OBX application APIs. The sole volunteer-lead exception requires setting the server-only `STAFFHUB_VOLUNTEER_REP_EMAIL` to the verified representative's exact StaffHub email. Leave it unset until the account is confirmed; never use a shared or unidentified account.
The former `/api/obx/request-link` endpoint is retained only as a `410 Gone` response; it does not send email or SMS.
Adding or editing a local workbook does not update the production roster. A coordinator must import the CSV through **Dashboard → Onboarding → Import existing volunteers** and resolve any row errors before volunteers can use lookup.

Lookup returns `429 Too Many Requests` with `Retry-After: 900` when 10 attempts from an IP or 5 attempts for a contact pair occur within 15 minutes. Wait before retrying. Public registration accepts any two of name, email, and phone and creates a number when no matching record exists. A `409` means the submitted details conflict with an inactive or differently linked roster record; ask a coordinator to check it. A `404` is returned for likely automated submissions or when no usable record was returned.

This does not prove that the person entering those details owns the email account or phone. A match intentionally reveals the name and volunteer number and allows passport access. Do not reuse this lookup as authentication for unrelated sensitive operations.

Roster editing/import, CSV export, progress summary, nudge list, administrator reset, and badge download/share are available from the Onboarding dashboard and badge page. Import requires any two of `Name`/`Full name`, `Email`, and `Phone`; it can be used with `NK_Udada_Volunteers.xlsx` after saving a local CSV copy. The spreadsheet's `No.` values are ignored because they are not NKV IDs. Missing volunteer numbers are randomly assigned from the appropriate range by the database. Check import errors and duplicates. Keep volunteer contact spreadsheets out of source control and do not include contact data in logs or support messages.

Generated numbers use a database transaction lock so simultaneous registrations do not allocate the same number. Management-role accounts use the random 001–099 range; volunteers and interns use 100–9999. Apply the latest migrations before deploying. For public registrations, any two submitted fields are used to match/create the active roster record. These details are not verified and must not be used as identity proof for sensitive functions.

The dashboard uses copyable invite messages and displays nudge text for inactive volunteers. Activity entries are written for roster additions, deactivations, resets and completions. Content approval and live database migration remain launch prerequisites.
