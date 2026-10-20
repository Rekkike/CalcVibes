# CalcVibes — Project IRR Analyzer

A personal, locally running investment-appraisal application that replaces Invest-for-Excel-class spreadsheet work: model project cost from burn-rate assumptions, solve the repayment stream required to hit a target IRR over a set term, and present the results as a board-ready slide deck.

## Status

The specification (docs/SPECIFICATION.md, currently v0.6.12) is the authority of record and its changelog grades the delivered series, v0.1 through v0.6.12. The application and the generated deck are deployed live at https://rekkike.github.io/CalcVibes/, auto-deployed by the GitHub Actions pipeline on every push to main (typecheck, the full test battery, build, deploy). The canonical project template lives at data/template-project.json.

## Repository map

- `docs/` — the living specification, environment discipline, builder bootstrap, directives, and research notes.
  - `docs/SPECIFICATION.md` — the living specification (currently v0.6.12).
  - `docs/ENVIRONMENT_DISCIPLINE.md` — standing rules for every builder session.
  - `docs/BUILDER_BOOTSTRAP.md` — the bootstrap message for a fresh builder session.
  - `docs/directives/` — the directive passes of record, one file per pass.
  - `docs/research/invest-for-excel-inspiration.md` — research notes on Invest for Excel.
- `prototype/` — the standalone single-file prototype, the historical behavioral reference for the v0.1 engine.
- `core/` — the pure TypeScript calculation engine.
- `web/` — the application front end and the deck generator.
- `data/` — the canonical template project and the golden-battery fixture.

## Workflow

The project follows a directive-driven builder pattern: the controller composes one directive pass at a time, a builder agent executes it on a `wip/<pass-name>` branch under the ratified checkpoint discipline, and each pass ends with a squash-merge to main citing the directive parent, a green CI battery, a live-bundle census, and a controller grading that updates the specification changelog and roadmap. Checkpoint arithmetic is script-verified with red proofs; the engine core is pure, deterministic TypeScript with a monthly-resolution cash-flow vector as the single source of truth. Versioning is semver by directive pass, the delivered series running v0.1 (engine core) through v0.6.12 (the hygiene-and-sanity pass); the roadmap toward the v1.0 desktop packaging (Tauri) is the specification's roadmap section.
