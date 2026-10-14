import type { ModelInputs } from "../../../core/src/types.js";
import { scenarioResults, tornado } from "../../../core/src/scenarios.js";
import { computeModel } from "../engine.js";
import { moneyForDisplay, entryToValue, feeForDisplay } from "../engine.js";
import type { CurrencyCode, EntryUnit } from "../engine.js";

type ListSetter = (v: number[] | null) => void;

const AXIS_EXPLANATIONS: Record<string, string> = {
  target: "The target IRR is the annual return the payment stream is solved to achieve; each value produces its own solved payment.",
  term: "The term is the number of years over which the payment stream runs; a longer term lowers each payment.",
  balloon: "A balloon is a one-time final payment at the end of the term; 0 means none.",
  // v0.6.10 Task E.5 (Task D.1): the grant-scale axis — each factor multiplies every grant
  // row's amount; a factor of 0 removes the grants (a zero-amount grant is invalid per
  // FND-AMOUNT); the loan rows never scale.
  "grant-scale": "The grant-scale factor multiplies every grant row's amount; 0 removes the grants entirely; the loan rows never scale.",
};

function ScenarioListEditor(props: { label: string; values: number[] | null; onChange: ListSetter }) {
  const { label, values, onChange } = props;
  const current = values ?? [];
  return (
    <div data-testid={`scenario-list-${label}`} className="scenario-list">
      <h4>{label}</h4>
      <p data-testid={`scenario-axis-explanation-${label}`} className="muted">{AXIS_EXPLANATIONS[label]}</p>
      {current.map((v, i) => (
        <div key={i} className="scenario-list-row">
          <input
            data-field={`scenario-${label}`}
            data-index={i}
            type="number"
            placeholder={`a ${label} value`}
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

export function ScenariosSection(props: {
  inputs: ModelInputs;
  scenarioTargets?: number[] | null;
  scenarioTerms?: number[] | null;
  scenarioBalloons?: number[] | null;
  scenarioGrantScales?: number[] | null;
  onScenarioTargetsChange?: ListSetter;
  onScenarioTermsChange?: ListSetter;
  onScenarioBalloonsChange?: ListSetter;
  onScenarioGrantScalesChange?: ListSetter;
  entryUnit: EntryUnit;
  currency: string;
}) {
  const { inputs, scenarioTargets = null, scenarioTerms = null, scenarioBalloons = null, scenarioGrantScales = null, onScenarioTargetsChange, onScenarioTermsChange, onScenarioBalloonsChange, onScenarioGrantScalesChange, entryUnit, currency } = props;
  const cur = (currency as CurrencyCode) ?? "SEK";
  const money = (v: number) => moneyForDisplay(v, cur, entryUnit);
  // v0.6.9 Task F (finding W28): the scenario payment figures render through the
  // magnitude-aware feeForDisplay; the total-cost cells stay at the entry-unit money form.
  const fee = (v: number) => feeForDisplay(v, cur, entryUnit);
  let sc: ReturnType<typeof scenarioResults> | null = null;
  let t: ReturnType<typeof tornado> | null = null;
  let refusalMessage: string | null = null;
  try {
    sc = scenarioResults(inputs);
    t = tornado(inputs);
  } catch (e) {
    refusalMessage = (e as Error).message;
  }
  const terms = scenarioTerms ?? [];
  const targets = scenarioTargets ?? [];
  const balloons = scenarioBalloons ?? [];
  const grantScales = scenarioGrantScales ?? [];
  const profileActive = inputs.repayment.collectionsOverrides !== undefined && Object.keys(inputs.repayment.collectionsOverrides).length > 0;
  const tablesComputable = targets.length > 0 && terms.length > 0 && !profileActive;
  const btComputable = terms.length > 0 && balloons.length > 0 && !profileActive;
  // v0.6.10 Task E.5: the grant-scale table computes only with both axes set and never in
  // profile mode (the same SCE-PROFILE wall as the other payment tables).
  const gsComputable = grantScales.length > 0 && terms.length > 0 && !profileActive;
  const computeCell = (patch: Partial<ModelInputs>): { value: number | null; message: string | null } => {
    try {
      const r = computeModel({ ...inputs, ...patch });
      return { value: r.paymentAmount, message: null };
    } catch (e) {
      return { value: null, message: (e as Error).message };
    }
  };
  const twoWay: { value: number | null; message: string | null }[][] = [];
  const bt: { value: number | null; message: string | null }[][] = [];
  if (tablesComputable) {
    for (const target of targets) {
      const row: { value: number | null; message: string | null }[] = [];
      for (const term of terms) {
        row.push(computeCell({ targetIrr: target, repayment: { ...inputs.repayment, termYears: term } }));
      }
      twoWay.push(row);
    }
  }
  if (btComputable) {
    for (const term of terms) {
      const row: { value: number | null; message: string | null }[] = [];
      for (const balloon of balloons) {
        row.push(computeCell({ repayment: { ...inputs.repayment, termYears: term, balloon: entryToValue(balloon, entryUnit) } }));
      }
      bt.push(row);
    }
  }
  // v0.6.10 Task E.5 (Task D.1): the grant-scale table — each cell scales the grant rows'
  // amounts by the factor (a factor of 0 removes the grant rows; a zero-amount grant is
  // invalid per FND-AMOUNT), leaves the loan rows untouched, and solves at the term. The
  // semantics mirror the engine's paymentVsGrantScaleTable exactly (one source).
  const gs: { value: number | null; message: string | null }[][] = [];
  if (gsComputable) {
    const scaledFunding = (scale: number): ModelInputs["funding"] => {
      if (!inputs.funding || !inputs.funding.rows || inputs.funding.rows.length === 0) return inputs.funding;
      const rows = inputs.funding.rows
        .filter((fr) => fr.kind !== "grant" || scale > 0)
        .map((fr) => (fr.kind === "grant" ? { ...fr, amount: fr.amount * scale } : fr));
      return { rows };
    };
    for (const scale of grantScales) {
      const row: { value: number | null; message: string | null }[] = [];
      for (const term of terms) {
        row.push(computeCell({ repayment: { ...inputs.repayment, termYears: term }, funding: scaledFunding(scale) }));
      }
      gs.push(row);
    }
  }
  if (refusalMessage !== null || sc === null || t === null) {
    return (
      <section data-testid="scenarios">
        <h2>Scenarios and sensitivity</h2>
        <div data-testid="scenarios-refusal" className="warning">
          <p>The engine refused to compute the scenario set for this project.</p>
          <p>{refusalMessage ?? "The scenario set could not be computed for this project."}</p>
        </div>
      </section>
    );
  }
  const anyAxisSet = targets.length > 0 || terms.length > 0 || balloons.length > 0 || grantScales.length > 0;
  return (
    <section data-testid="scenarios">
      <h2>Scenarios and sensitivity</h2>
      <div className="scenario-lists">
        {onScenarioTargetsChange && <ScenarioListEditor label="target" values={scenarioTargets} onChange={onScenarioTargetsChange} />}
        {onScenarioTermsChange && <ScenarioListEditor label="term" values={scenarioTerms} onChange={onScenarioTermsChange} />}
        {onScenarioBalloonsChange && <ScenarioListEditor label="balloon" values={scenarioBalloons} onChange={onScenarioBalloonsChange} />}
        {onScenarioGrantScalesChange && <ScenarioListEditor label="grant-scale" values={scenarioGrantScales} onChange={onScenarioGrantScalesChange} />}
      </div>
      {!anyAxisSet && (
        <p data-testid="scenarios-empty-state" className="warning">Enter values to compute the tables.</p>
      )}
      <h3>Named scenario sets</h3>
      <table data-testid="scenario-table">
        <thead><tr><th>Scenario</th><th>Payment</th><th>Total cost</th><th>Payments</th></tr></thead>
        <tbody>
          <tr data-scenario="base"><td>Base</td><td data-stat="basePayment">{sc.base.paymentAmount === null ? "—" : fee(sc.base.paymentAmount)}</td><td>{money(sc.base.totalCost)}</td><td>{sc.base.paymentCount}</td></tr>
          <tr data-scenario="optimistic"><td>Optimistic</td><td data-stat="optPayment">{sc.optimistic.paymentAmount === null ? "—" : fee(sc.optimistic.paymentAmount)}</td><td>{money(sc.optimistic.totalCost)}</td><td>{sc.optimistic.paymentCount}</td></tr>
          <tr data-scenario="pessimistic"><td>Pessimistic</td><td data-stat="pesPayment">{sc.pessimistic.paymentAmount === null ? "—" : fee(sc.pessimistic.paymentAmount)}</td><td>{money(sc.pessimistic.totalCost)}</td><td>{sc.pessimistic.paymentCount}</td></tr>
        </tbody>
      </table>
      <h3>Tornado (payment sensitivity)</h3>
      <table data-testid="tornado-table">
        <thead><tr><th>Factor</th><th>Low</th><th>High</th></tr></thead>
        <tbody>
          {t.map((row) => (
            <tr key={row.factor} data-factor={row.factor}><td>{row.factor}</td><td>{row.low === null ? "—" : fee(row.low)}</td><td>{row.high === null ? "—" : fee(row.high)}</td></tr>
          ))}
        </tbody>
      </table>
      {profileActive && <p data-testid="sce-profile-note" className="warning">The payment sensitivity tables require the solved payment stream; they do not apply while a collections profile is present (SCE-PROFILE).</p>}
      <h3>Payment vs term at each target IRR</h3>
      {!tablesComputable ? (
        <p data-testid="term-target-empty" className="warning">Enter values to compute the tables.</p>
      ) : (
        <table data-testid="term-target-table">
          <thead><tr><th>Target / term</th>{terms.map((x) => <th key={x}>{x}</th>)}</tr></thead>
          <tbody>
            {targets.map((target, i) => (
              <tr key={target}><td>{target}%</td>{terms.map((term, j) => <td key={term} data-cell-refusal={twoWay[i][j].value === null ? "true" : undefined}>{twoWay[i][j].value === null ? `refused: ${twoWay[i][j].message}` : fee(twoWay[i][j].value as number)}</td>)}</tr>
            ))}
          </tbody>
        </table>
      )}
      <h3>Payment vs balloon at each term</h3>
      {!btComputable ? (
        <p data-testid="balloon-term-empty" className="warning">Enter values to compute the tables.</p>
      ) : (
        <table data-testid="balloon-term-table">
          <thead><tr><th>Term / balloon</th>{balloons.map((x) => <th key={x}>{x}</th>)}</tr></thead>
          <tbody>
            {terms.map((term, i) => (
              <tr key={term}><td>{term}</td>{balloons.map((balloon, j) => <td key={balloon} data-cell-refusal={bt[i][j].value === null ? "true" : undefined}>{bt[i][j].value === null ? `refused: ${bt[i][j].message}` : fee(bt[i][j].value as number)}</td>)}</tr>
            ))}
          </tbody>
        </table>
      )}
      <h3>Payment vs term at each grant-scale factor</h3>
      {!gsComputable ? (
        <p data-testid="grant-scale-empty" className="warning">Enter values to compute the tables.</p>
      ) : (
        <table data-testid="grant-scale-term-table">
          <thead><tr><th>Grant scale / term</th>{terms.map((x) => <th key={x}>{x}</th>)}</tr></thead>
          <tbody>
            {grantScales.map((scale, i) => (
              <tr key={scale} data-grant-scale={scale}><td>{scale}</td>{terms.map((term, j) => <td key={term} data-cell-refusal={gs[i][j].value === null ? "true" : undefined}>{gs[i][j].value === null ? `refused: ${gs[i][j].message}` : fee(gs[i][j].value as number)}</td>)}</tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
