import type { MaintenanceConfig, ModelInputs, ModelResult, OperatingLine } from "../../../core/src/types.js";
import { moneyForDisplay } from "../engine.js";
import type { CurrencyCode, EntryUnit } from "../engine.js";
import { MoneyEditor } from "../MoneyEditor.js";

export function OperatingSection(props: {
  inputs: ModelInputs;
  result: ModelResult | null;
  setOperating: (lines: OperatingLine[]) => void;
  setMaintenance: (m: MaintenanceConfig) => void;
  entryUnit: EntryUnit;
}) {
  const { inputs, result, setOperating, setMaintenance, entryUnit } = props;
  const currency = (inputs.currency as CurrencyCode) ?? "SEK";
  const money = (v: number) => moneyForDisplay(v, currency, entryUnit);
  const lines = inputs.operatingLines ?? [];
  const maintenance = inputs.maintenance ?? { mode: "off" as const };
  // v0.6.12.2 (AUD-3): the heading renders the basis the engine emitted on the maintenance entry
  // (the one-story rule); with maintenance off the engine emits none and the heading names none.
  const emittedBasis = result?.operatingLines.find((o) => o.id === "maintenance")?.basis;
  const update = (id: string, patch: Partial<OperatingLine>) =>
    setOperating(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  return (
    <section data-testid="operating">
      <h2>Operating lines and maintenance</h2>
      <table data-testid="operating-lines">
        <thead>
          <tr><th>Label</th><th>Amount / year</th><th>Start year</th><th>Year count</th><th>Escalation %</th><th></th></tr>
        </thead>
        <tbody>
          {lines.map((l) => {
            const info = result?.operatingLines.find((o) => o.id === l.id);
            return [
              <tr key={l.id} data-kind="operating" data-line={l.id}>
                <td><input data-field="opLabel" value={l.label} onChange={(e) => update(l.id, { label: e.target.value })} /></td>
                <td><MoneyEditor dataField="opAmount" value={l.amount} entryUnit={entryUnit} onChange={(v) => update(l.id, { amount: v })} /></td>
                <td><input data-field="opStartYear" type="number" value={l.startYear} onChange={(e) => update(l.id, { startYear: parseFloat(e.target.value) || 0 })} /></td>
                <td><input data-field="opYearCount" type="number" value={l.yearCount} onChange={(e) => update(l.id, { yearCount: parseFloat(e.target.value) || 0 })} /></td>
                <td><input data-field="opEscalation" type="number" value={l.escalation} onChange={(e) => update(l.id, { escalation: parseFloat(e.target.value) || 0 })} /></td>
                <td><button data-action="remove-operating" onClick={() => setOperating(lines.filter((x) => x.id !== l.id))}>Remove</button></td>
              </tr>,
              info !== undefined && (
                <tr key={l.id + "-info"} data-kind="operating-info" data-line={l.id}>
                  <td colSpan={6} data-testid="operating-info">
                    Nominal span months {info.nominalSpan[0]}–{info.nominalSpan[1]}; effective window {info.effectiveWindow[0]}–{info.effectiveWindow[1]}; total {money(info.total)}.
                  </td>
                </tr>
              ),
            ];
          })}
        </tbody>
      </table>
      <button data-action="add-operating" onClick={() => setOperating([...lines, { id: "o" + (lines.length + 1), label: "", amount: 0, startYear: 1, yearCount: 1, escalation: 0 }])}>Add operating line</button>
      <h3>Maintenance (derived from total CAPEX{emittedBasis !== undefined ? ` ${money(emittedBasis)}` : ""})</h3>
      <label>Mode{" "}
        <select data-field="maintenanceMode" value={maintenance.mode} onChange={(e) => {
          const mode = e.target.value as MaintenanceConfig["mode"];
          if (mode === "percent") setMaintenance({ mode, percentPerYear: maintenance.percentPerYear ?? 0.5 });
          else if (mode === "fixed") setMaintenance({ mode, fixedAnnualAmount: maintenance.fixedAnnualAmount ?? 5000 });
          else setMaintenance({ mode: "off" });
        }}>
          <option value="off">Off</option>
          <option value="percent">Percent of CAPEX per year</option>
          <option value="fixed">Fixed annual amount</option>
        </select>
      </label>
      {maintenance.mode === "percent" && (
        <label>Percent per year (rule of thumb: 0.5% of CAPEX per year){" "}
          <input data-field="maintenancePercent" type="number" value={maintenance.percentPerYear ?? 0} onChange={(e) => setMaintenance({ mode: "percent", percentPerYear: parseFloat(e.target.value) || 0 })} />
        </label>
      )}
      {maintenance.mode === "fixed" && (
        <label>Fixed annual amount{" "}
          <MoneyEditor dataField="maintenanceFixed" value={maintenance.fixedAnnualAmount ?? 0} entryUnit={entryUnit} onChange={(v) => setMaintenance({ mode: "fixed", fixedAnnualAmount: v })} />
        </label>
      )}
      {result !== null && maintenance.mode !== "off" && (
        <p data-testid="maintenance-derived">
          Maintenance, derived: {maintenance.mode === "percent"
            ? `${maintenance.percentPerYear}% of total CAPEX`
            : "fixed annual amount"} — effective window {result.operatingLines.find((o) => o.id === "maintenance")?.effectiveWindow.join("–")}, total {money(result.operatingLines.find((o) => o.id === "maintenance")?.total ?? 0)}.
        </p>
      )}
    </section>
  );
}
