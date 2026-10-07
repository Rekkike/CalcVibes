# Project IRR Analyzer — Specification

Living specification. This file is the authority of record for what the application is and does. The changelog at the end grades every change. Current version: **v0.2.2** (2026-10-07).

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
- Operating cost lines (v0.3.1 scope of record, user request 2026-10-07): rent, lease, concession, OPEX, and maintenance lines that run alongside collections during the repayment period. A maintenance rule derives a yearly cost from CAPEX (rule of thumb: 0.5 percent of total CAPEX per year, payable from the first year collections begin; changeable to a fixed sum or another percentage). Operation-period costs are costs of the single vector: they raise the solved payment and lower the achieved IRR. Convention of record: operation-period cost lines never move the repayment start — the repayment start is either set explicitly by the user or derived by default from the project-fulfillment lines alone, so these costs run alongside collections rather than deferring them.

### 4.3 Repayment solver — three modes

- Mode A (primary): given target IRR and term, solve the periodic payment P so that NPV(collections) = NPV(costs) at the target rate, honouring frequency, grace, escalation, and balloon.
- Mode B: given P and target IRR, solve the required term (rounded up to whole payment periods).
- Mode C: given P and term, report the achieved IRR (no solving).
- The achieved IRR is always verified numerically (bisection on the NPV function) against the solved structure.
- Collection indexation (v0.3.1 scope of record, user request 2026-10-07): CPI-style indexation of collections — collections in year k are scaled by (1 + rate)^(k-1), rule of thumb 2 percent per year when enabled. The arithmetic already exists (the payment escalation parameter); the pass surfaces it in the UI under the indexation name and defaults the rule of thumb.
- Repayment start override (v0.3.1 scope of record, user request 2026-10-07): the first collection year is user-settable, including during the cost period — large projects may begin renting out parts of a property before construction completes. Default: derived as the last project-fulfillment cost year plus grace, exactly as today. When collections overlap the cost period, the net vector can change sign more than once; the ambiguity policy of section 4.7 applies, the ambiguity flag is expected rather than exceptional in such structures, and the solver identity still holds at the target rate. Open question: whether an explicit start composes with grace (recommendation: the explicit start replaces the derivation, and grace must be zero when the override is set).

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
- Validation: input errors surface; no silent filtering. A cost line with an empty name, a non-positive amount, or a start year below one is an error to be reported, not a line to be quietly dropped. (Deviation of record: the prototype silently dropped invalid lines; the tool of record reports them. Enforced since the v0.1.1 hardening pass.)
- IRR non-uniqueness: for net-flow vectors with more than one sign change, the IRR may not be unique. The engine counts sign changes across non-zero flows and reports an ambiguity flag alongside the achieved IRR; the UI must warn when the flag is set. The solver returns the first bracket found from the left of the scan grid; this limitation is documented, not hidden.
- Solver bounds: the IRR search never evaluates the NPV outside monthly rates [-0.9, 6.0].
- Determinism: identical inputs produce identical outputs; the engine contains no randomness, clock, or I/O.
- Directional claims of record (script-verified 2026-10-07): a longer grace strictly raises the solved payment at positive target rates (deferral discounts every collection; at a zero target rate the payment is invariant to grace); a larger balloon strictly lowers the payment; a higher target IRR strictly lowers the cost NPV; a longer term strictly lowers the payment.
- Ambiguity reachability, limitation of record (v0.2.0): under the current input model the ambiguity flag is unreachable — collections begin at or after the last cost month, so the net vector crosses zero at most once. The UI warning is therefore verified against a stubbed result; the limitation is documented, not hidden.

### 4.8 Regression anchor and template project (of record, 2026-10-07)

- data/template-project.json (Project Alpha, schema version 1) is the canonical regression anchor and the demo source: one file, one source of truth, consumed by the golden fixture and by the UI demo load alike.
- core/test/template.golden.test.ts pins the template's complete golden output profile: twelve scalars, exact line totals, the ten-row yearly table, eight monthly checkpoints, and file-model identity with the inline anchor.
- Standing rule: every pass keeps the golden fixture green. A change to any golden value is a change to model behavior and requires an explicit, spec-graded decision before implementation — never a silent pin update.

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
- data/ — project-file JSON schema and examples. First artifact: template-project.json (Project Alpha, schema version 1), the regression anchor of record (section 4.8).

## 7. Versioning contract and roadmap

- v0.1 — Engine core: cost model, Mode-A solver, IRR/payback, checkpoint tests.
- v0.1.1 — Verification hardening: invariant tests, validation contract, numerical policy enforced.
- v0.2 — UI parity with the prototype (four sections). Delivered at v0.2.0.
- v0.3 — Appraisal suite: MIRR, WACC NPV, PI, discounted payback, scenarios, sensitivity tables, Modes B and C; the engine emits goalMet, carried from v0.2.0.
- v0.3.1 — Operating cost model, indexation, and repayment timing: OPEX, maintenance, rent, lease, and concession lines running alongside collections; the maintenance rule (percent of CAPEX or fixed sum, payable from the first collection year); CPI-style collection indexation surfaced in the UI; an explicit repayment start override allowing collections during the cost period; the presentation labels operation-period costs as separate considerations alongside the investment figures.
- v0.4 — Financing layer: debt/equity, drawdown, IDC, DSCR, equity IRR.
- v0.5 — Presentation and exports: deck polish, PDF print, XLSX schedule.
- v1.0 — Desktop packaging (Tauri), project file save/load, installer.
- 0.x is pre-1.0 development; 1.0 is the promise: installable, standalone, correct.

