import { entryToValue, valueToEntry } from "./engine.js";
import type { EntryUnit } from "./engine.js";

export function MoneyEditor(props: {
  value: number;
  entryUnit: EntryUnit;
  onChange: (actual: number) => void;
  dataField: string;
  dataColumn?: number;
  disabled?: boolean;
  title?: string;
}) {
  const { value, entryUnit, onChange, dataField, dataColumn, disabled = false, title } = props;
  return (
    <input
      data-field={dataField}
      data-column={dataColumn}
      data-entry-unit={entryUnit}
      type="number"
      value={valueToEntry(value, entryUnit)}
      disabled={disabled}
      title={title}
      onChange={(e) => onChange(entryToValue(parseFloat(e.target.value) || 0, entryUnit))}
    />
  );
}
