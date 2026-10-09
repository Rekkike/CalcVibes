import type { ModelResult } from "../../../core/src/types.js";
import { percentForDisplay, roundForDisplay } from "../engine.js";
import { yearHeader } from "../state.js";
import { CostInflowColumns, CumulativeLine } from "../charts.js";
import { deckMoneyForDisplay, deckYearsForDisplay, dscrTwoForDisplay } from "../engine.js";

export function ResultsSection(props: { result: ModelResult; targetIrr: number; currency: string; startYear?: number | null }) {
  const { result, targetIrr, currency, startYear = null } = props;
  return (
    <section data-testid="results">
      <h2>Results</h2>
      <div data-testid="answer-band" className={"answer-band " + (result.goalMet ? "tone-ok" : "tone-bad")}>
        <p data-testid="goal-check" className="answer-statement">
          {result.goalMet
            ? `The project meets its target: the solved structure achieves an IRR of ${percentForDisplay(result.achievedIrr, 2)} against a target of ${roundForDisplay(targetIrr, 2)}% — target achieved.`
            : `The project falls short: the solved structure achieves an IRR of ${percentForDisplay(result.achievedIrr, 2)} against a target of ${roundForDisplay(targetIrr, 2)}% — target not achieved.`}
          {result.irrAmbiguous && (
            <span data-testid="irr-ambiguity-warning" className="warning">
              {" "}Warning: the net flow has {result.signChanges} sign changes; the IRR may not be unique.
            </span>
          )}
        </p>
      </div>
      <div data-testid="kpi-row" className="kpi-row">
        <div className={"kpi-card " + (result.goalMet ? "tone-ok" : "tone-bad")}>
          <span className="kpi-label">Achieved IRR</span>
          <span className="kpi-value">{result.achievedIrr === null ? "—" : percentForDisplay(result.achievedIrr, 2)}</span>
          <span className="kpi-chip">vs {roundForDisplay(targetIrr, 2)}% target</span>
        </div>
        <div className={"kpi-card " + (result.npvAtWacc >= 0 ? "tone-ok" : "tone-bad")}>
          <span className="kpi-label">NPV at WACC</span>
          <span className="kpi-value">{deckMoneyForDisplay(result.npvAtWacc, currency as Parameters<typeof deckMoneyForDisplay>[1])}</span>
          <span className="kpi-chip">{result.npvAtWacc >= 0 ? "positive at the benchmark" : "negative at the benchmark"}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Payback (nominal)</span>
          <span className="kpi-value">{result.paybackYears === null ? "not within the horizon" : deckYearsForDisplay(result.paybackYears)}</span>
        </div>
        <div className={"kpi-card " + (result.financing !== null && result.financing.minDscr !== null ? (result.financing.minDscr.value >= 1.0 ? "tone-ok" : "tone-bad") : "")}>
          <span className="kpi-label">Min DSCR</span>
          <span className="kpi-value">{result.financing === null || result.financing.minDscr === null ? "not applicable" : dscrTwoForDisplay(result.financing.minDscr.value)}</span>
          {result.financing !== null && result.financing.minDscr !== null && (
            <span className="kpi-chip">in {yearHeader(result.financing.minDscr.year, startYear)}</span>
          )}
        </div>
      </div>
      <div data-testid="figure-band" className="figure-band">
        <span className="figure-item"><span className="figure-label">Total cost</span> <span className="figure-value">{deckMoneyForDisplay(result.totalCost, currency as Parameters<typeof deckMoneyForDisplay>[1])}</span></span>
        <span className="figure-item"><span className="figure-label">Total collected</span> <span className="figure-value">{deckMoneyForDisplay(result.totalCollected, currency as Parameters<typeof deckMoneyForDisplay>[1])}</span></span>
        <span className="figure-item"><span className="figure-label">Net gain</span> <span className="figure-value">{deckMoneyForDisplay(result.netGain, currency as Parameters<typeof deckMoneyForDisplay>[1])}</span></span>
        <p className="caveat">Nominal figures are undiscounted; the cost NPV and achieved IRR are discounted.</p>
      </div>
      <h3>Yearly schedule</h3>
      <CostInflowColumns yearly={result.yearly} labelFor={(y) => yearHeader(y, startYear)} valueFor={(v) => deckMoneyForDisplay(v, currency as Parameters<typeof deckMoneyForDisplay>[1])} />
      <table data-testid="yearly-table">
        <thead>
          <tr><th>Year</th><th>Cost (nominal)</th><th>Collections (nominal)</th><th>Net (nominal)</th><th>Cumulative net (nominal)</th></tr>
        </thead>
        <tbody>
          {result.yearly.map((y) => (
            <tr key={y.year}>
              <td>{yearHeader(y.year, startYear)}</td>
              <td>{roundForDisplay(y.cost)}</td>
              <td>{roundForDisplay(y.inflow)}</td>
              <td>{roundForDisplay(y.net)}</td>
              <td>{roundForDisplay(y.cumulative)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>Cost composition (line totals, nominal)</h3>
      <ul data-testid="cost-composition">
        {result.lineTotals.map((l) => (
          <li key={l.id}>{l.name}: {roundForDisplay(l.total)}</li>
        ))}
      </ul>
      <h3>Key metrics</h3>
      <dl data-testid="metrics">
        <dt>Total cost (nominal)</dt><dd data-stat="totalCost">{roundForDisplay(result.totalCost)}</dd>
        <dt>Cost NPV at target (discounted)</dt><dd data-stat="costNpv">{roundForDisplay(result.costNpv)}</dd>
        <dt>Total collected (nominal)</dt><dd data-stat="totalCollected">{roundForDisplay(result.totalCollected)}</dd>
        <dt>Net gain (nominal)</dt><dd data-stat="netGain">{roundForDisplay(result.netGain)}</dd>
        <dt>Payback (years, nominal)</dt>
        <dd data-stat="paybackYears">{result.paybackYears === null ? "—" : roundForDisplay(result.paybackYears, 5)}</dd>
        <dt>Achieved IRR</dt>
        <dd data-stat="achievedIrr">{result.achievedIrr === null ? "—" : roundForDisplay(result.achievedIrr * 100, 2) + "%"}</dd>
        <dt>Currency</dt><dd>{currency}</dd>
      </dl>
      <p className="caveat">Nominal figures are undiscounted; the cost NPV and achieved IRR are discounted. {result.paybackYears === null ? "The project does not reach payback on the net vector." : "Payback is interpolated on the nominal cumulative net flow."}</p>
      {result.financing !== null && (
        <>
          <h3>Equity metrics</h3>
          <dl data-testid="equity-panel">
            <dt>Equity outlay</dt><dd data-stat="equityOutlay">{roundForDisplay(result.financing.equity.outlay)}</dd>
            <dt>Equity NPV at WACC (discounted)</dt><dd data-stat="equityNpvAtWacc">{roundForDisplay(result.financing.equity.npvAtWacc)}</dd>
            <dt>Equity NPV at target (leveraged verification)</dt><dd data-stat="equityNpvAtTarget">{roundForDisplay(result.financing.equity.npvAtTarget)}</dd>
            <dt>Equity payback (years)</dt><dd data-stat="equityPayback">{result.financing.equity.payback === null ? "—" : roundForDisplay(result.financing.equity.payback, 5)}</dd>
            <dt>Equity IRR</dt>
            <dd data-stat="equityIrr">
              {result.financing.equity.zeroOutlay
                ? "Not applicable (zero equity outlay)"
                : result.financing.equity.irr === null ? "—" : percentForDisplay(result.financing.equity.irr)}
              {result.financing.equity.irrAmbiguous && (
                <span data-testid="equity-ambiguity-warning" className="warning">
                  {" "}Warning: the equity net flow has {result.financing.equity.signChanges} sign changes; the equity IRR may not be unique.
                </span>
              )}
            </dd>
          </dl>
          <h3>Debt schedule (yearly)</h3>
          <table data-testid="debt-schedule">
            <thead><tr><th>Year</th><th>Interest</th><th>Principal</th><th>Service</th></tr></thead>
            <tbody>
              {result.financing.yearly.map((y) => (
                <tr key={y.year}><td>{yearHeader(y.year, startYear)}</td><td>{roundForDisplay(y.interest)}</td><td>{roundForDisplay(y.principal)}</td><td>{roundForDisplay(y.service)}</td></tr>
              ))}
            </tbody>
          </table>
          <h3>DSCR (yearly)</h3>
          <table data-testid="dscr-table">
            <thead><tr><th>Year</th><th>Inflows</th><th>Debt service</th><th>DSCR</th></tr></thead>
            <tbody>
              {result.financing.dscr.filter((d) => d.dscr !== null).map((d) => (
                <tr key={d.year} data-dscr-min={result.financing?.minDscr?.year === d.year ? "true" : "false"}>
                  <td>{yearHeader(d.year, startYear)}</td><td>{roundForDisplay(d.inflows)}</td><td>{roundForDisplay(d.service)}</td>
                  <td>{d.dscr === null ? "—" : roundForDisplay(d.dscr, 4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {result.financing.minDscr !== null && (
            <p data-testid="min-dscr">Minimum DSCR: {roundForDisplay(result.financing.minDscr.value, 4)} in {yearHeader(result.financing.minDscr.year, startYear)}</p>
          )}
        </>
      )}
          <h3>Coverage</h3>
      <div data-testid="coverage-chart">
        <CumulativeLine yearly={result.yearly} labelFor={(y) => yearHeader(y, startYear)} valueFor={(v) => deckMoneyForDisplay(v, currency as Parameters<typeof deckMoneyForDisplay>[1])} />
      </div>
      {result.termPositions !== undefined && result.termPositions.length > 0 && (
        <>
          <h3>Per-term positions (the whole project at each contract boundary)</h3>
          <p className="muted">Each row is the whole project's position at the end of the contract: the truncated-flow IRR, the cumulative net, the NPVs, and the payback so far. A lease has no standalone IRR; the outflow belongs to the whole project.</p>
          <table data-testid="term-positions">
            <thead>
              <tr><th>Position</th><th>End month</th><th>Truncated IRR</th><th>Cumulative net</th><th>NPV at WACC</th><th>NPV at target</th><th>Payback so far</th></tr>
            </thead>
            <tbody>
              {result.termPositions.map((tp) => (
                <tr key={tp.contractId} data-term-contract={tp.contractId}>
                  <td data-term-label>Project position at the end of {tp.label}</td>
                  <td>{tp.endMonth}</td>
                  <td>{tp.truncatedIrr === null ? "\u2014" : roundForDisplay(tp.truncatedIrr * 100, 2) + "%"}{tp.truncatedIrrAmbiguous ? " (ambiguous)" : ""}</td>
                  <td>{roundForDisplay(tp.cumulativeNet)}</td>
                  <td>{roundForDisplay(tp.npvAtWacc)}</td>
                  <td>{roundForDisplay(tp.npvAtTarget)}</td>
                  <td>{tp.paybackSoFar === null ? "\u2014" : roundForDisplay(tp.paybackSoFar, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {result.bookView !== undefined && (
        <>
          <h3>Book view (depreciation; not cash flow)</h3>
          <p className="muted" data-testid="book-view-disclosure">The book view records the depreciation write-down; it never enters the cash flows (the investment was paid once, in the cost vector). The book result is collections minus operating minus depreciation.</p>
          <table data-testid="book-schedule">
            <thead>
              <tr><th>Year</th><th>Beginning book value</th><th>Depreciation charge</th><th>Ending book value</th><th>Collections</th><th>Operating</th><th>Book result</th></tr>
            </thead>
            <tbody>
              {result.bookView.combined.map((row) => (
                <tr key={row.year} data-book-year={row.year}>
                  <td>{yearHeader(row.year, startYear)}</td>
                  <td>{roundForDisplay(row.beginning)}</td>
                  <td>{roundForDisplay(row.charge)}</td>
                  <td>{roundForDisplay(row.ending)}</td>
                  <td>{roundForDisplay(row.collections)}</td>
                  <td>{roundForDisplay(row.operating)}</td>
                  <td>{roundForDisplay(row.bookResult)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl data-testid="residual-reconciliation">
            <dt>Residual mode</dt><dd data-stat="residualMode">{result.bookView.residualMode}</dd>
            <dt>Remaining book value at the residual year</dt><dd data-stat="remainingBookValue">{roundForDisplay(result.bookView.remainingBookValueAtResidualYear)}</dd>
            <dt>Residual used (terminal inflow)</dt><dd data-stat="residualUsed">{roundForDisplay(result.residualAmountUsed ?? 0)}</dd>
            {result.bookView.residualMode === "amount" && (
              <><dt>Set amount</dt><dd data-stat="residualSetAmount">{roundForDisplay(result.bookView.setAmount)}</dd>
              <dt>Gain or loss on sale</dt><dd data-stat="gainOrLoss">{roundForDisplay(result.bookView.gainOrLossOnSale)}</dd></>
            )}
          </dl>
        </>
      )}
    </section>
  );
}
