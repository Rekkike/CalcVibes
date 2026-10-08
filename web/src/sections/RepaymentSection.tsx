import type { ModelInputs, ModelResult } from "../../../core/src/types.js";
import { roundForDisplay } from "../engine.js";
import { spreadFill } from "../state.js";

export function RepaymentSection(props: {
  inputs: ModelInputs;
  result: ModelResult | null;
  setRepayment: (patch: Partial<ModelInputs["repayment"]>) => void;
  mode: "A" | "B" | "C";
  setMode: (m: "A" | "B" | "C") => void;
  modePayment: number;
  setModePayment: (p: number) => void;
}) {
  const { inputs, result, setRepayment, mode, setMode, modePayment, setModePayment } = props;
  const r = inputs.repayment;
  const num = (key: keyof ModelInputs["repayment"]) => (e: { target: { value: string } }) =>
    setRepayment({ [key]: parseFloat(e.target.value) || 0 } as Partial<ModelInputs["repayment"]>);
  return (
    <section data-testid="repayment">
      <h2>Repayment</h2>
      <label>Mode{" "}
        <select data-field="mode" value={mode} onChange={(e) => setMode(e.target.value as "A" | "B" | "C")}>
          <option value="A">Mode A — solve the payment</option>
          <option value="B">Mode B — solve the term given a payment</option>
          <option value="C">Mode C — evaluate a given payment</option>
        </select>
      </label>
      {mode !== "A" && (
        <label>Payment per period <input data-field="modePayment" type="number" value={modePayment} onChange={(e) => setModePayment(parseFloat(e.target.value) || 0)} /></label>
      )}
      <label>First collection year (override; blank means derived){" "}
        <input data-field="firstCollectionYear" type="number" value={inputs.repayment.firstCollectionYear ?? ""} onChange={(e) =>
          setRepayment({ firstCollectionYear: e.target.value === "" ? null : parseFloat(e.target.value) || 0 })} />
      </label>
      <details data-testid="collections-editor">
        <summary>Per-year collections profile (optional; overrides the solved stream)</summary>
        <table data-testid="collections-rows">
          <thead><tr><th>Year</th><th>Collected sum</th><th></th></tr></thead>
          <tbody>
            {Object.entries(inputs.repayment.collectionsOverrides ?? {}).map(([y, amount]) => (
              <tr key={y} data-override-year={y}>
                <td><input data-field="col-override-year" value={y} onChange={(e) => {
                  const next = { ...(inputs.repayment.collectionsOverrides ?? {}) };
                  delete next[Number(y)];
                  next[parseFloat(e.target.value) || 0] = amount;
                  setRepayment({ collectionsOverrides: next });
                }} /></td>
                <td><input data-field="col-override-amount" type="number" value={amount} onChange={(e) => {
                  const next = { ...(inputs.repayment.collectionsOverrides ?? {}) };
                  next[Number(y)] = parseFloat(e.target.value) || 0;
                  setRepayment({ collectionsOverrides: next });
                }} /></td>
                <td><button data-action="remove-col-override" data-year={y} onClick={() => {
                  const next = { ...(inputs.repayment.collectionsOverrides ?? {}) };
                  delete next[Number(y)];
                  setRepayment({ collectionsOverrides: next });
                }}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <button data-action="add-col-override" onClick={() => {
          const next = { ...(inputs.repayment.collectionsOverrides ?? {}) };
          next[3] = next[3] ?? 0;
          setRepayment({ collectionsOverrides: next });
        }}>Add year</button>
        <div data-testid="collections-spread">
          <label>Spread total <input data-field="col-spread-total" type="number" defaultValue="" /></label>
          <label>First year <input data-field="col-spread-first" type="number" defaultValue={3} /></label>
          <label>Year count <input data-field="col-spread-count" type="number" defaultValue={1} /></label>
          <button data-action="col-spread-fill" onClick={() => {
            const root = document.querySelector('[data-testid="collections-editor"]') as HTMLElement;
            const total = parseFloat((root.querySelector('[data-field="col-spread-total"]') as HTMLInputElement).value) || 0;
            const firstYear = parseFloat((root.querySelector('[data-field="col-spread-first"]') as HTMLInputElement).value) || 1;
            const yearCount = parseFloat((root.querySelector('[data-field="col-spread-count"]') as HTMLInputElement).value) || 1;
            setRepayment({ collectionsOverrides: spreadFill(total, firstYear, yearCount) });
          }}>Spread</button>
        </div>
      </details>
      <label>Term (years) <input data-field="termYears" type="number" value={r.termYears} onChange={num("termYears")} /></label>
      <label>Payments per year{" "}
        <select data-field="paymentsPerYear" value={r.paymentsPerYear} onChange={(e) => setRepayment({ paymentsPerYear: parseInt(e.target.value, 10) })}>
          <option value={1}>Annual</option>
          <option value={2}>Semi-annual</option>
          <option value={4}>Quarterly</option>
          <option value={12}>Monthly</option>
        </select>
      </label>
      <label>Grace (years) <input data-field="graceYears" type="number" value={r.graceYears} disabled={inputs.repayment.firstCollectionYear !== null && inputs.repayment.firstCollectionYear !== undefined} onChange={num("graceYears")} /></label>
      <label>Indexation (CPI) % per year (rule of thumb: 2%) <input data-field="paymentEscalation" type="number" value={r.paymentEscalation} onChange={num("paymentEscalation")} /></label>
      <label>Balloon <input data-field="balloon" type="number" value={r.balloon} onChange={num("balloon")} /></label>
      {result !== null && (
        <dl data-testid="repayment-summary">
          <dt>Solved payment</dt><dd data-stat="paymentAmount">{result.paymentAmount === null ? "not applicable (collection mode)" : roundForDisplay(result.paymentAmount)}</dd>
          <dt>Payment count</dt><dd data-stat="paymentCount">{result.paymentCount}</dd>
          <dt>First payment year</dt><dd data-stat="repaymentStartYear">{result.repaymentStartYear}</dd>
          <dt>Total collected</dt><dd data-stat="totalCollected">{roundForDisplay(result.totalCollected)}</dd>
        </dl>
      )}
    </section>
  );
}
