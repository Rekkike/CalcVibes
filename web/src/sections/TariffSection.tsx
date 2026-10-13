import type { ModelInputs, ModelResult, TariffConfig, TariffRow } from "../../../core/src/types.js";
import { computeModel, moneyForDisplay, feeForDisplay } from "../engine.js";
import type { CurrencyCode, EntryUnit } from "../engine.js";
import { MoneyEditor } from "../MoneyEditor.js";
import { useMemo } from "react";
import { yearHeader } from "../state.js";

export function TariffSection(props: {
  inputs: ModelInputs;
  result: ModelResult | null;
  setTariff: (t: TariffConfig) => void;
  startYear: number | null;
  entryUnit: EntryUnit;
}) {
  const { inputs, result, setTariff, startYear, entryUnit } = props;
  const currency = (inputs.currency as CurrencyCode) ?? "SEK";
  const money = (v: number) => moneyForDisplay(v, currency, entryUnit);
  // v0.6.9 Task F (finding W28): the fee-class surfaces (the unit price column and the per-row
  // per-lift charges) render through the magnitude-aware feeForDisplay at the app's entry unit.
  const fee = (v: number) => feeForDisplay(v, currency, entryUnit);
  const t = inputs.tariff ?? { mode: "off" as const, escalationPerYear: 2, rows: [], fixedAnnualAmount: null, manualPrices: null };
  const spanYears = useMemo(() => {
    if (result) return result.tariffYears.map((y) => y.year);
    try {
      const span = computeModel({ ...inputs, tariff: undefined });
      const first = Math.round(span.firstPaymentMonth / 12);
      const years: number[] = [];
      for (let k = 0; k < inputs.repayment.termYears + 1; k++) years.push(first + k);
      return years;
    } catch {
      return [];
    }
  }, [result, inputs]);
  const gridYears = spanYears;
  const updateRow = (id: string, patch: Partial<TariffRow>) =>
    setTariff({ ...t, rows: t.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  return (
    <section data-testid="tariff">
      <h2>Tariff-based collections</h2>
      <label>Mode{" "}
        <select data-field="tariffMode" value={t.mode} onChange={(e) => setTariff({ ...t, mode: e.target.value as TariffConfig["mode"] })}>
          <option value="off">Off (annuity solve)</option>
          <option value="decompose">Decompose the solved schedule</option>
          <option value="stable">Stable indexed tariff</option>
          <option value="manual">Manual per-year prices</option>
          <option value="fixed">Fixed required amount per year</option>
        </select>
      </label>
      {t.mode === "stable" && (
        <label>Tariff escalation % per year (rule of thumb: 2%){" "}
          <input data-field="tariffEscalation" type="number" value={t.escalationPerYear} onChange={(e) => setTariff({ ...t, escalationPerYear: parseFloat(e.target.value) || 0 })} />
        </label>
      )}
      {t.mode === "fixed" && (
        <label>Fixed annual amount{" "}
          <MoneyEditor dataField="tariffFixed" value={t.fixedAnnualAmount ?? 0} entryUnit={entryUnit} onChange={(v) => setTariff({ ...t, fixedAnnualAmount: v })} />
        </label>
      )}
      {/* v0.6.8 Task E (finding W21): the optional, user-authored tariff basis note. Empty by
          default, never required, no engine semantics (engine-blind by the pinned check); the
          browser enforces the 500-character bound. Surfaced in the deck and the PDF. */}
      <label>Basis note (optional){" "}
        <input
          data-field="tariffBasisNote"
          className="muted"
          type="text"
          maxLength={500}
          value={t.basisNote ?? ""}
          placeholder="Optional note on how this block is meant — shown in the deck and PDF"
          onChange={(e) => setTariff({ ...t, basisNote: e.target.value === "" ? null : e.target.value })}
        />
      </label>
      {t.mode !== "off" && (
        <>
          <h3>Volume grid {gridYears.length > 0 ? `(collection years ${gridYears[0]}–${gridYears[gridYears.length - 1]}, derived from the model span)` : ""}</h3>
          {/* v0.6.9 Task D (finding W25): the volume grid gains the .editor-scroll wrapper —
              parity with the cost grid (scroll, sticky header, sticky first column) so the
              per-year headers never bleed outside the card at the capped width. */}
          <div className="editor-scroll" data-testid="tariff-editor-scroll">
          <table data-testid="tariff-rows">
            <thead>
              <tr>
                <th>Descriptor</th><th>Weight</th>
                {/* v0.6.9 Task D: the compact per-year headers — the short token (Y3, Y4, …)
                    via yearHeader's null-startYear path when no start year is set; the
                    bare-year form is already compact and unchanged. */}
                {gridYears.map((y) => <th key={y} {...(startYear === null ? { "data-short-year": "true" } : {})}>{startYear === null ? `Y${y}` : yearHeader(y, startYear)}</th>)}
              </tr>
            </thead>
            <tbody>
              {t.rows.map((row) => (
                <tr key={row.id} data-kind="tariff-row" data-row={row.id}>
                  <td><input data-field="tariffLabel" value={row.label} onChange={(e) => updateRow(row.id, { label: e.target.value })} /></td>
                  <td><input data-field="tariffWeight" type="number" value={row.weight} onChange={(e) => updateRow(row.id, { weight: parseFloat(e.target.value) || 0 })} /></td>
                  {(gridYears.length > 0 ? gridYears : [0]).map((_, k) => (
                    <td key={k}>
                      <input data-field="tariffLift" data-column={k} type="number" value={row.lifts[k] ?? 0}
                        onChange={(e) => {
                          const lifts = row.lifts.slice();
                          lifts[k] = parseFloat(e.target.value) || 0;
                          updateRow(row.id, { lifts });
                        }} />
                    </td>
                  ))}
                  <td><button data-action="remove-tariff-row" onClick={() => setTariff({ ...t, rows: t.rows.filter((r) => r.id !== row.id) })}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <button data-action="add-tariff-row" onClick={() => setTariff({ ...t, rows: [...t.rows, { id: "r" + (t.rows.length + 1), label: "", weight: 1, lifts: [] }] })}>Add tariff row</button>
        </>
      )}
      {t.mode === "manual" && (
        <>
          <h3>Manual prices (one per grid column)</h3>
          {gridYears.map((y, k) => (
            <label key={y}>Price for collection year {y}{" "}
              <MoneyEditor dataField="manualPrice" dataColumn={k} value={t.manualPrices?.[k] ?? 0} entryUnit={entryUnit} onChange={(v) => {
                const prices = (t.manualPrices ?? gridYears.map(() => 0)).slice();
                prices[k] = v;
                setTariff({ ...t, manualPrices: prices });
              }} />
            </label>
          ))}
        </>
      )}
      {result !== null && result.tariffYears.length > 0 && (
        <div data-testid="tariff-results">
          <h3>Per-year decomposition</h3>
          <table data-testid="tariff-decomposition">
            <thead>
              <tr><th>Year</th><th>Required</th><th>Weighted volume</th><th>Unit price</th><th>Revenue</th></tr>
            </thead>
            <tbody>
              {result.tariffYears.map((y, k) => (
                <tr key={y.year} data-year={y.year}>
                  <td>{yearHeader(y.year, startYear)}</td>
                  <td>{y.required === null ? "—" : money(y.required)}</td>
                  <td>{money(y.weightedVolume)}</td>
                  <td>{y.unitPrice === null ? "—" : fee(y.unitPrice)}</td>
                  <td>{money(y.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {t.rows.length > 0 && result.tariffYears.length > 0 && result.tariffYears[0].perRowCharges !== null && (
            <>
              <h4>Per-lift charges (engine-emitted)</h4>
              <ul data-testid="per-lift-charges">
                {t.rows.map((row) => (
                  <li key={row.id} data-row-charge={row.id}>{row.label}: {fee((result.tariffYears[0].perRowCharges as Record<string, number>)[row.id])}</li>
                ))}
              </ul>
            </>
          )}
          {result.paymentAmount === null && <p data-testid="payment-na">Solved payment: not applicable in collection modes.</p>}
        </div>
      )}
    </section>
  );
}
