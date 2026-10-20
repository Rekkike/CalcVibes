# CHECKPOINT — wip/v0.6.12-hygiene

Running state of the v0.6.12 hygiene-and-sanity pass. Updated at every checkpoint push.

- Branch pushes so far: db77430c (checkpoint 0, the session setup); b500944 (checkpoint 1, the first-amendment merge and the Task A gap-check halt); this push (checkpoint 2: the second-amendment merge and the Task A close).
- Surface: the user's own Windows machine (Claude desktop app), workbench C:\Users\erich\Documents\calcvibes; git 2.55.0.windows.5, Node v22.23.2, npm 10.9.8, gh authenticated as Rekkike. Local git identity (clone only): Airikr <eric.bjork@proton.me>.
- Directive of execution: the second-amended directive at main 0bdaa2e38355eb7702cde7f78b8a97df581dc607 (parent a4a5b84c; sole change docs/directives/v0.6.12-hygiene-sanity.md), merged into this branch at 06fa3fe8. Directive parent of record for the squash-merge: 3097ad30b5e9dc686d67b4a9e5ae976aed4b0c57.
- Baseline reproduced at 6a5a7c7f before any work (exact): core 27 files / 294 tests green, core tsc clean; web 41 files / 356 tests green, web tsc clean.
- Task A CLOSED. Pre-state (first-amendment probe, pre-pin): both sites flipped to #000000 → web 41 / 356 green (gap confirmed); restored, diff empty, nothing committed. Two pins added to web/test/app-design.test.tsx (no other file): SECTION-HEADINGS-MUT (/\.app-root section h3,\s*\.app-root section h4\s*\{[^}]*color:\s*var\(--mut\)/) and DT-MUT (/\.app-root dt\s*\{[^}]*color:\s*var\(--mut\)/); each selector occurs exactly once in index.css. Red proofs on the pristine index.css, each flip individually to the literal #717273: (a) h3/h4 flip → exactly SECTION-HEADINGS-MUT failed, 1 failed / 357 passed (358); (b) dt flip → exactly DT-MUT failed, 1 failed / 357 passed (358); restored after each, index.css diff empty, nothing from the probes committed.
- Ledger at this push: web 41 files / 358 tests green (+2 tests, +0 files), web tsc clean; core untouched (27 / 294).
- Next action: Task B — the visible calendar-year labels in the collections editor and the tariff grid editors.
