import type { ModelResult } from "../../../core/src/types.js";
import { percentForDisplay, roundForDisplay } from "../engine.js";
import { yearHeader } from "../state.js";
import { CostInflowColumns, CumulativeLine } from "../charts.js";
import { deckMoneyForDisplay } from "../engine.js";

export function ResultsSection(props: { result: ModelResult; targetIrr: number; currency: string; startYear?: number | null }) {
  const { result, targetIrr, currency, startYear = null } = props;
  return (
    <section data-testid="results">
      <h2>Results</h2>
      <p data-testid="goal-check">
        Goal check: the solved structure achieves an IRR of{" "}
        {percentForDisplay(result.achievedIrr, 2)} against a target of{" "}
        {roundForDisplay(targetIrr, 2)}% — {result.goalMet ? "target achieved" : "target not achieved"}.
        {result.irrAmbiguous && (
          <span data-testid="irr-ambiguity-warning" className="warning">
            {" "}Warning: the net flow has {result.signChanges} sign changes; the IRR may not be unique.
          </span>
        )}
      </p>
      <h3>Yearly schedule</h3>
      <CostInflowColumns yearly={result.yearly} labelFor={(y) => yearHeader(y, startYear)} valueFor={(v) => deckMoneyForDisplay(v, currency as Parameters<typeof deckMoneyForDisplay>[1])} />
      <CumulativeLine yearly={result.yearly} labelFor={(y) => yearHeader(y, startYear)} valueFor={(v) => deckMoneyForDisplay(v, currency as Parameters<typeof deckMoneyForDisplay>[1])} />
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
    </section>
  );
}
