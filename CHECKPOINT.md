# CHECKPOINT — v0.6.10 funding-block pass (the branch is the working store; this history dies with the branch deletion)

Updated: 2026-10-14, session 5, checkpoint 2 (the demo-rotation re-anchor green and pushed).

## Last verified step
Checkpoint 2: the demo-rotation re-anchor rewrite is green — web/test/demo-rotation.test.tsx 15/15 (PROGRAM-LOADER and PROGRAM-DECK re-anchored to the shorePowerProgram fixture with every recorded pin reproduced on the rebuilt engine: solved payment 2843365.6055825967, targetChart points, funding block grossRaw 449000000 / grantsRaw 173500000 / netRaw 275500000 intensity 38,6%, outflow/inflow donut segs, segment rates 5,83/4,37/2,92/1,46 €ct/kWh, verdict "Target met — equity IRR 7.14% on €359 000 400 outlaid."; PORT-ENGINE/BOOK/TARIFF/GRID/SCENARIO and the land fixtures intentionally unchanged). Preceding verified steps: core battery 26 files / 277 tests ALL GREEN, tsc clean in both workspaces (the ratified source batch: App.tsx mode-refusal panel, ScenariosSection refusal-path restructure, TariffSection span-editor initial-sync fix, charts.tsx + deck.ts honest 100.1 disclosures, core/test/fileio.test.ts settings literals).

## Battery counts at this checkpoint
- core: 26 files / 277 tests — all green.
- web: 39 files / 342 tests — 72 failures / 270 passes at the committed pre-re-anchor state, except demo-rotation now green 15/15 locally (the documented re-anchor backlog continues suite by suite).

## Outstanding unverified edits
None. The demo-rotation rewrite and this checkpoint are in this push.

## Next action
Recreate the new permanent test file web/test/funding-ui.test.tsx (5 tests: FUNDING-ROWS, FUNDING-VIEW with the allocation-suffix fix, FUNDING-EDITORS with FND-AMOUNT, GRANT-SCALE-AXIS, GRANT-SCALE-TABLE) and run it to green, push; then web/test/tariff-span-ui.test.tsx (4 tests) the same way; then the remaining re-anchor suites one at a time, each pushed at green; then the xlsx and project-file test additions, the full battery both workspaces, the squash-merge citing the directive parent 5368e1db verbatim, the CI gate, and the live-bundle check.
