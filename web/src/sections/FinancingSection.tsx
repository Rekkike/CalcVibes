import type { FinancingConfig, ModelInputs } from "../../../core/src/types.js";

export function FinancingSection(props: {
  inputs: ModelInputs;
  setFinancing: (f: FinancingConfig) => void;
}) {
  const { inputs, setFinancing } = props;
  const f = inputs.financing ?? { enabled: false, sharePct: 60, debtRatePct: 6, termYears: 7, graceYears: 0, serviceStartYear: null, amortization: "annuity" as const, leveragedSolve: false, perLineSharePct: {} };
  const num = (key: "sharePct" | "debtRatePct" | "termYears" | "graceYears") => (e: { target: { value: string } }) =>
    setFinancing({ ...f, [key]: parseFloat(e.target.value) || 0 });
  return (
    <section data-testid="financing">
      <h2>Financing</h2>
      <label>Enable financing{" "}
        <input data-field="finEnabled" type="checkbox" checked={f.enabled} onChange={(e) => setFinancing({ ...f, enabled: e.target.checked })} />
      </label>
      {f.enabled && (
        <>
          <label>Debt share (%) <input data-field="finShare" type="number" value={f.sharePct} onChange={num("sharePct")} /></label>
          <label>Debt rate (% per year) <input data-field="finRate" type="number" value={f.debtRatePct} onChange={num("debtRatePct")} /></label>
          <label>Debt term (years) <input data-field="finTerm" type="number" value={f.termYears} onChange={num("termYears")} /></label>
          <label>Debt grace (years, interest-only) <input data-field="finGrace" type="number" value={f.graceYears} onChange={num("graceYears")} /></label>
          <label>Service start year (empty = first collection year){" "}
            <input data-field="finStart" type="number" value={f.serviceStartYear ?? ""} onChange={(e) =>
              setFinancing({ ...f, serviceStartYear: e.target.value === "" ? null : parseFloat(e.target.value) || 0 })} />
          </label>
          <label>Amortization{" "}
            <select data-field="finAmortization" value={f.amortization} onChange={(e) => setFinancing({ ...f, amortization: e.target.value as FinancingConfig["amortization"] })}>
              <option value="annuity">Annuity</option>
              <option value="equal-principal">Equal principal</option>
            </select>
          </label>
          <h3>Per-line debt share overrides (default: the project share)</h3>
          {inputs.costs.map((c) => (
            <label key={c.id}>{c.name || c.id} (%){" "}
              <input data-field="finLineShare" data-line={c.id} type="number"
                value={f.perLineSharePct?.[c.id] ?? f.sharePct}
                onChange={(e) => setFinancing({ ...f, perLineSharePct: { ...f.perLineSharePct, [c.id]: parseFloat(e.target.value) || 0 } })} />
            </label>
          ))}
          <label>Leveraged solve (the collections solve so the equity earns the target IRR){" "}
            <input data-field="finLeveraged" type="checkbox" checked={f.leveragedSolve} onChange={(e) => setFinancing({ ...f, leveragedSolve: e.target.checked })} />
          </label>
        </>
      )}
    </section>
  );
}
