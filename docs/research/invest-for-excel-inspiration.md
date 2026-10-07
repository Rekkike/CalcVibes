# Calculation Engine Inspiration: Invest for Excel and Comparable Tools

Research summary, 2026-10-07. Sources consulted: DataPartner (maker of Invest for Excel), Microsoft Support, Investopedia, Excel University, Corporate Finance Institute, Wall Street Prep, CFO Perspective.

## How Invest for Excel works (DataPartner Software)

- Invest for Excel is a specialist add-in for capital budgeting and investment appraisal. It standardizes the calculation of NPV, IRR, MIRR and further profitability factors across an organization.
- It models the full project economics: investments, depreciations, incomes, costs, working capital, and debt/equity financing, integrated into one cash-flow statement.
- The Enterprise edition includes a Financing module: drawdown, repayment, and financing costs of a loan, integrated directly into the project cash flow.
- Multi-parameter sensitivity analysis is supported via a Scenarios Manager: optimistic and pessimistic scenarios with combined-change line charts.
- Residual values are handled as first-class inputs.

## Canonical calculation methods to implement

- NPV and IRR at regular intervals; XNPV/XIRR with actual dates for irregular timing.
- IRR = the discount rate at which NPV = 0; verified numerically (bisection), not by closed form.
- MIRR (modified IRR) to handle reinvestment-rate assumptions.
- Payback and discounted payback (time to break even on cumulative cash flow).
- WACC as the benchmark discount rate; project accepted when IRR exceeds WACC / target.
- Sensitivity: one-way and two-way data tables (vary burn rate, IRR goal, term).
- Scenario analysis: base / optimistic / pessimistic assumption sets switchable in one place.

## Design implications for this application

1. Keep the monthly-resolution cash-flow vector as the single engine; every metric derives from it.
2. Add MIRR and discounted payback beside IRR and nominal payback.
3. Add a WACC/benchmark-rate input so NPV can be reported at the corporate rate, not only the target IRR.
4. Add scenario management (base/upside/downside) and two-way sensitivity tables (payment vs. term; payment vs. IRR goal).
5. Model financing explicitly when the time comes: drawdown schedule, interest during construction, and repayment on top of project returns.
6. Residual value as a first-class input in the repayment solver.
