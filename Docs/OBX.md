# OBX: Your Udada Passport

## Current implementation status

The public sign-in, signed volunteer session, answer recording, six-stop draft course, safeguarding pass logic, sign-off, management roster tools, CSV import/export, progress summary, nudge list, reset workflow, badge download/share and Pocket Card are implemented. Safeguarding and organisation content remain draft and must be reviewed before launch.

## Editing content and pass marks

English learner content is in `src/content/obx/en/stops.ts`. It is kept separate from the answer key at `src/lib/obx/answer-key.ts`, which is server-only. Add future languages as sibling locale files and keep keys out of client components. All current teaching content is draft.

Change `OBX_CONFIG.passMarks.keepingChildrenSafe` in `src/content/obx/config.ts` to change the safeguarding threshold. The default is 80 percent. Other stop scores do not block completion. Change `courseVersion` when a course update needs to be recorded on new progress rows, and change `mouVersion` when the signed MOU changes.

## Roster and numbers

Issue each volunteer a unique random `NKV-###` number from 100 through 9999. Never reuse a number. Add the volunteer's name, email, and phone to `volunteer_roster`; public passport lookup requires both email and phone. Numbers are assigned by the database when an administrator adds/imports a roster record, or may be supplied explicitly during import. Keep roster data and personal contact details in Supabase, not source control. Store email in lower case and phone in international E.164 format.

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

The roster and progress migrations enable RLS, restrict direct access for `anon` and ordinary authenticated users, and grant only management reads plus trusted server access. The volunteer-number migration grants number allocation to `service_role` only. After applying, run `supabase/tests/obx_access.sql` as a database owner and verify management access with real admin, manager and DPO accounts in a staging project. The migrations have not been applied to the hosted project in this implementation.

The public passport does not send verification messages. Volunteers enter the email and phone recorded on their active roster entry. An exact match displays the rostered name and assigned number, then offers a separate button to start OBX. This is a roster lookup, not identity verification: anyone who knows both contact details can view that name/number and start the passport. Keep roster contacts current and do not treat this flow as proof of identity for other services.

## Content and launch review checklist

- [ ] Safeguarding lead reviews every scenario, the pass flow, definitions, response steps, reporting timeline, and the designated safeguarding contact.
- [ ] Management verifies the 2024 founding date, Kampala base, youth-led description, mission wording, beneficiaries, SDG references, and five-pillar descriptions.
- [ ] Management verifies the MOU summary, version and public MOU URL.
- [ ] Add and verify the privacy notice URL and confirm the notice accurately describes access, retention and purpose.
- [ ] Set and verify coordinator, safeguarding, DPO and general help contacts.
- [ ] Confirm whether the optional story video is used. If so, review its URL, captions, consent and accessibility.
- [ ] Legal/DPO review the data handling text and Uganda Data Protection and Privacy Act 2019 reference.
- [ ] Review every draft answer, explanation, recap and interaction with programme leads.
- [ ] Test mobile, keyboard, reduced motion, session expiry, resume, simultaneous sessions and database outage states.
- [ ] Apply migrations to staging, verify access policies, then apply to production in the listed order.

Do not mark safeguarding material final before safeguarding lead approval.
