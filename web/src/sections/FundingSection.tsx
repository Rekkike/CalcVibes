import type { FundingConfig, FundingRow, ModelInputs, ModelResult } from "../../../core/src/types.js";
import { moneyForDisplay, percentTwoForDisplay } from "../engine.js";
import type { CurrencyCode, EntryUnit } from "../engine.js";
import { MoneyEditor } from "../MoneyEditor.js";
import { yearHeader } from "../state.js";

// v0.6.10 Task E.1: the funding block worksuite surface — the rows editor (label, kind,
// amount, landing year; the loan kind gains the term and repayment-start fields), add and
// remove, live validation through the standing issues summary (the engine's FND-* refusals
// surface there), and the funding view disclosure (grantsTotal, fundingNpv, the allocation
// table rendered per grant with the per-line shares). The UI performs no financial
// arithmetic: every figure comes from the engine's fundingView.
export function FundingSection(props: {
  inputs: ModelInputs;
  result: ModelResult | null;
  setFunding: (fc: FundingConfig | null) => void;
  startYear: number | null;
  entryUnit: EntryUnit;
}) {
  const { inputs, result, setFunding, startYear, entryUnit } = props;
  const currency = (inputs.currency as CurrencyCode) ?? "SEK";
  const money = (v: number) => moneyForDisplay(v, currency, entryUnit);
  const rows = inputs.funding?.rows ?? [];
  const updateRow = (id: string, patch: Partial<FundingRow>) =>
    setFunding({ rows: rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  const fv = result?.fundingView ?? null;
  return (
    <section data-testid="funding">
      <h2>Funding — grants and the interest-free note</h2>
      <p className="muted">
        The grant offsets the fee by default: the solve works against the grant-netted basis, and the book nets the
        depreciable base coherently. Grants ride as visible collections-side rows so the full circle stays reconciled.
        The interest-free loan nets to zero over the horizon by construction (its subsidy element is its net present
        value); it never joins the collections total.
      </p>
      <div data-testid="funding-rows">
        {rows.map((row) => (
          <div key={row.id} data-funding-row={row.id} className="funding-row">
            <label>Label{" "}
              <input data-field="fundingLabel" value={row.label} onChange={(e) => updateRow(row.id, { label: e.target.value })} />
            </label>
            <label>Kind{" "}
              <select data-field="fundingKind" value={row.kind} onChange={(e) => updateRow(row.id, { kind: e.target.value as FundingRow["kind"] })}>
                <option value="grant">Grant</option>
                <option value="interest-free-loan">Interest-free loan</option>
              </select>
            </label>
            <label>Amount{" "}
              <MoneyEditor dataField="fundingAmount" value={row.amount} entryUnit={entryUnit} onChange={(v) => updateRow(row.id, { amount: v })} />
            </label>
            <label>Landing year{" "}
              <input data-field="fundingYear" type="number" value={row.year} onChange={(e) => updateRow(row.id, { year: parseFloat(e.target.value) || 0 })} />
            </label>
            {row.kind === "interest-free-loan" && (
              <>
                <label>Term years{" "}
                  <input data-field="fundingTerm" type="number" value={row.termYears ?? 1} onChange={(e) => updateRow(row.id, { termYears: parseFloat(e.target.value) || 0 })} />
                </label>
                <label>Repayment start year{" "}
                  <input data-field="fundingRepayStart" type="number" value={row.repaymentStartYear ?? 1} onChange={(e) => updateRow(row.id, { repaymentStartYear: parseFloat(e.target.value) || 0 })} />
                </label>
              </>
            )}
            <button data-action="remove-funding-row" onClick={() => setFunding({ rows: rows.filter((r) => r.id !== row.id) })}>Remove</button>
          </div>
        ))}
        <button data-action="add-funding-row" onClick={() => setFunding({ rows: [...rows, { id: "f" + (rows.length + 1), label: "", kind: "grant", amount: 0, year: 1 }] })}>Add funding row</button>
      </div>
      {fv !== null && (
        <div data-testid="funding-view">
          <h3>Funding view (engine-emitted)</h3>
          <div data-testid="funding-summary" className="funding-summary">
            <p data-stat="grantsTotal">Grants total: {money(fv.grantsTotal)}</p>
            <p data-stat="fundingNpv">Funding NPV at target: {money(fv.fundingNpv)}</p>
            <p className="muted">
              The funding NPV is the present value of the funding rows at the target rate (an interest-free loan
              contributes its repayments as negative present value); it is subtracted from every solve numerator.
            </p>
          </div>
          <div data-testid="funding-allocation">
            <h4>Grant allocation — the book nets the depreciable base</h4>
            {fv.allocation.map((a) => (
              <div key={a.grantId} data-allocation={a.grantId} className="funding-allocation">
                <p>{a.label}: {money(a.amount)} at year {yearHeader(a.year, startYear)} — allocated proportionally to the capitalized-to-date cost of the depreciating lines at the receipt year.</p>
                <table data-testid="funding-allocation-table">
                  <thead>
                    <tr><th>Line</th><th>Capitalized to date</th><th>Share of grant</th><th>Netted amount</th></tr>
                  </thead>
                  <tbody>
                    {a.shares.map((s) => (
                      <tr key={s.lineId} data-line={s.lineId}>
                        <td>{s.lineName}</td>
                        <td>{money(s.capitalizedToDate)}</td>
                        <td>{percentTwoForDisplay(s.shareOfGrant)}</td>
                        <td>{money(s.nettedAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
