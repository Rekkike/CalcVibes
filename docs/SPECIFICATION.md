# Project IRR Analyzer — Specification

Living specification. This file is the authority of record for what the application is and does. The changelog at the end grades every change. Current version: **v0.1.1** (2026-10-07).

## 1. Purpose and user

A purpose-built investment-appraisal application replacing spreadsheet work (the Invest for Excel class of tooling) for one practitioner: modelling project cost from burn-rate assumptions, solving the repayment stream required to hit a target IRR over a set term, and presenting the result in board-ready form.

## 2. Decisions of record (2026-10-07)

- Primary user: the owner alone. Personal tool; no multi-user, sharing, or permissions machinery.
- Deployment: desktop / local. The application runs on the user's machine; no hosting requirement. GitHub Pages deployment is out of scope. Tauri wrapper recommended at v1.0.
- Version 1.0 scope: as complete as possible — the full appraisal suite plus the financing layer.
- Projects: one at a time. Single-document model (one project = one file), like a spreadsheet workbook. No project database, no side-by-side comparison in v1.
- Currency handling: user-selected currency per project; no exchange-rate machinery in v1.
- Quality bar: correctness over the full input space, not only the built-in example. Invariant tests, an explicit numerical policy, and a no-silent-filtering validation contract are part of the definition of correct.

## 3. Product definition

Jobs to be done, in order:

1. Define the project cost plan (burn rate lines, escalations, one-time CAPEX, residual value).
2. Define the repayment structure (term, frequency, grace, escalation, balloon).
3. Set the target IRR and read the solved payment stream, with verified achieved IRR.
4. Stress the result (scenarios, sensitivity tables, WACC benchmark).
5. Model the financing (debt/equity split, drawdown, interest, DSCR).
6. Present it (generated slide deck; exports to PDF and XLSX).

## 4. Calculation engine specification

### 4.1 Time basis

All computation on a monthly-resolution cash-flow vector; annual aggregation for reporting. Monthly rate from annual rate: r_m = (1 + r)^(1/12) - 1. Every metric derives from this one vector; no metric is computed independently of it.

### 4.2 Cost model

- Cost lines, any number: recurring (annual amount, start year, duration, escalation %/yr) or one-time (amount at a given year).
- Optional per-year override table on any recurring line (Invest-for-Excel-style flexibility).
- Residual value: first-class input, a positive terminal cash flow at a set year (placement ruling pending; recommendation: collections).
- Categories for grouping (personnel, infrastructure, CAPEX, other).

### 4.3 Repayment solver — three modes

- Mode A (primary): given target IRR and term, solve the periodic payment P so that NPV(collections) = NPV(costs) at the target rate, honouring frequency, grace, escalation, and balloon.
- Mode B: given P and target IRR, solve the required term (rounded up to whole payment periods).
- Mode C: given P and term, report the achieved IRR (no solving).
- The achieved IRR is always verified numerically (bisection on the NPV function) against the solved structure.

### 4.4 Metrics

- NPV at target IRR and NPV at WACC (benchmark discount rate input).
- IRR: bracketed bisection on the NPV function. The bracket is found by a finite grid scan for a sign change over monthly rates [-0.9, 6.0] (96 steps), then bisection to an NPV below 1e-9 or 300 iterations; the monthly root is annualized as (1 + r_m)^12 - 1. An all-zero flow vector yields no IRR. (DEFECT-001 repair of 2026-10-07: the original unbounded bracket [-0.9999, 10] evaluated the NPV at a degenerate rate where denominators underflow, and could collapse to the meaningless value 11^12 - 1.)
- MIRR with explicit finance rate and reinvestment rate.
- Payback (nominal) and discounted payback (at WACC), interpolated, both in years.
- Profitability index: NPV(collections at WACC) / NPV(costs at WACC).
- Total cost, total collected, nominal gain, collection-to-cost ratio.

### 4.5 Financing layer (v1.0 scope)

- Debt share per cost line; drawdown follows the cost schedule.
- Interest during construction capitalized into the debt balance at the debt rate.
- Debt repayment: annuity or equal-principal, with its own term and optional grace.
- Equity cash flow = project cash flow + debt drawdown - debt service; equity IRR reported beside project IRR.
- DSCR per year: collections / (interest + scheduled principal); minimum-DSCR reported.

