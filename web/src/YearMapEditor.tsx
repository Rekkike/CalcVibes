import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { MoneyEditor } from "./MoneyEditor.js";
import type { EntryUnit } from "./engine.js";

// v0.6.18 (AUD-16): the per-year editors key their rows by a STABLE id, never by the year. The year is the
// record key of the document ({ year: amount }); keyed by it, editing the year re-keyed the row (the focus was
// lost on every keystroke) and a second "Add year" re-used the same key (a no-op). The rows live here with a
// generated id; the record is derived from them (a duplicate year keeps the last row; the rows themselves are
// never dropped). When the record changes from OUTSIDE (a spread fill, an open) the rows rebuild from it.
interface Row { id: number; yearText: string; amount: number }

const recordOf = (rows: Row[]): Record<number, number> => {
  const out: Record<number, number> = {};
  for (const r of rows) out[parseFloat(r.yearText) || 0] = r.amount;
  return out;
};
const keyOf = (rec: Record<number, number>): string => JSON.stringify(Object.entries(rec).sort((a, b) => Number(a[0]) - Number(b[0])));

export function YearMapEditor(props: {
  value: Record<number, number>;
  onChange: (next: Record<number, number>) => void;
  entryUnit: EntryUnit;
  tableTestId: string;
  rowAttr: "data-override-year" | "data-profile-year";
  yearField: string;
  amountField: string;
  removeAction: string;
  addAction: string;
  // the year a first added row takes; a later add takes the year after the highest
  defaultNewYear: number;
  rowExtra?: (year: number) => Record<string, string>;
  yearNote?: (year: number) => ReactNode;
}) {
  const { value, onChange, entryUnit, tableTestId, rowAttr, yearField, amountField, removeAction, addAction, defaultNewYear, rowExtra, yearNote } = props;
  const nextId = useRef(0);
  const build = (rec: Record<number, number>): Row[] => Object.entries(rec).map(([y, amount]) => ({ id: nextId.current++, yearText: y, amount }));
  const [rows, setRows] = useState<Row[]>(() => build(value));
  // an outside change to the record (not the echo of this editor's own edit) rebuilds the rows
  const [seen, setSeen] = useState<string>(() => keyOf(value));
  let shown = rows;
  if (keyOf(value) !== seen && keyOf(value) !== keyOf(recordOf(rows))) {
    shown = build(value);
    setRows(shown);
    setSeen(keyOf(value));
  } else if (keyOf(value) !== seen) {
    setSeen(keyOf(value));
  }
  const commit = (next: Row[]) => {
    setRows(next);
    const rec = recordOf(next);
    setSeen(keyOf(rec));
    onChange(rec);
  };
  return (
    <>
      <table data-testid={tableTestId}>
        <thead><tr><th>Year</th><th>{amountField.includes("profile") || amountField.includes("col-") ? "Collected sum" : "Amount"}</th><th></th></tr></thead>
        <tbody>
          {shown.map((r) => {
            const year = parseFloat(r.yearText) || 0;
            return (
              <tr key={r.id} {...{ [rowAttr]: String(year) }} {...(rowExtra ? rowExtra(year) : {})}>
                <td>
                  <input data-field={yearField} value={r.yearText} onChange={(e) => commit(shown.map((x) => (x.id === r.id ? { ...x, yearText: e.target.value } : x)))} />
                  {yearNote !== undefined && <> {yearNote(year)}</>}
                </td>
                <td><MoneyEditor dataField={amountField} value={r.amount} entryUnit={entryUnit} onChange={(v) => commit(shown.map((x) => (x.id === r.id ? { ...x, amount: v } : x)))} /></td>
                <td><button data-action={removeAction} data-year={String(year)} onClick={() => commit(shown.filter((x) => x.id !== r.id))}>Remove</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <button data-action={addAction} onClick={() => {
        const taken = shown.map((r) => parseFloat(r.yearText) || 0);
        const year = taken.length === 0 || !taken.includes(defaultNewYear) ? defaultNewYear : Math.max(...taken) + 1;
        commit([...shown, { id: nextId.current++, yearText: String(year), amount: 0 }]);
      }}>Add year</button>
    </>
  );
}
