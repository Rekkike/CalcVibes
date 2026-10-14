# CHECKPOINT — v0.6.10 funding-block pass (the branch is the working store; this history dies with the branch deletion)

Updated: 2026-10-14, session 5, checkpoint 7 (the designpass suite re-anchored green and pushed).

## Last verified step
Checkpoint 7: web/test/designpass.test.tsx re-anchored and green 15/15 — NAV 11 views with funding in the finance group; ANSWER-BAND and KPI-ROW on the program fixture (IRR 6.05%, min DSCR "4.32" chip "in 2048" via dscrTwoForDisplay + yearHeader); FIGURE-BAND €628 250 000 / €855 907 745 / €227 657 745; WATERFALL-BUILD 7 segments with the W31 closing total bar (data-waterfall-total, "Total program cost €628 250 k"); HURDLE-TRACE and TAKEAWAY-KICKERS ("Market pillar — bulk & liquid berths dominates the cost base") on the program fields. Preceding: web/test/sections.test.tsx re-anchored and green 5/5 — the repayment stats at the program fixture (payment "€2 843 k", 240 payments, start year 3, total collected "€855 907,75 k" including the riding grants), the results section (23 yearly rows, the composition naming "Container shore power — engineering & studies (RSP JV)", payback "13.854", achieved IRR "6.05%", the goal check, and the honest 3-sign-change ambiguity warning), and the recompute pin (term 3 → "€9 733 k", engine 9732652.914261179). Preceding: operating-ui 12/12 (maintenance €12 000,00 k; calendar-year override entry 2027; Mode B gross payment 4017471.445590696 → term 20/240/275) and financing-ui 8/8 (loadFinancing; per-line 31.69; debt schedule 3206705.47 / 4099568.51 / 133349.53, min DSCR 4.3189 in 2048; zero-outlay via share 100 + service start 6; leveraged P_L "€2 698 k"; FIN-LEVERAGED-MODE). All figures engine-verified by scratch harness; the harnesses are deleted. tsc clean.

## Battery counts at this checkpoint
- core: 26 files / 277 tests — all green.
- web: demo-rotation 15/15, funding-ui 5/5, tariff-span-ui 4/4, operating-ui 12/12, financing-ui 8/8, sections 5/5, designpass 15/15 green locally; the remaining pre-re-anchor suites still carry the backlog (was 66 failures; operating-ui 3, financing-ui 5, sections 3, designpass 7 cleared, so 48 remain).

## Outstanding unverified edits
None. Everything re-applied so far is in this push.

## Next action
Continue the remaining re-anchor suites one at a time (sections, designpass, app, app-design, edges, collections-ui, polish, design, design-overhaul, print-structure, design-remediation, multicontract-ui, units, xlsx, tariff-ui, profiles-scenarios, project-file, remediation062, remediation065, remediation, remediation061, webdisplay, chartlayer), each pushed at green with this file updated; then the xlsx and project-file test additions, the full battery both workspaces, the squash-merge citing the directive parent 5368e1db verbatim, the CI gate, and the live-bundle check.
