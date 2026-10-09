import type { CostLine, DepreciationConfig, Reinvestment } from "./types.js";

export interface BookLineRow {
  id: string;
  name: string;
  years: { year: number; beginning: number; charge: number; ending: number }[];
  endingBookAtEnd: number;
  isRetained: boolean;
}

export interface BookSchedule {
  lines: BookLineRow[];
  combined: { year: number; beginning: number; charge: number; ending: number }[];
  remainingBookValueAt(year: number): number;
  totalCharge: number;
}

interface BookEntry {
  id: string;
  name: string;
  amount: number;
  startYear: number;
  config: DepreciationConfig | null;
}

function resolveCharge(entry: BookEntry, horizonYears: number): { beginning: number; charge: number; ending: number }[] {
  const cfg = entry.config;
  const rows: { beginning: number; charge: number; ending: number }[] = [];
  let book = entry.amount;
  for (let y = entry.startYear; y <= horizonYears; y++) {
    const idx = y - entry.startYear;
    let charge = 0;
    if (cfg && cfg.mode === "retained") {
      charge = 0;
    } else if (cfg && cfg.mode === "straight-line") {
      const yrs = Math.max(1, cfg.years ?? horizonYears);
      charge = idx < yrs ? entry.amount / yrs : 0;
    } else if (cfg && cfg.mode === "rate") {
      charge = book * ((cfg.yearlyRatePct ?? 0) / 100);
    } else {
      // The project default when unconfigured: capex held at book (retained) — no silent write-down.
      charge = 0;
    }
    if (y < entry.startYear) charge = 0;
    rows.push({ beginning: book, charge, ending: book - charge });
    book -= charge;
    if (book < 0) book = 0;
  }
  return rows;
}

export function computeBookSchedule(
  costs: CostLine[],
  reinvestments: { contractId: string; ri: Reinvestment }[],
  defaultConfig: DepreciationConfig | null,
  horizonYears: number,
  costLineTotals: Map<string, number>,
): BookSchedule {
  const entries: BookEntry[] = [];
  for (const c of costs) {
    const total = costLineTotals.get(c.id) ?? c.amount;
    entries.push({ id: c.id, name: c.name, amount: total, startYear: c.startYear, config: c.depreciation ?? defaultConfig ?? null });
  }
  for (const { contractId, ri } of reinvestments) {
    entries.push({ id: `reinv-${contractId}-${ri.year}`, name: `Reinvestment (${contractId})`, amount: ri.amount, startYear: ri.year, config: null });
  }
  const lines: BookLineRow[] = entries.map((e) => {
    const rows = resolveCharge(e, horizonYears);
    return {
      id: e.id,
      name: e.name,
      years: rows.map((r, i) => ({ year: e.startYear + i, beginning: r.beginning, charge: r.charge, ending: r.ending })),
      endingBookAtEnd: rows.length > 0 ? rows[rows.length - 1].ending : e.amount,
      isRetained: !e.config || e.config.mode === "retained",
    };
  });
  const combined: { year: number; beginning: number; charge: number; ending: number }[] = [];
  for (let y = 1; y <= horizonYears; y++) {
    let beg = 0, ch = 0, end = 0;
    for (const l of lines) {
      const row = l.years.find((r) => r.year === y);
      if (row) { beg += row.beginning; ch += row.charge; end += row.ending; }
    }
    combined.push({ year: y, beginning: beg, charge: ch, ending: end });
  }
  const remainingBookValueAt = (year: number): number => {
    let total = 0;
    for (const l of lines) {
      const row = l.years.find((r) => r.year === year);
      if (row) total += row.ending;
      else if (year < (l.years[0]?.year ?? 1)) total += 0;
      else total += l.endingBookAtEnd;
    }
    return total;
  };
  const totalCharge = combined.reduce((a, r) => a + r.charge, 0);
  return { lines, combined, remainingBookValueAt, totalCharge };
}
