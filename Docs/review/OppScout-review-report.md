# OppScout Technical Review, Revision 2: repository verification

## Time-sensitive

The attached assignment asks for verification of scholarship and vacancy deadlines, including a claimed Commonwealth Master's and PhD deadline of 20 October 2026. This checkout is **not** the OppScout repository and contains no catalogue snapshot or source records. Those dates are therefore **UNVERIFIABLE** here. The owner should verify them directly on the Commonwealth Scholarship Commission, Chevening and UNICEF official pages before relying on the dates.

## Executive verdict

**BLOCKER: the requested review cannot be completed against this checkout as supplied.**

The task identifies repository `Hamba69/OPPSCOUT`, branch `main`, and requires OppScout-specific files. The current checkout is `Hamba12p/NK-Management` at commit `42093863110f29912b98ad80ae2cdf12496c22b8`, with an NK Udada staff hub and OBX onboarding feature. None of the required OppScout inputs exist:

- `docs/audits/catalog-snapshot.json`
- `scripts/audit-catalog.ts`
- `docs/deviations.md`
- `docs/LAUNCH_READINESS_100_USERS.md`
- `prisma/schema.prisma`
- `scripts/check-rls.ts`
- `src/services/`

No source, schema, configuration, migration, production system or database was changed. The only additions are this review evidence and the offline prerequisite-check script, both under the locations permitted by the attached assignment.

## V0 baseline

| Check | Result | Evidence |
|---|---|---|
| Repository commit | Confirmed | `git rev-parse HEAD`: `42093863110f29912b98ad80ae2cdf12496c22b8` |
| Repository identity | Mismatch | Current working tree is NK Management; attached task names Hamba69/OPPSCOUT |
| Node | Confirmed | `v24.13.0` |
| npm | Confirmed | `11.6.2` |
| Env file names | Present | `.env.example`, `.env.local`, `.env.local.example`; values were not read |
| OppScout catalogue snapshot | Missing | `Test-Path docs\audits\catalog-snapshot.json` returned false |
| OppScout Prisma schema | Missing | `Test-Path prisma\schema.prisma` returned false |
| Unit tests | Passed for current project | 4 passed, 0 failed; these are OBX tests |
| Lint | Passed with warnings | Exit code 0, 0 errors, 15 warnings |
| Typecheck | Passed for current project | `npx tsc --noEmit` exit code 0 |
| RLS check | Not runnable | `scripts/check-rls.ts` is absent |
| Database verification | Not run | No database access was used or required |

Reproduce the OppScout prerequisite check with:

```powershell
node scripts/review/verify-all.mjs
```

It exits non-zero intentionally while the required OppScout inputs are absent.

## Claim register verdicts

The requested F1 to F13 and S1 to S12 claims are all **UNVERIFIABLE**, severity **BLOCKER**, in this checkout. Verifying them would require the OppScout repository at the named commit or a complete source snapshot containing the named files. Assigning CONFIRMED, PARTIAL, REFUTED or STALE from NK Management files would fabricate evidence.

| Claim group | Verdict | Severity | Missing evidence |
|---|---|---|---|
| S1-S12 catalogue and arithmetic | UNVERIFIABLE | BLOCKER | `docs/audits/catalog-snapshot.json` |
| F1-F3 catalogue, source and review scripts | UNVERIFIABLE | BLOCKER | OppScout catalogue and `scripts/review-*` |
| F4 discovery workers and promotion path | UNVERIFIABLE | BLOCKER | OppScout worker and storage code |
| F5 Prisma model freeze | UNVERIFIABLE | BLOCKER | `prisma/schema.prisma`, migrations |
| F6 profile eligibility fields | UNVERIFIABLE | BLOCKER | OppScout domain and schema files |
| F7-F8 matching and hard gates | UNVERIFIABLE | BLOCKER | `engine-selector.ts`, matching tests and rules |
| F9 automated signals and reports | UNVERIFIABLE | BLOCKER | `automated-signals.ts`, report model |
| F10-F12 ingestion and lifecycle | UNVERIFIABLE | BLOCKER | ingestion adapters and repository tests |
| F13 Anthropic extraction and spend controls | UNVERIFIABLE | BLOCKER | `anthropic-extractor.ts`, `ai-rules.ts` |
| RLS, feature flags, import safety and test counts | UNVERIFIABLE | BLOCKER | OppScout schema, migrations, scripts and tests |

## Findings not in the plan

No OppScout-specific additional findings can be made responsibly. The repository mismatch itself is an additional process finding:

| Finding | Verdict | Severity | Evidence |
|---|---|---|---|
| Review target and checkout do not match | CONFIRMED | BLOCKER | Current tree contains `src/app/obx`, `supabase/migrations` and `tests/obx.test.mjs`; all required OppScout paths are absent |

## What was not done, and why

- No web deadline verification was performed because the attached review cannot be tied to records in this checkout, and the named OppScout catalogue is absent.
- No `docs/review/evidence/snapshot-verification.txt` was generated because there is no snapshot to compute from.
- No F7, F8 or F11 reproduction scripts were generated because the referenced implementation and memory adapter do not exist here.
- No V3 gate matrix or implementation plan was generated because the real `UserProfile`, `Opportunity`, matching engine and Appendix B inputs are absent.
- No production or database claims are made.

## Required next step

Provide or check out `Hamba69/OPPSCOUT` at the intended `main` revision, including the named snapshot and source files. Then rerun the review workflow in this document's validation log. The current NK Management checkout should not be used to approve or reject OppScout remediation work.
