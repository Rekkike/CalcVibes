# CHECKPOINT — v0.6.10 funding-block pass (the branch is the working store; this history dies with the branch deletion)

Updated: 2026-10-14, session 5, checkpoint 3 (the funding-ui permanent test green and pushed).

## Last verified step
Checkpoint 3: the new permanent test web/test/funding-ui.test.tsx green 5/5 — FUNDING-ROWS (g1-g3/l1, loan-only term fields), FUNDING-VIEW (grantsTotal "€173 500,00 k", fundingNpv "€140 055,35 k", the three allocations, the g1 paragraph with the full allocation-rule suffix, engine-derived six-row g1 table with p1 "19.55%" / "€13 685,60 k", g3 "90.24%" / "9.76%"), FUNDING-EDITORS (add/remove, loan toggle, FND-AMOUNT through the issues summary), GRANT-SCALE-AXIS (refusal banner, axis explanation, empty-state), GRANT-SCALE-TABLE (core pins 4576582.960344898 / 3990190.2135963826 / 3899397.4844559785 / 3416777.90958949 / 3222212.0085670594 / 2843365.6055825967 with term-25 nulls and the honest refusal message; every rendered cell engine-derived). All pins were script-verified on the rebuilt engine by a scratch harness before the file was written; the harness is deleted (its pins live in the permanent test). Also in this push: the demo-rotation import cleanup (the five display formatters unused after the rewrite, plus the provenance optional-chain typecheck) — demo-rotation still green 15/15, tsc clean in both workspaces.

## Battery counts at this checkpoint
- core: 26 files / 277 tests — all green.
- web: demo-rotation 15/15 and funding-ui 5/5 green locally; the remaining pre-re-anchor suites still carry the documented 72-failure backlog.

## Outstanding unverified edits
None. Everything re-applied so far is in this push.

## Next action
Recreate web/test/tariff-span-ui.test.tsx (4 tests: SPAN-DECLARED, SPAN-ALL-OR-NOTHING, ROW-SPANS, UNIT-PRICE-AND-SEGMENT-RATES), verify its pins by scratch harness, run to green, push; then re-apply the remaining web re-anchor suites one at a time per the 72-failure backlog (operating-ui, financing-ui, sections, designpass, app, app-design, edges, collections-ui, polish, design, design-overhaul, print-structure, design-remediation, multicontract-ui, units, xlsx, tariff-ui, profiles-scenarios, project-file, remediation062, remediation065, remediation, remediation061, webdisplay, chartlayer), each pushed at green; then the xlsx and project-file test additions, the full battery both workspaces, the squash-merge citing the directive parent 5368e1db verbatim, the CI gate, and the live-bundle check.
