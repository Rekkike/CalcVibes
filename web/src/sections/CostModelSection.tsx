import type { CostLine, ModelInputs } from "../../../core/src/types.js";
import { CURRENCIES, spreadFill } from "../state.js";
import { CompositionRows } from "../charts.js";
import { moneyForDisplay } from "../engine.js";


export function CostModelSection(props: {
  inputs: ModelInputs;
  issueByLine: Map<string, string[]>;
  setCurrency: (v: string) => void;
  addCost: () => void;
  removeCost: (id: string) => void;
  updateCost: (id: string, patch: Partial<CostLine>) => void;
  result: import("../../../core/src/types.js").ModelResult | null;
  setDepreciationDefault: (cfg: import("../../../core/src/types.js").DepreciationConfig | null) => void;
}) {
  const { inputs, issueByLine, setCurrency, addCost, removeCost, updateCost, result, setDepreciationDefault } = props;
  return (
    <section data-testid="costs">
      <h2>Cost model</h2>
      <label>
        Currency{" "}
        <select data-field="currency" value={inputs.currency} onChange={(e) => setCurrency(e.target.value)}>
          {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <table data-testid="cost-lines">
        <thead>
          <tr>
            <th>Name</th><th>Category</th><th>Amount / year</th><th>Start year</th><th>Duration (years)</th><th>Escalation %</th><th>Depreciation</th><th>Line total</th><th></th>
          </tr>
        </thead>
        <tbody>
          {inputs.costs.map((c) => {
            const lineIssues = issueByLine.get(c.id) || [];
            return [
              <tr key={c.id} data-line={c.id} data-kind="cost">
                <td>
                  <input data-field="name" value={c.name} onChange={(e) => updateCost(c.id, { name: e.target.value })} />
                </td>
                <td>
                  <select data-field="category" value={c.category} onChange={(e) => updateCost(c.id, { category: e.target.value as CostLine["category"] })}>
                    <option value="recurring">Recurring</option>
                    <option value="capex">CAPEX</option>
                  </select>
                </td>
                <td>
                  <input data-field="amount" type="number" value={c.amount} disabled={c.category === "capex" && c.yearOverrides !== undefined && Object.keys(c.yearOverrides ?? {}).length > 0} onChange={(e) => updateCost(c.id, { amount: parseFloat(e.target.value) || 0 })} title={c.category === "recurring" ? "Annual amount" : "The lump amount"} />
                </td>
                <td>
                  <input data-field="startYear" type="number" value={c.startYear} onChange={(e) => updateCost(c.id, { startYear: parseFloat(e.target.value) || 0 })} />
                </td>
                <td>
                  <input data-field="durationYears" type="number" value={c.durationYears} disabled={c.category === "capex"} onChange={(e) => updateCost(c.id, { durationYears: parseFloat(e.target.value) || 0 })} />
                  {c.category === "capex" && <span className="muted">CAPEX duration is set by the year profile</span>}
                </td>
                <td>
                  <input data-field="escalation" type="number" value={c.escalation} onChange={(e) => updateCost(c.id, { escalation: parseFloat(e.target.value) || 0 })} />
                </td>
                <td>
                  <select data-field="line-depreciation-mode" value={c.depreciation?.mode ?? ""} onChange={(e) => {
                    const mode = e.target.value;
                    if (mode === "") { updateCost(c.id, { depreciation: undefined }); return; }
                    if (mode === "retained") updateCost(c.id, { depreciation: { mode: "retained" } });
                    else if (mode === "straight-line") updateCost(c.id, { depreciation: { mode: "straight-line", years: c.depreciation?.years ?? 20 } });
                    else updateCost(c.id, { depreciation: { mode: "rate", yearlyRatePct: c.depreciation?.yearlyRatePct ?? 5 } });
                  }}>
                    <option value="">Project default</option>
                    <option value="retained">Retained</option>
                    <option value="straight-line">Straight-line</option>
                    <option value="rate">Yearly rate</option>
                  </select>
                  {c.depreciation?.mode === "straight-line" && (
                    <input data-field="line-depreciation-years" type="number" value={c.depreciation?.years ?? 20} onChange={(e) => updateCost(c.id, { depreciation: { mode: "straight-line", years: parseFloat(e.target.value) || 0 } })} />
                  )}
                  {c.depreciation?.mode === "rate" && (
                    <input data-field="line-depreciation-rate" type="number" value={c.depreciation?.yearlyRatePct ?? 0} onChange={(e) => updateCost(c.id, { depreciation: { mode: "rate", yearlyRatePct: parseFloat(e.target.value) || 0 } })} />
                  )}
                </td>
                <td data-field="line-total">—</td>
                <td>
                  <button data-action="remove-cost" onClick={() => removeCost(c.id)}>Remove</button>
                </td>
              </tr>,
              lineIssues.length > 0 && (
                <tr key={c.id + "-issues"} data-testid="line-issues" data-kind="issues" data-line={c.id}>
                  <td colSpan={9} className="warning">{lineIssues.join(" ")}</td>
                </tr>
              ),
              <tr key={c.id + "-years"} data-kind="year-editor" data-line={c.id}>
                <td colSpan={9}>
                  <details>
                    <summary data-testid="year-editor-toggle">Per-year amounts</summary>
                    <table data-testid="year-editor">
                      <thead><tr><th>Year</th><th>Amount</th><th></th></tr></thead>
                      <tbody>
                        {Object.entries(c.yearOverrides ?? {}).map(([y, amount]) => (
                          <tr key={y} data-override-year={y}>
                            <td><input data-field="override-year" value={y} onChange={(e) => {
                              const next = { ...(c.yearOverrides ?? {}) };
                              delete next[Number(y)];
                              next[parseFloat(e.target.value) || 0] = amount;
                              updateCost(c.id, { yearOverrides: next });
                            }} /></td>
                            <td><input data-field="override-amount" type="number" value={amount} onChange={(e) => {
                              const next = { ...(c.yearOverrides ?? {}) };
                              next[Number(y)] = parseFloat(e.target.value) || 0;
                              updateCost(c.id, { yearOverrides: next });
                            }} /></td>
                            <td><button data-action="remove-override" data-year={y} onClick={() => {
                              const next = { ...(c.yearOverrides ?? {}) };
                              delete next[Number(y)];
                              updateCost(c.id, { yearOverrides: next });
                            }}>Remove</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <button data-action="add-override" onClick={() => {
                      const next = { ...(c.yearOverrides ?? {}) };
                      next[1] = next[1] ?? 0;
                      updateCost(c.id, { yearOverrides: next });
                    }}>Add year</button>
                    <div data-testid="spread-editor">
                      <label>Spread total <input data-field="spread-total" type="number" defaultValue="" /></label>
                      <label>First year <input data-field="spread-first" type="number" defaultValue={1} /></label>
                      <label>Year count <input data-field="spread-count" type="number" defaultValue={1} /></label>
                      <button data-action="spread-fill" onClick={() => {
                        const root = document.querySelector(`[data-kind="year-editor"][data-line="${c.id}"]`) as HTMLElement;
                        const total = parseFloat((root.querySelector('[data-field="spread-total"]') as HTMLInputElement).value) || 0;
                        const firstYear = parseFloat((root.querySelector('[data-field="spread-first"]') as HTMLInputElement).value) || 1;
                        const yearCount = parseFloat((root.querySelector('[data-field="spread-count"]') as HTMLInputElement).value) || 1;
                        updateCost(c.id, { yearOverrides: spreadFill(total, firstYear, yearCount) });
                      }}>Spread</button>
                    </div>
                  </details>
                </td>
              </tr>,
            ];
          })}
        </tbody>
      </table>
      <div data-testid="depreciation-config">
        <h3>Depreciation (the book view)</h3>
        <p className="muted">Depreciation never touches the cash flows; it owns the yearly book schedule and the split of record (depreciable lines write down, retained lines hold at book).</p>
        <label>Project default (applies to unconfigured lines){" "}
          <select data-field="depreciation-default-mode" value={inputs.depreciationDefault?.mode ?? "retained"} onChange={(e) => {
            const mode = e.target.value as import("../../../core/src/types.js").DepreciationConfig["mode"];
            setDepreciationDefault(mode === "retained" ? { mode: "retained" } : mode === "straight-line" ? { mode: "straight-line", years: 20 } : { mode: "rate", yearlyRatePct: 5 });
          }}>
            <option value="retained">Retained (never writes down)</option>
            <option value="straight-line">Straight-line</option>
            <option value="rate">Yearly rate</option>
          </select>
        </label>
        {inputs.depreciationDefault?.mode === "straight-line" && (
          <label>Default straight-line years <input data-field="depreciation-default-years" type="number" value={inputs.depreciationDefault?.years ?? 20} onChange={(e) => setDepreciationDefault({ mode: "straight-line", years: parseFloat(e.target.value) || 0 })} /></label>
        )}
        {inputs.depreciationDefault?.mode === "rate" && (
          <label>Default yearly rate % <input data-field="depreciation-default-rate" type="number" value={inputs.depreciationDefault?.yearlyRatePct ?? 0} onChange={(e) => setDepreciationDefault({ mode: "rate", yearlyRatePct: parseFloat(e.target.value) || 0 })} /></label>
        )}
      </div>
      <button data-action="add-cost" onClick={addCost}>Add cost line</button>
      {result !== null && (
        <div className="scroll" data-testid="composition-rows-wrap">
          <CompositionRows lineTotals={result.lineTotals} valueFor={(t) => moneyForDisplay(t, (inputs.currency as Parameters<typeof moneyForDisplay>[1]) ?? "SEK")} />
        </div>
      )}
    </section>
  );
}
