import type { ModelInputs, ModelResult } from "../../../core/src/types.js";
import { roundForDisplay } from "../engine.js";

export function RepaymentSection(props: {
  inputs: ModelInputs;
  result: ModelResult | null;
  setRepayment: (patch: Partial<ModelInputs["repayment"]>) => void;
}) {
  const { inputs, result, setRepayment } = props;
  const r = inputs.repayment;
  const num = (key: keyof ModelInputs["repayment"]) => (e: { target: { value: string } }) =>
    setRepayment({ [key]: parseFloat(e.target.value) || 0 } as Partial<ModelInputs["repayment"]>);
  return (
    <section data-testid="repayment">
      <h2>Repayment</h2>
      <label>Term (years) <input data-field="termYears" type="number" value={r.termYears} onChange={num("termYears")} /></label>
      <label>Payments per year{" "}
        <select data-field="paymentsPerYear" value={r.paymentsPerYear} onChange={(e) => setRepayment({ paymentsPerYear: parseInt(e.target.value, 10) })}>
          <option value={1}>Annual</option>
          <option value={2}>Semi-annual</option>
          <option value={4}>Quarterly</option>
          <option value={12}>Monthly</option>
        </select>
      </label>
      <label>Grace (years) <input data-field="graceYears" type="number" value={r.graceYears} onChange={num("graceYears")} /></label>
      <label>Payment escalation (%/yr) <input data-field="paymentEscalation" type="number" value={r.paymentEscalation} onChange={num("paymentEscalation")} /></label>
      <label>Balloon <input data-field="balloon" type="number" value={r.balloon} onChange={num("balloon")} /></label>
      {result !== null && (
        <dl data-testid="repayment-summary">
          <dt>Solved payment</dt><dd data-stat="paymentAmount">{roundForDisplay(result.paymentAmount)}</dd>
          <dt>Payment count</dt><dd data-stat="paymentCount">{result.paymentCount}</dd>
          <dt>First payment year</dt><dd data-stat="repaymentStartYear">{result.repaymentStartYear}</dd>
          <dt>Total collected</dt><dd data-stat="totalCollected">{roundForDisplay(result.totalCollected)}</dd>
        </dl>
      )}
    </section>
  );
}
