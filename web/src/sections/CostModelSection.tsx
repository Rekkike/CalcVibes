import type { CostLine, ModelInputs } from "../../../core/src/types.js";
import { CURRENCIES } from "../state.js";


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
                  <input data-field="amount" type="number" value={c.amount} onChange={(e) => updateCost(c.id, { amount: parseFloat(e.target.value) || 0 })} />
                </td>
                <td>
                  <input data-field="startYear" type="number" value={c.startYear} onChange={(e) => updateCost(c.id, { startYear: parseFloat(e.target.value) || 0 })} />
                </td>
                <td>
                  <input data-field="durationYears" type="number" value={c.durationYears} disabled={c.category === "capex"} onChange={(e) => updateCost(c.id, { durationYears: parseFloat(e.target.value) || 0 })} />
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
            ];
          })}
        </tbody>
      </table>
      <button data-action="add-cost" onClick={addCost}>Add cost line</button>
    </section>
  );
}
