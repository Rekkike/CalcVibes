import type { Facility, FacilityOptions, ModelInputs, ModelResult } from "../../../core/src/types.js";
import { moneyForDisplay } from "../engine.js";
import type { CurrencyCode, EntryUnit } from "../engine.js";
import { MoneyEditor } from "../MoneyEditor.js";
import { blankFacility, blankNoteFacility, composeFacility, facilitiesOf, moveFacility } from "../state.js";

// v0.6.16 — the facility list surface: each facility is a term sheet (label, amount, rate, term,
// grace, amortization, service start) plus ONE scope choice (the whole program, spread by the incurred
// calendar, or pinned to named cost lines). The amount is the commitment: the per-line shares derive
// live from it and display at one decimal, closing at 100.0; the drawn total sits beside the stated
// amount and the engine-exposed drift discloses whenever the two differ. The per-line percentage
// override stays as the power-user path. The section consumes engine output only.
export function FinancingSection(props: {
  inputs: ModelInputs;
  result: ModelResult | null;
  setFacilities: (list: Facility[]) => void;
  setFacilityOptions: (o: FacilityOptions | undefined) => void;
  entryUnit: EntryUnit;
}) {
  const { inputs, result, setFacilities, setFacilityOptions, entryUnit } = props;
  const currency = (inputs.currency as CurrencyCode) ?? "SEK";
  const money = (v: number) => moneyForDisplay(v, currency, entryUnit);
  const list = facilitiesOf(inputs);
  const update = (id: string, patch: Partial<Facility>) => setFacilities(list.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const hasDebt = list.some((f) => f.datedDraw === undefined && f.enabled !== false);
  const leveraged = inputs.facilityOptions?.leveragedSolve === true;
  const num = (e: { target: { value: string } }) => parseFloat(e.target.value) || 0;
  return (
    <section data-testid="financing">
      <h2>Financing — the facility list</h2>
      <p className="muted">
        Each facility is a term sheet: the amount is the commitment, and the per-line shares derive from it. A general
        facility spreads across every cost line by the incurred calendar; an attached facility draws on the cost lines
        it names. The draws never exceed the scoped lines' incurred costs. An interest-free note is a facility at rate
        zero that lands as one dated lump.
      </p>
      <div data-testid="facility-list">
        {list.map((f, idx) => {
          const comp = composeFacility(inputs, result, f.id);
          const dated = f.datedDraw !== undefined;
          const byShares = f.sharePct !== undefined;
          const attached = f.scope.kind === "attached" ? f.scope.lineIds : null;
          return (
            <div key={f.id} data-facility={f.id} data-facility-kind={dated ? "note" : "debt"} className="facility-card">
              <label>On{" "}
                <input data-field="facEnabled" type="checkbox" checked={f.enabled !== false} onChange={(e) => update(f.id, { enabled: e.target.checked })} />
              </label>
              <label>Label{" "}
                <input data-field="facLabel" value={f.label} onChange={(e) => update(f.id, { label: e.target.value })} />
              </label>
              {!byShares && (
                <label>Amount (the commitment){" "}
                  <MoneyEditor dataField="facAmount" value={f.amount ?? 0} entryUnit={entryUnit} onChange={(v) => update(f.id, { amount: v })} />
                </label>
              )}
              <label>Rate (% per year){" "}
                <input data-field="facRate" type="number" value={f.ratePct} onChange={(e) => update(f.id, { ratePct: num(e) })} />
              </label>
              <label>Term (years){" "}
                <input data-field="facTerm" type="number" value={f.termYears} onChange={(e) => update(f.id, { termYears: num(e) })} />
              </label>
              {dated ? (
                <>
                  <label>Landing year{" "}
                    <input data-field="facDatedYear" type="number" value={f.datedDraw!.year} onChange={(e) => update(f.id, { datedDraw: { year: num(e) } })} />
                  </label>
                  <label>Repayment start year{" "}
                    <input data-field="facRepayStart" type="number" value={(f.serviceStartYear ?? 0) + 1} onChange={(e) => update(f.id, { serviceStartYear: num(e) - 1 })} />
                  </label>
                  <p className="muted" data-testid="facility-dated">Lands as one dated lump and repays in equal annual installments.</p>
                </>
              ) : (
                <>
                  <label>Grace (years, interest-only){" "}
                    <input data-field="facGrace" type="number" value={f.graceYears} onChange={(e) => update(f.id, { graceYears: num(e) })} />
                  </label>
                  <label>Service start year (empty = first collection year){" "}
                    <input data-field="facStart" type="number" value={f.serviceStartYear ?? ""} onChange={(e) =>
                      update(f.id, { serviceStartYear: e.target.value === "" ? null : parseFloat(e.target.value) || 0 })} />
                  </label>
                  <label>Amortization{" "}
                    <select data-field="facAmortization" value={f.amortization} onChange={(e) => update(f.id, { amortization: e.target.value as Facility["amortization"] })}>
                      <option value="annuity">Annuity</option>
                      <option value="equal-principal">Equal principal</option>
                    </select>
                  </label>
                  <label>Scope{" "}
                    <select data-field="facScope" value={f.scope.kind} onChange={(e) =>
                      update(f.id, { scope: e.target.value === "general" ? { kind: "general" } : { kind: "attached", lineIds: [] } })}>
                      <option value="general">General — the whole program</option>
                      <option value="attached">Attached — named cost lines</option>
                    </select>
                  </label>
                  {attached !== null && (
                    <div data-testid="facility-scope-lines" className="facility-scope">
                      {inputs.costs.map((c) => (
                        <label key={c.id}>
                          <input data-field="facScopeLine" data-line={c.id} type="checkbox" checked={attached.includes(c.id)} onChange={(e) =>
                            update(f.id, { scope: { kind: "attached", lineIds: e.target.checked ? [...attached, c.id] : attached.filter((x) => x !== c.id) } })} />
                          {" "}{c.name || c.id}
                        </label>
                      ))}
                    </div>
                  )}
                  <label>Per-line percentage override (the power-user path){" "}
                    <input data-field="facOverride" type="checkbox" checked={byShares} onChange={(e) => {
                      if (e.target.checked) {
                        const per: Record<string, number> = {};
                        const fr = result?.financing?.facilities?.find((x) => x.id === f.id);
                        for (const [id, s] of Object.entries(fr?.shares ?? {})) per[id] = s * 100;
                        update(f.id, { sharePct: 0, perLineSharePct: per, amount: null });
                      } else {
                        const { sharePct: _s, perLineSharePct: _p, ...rest } = f;
                        const fr = result?.financing?.facilities?.find((x) => x.id === f.id);
                        setFacilities(list.map((x) => (x.id === f.id ? { ...rest, amount: fr?.drawnTotal ?? 0 } : x)));
                      }
                    }} />
                  </label>
                  {byShares && (
                    <div data-testid="facility-line-shares" className="facility-scope">
                      <label>Default debt share (%){" "}
                        <input data-field="facShare" type="number" value={f.sharePct} onChange={(e) => update(f.id, { sharePct: num(e) })} />
                      </label>
                      {inputs.costs.map((c) => (
                        <label key={c.id}>{c.name || c.id} (%){" "}
                          <input data-field="facLineShare" data-line={c.id} type="number"
                            value={f.perLineSharePct?.[c.id] ?? f.sharePct}
                            onChange={(e) => update(f.id, { perLineSharePct: { ...f.perLineSharePct, [c.id]: num(e) } })} />
                        </label>
                      ))}
                    </div>
                  )}
                </>
              )}
              {comp !== null && (
                <div data-testid="facility-composition" className="facility-composition">
                  <p data-stat="facilityAmounts">
                    {comp.stated !== null ? <>Stated amount: <span data-stat="facilityStated">{money(comp.stated)}</span> · </> : null}
                    Drawn total: <span data-stat="facilityDrawn">{money(comp.drawn)}</span>
                  </p>
                  {comp.drifts && comp.drift !== null && (
                    <p data-testid="facility-drift" className="facility-drift">
                      Drift: the stated amount exceeds the drawn total by <span data-stat="facilityDrift">{money(comp.drift)}</span>. The draws are
                      capped at the scoped lines' incurred costs, so this part of the commitment is undrawn.
                    </p>
                  )}
                  {!dated && comp.rows.length > 0 && (
                    <table data-testid="facility-shares">
                      <thead><tr><th>Line</th><th>Share of the facility</th></tr></thead>
                      <tbody>
                        {comp.rows.map((r) => (
                          <tr key={r.lineId} data-line={r.lineId}><td>{r.name}</td><td data-share>{r.display}</td></tr>
                        ))}
                        <tr data-share-total><td>Total</td><td>{comp.shareTotalDisplay}</td></tr>
                      </tbody>
                    </table>
                  )}
                </div>
              )}
              <button data-action="facility-up" disabled={idx === 0} onClick={() => setFacilities(moveFacility(list, f.id, -1))}>Move up</button>
              <button data-action="facility-down" disabled={idx === list.length - 1} onClick={() => setFacilities(moveFacility(list, f.id, 1))}>Move down</button>
              <button data-action="remove-facility" onClick={() => setFacilities(list.filter((x) => x.id !== f.id))}>Remove</button>
            </div>
          );
        })}
        <button data-action="add-facility" onClick={() => setFacilities([...list, blankFacility(list)])}>Add facility</button>
        <button data-action="add-note-facility" onClick={() => setFacilities([...list, blankNoteFacility(list)])}>Add interest-free note</button>
      </div>
      {hasDebt && (
        <label>Leveraged solve (the collections solve so the equity earns the target IRR){" "}
          <input data-field="finLeveraged" type="checkbox" checked={leveraged} onChange={(e) => setFacilityOptions(e.target.checked ? { leveragedSolve: true } : undefined)} />
        </label>
      )}
    </section>
  );
}
