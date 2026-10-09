import type { GridRow, ModelInputs, ModelResult } from "../../../core/src/types.js";
import { moneyForDisplay } from "../engine.js";
import { yearHeader } from "../state.js";
import type { CurrencyCode } from "../engine.js";

function GridTable(props: { title: string; rows: GridRow[]; years: number; startYear: number | null; currency: CurrencyCode; testId: string; entryUnit?: import("../engine.js").EntryUnit }) {
  const { title, rows, years, entryUnit = "ones", startYear, currency, testId } = props;
  const rowTotal = (r: GridRow) => r.amounts.reduce((a, b) => a + b, 0);
  const colTotal = (k: number) => rows.reduce((a, r) => a + r.amounts[k], 0);
  return (
    <div data-testid={testId} className="yearly-grid">
      <h3>{title}</h3>
      <div className="grid-scroll">
        <table>
          <thead>
            <tr>
              <th className="grid-name-col sticky-col">Line</th>
              {Array.from({ length: years }, (_, k) => <th key={k} className="table-value-cell">{yearHeader(k + 1, startYear)}</th>)}
              <th className="table-value-cell">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.kind}-${r.id}`} data-grid-row={`${r.kind}:${r.id}`}>
                <td className="grid-name-col sticky-col">{r.name}</td>
                {r.amounts.map((a, k) => <td key={k} className="table-value-cell">{a === 0 ? "—" : moneyForDisplay(a, currency, entryUnit)}</td>)}
                <td className="table-value-cell">{moneyForDisplay(rowTotal(r), currency, entryUnit)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr data-grid-totals="true">
              <td className="grid-name-col sticky-col">Total</td>
              {Array.from({ length: years }, (_, k) => <td key={k} className="table-value-cell">{moneyForDisplay(colTotal(k), currency, entryUnit)}</td>)}
              <td className="table-value-cell">{moneyForDisplay(rows.reduce((a, r) => a + rowTotal(r), 0), currency, entryUnit)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export function YearlyDetailSection(props: { inputs: ModelInputs; result: ModelResult; startYear: number | null; entryUnit?: import("../engine.js").EntryUnit }) {
  const { inputs, result, startYear, entryUnit = "ones" } = props;
  const currency = (inputs.currency as CurrencyCode) ?? "SEK";
  const years = result.monthly.length / 12 > Math.floor(result.monthly.length / 12) ? Math.ceil(result.monthly.length / 12) : Math.floor(result.monthly.length / 12);
  return (
    <section data-testid="yearly-detail">
      <h2>Yearly detail</h2>
      <GridTable title="Cost grid" rows={result.costGrid} years={years} startYear={startYear} currency={currency} testId="cost-grid" entryUnit={entryUnit} />
      <GridTable title="Collections grid" rows={result.collectionsGrid} years={years} startYear={startYear} currency={currency} testId="collections-grid" entryUnit={entryUnit} />
    </section>
  );
}
