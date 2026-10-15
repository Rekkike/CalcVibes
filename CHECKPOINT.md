# CHECKPOINT — wip/v0.6.11-scenario-granularity

The scenario-granularity pass (directive docs/directives/v0.6.11-scenario-granularity.md; the directive parent b75ff427).

## Last verified step (checkpoint 1 — the core chunk)

Complete and green at this tip, verified on the rebuilt tree:

- Task C: the span-coverage refusal reworded to carry its cause and its check; gridFirst/gridLast are the actual grid bounds, data-driven (core/src/engine.ts).
- Task A: scenarioResults returns per-variant outcomes — { result, refusal } per variant, EngineInputError-only catch, refusal verbatim (core/src/scenarios.ts).
- Task B: the tornado degrades per cell; TornadoRow gains lowRefusal/highRefusal; null alone never means refusal (core/src/scenarios.ts).
- Task D: ModelResult gains irrAmbiguityCause/irrAmbiguityNote; EquityMetrics gains ambiguityCause/ambiguityNote; the classifier re-counts the sign changes with the financing cash removed (main: the v0.6.10 Task A.3 contributions; equity: also the draws and debt service); one composer in engine.ts serves both views; FinancingContext gains fundingRows (core/src/engine.ts, core/src/financing.ts, core/src/types.ts).
- New suite core/test/scenarios0611.test.ts (17 tests): Task A pins, Task B cell pins, Task C string with data-driven bounds, Task D classifier branches and the three pinned notes verbatim plus every composition branch, the synthetic operational fixture pins, the PRE-failing assertions.
- The program fixture of record extracted to core/test/_program0610.ts (byte-identical values) so the new suite does not re-register the funding0610 describe blocks; funding0610.test.ts imports it.
- Re-anchors: funding0610.test.ts W35 coverage-string anchor moves to the Task C sentence; scenarios.test.ts moves to the Task A outcome shape (values byte-identical).

## Battery at this checkpoint

- core: 27 test files / 294 tests green; tsc clean. (Baseline of record 26 files / 277 tests; +1 suite file, +17 tests; the fixture module adds no tests.)
- web: untouched at this checkpoint (41 files / 356 tests at the baseline of record, verified green on the pristine tree before the chunk).

## Outstanding (the next chunk — the web pass)

- Task E: ScenariosSection — the framing line of record, the named-set table always rendering three rows with per-variant refusals, the tornado always rendering four rows, the retired testids (scenarios-refusal, scenario-set-refusal), the two-way tables unchanged in values.
- Task F: the deck scenario slide consumes per-variant outcomes; the per-variant disclosure sentences; the pessimistic delta item (rawValue 865489.9467288586, the exact double).
- ResultsSection and deck render the engine-composed ambiguity notes verbatim (the four retyped warning sites).
- Task H: VERSION v0.6.11 with the version pins re-anchored.
- Web suite re-anchors (appraisal-ui, funding-ui, remediation061, remediation062, demo-rotation, design-remediation, multicontract-ui, polish), full battery both workspaces, then the squash-merge citing the directive parent verbatim.

## Session notes

- The execution environment wiped /tmp twice this session (the twelfth and thirteenth historical wipes). The core chunk was rebuilt from the directive parent tarball and every directive pin re-verified digit for digit after the rebuild; no pin drift.
- Branch deletion after the squash-merge is not possible with the available tooling (no deletion function in the connector); disclosed in the completion report.