## 8. Open questions

- Currency list default and number formats (prototype: EUR/USD/GBP/SEK/NOK/DKK).
- Whether residual value belongs to the cost NPV or to collections (recommendation: collections).
- Tauri vs. Electron at v1.0 (recommendation: Tauri).
- Whether the maintenance percentage references total CAPEX or a selected CAPEX line (recommendation: total CAPEX, with optional per-line selection).
- Whether indexation needs per-year overrides beyond the single compounding rate (the single rate already implements the rule of thumb).
- Whether an explicit repayment start composes with grace or replaces the derivation (recommendation: replaces; grace must be zero when the override is set).

## Changelog

- v0.1.0 (2026-10-07) — Initial specification: design brief of record, engine specification, architecture, repository plan, versioning contract. Grade: initial seeding.
- v0.1.1 (2026-10-07) — Engine core pass (directive v0.1) delivered at commit aeaa7c8: engine ported to core/src, DEFECT-001 repaired per contract, 26 pinned checkpoint tests green with red proofs captured per pin. Specification amended: section 4.4 IRR method corrected to the repaired bracketing contract; section 4.7 added (numerical and validation policy of record); quality bar added to decisions of record; roadmap gains the v0.1.1 hardening gate. Grade: delivered — roadmap item v0.1 (cost model, Mode-A solver, IRR/payback, checkpoint tests) complete.
- v0.1.2 (2026-10-07) — Verification hardening pass (directive v0.1.1, amended mid-pass at 9af524d after a correct builder halt on the INV-7 grace contradiction) delivered at merge 4c038b5 (squash 0de75a2): validation contract in force (eleven rules, EngineInputError carrying human-readable issues, silent filtering removed), 144-case deterministic invariant suite (solver identity, achieved-IRR identity, scaling, determinism, finiteness, aggregation, monotonicity with the corrected grace direction, slot grid), sign-change counting with the ambiguity flag, mutation red proofs including the corrected INV-6 proof. Ledger: 54 tests green; original 26 pins unmodified. Directional claims of record added to section 4.7. One carried notice: the amended directive's term pins (903,142.19709 at term 3 and 318,490.43128 at term 15) are asserted only as an inequality in INV-7; adding the two pins is the mandatory opening chunk of the next pass. Grade: delivered with one carried notice — roadmap item v0.1.1 complete.
- v0.2.0 (2026-10-07) — UI parity pass (directive v0.2, amended mid-pass at 1f2cdcc; follow-up directive 7b4a043 issued when the first delivery ac2d3e6 predated the amendment) delivered at merges ac2d3e6 and 38d06cb: React web UI at structural parity with the prototype — four sections, five-slide presentation mode with keyboard navigation — with engine-only arithmetic in the UI (the display helper is the sole numeric transformation; input decoding excepted), blank start with the demo loading the template file, live validation surfacing with input retention, and the IRR ambiguity warning. Template battery of record: data/template-project.json (Project Alpha, schema version 1) committed at 4106c1c as the canonical regression anchor and demo source; core/test/template.golden.test.ts pins its full script-verified profile (twelve scalars, exact line totals, the ten-row yearly table, eight monthly checkpoints, file-model identity with the inline anchor) under the standing rule of section 4.8. Ledger of record: 59 core plus 15 web = 74 green; the directive's superseded figures 56 and 61 are corrected at 7b4a043 (the chunk-0 term pins live as assertions inside INV-7). Section 4.7 gains the ambiguity-reachability limitation of record. One carried notice: the goal-check comparison remains in the UI layer until the engine emits goalMet (v0.3). Grade: delivered with one carried notice — roadmap item v0.2 complete.
- v0.2.1 (2026-10-07) — Scope of record (user request, recorded early by design): the operating cost model and indexation pass added to the roadmap as v0.3.1 — rent, lease, concession, OPEX, and maintenance lines running alongside collections; the maintenance rule (rule of thumb 0.5 percent of CAPEX per year from the first collection year, changeable to a fixed sum or another percentage); CPI-style collection indexation (the arithmetic already exists as the payment escalation parameter; the pass surfaces and labels it, rule of thumb 2 percent). Convention of record added to section 4.2: operation-period cost lines never delay the repayment start. Two open questions recorded (the maintenance reference basis; per-year indexation overrides). No delivery; the builder's running v0.3 pass is unaffected. Grade: scope addition.
- v0.2.2 (2026-10-07) — Scope of record (user request, recorded immediately): the repayment start becomes user-settable — the first collection year may be placed during the cost period (partial rent-out mid-project), with the derived default unchanged (last project-fulfillment cost year plus grace). Recorded under the v0.3.1 roadmap entry, now widened to operating cost model, indexation, and repayment timing. Section 4.2's convention of record is restated for consistency: operation-period costs never move the repayment start, which is either explicit or derived from the fulfillment lines alone. Methodological consequence recorded in section 4.3: with collections overlapping costs, the net vector can change sign more than once, so the ambiguity flag is expected rather than exceptional in such structures and the section 4.7 policy governs. One open question added (explicit start versus grace composition; recommendation: replaces, grace must be zero). The v0.3 directive pins are unaffected: every v0.3 pin uses the derived start. Grade: scope addition.
