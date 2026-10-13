import type { ModelInputs, ModelResult } from "../../../core/src/types.js";
import { roundForDisplay, percentForDisplay, deckMoneyForDisplay, deckYearsForDisplay, feeForDisplay } from "../engine.js";
import { SignedCashflowChart } from "../charts.js";
import { yearHeader } from "../state.js";

export function OverviewSection(props: {
  inputs: ModelInputs;
  result: ModelResult | null;
  startYear: number | null;
  setStartYear: (v: number | null) => void;
  startYearError: string | null;
  setProjectName: (v: string) => void;
  setTargetIrr: (v: string) => void;
  setProjectLength: (v: number | null) => void;
  entryUnit?: import("../engine.js").EntryUnit;
}) {
  const { inputs, result, startYear, setStartYear, startYearError, setProjectName, setTargetIrr, setProjectLength, entryUnit = "ones" } = props;
  const currency = (inputs.currency as Parameters<typeof deckMoneyForDisplay>[1]) ?? "SEK";
  const money = (v: number) => deckMoneyForDisplay(v, currency, entryUnit);
  // v0.6.9 Task F (finding W28): the payment-per-period figure renders through feeForDisplay.
  const fee = (v: number) => feeForDisplay(v, currency, entryUnit);
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
      <label>
        Project start year (optional, 1900–2200){" "}
        <input data-field="startYear" type="number" value={startYear ?? ""} onChange={(e) => {
          const v = e.target.value === "" ? null : parseInt(e.target.value, 10);
          setStartYear(v !== null && !Number.isNaN(v) ? v : null);
        }} />
      </label>
      {startYearError !== null && <p data-testid="start-year-error" className="warning">{startYearError}</p>}
      <p data-testid="length-hint" className="note">Derived horizon: {result !== null ? `${result.monthly.length} months (${result.yearly.length} years)` : "not computed"}</p>
      {result !== null && result.horizon !== undefined && (
        <div data-testid="horizon-derivation">
          <p className="note">The horizon derives from the latest of its constituents.</p>
          <ul>
            {result.horizon.constituents.map((hc, i) => (
              <li key={i} data-constituent={hc.label} data-constituent-month={hc.month}>{hc.label}: month {hc.month}</li>
            ))}
          </ul>
        </div>
      )}
      {result !== null && (
        <div data-testid="overview-summary">
          <div data-testid="metric-cards" className="metric-cards">
            <div className="metric-card" data-metric="totalCost">
              <span className="metric-label">Total project cost</span>
              <span className="metric-value">{money(result.totalCost)}</span>
            </div>
            <div className="metric-card" data-metric="requiredPayment">
              <span className="metric-label">Required payment</span>
              <span className="metric-value">{result.paymentAmount === null ? "not applicable (collection mode)" : money(result.paymentAmount)}</span>
            </div>
            <div className={"metric-card " + (result.goalMet ? "tone-ok" : "tone-bad")} data-metric="achievedIrr">
              <span className="metric-label">Achieved IRR (against the {roundForDisplay(inputs.targetIrr, 2)}% goal)</span>
              <span className="metric-value">{result.achievedIrr === null ? "\u2014" : percentForDisplay(result.achievedIrr, 2)}</span>
            </div>
            <div className="metric-card" data-metric="payback">
              <span className="metric-label">Payback</span>
              <span className="metric-value">{result.paybackYears === null ? "not within the horizon" : deckYearsForDisplay(result.paybackYears)}</span>
            </div>
          </div>
          <div data-testid="overview-cashflow-chart">
            <SignedCashflowChart yearly={result.yearly} labelFor={(y) => yearHeader(y, startYear)} valueFor={(v) => money(v)} />
          </div>
        </div>
      )}
      {result !== null ? (
        <dl data-testid="headline-stats">
          <dt>Total cost</dt><dd data-stat="totalCost">{money(result.totalCost)}</dd>
          <dt>Cost NPV at target</dt><dd data-stat="costNpv">{money(result.costNpv)}</dd>
          <dt>Payment per period</dt><dd data-stat="paymentAmount">{result.paymentAmount === null ? "not applicable (collection mode)" : fee(result.paymentAmount)}</dd>
          <dt>Payments</dt><dd data-stat="paymentCount">{result.paymentCount}</dd>
          <dt>Total collected</dt><dd data-stat="totalCollected">{money(result.totalCollected)}</dd>
          <dt>Net gain</dt><dd data-stat="netGain">{money(result.netGain)}</dd>
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
        <>
          <p data-testid="overview-placeholder">Add cost lines and resolve any issues to see headline statistics.</p>
          <p data-testid="overview-summary-empty" className="muted">The cashflow summary renders once the model computes.</p>
        </>
      )}
    </section>
  );
}
