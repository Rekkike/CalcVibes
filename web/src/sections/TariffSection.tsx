import type { ModelInputs, ModelResult, TariffConfig, TariffRow } from "../../../core/src/types.js";
import { computeModel, moneyForDisplay, feeForDisplay, unitPriceForDisplay, roundForDisplay } from "../engine.js";
import type { CurrencyCode, EntryUnit } from "../engine.js";
import { MoneyEditor } from "../MoneyEditor.js";
import { useMemo, useState } from "react";
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
  // v0.6.10 Task E.2 (W35): the tariff owns its span — an overall start and term the engine
  // grids the year columns from; empty means the repayment-derived default of today. The
  // semantics are all-or-nothing: the span is declared only when both fields carry values.
  const declaredSpan = t.span ?? null;
  const derivedSpan = useMemo(() => {
    try {
      const bare = computeModel({ ...inputs, tariff: undefined });
      return { first: Math.round(bare.firstPaymentMonth / 12), term: inputs.repayment.termYears };
    } catch {
      return null;
    }
  }, [inputs]);
  const spanYears = useMemo(() => {
    if (result) return result.tariffYears.map((y) => y.year);
    if (declaredSpan) {
      // The repayment convention: a term of T years starting at the year-end of startYear
      // touches T + 1 calendar years (termYears + 1 columns).
      const years: number[] = [];
      for (let k = 0; k <= declaredSpan.termYears; k++) years.push(declaredSpan.startYear + k);
      return years;
    }
    try {
      const span = computeModel({ ...inputs, tariff: undefined });
      const first = Math.round(span.firstPaymentMonth / 12);
      const years: number[] = [];
      for (let k = 0; k < inputs.repayment.termYears + 1; k++) years.push(first + k);
      return years;
    } catch {
      return [];
    }
  }, [result, inputs, declaredSpan]);
  const gridYears = spanYears;
  const updateRow = (id: string, patch: Partial<TariffRow>) =>
    setTariff({ ...t, rows: t.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  // The overall span editors keep their raw text locally (controlled inputs); the committed
  // span is all-or-nothing — declared only when both fields parse, null otherwise.
  // The text initializes FROM the declared span (a preset span must render its values, or
  // editing one field would silently drop the other per the all-or-nothing commit).
  const [spanText, setSpanText] = useState<{ start: string; term: string }>(declaredSpan ? { start: String(declaredSpan.startYear), term: String(declaredSpan.termYears) } : { start: "", term: "" });
  const declaredKey = declaredSpan ? `${declaredSpan.startYear}:${declaredSpan.termYears}` : "";
  const [spanSyncedKey, setSpanSyncedKey] = useState(declaredKey);
  if (spanSyncedKey !== declaredKey) {
    setSpanSyncedKey(declaredKey);
    setSpanText(declaredSpan ? { start: String(declaredSpan.startYear), term: String(declaredSpan.termYears) } : { start: "", term: "" });
  }
  const commitOverallSpan = (text: { start: string; term: string }) => {
    const s = text.start.trim() === "" ? null : parseFloat(text.start);
    const y = text.term.trim() === "" ? null : parseFloat(text.term);
    if (s === null || y === null || !Number.isFinite(s) || !Number.isFinite(y)) {
      if (declaredSpan !== null) setTariff({ ...t, span: null });
      return;
    }
    if (declaredSpan === null || declaredSpan.startYear !== s || declaredSpan.termYears !== y) {
      setTariff({ ...t, span: { startYear: s, termYears: y } });
    }
  };
  // The per-row span editors: empty = inherit the common span (row.span null).
  // The per-row text initializes FROM the preset row spans for the same reason as the overall
  // editors above.
  const [rowSpanText, setRowSpanText] = useState<Record<string, { start: string; term: string }>>(
    Object.fromEntries(t.rows.map((r) => [r.id, r.span ? { start: String(r.span.startYear), term: String(r.span.termYears) } : { start: "", term: "" }]))
  );
  const rowSpanKey = t.rows.map((r) => r.id + ":" + (r.span ? `${r.span.startYear}-${r.span.termYears}` : "none")).join("|");
  const [rowSpanSyncedKey, setRowSpanSyncedKey] = useState(rowSpanKey);
  if (rowSpanSyncedKey !== rowSpanKey) {
    setRowSpanSyncedKey(rowSpanKey);
    const next: Record<string, { start: string; term: string }> = {};
    for (const r of t.rows) next[r.id] = r.span ? { start: String(r.span.startYear), term: String(r.span.termYears) } : { start: "", term: "" };
    setRowSpanText(next);
  }
  const commitRowSpan = (id: string, text: { start: string; term: string }) => {
    const s = text.start.trim() === "" ? null : parseFloat(text.start);
    const y = text.term.trim() === "" ? null : parseFloat(text.term);
    const row = t.rows.find((r) => r.id === id);
    if (s === null || y === null || !Number.isFinite(s) || !Number.isFinite(y)) {
      if (row?.span != null) updateRow(id, { span: null });
      return;
    }
    if (row?.span == null || row.span.startYear !== s || row.span.termYears !== y) {
      updateRow(id, { span: { startYear: s, termYears: y } });
    }
  };
  // v0.6.10 Task E.3 (W20): the per-segment surcharge renders at the full-ramp year — the
  // first grid year at the maximum weighted volume (the "at full ramp" pin site).
  const fullRampYear = result !== null && result.tariffYears.length > 0
    ? result.tariffYears.reduce((best, y) => (y.weightedVolume > best.weightedVolume ? y : best), result.tariffYears[0])
    : null;
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
          {/* v0.6.10 Task E.2 (W35): the overall span fields — start year and term years;
              empty means the repayment-derived default (the placeholder shows the derived
              shape); the semantics are all-or-nothing (both or neither). */}
          <div data-testid="tariff-span-editors" className="tariff-span-editors">
            <label>Tariff span start year (empty = {derivedSpan ? `derived default ${derivedSpan.first}` : "derived from the repayment shape"}){" "}
              <input
                data-field="tariffSpanStart"
                type="number"
                value={spanText.start}
                placeholder={derivedSpan ? String(derivedSpan.first) : ""}
                onChange={(e) => {
                  const next = { ...spanText, start: e.target.value };
                  setSpanText(next);
                  commitOverallSpan(next);
                }}
              />
            </label>
            <label>Tariff span term years (empty = {derivedSpan ? `derived default ${derivedSpan.term}` : "derived from the repayment shape"}){" "}
              <input
                data-field="tariffSpanTerm"
                type="number"
                value={spanText.term}
                placeholder={derivedSpan ? String(derivedSpan.term) : ""}
                onChange={(e) => {
                  const next = { ...spanText, term: e.target.value };
                  setSpanText(next);
                  commitOverallSpan(next);
                }}
              />
            </label>
            <button data-action="clear-tariff-span" onClick={() => {
              setSpanText({ start: "", term: "" });
              if (declaredSpan !== null) setTariff({ ...t, span: null });
            }}>Clear tariff span</button>
          </div>
          <h3>Volume grid {gridYears.length > 0 ? `(collection years ${gridYears[0]}–${gridYears[gridYears.length - 1]}, ${declaredSpan ? "declared tariff span" : "derived from the model span"})` : ""}{t.volumeUnitLabel ? <span data-testid="tariff-volume-unit"> — volumes in {t.volumeUnitLabel}</span> : null}</h3>
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
                {/* v0.6.10 Task E.2 (W35): the optional per-row span columns — empty means
                    the row inherits the common span. */}
                <th>Row span start</th><th>Row span term</th>
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
                  <td><input data-field="tariffRowSpanStart" value={rowSpanText[row.id]?.start ?? ""} placeholder="inherit" onChange={(e) => {
                    const next = { ...(rowSpanText[row.id] ?? { start: "", term: "" }), start: e.target.value };
                    setRowSpanText({ ...rowSpanText, [row.id]: next });
                    commitRowSpan(row.id, next);
                  }} /></td>
                  <td><input data-field="tariffRowSpanTerm" value={rowSpanText[row.id]?.term ?? ""} placeholder="inherit" onChange={(e) => {
                    const next = { ...(rowSpanText[row.id] ?? { start: "", term: "" }), term: e.target.value };
                    setRowSpanText({ ...rowSpanText, [row.id]: next });
                    commitRowSpan(row.id, next);
                  }} /></td>
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
                  <td>{y.unitPrice === null ? "—" : unitPriceForDisplay(y.unitPrice, currency)}</td>
                  <td>{money(y.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {t.rows.length > 0 && result.tariffYears.length > 0 && result.tariffYears[0].perRowCharges !== null && (
            <>
              {t.priceUnitLabel && t.priceDisplayDivisor && fullRampYear !== null ? (
                <>
                  {/* v0.6.10 Task E.3 (W20): with the machine-labeled unit vocabulary declared,
                      the per-row charge renders as the per-segment surcharge in the declared
                      price unit at the full-ramp year — segment rate = charge / divisor. */}
                  <h4>Per-segment surcharge (engine-emitted, full ramp)</h4>
                  <ul data-testid="per-lift-charges">
                    {t.rows.map((row) => {
                      const charges = fullRampYear.perRowCharges as Record<string, number>;
                      const rate = charges[row.id] / (t.priceDisplayDivisor as number);
                      return (
                        <li key={row.id} data-row-charge={row.id} title="Per-segment surcharge (engine-emitted, full ramp)">{row.label}: {roundForDisplay(rate, 2).toFixed(2).replace(".", ",")} {t.priceUnitLabel}</li>
                      );
                    })}
                  </ul>
                  <p className="muted">Rendered at the full-ramp year ({yearHeader(fullRampYear.year, startYear)}), the first grid year at the maximum weighted volume.</p>
                </>
              ) : (
                <>
                  <h4>Per-lift charges (engine-emitted)</h4>
                  <ul data-testid="per-lift-charges">
                    {t.rows.map((row) => (
                      <li key={row.id} data-row-charge={row.id}>{row.label}: {fee((result.tariffYears[0].perRowCharges as Record<string, number>)[row.id])}</li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
          {result.paymentAmount === null && <p data-testid="payment-na">Solved payment: not applicable in collection modes.</p>}
        </div>
      )}
    </section>
  );
}
