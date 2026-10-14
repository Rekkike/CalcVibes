# CHECKPOINT — v0.6.10 funding-block pass (the branch is the working store; this history dies with the branch deletion)

Updated: 2026-10-14, session 5, checkpoint 12 (multicontract-ui re-anchored green and pushed).

## Last verified step
Checkpoint 12: web/test/multicontract-ui.test.tsx re-anchored and green 14/14 — HORIZON-DISPLAY on shorePowerProgram (cost program constituent at month 60); LEGACY-XLSX inventory ["Inputs","Cost lines","Repayment","Collections schedule","Metrics"] on the base demo; VERSION v0.6.10. Preceding: checkpoint 11 the design family re-anchored green — design-overhaul 15/15 (APP-ROWS six composition rows, DONUT-WORKING six segments, six colors, six labels outside the geometry), design 15-file suite green (investment composition rows six), print-structure green (one composition figure, six labeled rows), design-remediation 10/10 (OVERVIEW-SUMMARY on shorePowerProgram, VERSION v0.6.10). Preceding: checkpoint 10 polish.test.tsx re-anchored and green 17/17 — composition rows 6 with first row "Container shore power — engineering & studies (RSP JV)" 16.5% 74 000; VERSION v0.6.10 everywhere; deal tiles 9 labels including Equity outlay / Equity IRR / Minimum DSCR. Preceding: checkpoint 9 collections-ui.test.tsx re-anchored and green 4/4 — the yearly detail grids on the program fixture: cost grid rows cost:p1–p6 plus operating o1/o2; collections grid 8 rows (tariff r1–r4, grant g1–g3, funding-loan l1); tariff r1 total "€490 354,39 k", tariff r2 total "€96 808,39 k" (grid totals rows present). The Alpha-template route tests are unchanged and pass. Preceding: checkpoint 8 app 4/4, app-design 7/7, edges 7/7 (program demo label, app stats payment "€2 843 k" / total cost "€628 250 k", c1→p1 id swaps); checkpoint 7 designpass 15/15; checkpoint 6 sections 5/5; checkpoint 5 operating-ui 12/12 and financing-ui 8/8; checkpoint 4 tariff-span-ui 4/4 (new); checkpoint 3 funding-ui 5/5 (new); checkpoint 2 demo-rotation 15/15. tsc clean at each push.

## Battery counts at this checkpoint
- core: 26 files / 277 tests — all green (verified session 5 start).
- web: 351 tests total. Green locally: demo-rotation 15, funding-ui 5, tariff-span-ui 4, operating-ui 12, financing-ui 8, sections 5, designpass 15, app 4, app-design 7, edges 7. Backlog remaining: 31 failures (42 re-verified minus polish 3, design 1, design-overhaul 1, print-structure 1, design-remediation 2, multicontract-ui 3).

## Outstanding unverified edits
None. Everything applied so far is in this push.

## Next action
Continue the remaining re-anchor suites one at a time (collections-ui, polish, design, design-overhaul, print-structure, design-remediation, multicontract-ui, units, xlsx, tariff-ui, profiles-scenarios, project-file, remediation062, remediation065, remediation, remediation061, webdisplay, chartlayer, appraisal-ui), each pushed at green with this file updated; then the xlsx and project-file test additions, the full battery both workspaces, the squash-merge citing the directive parent 5368e1db verbatim, the CI gate, and the live-bundle check.
