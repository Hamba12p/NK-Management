# OBX: Your Udada Passport

## Current implementation status

The OBX app supports public registration using any two of name, email, and phone; a honeypot, minimum form time, hashed IP/contact rate limits; StaffHub-authenticated sessions; signed passport sessions; answer recording; sign-off; management roster tools; CSV import/export; progress summaries; nudge list; reset workflow; and badge download/share. The Pocket Card is not exposed because approved safeguarding and privacy contacts are not configured.

## Editing content and pass marks

English learner content is in `src/content/obx/en/stops.ts`. It is kept separate from the answer key at `src/lib/obx/answer-key.ts`, which is server-only. Add future languages as sibling locale files and keep keys out of client components. All current teaching content is draft.

Change `OBX_CONFIG.passMarks.keepingChildrenSafe` in `src/content/obx/config.ts` to change the safeguarding threshold. The default is 80 percent. Other stop scores do not block completion. Change `courseVersion` when a course update needs to be recorded on new progress rows, and change `mouVersion` when the signed MOU changes.

## Roster and numbers

Issue each volunteer a unique random NKV number. Volunteers and interns use `NKV-100` through `NKV-9999`; management roles use `NKV-001` through `NKV-099`. The allocator is serialized in the database and will not reuse a number while it remains in the roster. New StaffHub users are linked to a roster row the first time they continue with their authenticated StaffHub account. Public registration accepts any two of name, email, and phone and stores provided contact information in `volunteer_roster`. Details are not verified: this is an OBX onboarding route, not authentication for sensitive services. Keep roster data and personal contact details in Supabase, not source control.

The fake seed script is for local or isolated test projects only:

```powershell
npm run seed:obx
```

It inserts fake records numbered NKV-900 onward and uses `.invalid` email addresses. It requires `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Do not run it against production.

## Reset and versioning

Reset creates a new `obx_progress` cycle and retains the old progress and answers. It is administrator-only. Do not reset a real volunteer by deleting their history. Bump `OBX_CONFIG.courseVersion` for a new course cycle.

## Environment variables

- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL, already used by the hub.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: public browser key, already used by the hub.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only key used by public OBX handlers. Never add a `NEXT_PUBLIC_` prefix.
- `OBX_SESSION_SECRET`: random secret of at least 32 characters for signed session cookies.
- `OBX_IP_SALT`: random secret of at least 32 characters for keyed hashes of IP addresses and volunteer numbers.

The last three values must be set in local server environment and the hosting provider before OBX can sign users in. Keep secrets out of source control and client bundles.

## Database migrations

Apply the following SQL files in order in the Supabase SQL Editor, or through your reviewed migration deployment process:

1. `supabase/migrations/20261017070238_obx_roster_and_auth_attempts.sql`
2. `supabase/migrations/20261017070239_obx_progress_results_and_answers.sql`
3. `supabase/migrations/20261017070240_obx_management_read_policies.sql`
4. `supabase/migrations/20261024145000_obx_volunteer_phone_and_random_numbers.sql`
5. `supabase/migrations/20261026090000_obx_open_registration.sql`
6. `supabase/migrations/20261026103300_obx_staffhub_identity_and_flexible_registration.sql`
7. `supabase/migrations/20261026105800_obx_legal_consent.sql`
8. `supabase/migrations/20261026115500_obx_profile_link_schema.sql`

The roster and progress migrations enable RLS, restrict direct access for `anon` and ordinary authenticated users, and grant management reads plus trusted server access. Number allocation and registration functions are restricted to `service_role`. Migration 6 adds a unique StaffHub profile link, flexible two-field registration, the management number range, and Nakitto Reges (`regesnakitto@gmail.com`) to the active roster; if her intern profile already exists, it links it. Migration 7 adds the versioned legal-consent table with management-only reads and trusted server writes. Apply these migrations to staging first, run `supabase/tests/obx_access.sql`, `supabase/tests/intern_access.sql`, and `supabase/tests/obx_legal_consent.sql`, and verify with admin, manager, DPO, volunteer, and intern accounts.
Migration 8 adds a unique StaffHub profile link and links Hamba Shabil's existing active OBX row to his verified manager profile without changing his volunteer number or StaffHub role. Volunteer, senior-volunteer and volunteer-lead roles are restricted to OBX routes; the volunteer representative exception requires setting the server-only `STAFFHUB_VOLUNTEER_REP_EMAIL` to the verified representative's exact StaffHub email.
The StaffHub dashboard shows an OBX passport card for staff accounts, linking to the public onboarding flow.

The public passport does not send verification messages. A successful registration immediately creates or matches an active roster entry and issues a number. The volunteer must read and accept the current in-page Privacy Notice and Volunteer MOU before course progress is created or resumed. Any two of name/email/phone can match an existing record; entries are not verified. Prefer the StaffHub account button for existing staff. Do not treat public OBX registration as proof of identity for other services.

## Content and launch review checklist

- [ ] Safeguarding lead reviews every scenario, the pass flow, definitions, response steps, reporting timeline, and the designated safeguarding contact.
- [ ] Management verifies the 2024 founding date, Kampala base, youth-led description, mission wording, beneficiaries, SDG references, and five-pillar descriptions.
- [ ] Management verifies the in-page MOU summary and legal version.
- [ ] Verify the safeguarding escalation route and coordinator contacts outside the app; only expose a pocket card after these are approved and configured.
- [ ] Review the in-page Privacy Notice and Volunteer MOU in `src/lib/obx/legal-content.ts` for organisational approval and ensure consent version `2026-10-26` is correct.
- [ ] Confirm whether the optional story video is used. If so, review its URL, captions, consent and accessibility.
- [ ] Legal/DPO review the data handling text and Uganda Data Protection and Privacy Act 2019 reference.
- [ ] Review every answer, explanation, recap, interaction, and organisation fact with programme leads and safeguarding leadership.
- [ ] Test mobile, keyboard, reduced motion, session expiry, resume, simultaneous sessions and database outage states.
- [ ] Apply migrations to staging, verify access policies, then apply to production in the listed order.

Do not mark safeguarding material final before safeguarding lead approval.
