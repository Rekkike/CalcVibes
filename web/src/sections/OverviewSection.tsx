import type { ModelInputs, ModelResult } from "../../../core/src/types.js";
import { roundForDisplay } from "../engine.js";

export function OverviewSection(props: {
  inputs: ModelInputs;
  result: ModelResult | null;
  setProjectName: (v: string) => void;
  setTargetIrr: (v: string) => void;
  setProjectLength: (v: number | null) => void;
}) {
  const { inputs, result, setProjectName, setTargetIrr, setProjectLength } = props;
  return (
    <section data-testid="overview">
      <h2>Overview</h2>
      <label>
        Project name{" "}
        <input data-field="projectName" value={inputs.projectName} onChange={(e) => setProjectName(e.target.value)} />
      </label>
      <label>
        Target IRR (%){" "}
        <input data-field="targetIrr" type="number" value={inputs.targetIrr} onChange={(e) => setTargetIrr(e.target.value)} />
      </label>
      <label>
        Project length (years; empty = derived horizon){" "}
        <input data-field="projectLength" type="number" value={inputs.projectLengthYears ?? ""} onChange={(e) =>
          setProjectLength(e.target.value === "" ? null : parseFloat(e.target.value) || 0)} />
      </label>
      {result !== null ? (
        <dl data-testid="headline-stats">
          <dt>Total cost</dt><dd data-stat="totalCost">{roundForDisplay(result.totalCost)}</dd>
          <dt>Cost NPV at target</dt><dd data-stat="costNpv">{roundForDisplay(result.costNpv)}</dd>
          <dt>Payment per period</dt><dd data-stat="paymentAmount">{result.paymentAmount === null ? "not applicable (collection mode)" : roundForDisplay(result.paymentAmount)}</dd>
          <dt>Payments</dt><dd data-stat="paymentCount">{result.paymentCount}</dd>
          <dt>Total collected</dt><dd data-stat="totalCollected">{roundForDisplay(result.totalCollected)}</dd>
          <dt>Net gain</dt><dd data-stat="netGain">{roundForDisplay(result.netGain)}</dd>
          <dt>Payback (years)</dt>
          <dd data-stat="paybackYears">{result.paybackYears === null ? "—" : roundForDisplay(result.paybackYears, 5)}</dd>
          <dt>Achieved IRR</dt>
          <dd data-stat="achievedIrr">
            {result.achievedIrr === null ? "—" : roundForDisplay(result.achievedIrr * 100, 2) + "%"}
            {result.irrAmbiguous && (
              <span data-testid="irr-ambiguity-warning" className="warning">
                Warning: the net flow has {result.signChanges} sign changes; the IRR may not be unique.
              </span>
            )}
          </dd>
        </dl>
      ) : (
        <p data-testid="overview-placeholder">Add cost lines and resolve any issues to see headline statistics.</p>
      )}
    </section>
  );
}
