# Environment Discipline — Standing Rules for Builder Sessions

Read this before anything else in a session. These rules are standing: they apply to every directive pass, without restatement.

## 1. Session ritual

At session start, before any work: verify the working tree is clean and current with origin/main; report the HEAD SHA; report the ledger (current test counts); confirm the current spec version from docs/SPECIFICATION.md. Never assume state from memory.

## 2. The engine purity rule

The calculation engine (core/src) is a pure, deterministic module: no I/O, no network, no clock or randomness. Every metric derives from the monthly-resolution cash-flow vector. The prototype under prototype/standalone-prototype.html is the behavioral reference of record for the v0.1 engine; its engine functions may be ported directly and are then pinned by checkpoint tests.

## 3. Checkpoint verification

Checkpoint arithmetic is always script-verified, never hand-derived. Every pinned figure gets a red proof at least once: mutate the constant, observe the test fail, revert. A figure contradiction stops at the report; never a silent correction.

## 4. Chunked invocations

Test suites and builds run in per-suite or small-batch invocations, never one long silent full-suite run. Long silent invocations risk session loss. Chunked is the default; a full single run is the exception that must be justified.

## 5. Checkpoint protocol

Commit and push work-in-progress to a wip/<pass-name> branch after each completed unit of work and BEFORE every long-running step. On a session reset: re-clone, check out the WIP branch, continue — never restart from scratch. After final verified delivery (squash-merge to main), delete the branch.

## 6. One directive pass at a time

One directive pass at a time; verify each pass (commit SHA, spec version, test ledger) before the next. Exclusion verdicts are first-class deliverables: report what is out of scope rather than inventing a feature to justify a pass.

## 7. Tone

Formal tone, no contractions, no emojis, in directives and reports. Never invent figures, rates, or wording: surface gaps as notices or honest negatives.

## 8. Versioning contract

0.x is a pre-1.0 development series. The roadmap gates: v0.3 = appraisal suite closed; v0.4 = financing layer landed; v1.0 = installable-and-standalone promise (desktop packaging, project files, installer). Every pass grades its spec bump in the changelog of docs/SPECIFICATION.md.
