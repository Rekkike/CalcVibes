import type { ModelInputs, ModelResult } from "../../../core/src/types.js";
import { composeFlow, flowOf, flowSourceKindLabel, nextId, yearHeader, FLOW_EQUITY_USE, FLOW_SERVICE_USE } from "../state.js";
import type { FlowPairing } from "../state.js";
import { moneyForDisplay } from "../engine.js";
import type { CurrencyCode, EntryUnit } from "../engine.js";
import { MoneyEditor } from "../MoneyEditor.js";
import { FlowCoverage } from "../charts.js";
import { composeFlowSlide, FLOW_FUNGIBILITY_CAPTION } from "../deck.js";

// v0.6.22 Task C — the Plan flow surface: the composed reading and the authored editor in one place.
// The reading renders the SAME composed model the deck slide and the print route consume (composeFlow
// plus composeFlowSlide, called once here; nothing recomputes): the aggregated composition inline,
// then the per-year drill as a grid table (yearHeader columns, the signed remainder row, the year's
// allocations). The editor is the two-column pairing grid on the YearMapEditor grammar: one row per
// authored pairing with a source select over the collections-grid identities, a use select over the
// use identities, a MoneyEditor amount at the entry unit and a remove control; rows are keyed by the
// pair's stable generated id, never by a volatile field. The drill rides the editor-scroll wrapper
// (the W25 parity ruling); the surface uses the W24 two-column layout at the wide breakpoint.
export function FlowSection(props: {
  inputs: ModelInputs;
  result: ModelResult | null;
  startYear: number | null;
  entryUnit: EntryUnit;
  setFlowPairs: (pairs: FlowPairing[]) => void;
}) {
  const { inputs, result, startYear, entryUnit, setFlowPairs } = props;
  if (result === null) {
    return (
      <section data-testid="flow-surface">
        <h2>Flow — what the collections pay for</h2>
        <p>Resolve the input issues to see the flow.</p>
      </section>
    );
  }
  const flow = composeFlow(inputs, result);
  const currency = (inputs.currency as CurrencyCode) ?? "SEK";
  const money = (v: number) => moneyForDisplay(v, currency, entryUnit);
  const view = composeFlowSlide(flow, money);
  const pairs = flowOf(inputs);
  const years = flow.years.length;

  // the drill rows: the income kinds (per-year allocated outflow), then the use buckets (per-year
  // allocated inflow), then the signed remainder row; columns are the yearHeader years plus Total
  const bucketOf = (useKey: string): string =>
    useKey === FLOW_EQUITY_USE ? "Equity remainder" : useKey === FLOW_SERVICE_USE ? "Debt service" : flowUseBucketLabel(useKey);
  const incomeKinds = [...new Set(flow.sources.map((s) => s.kind))].filter((k) => flow.sources.some((s) => s.kind === k && s.gross > 0));
  const allocFromKind = (kind: string, y: number) => flow.years[y - 1].allocations.filter((a) => a.sourceKey.startsWith(kind + ":")).reduce((a, x) => a + x.amount, 0);
  const allocToBucket = (bucket: string, y: number) => flow.years[y - 1].allocations.filter((a) => bucketOf(a.useKey) === bucket).reduce((a, x) => a + x.amount, 0);
  const useBuckets = [...new Set(flow.uses.filter((u) => u.key !== FLOW_EQUITY_USE && u.total > 0).map((u) => bucketOf(u.key)))];

  const commit = (next: FlowPairing[]) => setFlowPairs(next);
  const updatePair = (id: string, patch: Partial<FlowPairing>) => commit(pairs.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const removePair = (id: string) => commit(pairs.filter((p) => p.id !== id));
  const addPair = () => {
    const src = flow.sources.find((s) => s.gross > 0)?.key ?? flow.sources[0]?.key ?? "";
    const use = flow.uses.find((u) => u.key === FLOW_SERVICE_USE)?.key ?? flow.uses.find((u) => u.key !== FLOW_EQUITY_USE)?.key ?? FLOW_EQUITY_USE;
    commit([...pairs, { id: nextId("f", pairs.map((p) => p.id)), sourceId: src, useId: use, amount: 0 }]);
  };

  return (
    <section data-testid="flow-surface">
      <h2>Flow — what the collections pay for</h2>
      <p className="muted" data-testid="flow-fungibility">{FLOW_FUNGIBILITY_CAPTION}</p>
      <div className="flow-surface-grid">
        <div>
          <h3>The composition over the horizon</h3>
          <div data-testid="flow-composition" data-form="coverage">
            <FlowCoverage flow={view} />
          </div>
          <p className="muted" data-testid="flow-caption">{view.caption}</p>
          <dl data-testid="flow-summary">
            <dt>Total collected (nominal)</dt><dd data-stat="flow-income">{view.incomeNetValue}</dd>
            <dt>Total uses (nominal)</dt><dd data-stat="flow-uses">{view.usesTotalValue}</dd>
            <dt>Remainder to equity (signed)</dt><dd data-stat="flow-remainder" data-negative={view.remainderNet < 0 ? "true" : "false"}>{view.remainderNetValue}</dd>
            <dt>Shortfall years</dt><dd data-stat="flow-shortfall-years">{view.shortfallYears}</dd>
            <dt>Shortfall total</dt><dd data-stat="flow-shortfall">{view.shortfallValue}</dd>
            <dt>Surplus remainder</dt><dd data-stat="flow-surplus">{view.surplusValue}</dd>
          </dl>
          {flow.shortfallYears > 0 && (
            <p className="warning" data-testid="flow-shortfall-note">{flow.shortfallYears} of {years} years run a shortfall totaling {view.shortfallValue}; the remainder is signed in every year and never smoothed.</p>
          )}
          <div className="flow-drill">
            <h3>The per-year drill</h3>
            <div className="editor-scroll" data-testid="flow-drill-scroll">
              <table data-testid="flow-drill">
                <thead>
                  <tr>
                    <th className="grid-name-col sticky-col">Flow</th>
                    {flow.years.map((y) => <th key={y.year} className="table-value-cell">{yearHeader(y.year, startYear)}</th>)}
                    <th className="table-value-cell">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {incomeKinds.map((k) => (
                    <tr key={`in:${k}`} data-flow-drill-row={`in:${k}`}>
                      <td className="grid-name-col sticky-col">From {flowSourceKindLabel(k)}</td>
                      {flow.years.map((y) => <td key={y.year} className="table-value-cell">{(v => v === 0 ? "—" : money(v))(allocFromKind(k, y.year))}</td>)}
                      <td className="table-value-cell">{money(flow.sources.filter((s) => s.kind === k).reduce((a, s) => a + s.gross, 0))}</td>
                    </tr>
                  ))}
                  {useBuckets.map((b) => (
                    <tr key={`use:${b}`} data-flow-drill-row={`use:${b}`}>
                      <td className="grid-name-col sticky-col">To {b}</td>
                      {flow.years.map((y) => <td key={y.year} className="table-value-cell">{(v => v === 0 ? "—" : money(v))(allocToBucket(b, y.year))}</td>)}
                      <td className="table-value-cell">{money(flow.uses.filter((u) => u.key !== FLOW_EQUITY_USE && bucketOf(u.key) === b).reduce((a, u) => a + u.total, 0))}</td>
                    </tr>
                  ))}
                  <tr data-flow-drill-row="remainder" data-signed="true">
                    <td className="grid-name-col sticky-col">Remainder to equity (signed)</td>
                    {flow.years.map((y) => <td key={y.year} className={"table-value-cell" + (y.remainder < 0 ? " tone-bad" : "")} data-negative={y.remainder < 0 ? "true" : "false"}>{money(y.remainder)}</td>)}
                    <td className={"table-value-cell" + (view.remainderNet < 0 ? " tone-bad" : "")}>{view.remainderNetValue}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div>
          <h3>Authored pairings</h3>
          <p className="muted">An authored pairing replaces the default where drawn: a horizon-level amount, satisfied first in authored order and cumulatively across years. The default then fills the rest.</p>
          <p className="muted" data-testid="flow-pairing-effect">A pairing changes which source covers which use (the drill&apos;s From and To rows show it), never the coverage bridge&apos;s totals: the bridge aggregates every source into the collections step.</p>
          {flow.refusals.length > 0 && (
            <ul data-testid="flow-refusals">
              {flow.refusals.map((r, i) => (
                <li key={i} data-flow-refusal={r.code} className={r.warning ? "warning" : "warning flow-refusal"}>{r.message}</li>
              ))}
            </ul>
          )}
          <table data-testid="flow-pairings" className="flow-pairing-table">
            <thead><tr><th>Source</th><th>Use</th><th>Amount</th><th></th></tr></thead>
            <tbody>
              {pairs.map((p) => (
                <tr key={p.id} data-flow-pairing={p.id}>
                  <td>
                    <select data-field="flow-source" data-pairing={p.id} value={p.sourceId} onChange={(e) => updatePair(p.id, { sourceId: e.target.value })}>
                      {flow.sources.map((s) => <option key={s.key} value={s.key}>{s.label} ({s.key})</option>)}
                    </select>
                  </td>
                  <td>
                    <select data-field="flow-use" data-pairing={p.id} value={p.useId} onChange={(e) => updatePair(p.id, { useId: e.target.value })}>
                      {flow.uses.map((u) => <option key={u.key} value={u.key}>{u.label} ({u.key})</option>)}
                    </select>
                  </td>
                  <td><MoneyEditor dataField="flow-amount" value={p.amount} entryUnit={entryUnit} onChange={(v) => updatePair(p.id, { amount: v })} /></td>
                  <td><button data-action="flow-remove-pairing" data-pairing={p.id} onClick={() => removePair(p.id)}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button data-action="flow-add-pairing" onClick={addPair}>Add pairing</button>
        </div>
      </div>
    </section>
  );
}

// The use bucket label of a cost-grid use key (the composeFlowSlide aggregation's vocabulary).
function flowUseBucketLabel(useKey: string): string {
  const kind = useKey.slice(0, useKey.indexOf(":"));
  return { operating: "Operating", maintenance: "Operating", reinvestment: "Reinvestment", cost: "Capital" }[kind] ?? kind;
}
