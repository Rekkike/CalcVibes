# Builder Bootstrap — Fresh Session Message

Paste this message at the start of a fresh builder session:

> You are continuing work on the Project IRR Analyzer repository (Rekkike/CalcVibes, this repo). Previous sessions completed: the design brief and living specification (docs/SPECIFICATION.md at v0.1.0) and the standalone reference prototype (prototype/standalone-prototype.html — the behavioral reference of record for the v0.1 engine). No production code exists yet in core/ or web/; the v0.1 objective is the engine core: cost model, Mode-A payment solver, IRR and payback, with checkpoint tests porting the prototype engine. The standing rules live in docs/ENVIRONMENT_DISCIPLINE.md — read it before anything else; perform the session ritual (HEAD, ledger, spec version) first. Working discipline: the engine is a pure deterministic TypeScript module at monthly resolution; every metric derives from the single cash-flow vector; checkpoint arithmetic is always script-verified, never hand-derived, with red proofs for every pin; test suites run chunked, never as one long silent run; commit and push to a wip/<pass-name> branch after every completed unit of work and before long-running steps; one directive pass at a time, verified before the next; formal tone, no contractions, no emojis in directives and reports.

Update the delivered-state line to the current state before use.
