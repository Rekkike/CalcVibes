import type { AppraisalParams, ModelInputs } from "../../../core/src/types.js";
import { percentForDisplay, roundForDisplay } from "../engine.js";

export function AppraisalSection(props: {
  inputs: ModelInputs;
  setAppraisal: (patch: Partial<AppraisalParams>) => void;
  result: import("../../../core/src/types.js").ModelResult | null;
}) {
  const { inputs, setAppraisal, result } = props;
  const a = inputs.appraisal ?? { wacc: 8, financeRate: 6, reinvestmentRate: 6, residual: { amount: 0, year: 10 } };
  const num = (key: "wacc" | "financeRate" | "reinvestmentRate") => (e: { target: { value: string } }) =>
    setAppraisal({ [key]: parseFloat(e.target.value) || 0 } as Partial<AppraisalParams>);
  return (
    <section data-testid="appraisal">
      <h2>Appraisal</h2>
      <label>WACC (%) <input data-field="wacc" type="number" value={a.wacc} onChange={num("wacc")} /></label>
      <label>Finance rate (%) <input data-field="financeRate" type="number" value={a.financeRate} onChange={num("financeRate")} /></label>
      <label>Reinvestment rate (%) <input data-field="reinvestmentRate" type="number" value={a.reinvestmentRate} onChange={num("reinvestmentRate")} /></label>
      <h3>Residual value (terminal inflow on the collections side)</h3>
      <label>Residual amount <input data-field="residualAmount" type="number" value={a.residual.amount} onChange={(e) => setAppraisal({ residual: { ...a.residual, amount: parseFloat(e.target.value) || 0 } })} /></label>
      <label>Residual year <input data-field="residualYear" type="number" value={a.residual.year} onChange={(e) => setAppraisal({ residual: { ...a.residual, year: parseFloat(e.target.value) || 0 } })} /></label>
      {result !== null && (
        <dl data-testid="appraisal-summary">
          <dt>NPV at target IRR (solver identity, discounted)</dt><dd data-stat="npvAtTarget">{roundForDisplay(result.npvAtTarget)}</dd>
          <dt>NPV at WACC (discounted)</dt><dd data-stat="npvAtWacc">{roundForDisplay(result.npvAtWacc)}</dd>
          <dt>NPV of collections at WACC (discounted)</dt><dd data-stat="npvCollectionsAtWacc">{roundForDisplay(result.npvCollectionsAtWacc)}</dd>
          <dt>NPV of costs at WACC (discounted)</dt><dd data-stat="npvCostsAtWacc">{roundForDisplay(result.npvCostsAtWacc)}</dd>
          <dt>Profitability index (NPV collections at WACC / NPV costs at WACC)</dt>
          <dd data-stat="profitabilityIndex">{result.profitabilityIndex === null ? "—" : roundForDisplay(result.profitabilityIndex, 5)}</dd>
          <dt>Payback, nominal (years)</dt><dd data-stat="paybackYears">{result.paybackYears === null ? "—" : roundForDisplay(result.paybackYears, 5)}</dd>
          <dt>Payback, discounted at WACC (years)</dt>
          <dd data-stat="discountedPaybackYears">{result.discountedPaybackYears === null ? "—" : roundForDisplay(result.discountedPaybackYears, 5)}</dd>
          <dt>MIRR (finance 6, reinvest 6 shown as configured)</dt><dd data-stat="mirr">{percentForDisplay(result.mirr)}</dd>
          <dt>Goal check (engine)</dt><dd data-stat="goalMet">{result.goalMet ? "Target achieved" : "Target not achieved"}</dd>
        </dl>
      )}
    </section>
  );
}