### 4.6 Scenarios and sensitivity

- Three named assumption sets (base / optimistic / pessimistic): global multipliers on burn rate, escalation shift, IRR-goal shift, term shift.
- One-way sensitivity (tornado) on the required payment: burn rate, target IRR, term, escalation.
- Two-way tables: payment vs. term; payment vs. target IRR; payment vs. balloon.

### 4.7 Numerical and validation policy (of record, 2026-10-07)

- Precision: all computation in IEEE-754 double precision with no intermediate rounding. Rounding occurs only at the display and export boundary.
- Display: values are rounded to the currency's minor unit for presentation; a displayed total is computed from unrounded values, so displayed component rows may differ from a displayed total by at most one minor unit.
- Validation: input errors surface; no silent filtering. A cost line with an empty name, a non-positive amount, or a start year below one is an error to be reported, not a line to be quietly dropped. (Deviation of record: the prototype silently dropped invalid lines; the tool of record reports them.)
- IRR non-uniqueness: for net-flow vectors with more than one sign change, the IRR may not be unique. The engine counts sign changes across non-zero flows and reports an ambiguity flag alongside the achieved IRR; the UI must warn when the flag is set. The solver returns the first bracket found from the left of the scan grid; this limitation is documented, not hidden.
- Solver bounds: the IRR search never evaluates the NPV outside monthly rates [-0.9, 6.0].
- Determinism: identical inputs produce identical outputs; the engine contains no randomness, clock, or I/O.

## 5. Application architecture

- Layering: (1) pure calculation engine, no I/O, deterministic; (2) UI layer; (3) storage layer; (4) presentation/export layer. The engine is identical in tests, UI, and exports.
- Technology: TypeScript engine; React web UI (Vite); at v1.0 packaged as a desktop application via a Tauri wrapper.
- Storage: local project files (JSON, schema-versioned) — open, save, and recent-files. One project per file. No cloud, no accounts.
- Presentation mode: the five-slide deck generated from the live model (title, investment, repayment, returns, summary), navigable by keyboard; print-to-PDF from the same rendering; XLSX schedule export.

## 6. Repository structure

- core/src — engine (pure functions).
- core/test — engine tests with pinned checkpoints.
- web/src — React UI.
- web/test — UI tests.
- docs/ — this specification, the environment discipline, research, sources.
- prototype/ — the standalone reference prototype (behavioral reference of record for the v0.1 engine).
- data/ — project-file JSON schema and examples.

## 7. Versioning contract and roadmap

- v0.1 — Engine core: cost model, Mode-A solver, IRR/payback, checkpoint tests.
- v0.1.1 — Verification hardening: invariant tests, validation contract, numerical policy enforced.
- v0.2 — UI parity with the prototype (four sections).
- v0.3 — Appraisal suite: MIRR, WACC NPV, PI, discounted payback, scenarios, sensitivity tables, Modes B and C.
- v0.4 — Financing layer: debt/equity, drawdown, IDC, DSCR, equity IRR.
- v0.5 — Presentation and exports: deck polish, PDF print, XLSX schedule.
- v1.0 — Desktop packaging (Tauri), project file save/load, installer.
- 0.x is pre-1.0 development; 1.0 is the promise: installable, standalone, correct.

## 8. Open questions

- Currency list default and number formats (prototype: EUR/USD/GBP/SEK/NOK/DKK).
- Whether residual value belongs to the cost NPV or to collections (recommendation: collections).
- Tauri vs. Electron at v1.0 (recommendation: Tauri).

## Changelog

- v0.1.0 (2026-10-07) — Initial specification: design brief of record, engine specification, architecture, repository plan, versioning contract. Grade: initial seeding.
- v0.1.1 (2026-10-07) — Engine core pass (directive v0.1) delivered at commit aeaa7c8: engine ported to core/src, DEFECT-001 repaired per contract, 26 pinned checkpoint tests green with red proofs captured per pin. Specification amended: section 4.4 IRR method corrected to the repaired bracketing contract; section 4.7 added (numerical and validation policy of record); quality bar added to decisions of record; roadmap gains the v0.1.1 hardening gate. Grade: delivered — roadmap item v0.1 (cost model, Mode-A solver, IRR/payback, checkpoint tests) complete.
