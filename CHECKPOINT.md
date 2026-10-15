# CHECKPOINT — wip/v0.6.11-scenario-granularity (builder session 6)

Directive: docs/directives/v0.6.11-scenario-granularity.md (parent b75ff42709745dfaa601050a30cba546655d5ee0).

## Last verified step (this checkpoint: core chunk complete)

- Task C: the span-coverage refusal reworded (engine.ts, gridFirst/gridLast data-driven; zero-weighted-volume refusal untouched).
- Task A: scenarioResults returns per-variant ScenarioOutcome (EngineInputError-only catch, refusal verbatim); SCENARIO_SETS/applyScenario unchanged.
- Task B: TornadoRow gains lowRefusal/highRefusal; eight cells computed individually.
- Task D (core): composeAmbiguityNote single-sourced in engine.ts (six branches); the mechanical classifier on both views (financing cash stripped, exactly the v0.6.10 Task A.3 contributions; equity also strips draws and debt service); ModelResult gains irrAmbiguityCause/irrAmbiguityNote; EquityMetrics gains ambiguityCause/ambiguityNote; FinancingContext gains fundingRows.
- Task G (core part): core/test/scenarios0611.test.ts written (10 tests: Task A pins, the Task F delta double, Task B cells, Task C strings with data-driven bounds, Task D classifier/notes/null branches/composition).
- Re-anchors disclosed: funding0610.test.ts W35 coverage-string anchor (value pins byte-identical); scenarios.test.ts consumes the Task A outcome shape (values byte-identical); programFixture0610 moved to test/_shared.ts (single-sourcing the fixture; importing a test file into another test file double-runs its tests under vitest — the fixture body is byte-identical).

## Battery counts at this checkpoint

- core: 27 files / 287 tests green (baseline 26/277; +1 file, +10 tests, no double-count).
- web: 41 files / 356 tests green (untouched so far this pass).
- tsc clean in both workspaces.
- Golden battery untouched; funding pins byte-identical; template.golden.test.ts not in the patch.

## Outstanding (next actions)

1. Web chunk: Task E ScenariosSection (framing line, always-three-rows named set, per-variant refusals, always-four-rows tornado), Task F deck scenario slide (per-variant disclosures, the pessimistic delta item), Task D surfaces (ResultsSection/deck render the engine notes verbatim), Task H VERSION v0.6.11; re-anchor the web suites per the directive's predicted families.
2. Full battery both workspaces; byte verification.
3. Squash-merge to main citing the directive parent verbatim; CI gate; live-bundle check; completion report.

Note: an environment wipe (the twelfth) erased the working tree mid-session; the environment was rebuilt from b75ff427 per docs/ENVIRONMENT_DISCIPLINE.md and the baseline re-verified (core 26/277, web 41/356, tsc clean) before this chunk was replayed.
