import type { CostLine, ModelInputs } from "../../../core/src/types.js";
import { CURRENCIES, spreadFill, yearHeader } from "../state.js";
import { CompositionRows, CompositionDonut } from "../charts.js";
import { moneyForDisplay, entryToValue } from "../engine.js";
import type { CurrencyCode, EntryUnit } from "../engine.js";
import { MoneyEditor } from "../MoneyEditor.js";


export function CostModelSection(props: {
  inputs: ModelInputs;
  issueByLine: Map<string, string[]>;
  setCurrency: (v: string) => void;
  addCost: () => void;
  removeCost: (id: string) => void;
  updateCost: (id: string, patch: Partial<CostLine>) => void;
  result: import("../../../core/src/types.js").ModelResult | null;
  setDepreciationDefault: (cfg: import("../../../core/src/types.js").DepreciationConfig | null) => void;
  entryUnit: EntryUnit;
  startYear: number | null;
}) {
  const { inputs, issueByLine, setCurrency, addCost, removeCost, updateCost, result, setDepreciationDefault, entryUnit, startYear } = props;
  const currency = (inputs.currency as CurrencyCode) ?? "SEK";
  const money = (v: number) => moneyForDisplay(v, currency, entryUnit);
  const lineTotalFor = (c: CostLine): number => result?.lineTotals.find((l) => l.id === c.id)?.total ?? 0;
  const lastCostYearOf = (c: CostLine): number => {
    if (c.category === "capex") {
      const overrides = c.yearOverrides && Object.keys(c.yearOverrides).length > 0 ? c.yearOverrides : null;
      return overrides ? Math.max(...Object.keys(overrides).map(Number)) : c.startYear;
    }
    return c.startYear + Math.max(1, c.durationYears) - 1;
  };
  return (
    <section data-testid="costs">
      <h2>Cost model</h2>
      <label>
        Currency{" "}
        <select data-field="currency" value={inputs.currency} onChange={(e) => setCurrency(e.target.value)}>
          {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <div className="editor-scroll" data-testid="cost-editor-scroll">
      <table data-testid="cost-lines">
        <thead>
          <tr>
            <th>Name</th><th>Category</th><th>Group</th><th>Amount / year</th><th>Start year</th><th>Duration (years)</th><th>Escalation %</th><th>Depreciation</th><th>Line total</th><th></th>
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
                  <input data-field="group" placeholder="optional" value={c.group ?? ""} onChange={(e) => updateCost(c.id, { group: e.target.value === "" ? undefined : e.target.value })} />
                </td>
                <td>
                  <MoneyEditor dataField="amount" value={c.amount} entryUnit={entryUnit} disabled={c.category === "capex" && c.yearOverrides !== undefined && Object.keys(c.yearOverrides ?? {}).length > 0} onChange={(v) => updateCost(c.id, { amount: v })} title={c.category === "recurring" ? "Annual amount" : "The lump amount"} />
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
                    <input data-field="line-depreciation-years" type="number" value={c.depreciation?.years ?? 20} onChange={(e) => updateCost(c.id, { depreciation: { mode: "straight-line", years: parseFloat(e.target.value) || 0, startYear: c.depreciation?.startYear } })} />
                  )}
                  {c.depreciation?.mode === "rate" && (
                    <input data-field="line-depreciation-rate" type="number" value={c.depreciation?.yearlyRatePct ?? 0} onChange={(e) => updateCost(c.id, { depreciation: { mode: "rate", yearlyRatePct: parseFloat(e.target.value) || 0, startYear: c.depreciation?.startYear } })} />
                  )}
                  <label>Commissioning year (empty = {yearHeader(lastCostYearOf(c) + 1, startYear)}, the year after the costs end)
                    <input data-field="line-depreciation-startYear" type="number" value={c.depreciation?.startYear ?? ""} onChange={(e) => {
                      const v = e.target.value === "" ? undefined : parseFloat(e.target.value) || 0;
                      const mode = c.depreciation?.mode ?? (inputs.depreciationDefault?.mode ?? "retained");
                      const base = mode === "straight-line"
                        ? { mode: "straight-line" as const, years: c.depreciation?.years ?? 20 }
                        : mode === "rate"
                          ? { mode: "rate" as const, yearlyRatePct: c.depreciation?.yearlyRatePct ?? 5 }
                          : { mode: "retained" as const };
                      updateCost(c.id, { depreciation: { ...base, startYear: v } });
                    }} />
                  </label>
                </td>
                <td data-field="line-total" data-testid="line-total">{money(lineTotalFor(c))}</td>
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
                            <td><MoneyEditor dataField="override-amount" value={amount} entryUnit={entryUnit} onChange={(v) => {
                              const next = { ...(c.yearOverrides ?? {}) };
                              next[Number(y)] = v;
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
                        const totalEntry = parseFloat((root.querySelector('[data-field="spread-total"]') as HTMLInputElement).value) || 0;
                        const firstYear = parseFloat((root.querySelector('[data-field="spread-first"]') as HTMLInputElement).value) || 1;
                        const yearCount = parseFloat((root.querySelector('[data-field="spread-count"]') as HTMLInputElement).value) || 1;
                        updateCost(c.id, { yearOverrides: spreadFill(entryToValue(totalEntry, entryUnit), firstYear, yearCount) });
                      }}>Spread</button>
                    </div>
                  </details>
                </td>
              </tr>,
            ];
          })}
        </tbody>
      </table>
      </div>
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
          <CompositionRows lineTotals={result.lineTotals} valueFor={(t) => money(t)} />
        </div>
      )}
      {result !== null && (
        <div data-testid="composition-donut-wrap">
          <CompositionDonut lineTotals={result.lineTotals} valueFor={(t) => money(t)} />
        </div>
      )}
    </section>
  );
}
