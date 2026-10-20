# CHECKPOINT — wip/v0.6.12-hygiene

Running state of the v0.6.12 hygiene-and-sanity pass. Updated at every checkpoint push.

- Branch pushes so far: db77430c (checkpoint 0, the session setup); this push (checkpoint 1: the amended directive merged into the branch, the Task A gap-check halt recorded).
- Surface: the user's own Windows machine (Claude desktop app), workbench C:\Users\erich\Documents\calcvibes; git 2.55.0.windows.5, Node v22.23.2, npm 10.9.8, gh authenticated as Rekkike. Local git identity (clone only): Airikr <eric.bjork@proton.me>.
- Directive of execution: the amended directive at main a4a5b84cc5fd520fef37c7f376969bec78e2e9e3 (parent 6a5a7c7f, the original directive commit; sole change docs/directives/v0.6.12-hygiene-sanity.md), merged into this branch at a1b29e67. Directive parent of record for the squash-merge: 3097ad30b5e9dc686d67b4a9e5ae976aed4b0c57.
- Baseline reproduced at 6a5a7c7f before any work (exact): core 27 files / 294 tests green, core tsc clean; web 41 files / 356 tests green, web tsc clean.
- Task A (amended, the re-coverage gap check): HALTED on a gap. The two v0.5.5-named re-anchor sites — web/src/index.css lines 160-164 (.app-root section h3, .app-root section h4 → color: var(--mut)) and lines 209-211 (.app-root dt → color: var(--mut)) — have no covering test. No test in web/test references these selectors; SINGLE-ROOT and NO-DANGLING do not assert per-rule consumption. Mutation probe: both color declarations replaced with #000000 in the working copy → web battery 41 files / 356 tests green (the mutation survives); file restored from HEAD, diff empty. No test added (the amended directive reserves the specific test to the controller).
- State of record: no source or test file changed on this branch. Tasks B-F not begun.
- Next action: await the controller's ruling on the Task A covering test, then Task B.
