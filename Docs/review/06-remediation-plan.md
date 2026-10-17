# OppScout remediation execution plan

This plan is ready to execute once the correct `Hamba69/OPPSCOUT` checkout and its review inputs are supplied. It deliberately contains no implementation changes because the attached assignment prohibits product edits during this run.

## Batch 0: establish the correct baseline

1. Check out the intended OppScout repository and record commit, Node, package manager, Next.js and Prisma versions.
2. Convert `OppScout_Technical_Review_Plan_v2.docx` to `docs/review/plan-source.md` if the source document is available.
3. Run install, typecheck, lint, unit, contract, end-to-end and RLS checks without changes.
4. Record all results in `docs/review/05-validation-log.md`.

Exit criteria: the named files exist, the repository identity is confirmed, and baseline failures are separated from remediation failures.

## Batch 1: catalogue and evidence verification

1. Add `scripts/review/verify-snapshot.ts`.
2. Recompute every S1-S12, F1, F2 and grants/cap arithmetic claim from the immutable catalogue snapshot.
3. Test Uganda-location false positives and false negatives and normalise organisation names in a separate comparison.
4. Save machine output to `docs/review/evidence/snapshot-verification.txt`.

Exit criteria: every computed number has claimed value, computed value, verdict and reproducible evidence.

## Batch 2: code finding verification

1. Inspect F1-F13 at the named symbols and record file/line evidence.
2. Add read-only reproductions for F7, F8 and F11 under `scripts/review/`.
3. Run reproductions against the memory adapter or a temporary copy only.
4. Review the additional security and scale checklist: SSRF, prompt injection, service-role exposure, admin auth, rate limits, RLS, import dry-run defaults and feature flags.

Exit criteria: every finding has one of the required verdict labels and a severity for every non-CONFIRMED result.

## Batch 3: proposed gate and matrix verification

1. Implement the review-only `isVisibleToSeeker` harness under `scripts/review/`.
2. Run all applicable Appendix B rows and classify rows by visibility, matching, hard-gate or ingestion scope.
3. Probe remote, non-remote, missing-location, multi-place, expired and unpublished edge cases.
4. Save results and proposed regression tests under `docs/review/proposed-tests/`.

Exit criteria: each matrix row has an expected result, observed result and evidence.

## Batch 4: owner decision register

1. Separate code defects from policy/legal questions.
2. Record counsel questions for privacy, copyright, defamation, registration and submission terms without legal conclusions.
3. Record unresolved production questions requiring database or provider access.
4. Rank remediation work by blocker, major and minor severity.

Exit criteria: the owner can execute the remediation work without repeating discovery, and no live number is presented without a reproducible query.

## Required final verification

After implementation batches are approved and executed in the correct repository:

- run the full baseline suite again;
- run all proposed regressions;
- run RLS and route-authorization checks;
- verify imports remain dry-run by default;
- verify feature flags fail closed when environment variables are missing;
- inspect the final diff for prohibited secret exposure;
- append final results to `docs/review/05-validation-log.md`.
