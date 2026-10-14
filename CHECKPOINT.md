# CHECKPOINT — v0.6.10 funding-block pass (the branch is the working store; this history dies with the branch deletion)

Updated: 2026-10-14, session 5, checkpoint 5 (operating-ui and financing-ui re-anchored green and pushed).

## Last verified step
Checkpoint 5: two suites re-anchored to the shorePowerProgram fixture and green — web/test/operating-ui.test.tsx 12/12 (maintenance derived total €12 000,00 k = 0.5% of the 120 M capex base over the 20-year window; the first-collection-year override enters calendar years under the preset start year 2026, entry 2027 → model year 2; Mode B at the gross-of-funding term-20 payment 4017471.445590696 → "Solved term: 20 years (240 payments; last payment month 275)") and web/test/financing-ui.test.tsx 8/8 (loadFinancing replaces enableFinancing — the fixture arrives enabled sharePct 0 / perLine 31.69 / 3.5% / term 20 / grace 3; the per-line override pin p1 "31.69"; the debt schedule 3206705.47 / 4099568.51 / 133349.53 with min DSCR 4.3189 in 2048; the zero-outlay note via share 100 + the three per-line shares raised + service start 6; the leveraged P_L 2698180.689756401 → "€2 698 k"; FIN-LEVERAGED-MODE without the enable toggle). All figures engine-verified by scratch harness before re-anchoring; the harnesses are deleted. tsc clean.

## Battery counts at this checkpoint
- core: 26 files / 277 tests — all green.
- web: demo-rotation 15/15, funding-ui 5/5, tariff-span-ui 4/4, operating-ui 12/12, financing-ui 8/8 green locally; the remaining pre-re-anchor suites still carry the backlog (was 66 failures; operating-ui carried 3 and financing-ui 5, so 58 remain).

## Outstanding unverified edits
None. Everything re-applied so far is in this push.

## Next action
Continue the remaining re-anchor suites one at a time (sections, designpass, app, app-design, edges, collections-ui, polish, design, design-overhaul, print-structure, design-remediation, multicontract-ui, units, xlsx, tariff-ui, profiles-scenarios, project-file, remediation062, remediation065, remediation, remediation061, webdisplay, chartlayer), each pushed at green with this file updated; then the xlsx and project-file test additions, the full battery both workspaces, the squash-merge citing the directive parent 5368e1db verbatim, the CI gate, and the live-bundle check.
