import type { ModelResult } from "../../../core/src/types.js";
import { roundForDisplay } from "../engine.js";

export function ResultsSection(props: { result: ModelResult; targetIrr: number; currency: string }) {
  const { result, targetIrr, currency } = props;
  return (
    <section data-testid="results">
      <h2>Results</h2>
      <p data-testid="goal-check">
        Goal check: the solved structure achieves an IRR of{" "}
        {result.achievedIrr === null ? "—" : roundForDisplay(result.achievedIrr * 100, 2) + "%"} against a target of{" "}
        {roundForDisplay(targetIrr, 2)}% — {result.goalMet ? "target achieved" : "target not achieved"}.
        {result.irrAmbiguous && (
          <span data-testid="irr-ambiguity-warning" className="warning">
            {" "}Warning: the net flow has {result.signChanges} sign changes; the IRR may not be unique.
          </span>
        )}
      </p>
      <h3>Yearly schedule</h3>
      <table data-testid="yearly-table">
        <thead>
          <tr><th>Year</th><th>Cost (nominal)</th><th>Collections (nominal)</th><th>Net (nominal)</th><th>Cumulative net (nominal)</th></tr>
        </thead>
        <tbody>
          {result.yearly.map((y) => (
            <tr key={y.year}>
              <td>{y.name}</td>
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
    </section>
  );
}
