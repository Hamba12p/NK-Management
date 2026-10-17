# OBX Operations

## Applying schema changes

Review and apply the three migrations in the order documented in `docs/OBX.md`. They are SQL files under `supabase/migrations/`. Confirm the resulting migration ledger and schema in the correct Supabase project. Do not assume a successful website build applies SQL.

## Initial setup

Set the Supabase URL and publishable key already used by the hub. Add `SUPABASE_SERVICE_ROLE_KEY`, `OBX_SESSION_SECRET`, and `OBX_IP_SALT` to the server environment. Generate separate random secrets for the two OBX values. Redeploy after setting production variables.

## Managing course settings

Review `src/content/obx/config.ts` before launch. It contains the course and MOU versions, pass marks, privacy link, contacts, optional video and Pocket Card feature flag. All blank or confirmation values need a named owner and approval before public invitations are sent.

## Failure response

Public handlers return a generic connection message when the service key or database is unavailable. Check server environment configuration, Supabase availability and migration state. Never include a volunteer email or number in support logs or URLs.

Roster editing/import, CSV export, progress summary, nudge list, administrator reset, badge image download, print certificate and Pocket Card are available from the Onboarding dashboard and badge page. The dashboard uses copyable invite messages and displays nudge text for inactive volunteers. Activity entries are written for roster additions, deactivations, resets and completions. Content approval and live database migration remain launch prerequisites.
