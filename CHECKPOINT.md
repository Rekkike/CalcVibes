# CHECKPOINT — wip/v0.6.11-scenario-granularity

Running state of the v0.6.11 scenario-granularity pass. Updated at every checkpoint push.

- Last verified step: the core chunk delivered — Task A (per-variant ScenarioOutcome), Task B (per-cell tornado refusals), Task C (the reworded span-coverage refusal), the Task D core half (types, the mechanical classifier, the single-sourced composer, FinancingContext.fundingRows, the equity cause/note). Core battery 26 files / 277 tests green; core tsc clean. Both core re-anchors applied (scenarios.test.ts shape consumers, values unchanged; the funding0610 W35 message anchor, values unchanged).
- Pins scratch-verified on the live tree this session: the Task A base / optimistic-refusal / pessimistic pins; all eight Task B cells; the Task C message (years 3-23, year 24); the classifier re-counts (main 3 -> 1 financing; equity 4 -> 1 financing); the three pinned notes verbatim; the synthetic operational fixture pins; the pessimistic delta double 865489.9467288586.
- PRE red proofs observed on the pristine b75ff427 tree: scenarioResults and tornado throw the wholesale coverage refusal (the whole set and table dead); per-variant PRE facts recorded (base computes, optimistic throws, pessimistic computes); grep-verifiable absences recorded (no scenarios-framing testid; the retired testids present; the wholesale deck disclosure at web/src/deck.ts:457; the four retyped warning sites; VERSION v0.6.10).
- Outstanding unverified edits: none beyond this commit.
- Next action: write core/test/scenarios0611.test.ts with every pin (checkpoint 2), then the web chunk (Tasks E, F, the G web re-anchors, H).
- Baseline of record verified this session on the rebuilt tree: core 26/277, web 41/356, tsc clean both.
- Environment note: one full /tmp wipe occurred mid-session (the twelfth historical wipe); the environment was rebuilt per docs/ENVIRONMENT_DISCIPLINE.md and every patch replayed verbatim from the live session transcript. The rebuilt installer's fix-4 copy step uses tar --strip-components=1 (this sandbox's cp nested the tarball root inside the destination); disclosed in the completion report.
