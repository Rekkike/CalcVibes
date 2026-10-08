import type { ModelInputs } from "../../../core/src/types.js";
import { scenarioResults, tornado, paymentVsTermTargetTable, paymentVsBalloonTermTable } from "../../../core/src/scenarios.js";
import { roundForDisplay } from "../engine.js";

type ListSetter = (v: number[] | null) => void;

function ScenarioListEditor(props: { label: string; values: number[] | null; fallback: number[]; onChange: ListSetter }) {
  const { label, values, fallback, onChange } = props;
  const current = values ?? fallback;
  return (
    <div data-testid={`scenario-list-${label}`} className="scenario-list">
      <h4>{label}</h4>
      {current.map((v, i) => (
        <div key={i} className="scenario-list-row">
          <input
            data-field={`scenario-${label}`}
            data-index={i}
            type="number"
            value={v}
            onChange={(e) => {
              const next = current.slice();
              next[i] = parseFloat(e.target.value) || 0;
              onChange(next);
            }}
          />
          <button data-action={`scenario-remove-${label}`} data-index={i} onClick={() => onChange(current.filter((_, j) => j !== i))}>Remove</button>
        </div>
      ))}
      <button data-action={`scenario-add-${label}`} onClick={() => onChange([...current, 0])}>Add</button>
    </div>
  );
}

export function ScenariosSection(props: { inputs: ModelInputs; scenarioTargets?: number[] | null; scenarioTerms?: number[] | null; scenarioBalloons?: number[] | null; onScenarioTargetsChange?: ListSetter; onScenarioTermsChange?: ListSetter; onScenarioBalloonsChange?: ListSetter }) {
  const { inputs, scenarioTargets = null, scenarioTerms = null, scenarioBalloons = null, onScenarioTargetsChange, onScenarioTermsChange, onScenarioBalloonsChange } = props;
  const sc = scenarioResults(inputs);
  const t = tornado(inputs);
  const terms = scenarioTerms ?? [5, 7, 9];
  const targets = scenarioTargets ?? [8, 12, 16];
  const balloons = scenarioBalloons ?? [0, 1000000, 2000000];
  const profileActive = inputs.repayment.collectionsOverrides !== undefined && Object.keys(inputs.repayment.collectionsOverrides).length > 0;
  const twoWay = profileActive ? [] : paymentVsTermTargetTable(inputs, terms, targets);
  const bt = profileActive ? [] : paymentVsBalloonTermTable(inputs, balloons, terms);
  return (
    <section data-testid="scenarios">
      <h2>Scenarios and sensitivity</h2>
      <div className="scenario-lists">
        {onScenarioTargetsChange && <ScenarioListEditor label="target" values={scenarioTargets} fallback={[8, 12, 16]} onChange={onScenarioTargetsChange} />}
        {onScenarioTermsChange && <ScenarioListEditor label="term" values={scenarioTerms} fallback={[5, 7, 9]} onChange={onScenarioTermsChange} />}
        {onScenarioBalloonsChange && <ScenarioListEditor label="balloon" values={scenarioBalloons} fallback={[0, 1000000, 2000000]} onChange={onScenarioBalloonsChange} />}
      </div>
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
      {profileActive && <p data-testid="sce-profile-note" className="warning">The payment sensitivity tables require the solved payment stream; they do not apply while a collections profile is present (SCE-PROFILE).</p>}
      <h3>Payment vs term at each target IRR</h3>
      <table data-testid="term-target-table" style={{ display: profileActive ? "none" : undefined }}>
        <thead><tr><th>Target / term</th>{terms.map((x) => <th key={x}>{x}</th>)}</tr></thead>
        <tbody>
          {!profileActive && targets.map((target, i) => (
            <tr key={target}><td>{target}%</td>{terms.map((term, j) => <td key={term}>{twoWay[i][j] === null ? "—" : roundForDisplay(twoWay[i][j])}</td>)}</tr>
          ))}
        </tbody>
      </table>
      <h3>Payment vs balloon at each term</h3>
      <table data-testid="balloon-term-table">
        <thead><tr><th>Term / balloon</th>{balloons.map((x) => <th key={x}>{x}</th>)}</tr></thead>
        <tbody>
          {!profileActive && terms.map((term, i) => (
            <tr key={term}><td>{term}</td>{balloons.map((balloon, j) => <td key={balloon}>{bt[i][j] === null ? "—" : roundForDisplay(bt[i][j])}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
