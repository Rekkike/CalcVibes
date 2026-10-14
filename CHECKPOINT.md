# CHECKPOINT — v0.6.10 funding-block pass (the branch is the working store; this history dies with the branch deletion)

Updated: 2026-10-14, session 5, checkpoint 8 (app, app-design, and edges re-anchored green and pushed).

## Last verified step
Checkpoint 8: web/test/app.test.tsx green 4/4, web/test/app-design.test.tsx green 7/7, web/test/edges.test.tsx green 7/7. The re-anchors are the program-fixture swaps: the demo label "Shore-power program (Rotterdam)"; the app stats paymentAmount "€2 843 k" and totalCost "€628 250 k" (engine 2843365.6055825967 / 628250000, carried pins); the cost-line id swaps c1→p1 in the line-targeted selectors and the issues-summary message ("Cost line p1 has an empty name.", "Cost line p1 () has a non-positive amount."). The blank-start, STALE-STRING export-disabled, presentation-mode PDF reason, legacy-currency, and PDF-disclosure tests are unchanged and pass on the new fixture. Preceding: checkpoint 7 designpass 15/15; checkpoint 6 sections 5/5; checkpoint 5 operating-ui 12/12 and financing-ui 8/8; checkpoint 4 tariff-span-ui 4/4 (new); checkpoint 3 funding-ui 5/5 (new); checkpoint 2 demo-rotation 15/15. tsc clean at each push.

## Battery counts at this checkpoint
- core: 26 files / 277 tests — all green (verified session 5 start).
- web: 351 tests total. Green locally: demo-rotation 15, funding-ui 5, tariff-span-ui 4, operating-ui 12, financing-ui 8, sections 5, designpass 15, app 4, app-design 7, edges 7. Backlog remaining: 43 failures (48 at session-5 resume minus app 2, app-design 2, edges 1).

## Outstanding unverified edits
None. Everything applied so far is in this push.

## Next action
Continue the remaining re-anchor suites one at a time (collections-ui, polish, design, design-overhaul, print-structure, design-remediation, multicontract-ui, units, xlsx, tariff-ui, profiles-scenarios, project-file, remediation062, remediation065, remediation, remediation061, webdisplay, chartlayer, appraisal-ui), each pushed at green with this file updated; then the xlsx and project-file test additions, the full battery both workspaces, the squash-merge citing the directive parent 5368e1db verbatim, the CI gate, and the live-bundle check.
