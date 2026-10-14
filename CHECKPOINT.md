# CHECKPOINT — v0.6.10 funding-block pass (the branch is the working store; this history dies with the branch deletion)

Updated: 2026-10-14, session 5, checkpoint 4 (the tariff-span-ui permanent test green and pushed).

## Last verified step
Checkpoint 4: the new permanent test web/test/tariff-span-ui.test.tsx green 4/4 — SPAN-DECLARED (span fields "3"/"20" initializing from the declared span, header "Volume grid (collection years 3–23, declared tariff span) — volumes in GWh", 25 th with first grid column 2028), SPAN-ALL-OR-NOTHING (clear → placeholders "3"/"20" and the derived-from-the-model-span header; a start year alone stays derived; term "21" declares years 3–24 with 26 th), ROW-SPANS (r1 inherit placeholders, r2 5/19, r3 6/18, r4 6/18 initializing from the preset row spans; clearing r4's start clears the row span and both fields resync to ""), UNIT-PRICE-AND-SEGMENT-RATES (y3 label "2028" unit price 7108.4140139564915 → "€7 108,41", y5 "€40 141,63", y9/y22 "€29 162,72", full-ramp year 9 volume 1170 → "€1,17 k", the four segment rates 5,83/4,37/2,92/1,46 €ct/kWh engine-derived over divisor 10000, note "Rendered at the full-ramp year (2034), the first grid year at the maximum weighted volume."). All pins script-verified on the rebuilt engine by a scratch harness before the file was written; the harness is deleted. tsc clean.

## Battery counts at this checkpoint
- core: 26 files / 277 tests — all green.
- web: demo-rotation 15/15, funding-ui 5/5, tariff-span-ui 4/4 green locally; the remaining pre-re-anchor suites still carry the documented 72-failure backlog.

## Outstanding unverified edits
None. Everything re-applied so far is in this push.

## Next action
Re-apply the remaining web re-anchor suites one at a time per the 72-failure backlog (operating-ui, financing-ui, sections, designpass, app, app-design, edges, collections-ui, polish, design, design-overhaul, print-structure, design-remediation, multicontract-ui, units, xlsx, tariff-ui, profiles-scenarios, project-file, remediation062, remediation065, remediation, remediation061, webdisplay, chartlayer), each pushed at green with this file updated; then the xlsx and project-file test additions, the full battery both workspaces, the squash-merge citing the directive parent 5368e1db verbatim, the CI gate, and the live-bundle check.
