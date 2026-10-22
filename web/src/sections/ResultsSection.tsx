import type { ModelResult } from "../../../core/src/types.js";
import { percentForDisplay, roundForDisplay } from "../engine.js";
import { composeBookCollections, composeFacilitySchedules, yearHeader } from "../state.js";
import { SignedCashflowChart } from "../charts.js";
import { deckMoneyForDisplay, deckYearsForDisplay, dscrTwoForDisplay } from "../engine.js";

export function ResultsSection(props: { result: ModelResult; targetIrr: number; currency: string; startYear?: number | null; entryUnit?: import("../engine.js").EntryUnit }) {
  const { result, targetIrr, currency, startYear = null, entryUnit = "ones" } = props;
  const money = (v: number) => deckMoneyForDisplay(v, currency as Parameters<typeof deckMoneyForDisplay>[1], entryUnit);
  const bookSplit = composeBookCollections(result);
  return (
    <section data-testid="results">
      <h2>Results</h2>
      <div data-testid="answer-band" className={"answer-band " + (result.goalMet ? "tone-ok" : "tone-bad")}>
        <p data-testid="goal-check" className="answer-statement">
          {result.goalMet
            ? `The project meets its target: the solved structure achieves an IRR of ${percentForDisplay(result.achievedIrr, 2)} against a target of ${roundForDisplay(targetIrr, 2)}% — target achieved.`
            : `The project falls short: the solved structure achieves an IRR of ${percentForDisplay(result.achievedIrr, 2)} against a target of ${roundForDisplay(targetIrr, 2)}% — target not achieved.`}
          {result.irrAmbiguityNote !== null && (
            <span data-testid="irr-ambiguity-warning" className="warning">
              {" "}{result.irrAmbiguityNote}
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
          <span className="kpi-value">{money(result.npvAtWacc)}</span>
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
        <span className="figure-item"><span className="figure-label">Total cost</span> <span className="figure-value">{money(result.totalCost)}</span></span>
        <span className="figure-item"><span className="figure-label">Total collected</span> <span className="figure-value">{money(result.totalCollected)}</span></span>
        <span className="figure-item"><span className="figure-label">Net gain</span> <span className="figure-value">{money(result.netGain)}</span></span>
        <p className="caveat">Nominal figures are undiscounted; the cost NPV and achieved IRR are discounted.</p>
      </div>
      <h3>Yearly schedule</h3>
      <table data-testid="yearly-table">
        <thead>
          <tr><th>Year</th><th>Cost (nominal)</th><th>Collections (nominal)</th><th>Net (nominal)</th><th>Cumulative net (nominal)</th></tr>
        </thead>
        <tbody>
          {result.yearly.map((y) => (
            <tr key={y.year}>
              <td>{yearHeader(y.year, startYear)}</td>
              <td data-stat="yearly-cost">{money(y.cost)}</td>
              <td data-stat="yearly-inflow">{money(y.inflow)}</td>
              <td data-stat="yearly-net">{money(y.net)}</td>
              <td data-stat="yearly-cumulative">{money(y.cumulative)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>Cost composition (line totals, nominal)</h3>
      <ul data-testid="cost-composition">
        {result.lineTotals.map((l) => (
          <li key={l.id}>{l.name}: {money(l.total)}</li>
        ))}
      </ul>
      <h3>Key metrics</h3>
      <dl data-testid="metrics">
        <dt>Total cost (nominal)</dt><dd data-stat="totalCost">{money(result.totalCost)}</dd>
        <dt>Cost NPV at target (discounted)</dt><dd data-stat="costNpv">{roundForDisplay(result.costNpv)}</dd>
        <dt>Total collected (nominal)</dt><dd data-stat="totalCollected">{money(result.totalCollected)}</dd>
        <dt>Net gain (nominal)</dt><dd data-stat="netGain">{money(result.netGain)}</dd>
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
              {result.financing.equity.ambiguityNote !== null && (
                <span data-testid="equity-ambiguity-warning" className="warning">
                  {" "}{result.financing.equity.ambiguityNote}
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
          {/* v0.6.18 Task C: the per-facility debt-service schedules beneath the combined aggregate; each
              facility's yearly draws, interest, principal, service and closing balance, composed once in
              state.ts from the engine's per-facility monthly arrays. The note's payback installments are named. */}
          {composeFacilitySchedules(result).length > 0 && (
            <div data-testid="facility-schedules">
              <h3>Facility schedules (yearly, by facility)</h3>
              <p className="muted" data-testid="facility-schedules-note">The combined debt schedule above is the sum of these facility rows, year by year. The interest-free note's payback appears as its own installments, not inside an unnamed principal.</p>
              {composeFacilitySchedules(result).map((f) => (
                <div key={f.id} data-facility-schedule={f.id} data-facility-origin={f.origin}>
                  <h4 data-testid="facility-schedule-title">{f.label || f.id} — {f.origin === "funding-note" ? "interest-free note (payback installments)" : "facility"}, {f.scopeText}</h4>
                  <table data-testid="facility-schedule">
                    <thead><tr><th>Year</th><th>Draws</th><th>Interest</th><th>{f.principalLabel}</th><th>Service</th><th>Closing balance</th></tr></thead>
                    <tbody>
                      {f.rows.map((r) => (
                        <tr key={r.year} data-facility-year={r.year}><td>{yearHeader(r.year, startYear)}</td><td>{roundForDisplay(r.draws)}</td><td>{roundForDisplay(r.interest)}</td><td>{roundForDisplay(r.principal)}</td><td>{roundForDisplay(r.service)}</td><td>{roundForDisplay(r.balance)}</td></tr>
                      ))}
                      <tr data-facility-total="true"><td>Total</td><td>{roundForDisplay(f.totals.draws)}</td><td>{roundForDisplay(f.totals.interest)}</td><td>{roundForDisplay(f.totals.principal)}</td><td>{roundForDisplay(f.totals.service)}</td><td></td></tr>
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
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
      <h3>Signed cashflow (costs below the line, collections above it, the cumulative net overlaid)</h3>
      <div data-testid="coverage-chart">
        <SignedCashflowChart yearly={result.yearly} labelFor={(y) => yearHeader(y, startYear)} valueFor={(v) => money(v)} />
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
          <p className="muted" data-testid="book-view-disclosure">The book view records the depreciation write-down; it never enters the cash flows (the investment was paid once, in the cost vector). The book result is collections minus operating minus depreciation.{bookSplit !== null && " The collections column is every project inflow of the year: the fee collections, the grant receipts and the interest-free note's advance net of its installments, which the project net flow carries as cash; the three columns beside it name that basis and sum to the collections figure."}</p>
          <table data-testid="book-schedule">
            <thead>
              <tr><th>Year</th><th>Beginning book value</th><th>Depreciation charge</th><th>Ending book value</th><th>Collections (all project inflows)</th>{bookSplit !== null && (<><th>of which fee collections</th><th>of which grant receipts</th><th>of which the note (advance less installments)</th></>)}<th>Operating</th><th>Book result</th></tr>
            </thead>
            <tbody>
              {result.bookView.combined.map((row) => (
                <tr key={row.year} data-book-year={row.year}>
                  <td>{yearHeader(row.year, startYear)}</td>
                  <td>{roundForDisplay(row.beginning)}</td>
                  <td>{roundForDisplay(row.charge)}</td>
                  <td>{roundForDisplay(row.ending)}</td>
                  <td>{roundForDisplay(row.collections)}</td>
                  {bookSplit !== null && (() => {
                    const s = bookSplit.find((x) => x.year === row.year);
                    return (<><td data-book-fees>{roundForDisplay(s?.fees ?? 0)}</td><td data-book-grants>{roundForDisplay(s?.grants ?? 0)}</td><td data-book-note>{roundForDisplay(s?.note ?? 0)}</td></>);
                  })()}
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
