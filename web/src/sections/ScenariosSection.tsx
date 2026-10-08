import type { ModelInputs } from "../../../core/src/types.js";
import { scenarioResults, tornado, paymentVsTermTargetTable, paymentVsBalloonTermTable } from "../../../core/src/scenarios.js";
import { roundForDisplay } from "../engine.js";

export function ScenariosSection(props: { inputs: ModelInputs }) {
  const { inputs } = props;
  const sc = scenarioResults(inputs);
  const t = tornado(inputs);
  const terms = [5, 7, 9];
  const targets = [8, 12, 16];
  const balloons = [0, 1000000, 2000000];
  const twoWay = paymentVsTermTargetTable(inputs, terms, targets);
  const bt = paymentVsBalloonTermTable(inputs, balloons, terms);
  return (
    <section data-testid="scenarios">
      <h2>Scenarios and sensitivity</h2>
      <h3>Named scenario sets</h3>
      <table data-testid="scenario-table">
        <thead><tr><th>Scenario</th><th>Payment</th><th>Total cost</th><th>Payments</th></tr></thead>
        <tbody>
          <tr data-scenario="base"><td>Base</td><td data-stat="basePayment">{sc.base.paymentAmount === null ? "—" : roundForDisplay(sc.base.paymentAmount)}</td><td>{roundForDisplay(sc.base.totalCost)}</td><td>{sc.base.paymentCount}</td></tr>
          <tr data-scenario="optimistic"><td>Optimistic</td><td data-stat="optPayment">{sc.optimistic.paymentAmount === null ? "—" : roundForDisplay(sc.optimistic.paymentAmount)}</td><td>{roundForDisplay(sc.optimistic.totalCost)}</td><td>{sc.optimistic.paymentCount}</td></tr>
          <tr data-scenario="pessimistic"><td>Pessimistic</td><td data-stat="pesPayment">{sc.pessimistic.paymentAmount === null ? "—" : roundForDisplay(sc.pessimistic.paymentAmount)}</td><td>{roundForDisplay(sc.pessimistic.totalCost)}</td><td>{sc.pessimistic.paymentCount}</td></tr>
        </tbody>
      </table>
      <h3>Tornado (payment sensitivity)</h3>
      <table data-testid="tornado-table">
        <thead><tr><th>Factor</th><th>Low</th><th>High</th></tr></thead>
        <tbody>
          {t.map((row) => (
            <tr key={row.factor} data-factor={row.factor}><td>{row.factor}</td><td>{row.low === null ? "—" : roundForDisplay(row.low)}</td><td>{row.high === null ? "—" : roundForDisplay(row.high)}</td></tr>
          ))}
        </tbody>
      </table>
      <h3>Payment vs term at each target IRR</h3>
      <table data-testid="term-target-table">
        <thead><tr><th>Target / term</th>{terms.map((x) => <th key={x}>{x}</th>)}</tr></thead>
        <tbody>
          {targets.map((target, i) => (
            <tr key={target}><td>{target}%</td>{terms.map((term, j) => <td key={term}>{twoWay[i][j] === null ? "—" : roundForDisplay(twoWay[i][j])}</td>)}</tr>
          ))}
        </tbody>
      </table>
      <h3>Payment vs balloon at each term</h3>
      <table data-testid="balloon-term-table">
        <thead><tr><th>Term / balloon</th>{balloons.map((x) => <th key={x}>{x}</th>)}</tr></thead>
        <tbody>
          {terms.map((term, i) => (
            <tr key={term}><td>{term}</td>{balloons.map((balloon, j) => <td key={balloon}>{bt[i][j] === null ? "—" : roundForDisplay(bt[i][j])}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
