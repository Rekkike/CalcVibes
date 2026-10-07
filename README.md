# CalcVibes — Project IRR Analyzer

A personal, locally running investment-appraisal application that replaces Invest-for-Excel-class spreadsheet work: model project cost from burn-rate assumptions, solve the repayment stream required to hit a target IRR over a set term, and present the results as a board-ready slide deck.

## Status

Specification v0.1.0 is seeded in `docs/SPECIFICATION.md`. No production code exists yet. An interactive prototype is available at `prototype/standalone-prototype.html` (single file, runs offline in any browser).

## Repository map

- `docs/` — specification, environment discipline, builder bootstrap, and research notes.
  - `docs/SPECIFICATION.md` — the living specification (currently v0.1.0).
  - `docs/ENVIRONMENT_DISCIPLINE.md` — standing rules for every builder session.
  - `docs/BUILDER_BOOTSTRAP.md` — the bootstrap message for a fresh builder session.
  - `docs/research/invest-for-excel-inspiration.md` — research notes on Invest for Excel.
- `prototype/` — the standalone single-file prototype.
- `core/` — the pure TypeScript calculation engine (to be created in v0.1).
- `web/` — the application front end (to be created in v0.2).

## Workflow

The project follows a directive-driven builder pattern: the assistant researches and writes one directive pass at a time, a builder agent executes it, and each pass ends with a wip-branch checkpoint on `wip/<pass-name>`. Checkpoint arithmetic is script-verified with red proofs; the engine core is pure, deterministic TypeScript with a monthly-resolution cash-flow vector as the single source of truth. Commit and push after every completed unit. Versioning is semver: v0.1 engine core, v0.2 UI parity with the prototype, v0.3 appraisal suite, v0.4 financing layer, v0.5 presentation and exports, v1.0 desktop packaging.
