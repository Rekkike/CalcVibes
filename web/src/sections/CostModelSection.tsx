import type { CostLine, ModelInputs } from "../../../core/src/types.js";
import { CURRENCIES, spreadFill } from "../state.js";


export function CostModelSection(props: {
  inputs: ModelInputs;
  issueByLine: Map<string, string[]>;
  setCurrency: (v: string) => void;
  addCost: () => void;
  removeCost: (id: string) => void;
  updateCost: (id: string, patch: Partial<CostLine>) => void;
}) {
  const { inputs, issueByLine, setCurrency, addCost, removeCost, updateCost } = props;
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
            <th>Name</th><th>Category</th><th>Amount / year</th><th>Start year</th><th>Duration (years)</th><th>Escalation %</th><th>Line total</th><th></th>
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
                <td data-field="line-total">—</td>
                <td>
                  <button data-action="remove-cost" onClick={() => removeCost(c.id)}>Remove</button>
                </td>
              </tr>,
              lineIssues.length > 0 && (
                <tr key={c.id + "-issues"} data-testid="line-issues" data-kind="issues" data-line={c.id}>
                  <td colSpan={8} className="warning">{lineIssues.join(" ")}</td>
                </tr>
              ),
              <tr key={c.id + "-years"} data-kind="year-editor" data-line={c.id}>
                <td colSpan={8}>
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
      <button data-action="add-cost" onClick={addCost}>Add cost line</button>
    </section>
  );
}
