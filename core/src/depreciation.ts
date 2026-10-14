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
  incurred: Map<number, number>;
  startYear: number;
  config: DepreciationConfig | null;
}

export function lineIncurred(c: CostLine): Map<number, number> {
  const map = new Map<number, number>();
  const overrides = c.yearOverrides && Object.keys(c.yearOverrides).length > 0 ? c.yearOverrides : null;
  if (c.category === "capex") {
    if (overrides) {
      for (const [yStr, amount] of Object.entries(overrides)) map.set(Number(yStr), amount);
    } else {
      map.set(c.startYear, c.amount);
    }
  } else {
    const dur = Math.max(1, c.durationYears);
    for (let j = 0; j < dur; j++) {
      const y = c.startYear + j;
      const overridden = overrides && Object.prototype.hasOwnProperty.call(overrides, String(y));
      map.set(y, overridden ? (overrides as Record<number, number>)[y] : c.amount * Math.pow(1 + c.escalation / 100, j));
    }
  }
  return map;
}

// v0.6.10 Task B: the optional grant netting — lineId -> (receipt year -> netted amount).
// With no map (or no entry for a line) the arithmetic is byte-identical to the
// pre-funding schedule (the golden no-drift pin).
export function computeBookSchedule(
  costs: CostLine[],
  reinvestments: { contractId: string; ri: Reinvestment }[],
  defaultConfig: DepreciationConfig | null,
  horizonYears: number,
  costLineTotals: Map<string, number>,
  nettingByLine?: Map<string, Map<number, number>>,
): BookSchedule {
  const entries: BookEntry[] = [];
  for (const c of costs) {
    entries.push({ id: c.id, name: c.name, incurred: lineIncurred(c), startYear: c.startYear, config: c.depreciation ?? defaultConfig ?? null });
  }
  for (const { contractId, ri } of reinvestments) {
    const map = new Map<number, number>();
    map.set(ri.year, ri.amount);
    entries.push({ id: `reinv-${contractId}-${ri.year}`, name: `Reinvestment (${contractId})`, incurred: map, startYear: ri.year, config: null });
  }
  const lines: BookLineRow[] = entries.map((e) => {
    const costYears = [...e.incurred.keys()].sort((a, b) => a - b);
    const firstYear = costYears.length > 0 ? costYears[0] : e.startYear;
    const lastCostY = costYears.length > 0 ? costYears[costYears.length - 1] : e.startYear;
    const cfg = e.config;
    const commissioning = cfg && cfg.startYear !== undefined && Number.isInteger(cfg.startYear) && (cfg.startYear as number) >= 1
      ? (cfg.startYear as number)
      : lastCostY + 1;
    const straightYears = cfg && cfg.mode === "straight-line" ? Math.max(1, cfg.years ?? horizonYears) : 0;
    const rows: { year: number; beginning: number; charge: number; ending: number }[] = [];
    let book = 0;
    let basis = 0;
    let charges = 0;
    let charging = false;
    // v0.6.10 Task B: the standing straight-line charge; a net arrival while charging
    // re-bases it over the remaining straight-line years.
    let currentCharge = 0;
    const nets = nettingByLine?.get(e.id) ?? null;
    for (let y = firstYear; y <= horizonYears; y++) {
      const incurred = e.incurred.get(y) ?? 0;
      const net = nets?.get(y) ?? 0;
      // v0.6.10 Task B: the net arrival reduces the book first (byte-identical when absent);
      // the ending carries the netted book forward, and before commissioning the nets simply
      // reduce the commissioning basis.
      const netted = book - net;
      let charge = 0;
      if (incurred > 0) {
        charge = 0;
      } else if (!charging && y >= commissioning) {
        charging = true;
        basis = netted;
        currentCharge = basis / straightYears;
      }
      if (charging && net > 0) {
        // v0.6.10 Task B: the net arrival re-bases the remaining straight-line charge
        // (nettedBook / remaining years); the rate mode charges on the netted book.
        if (cfg && cfg.mode === "straight-line") {
          const remaining = straightYears - charges;
          currentCharge = remaining > 0 ? Math.max(0, netted) / remaining : 0;
        }
      }
      if (charging && incurred === 0) {
        if (cfg && cfg.mode === "straight-line") {
          charge = charges < straightYears ? currentCharge : 0;
        } else if (cfg && cfg.mode === "rate") {
          charge = Math.max(0, netted) * ((cfg.yearlyRatePct ?? 0) / 100);
        } else {
          charge = 0;
        }
        charges += charge > 0 ? 1 : 0;
      }
      if (netted - charge < 0) charge = Math.max(0, netted);
      const ending = netted + incurred - charge;
      rows.push({ year: y, beginning: book, charge: charge, ending: ending });
      book = ending;
    }
    return {
      id: e.id,
      name: e.name,
      years: rows,
      endingBookAtEnd: rows.length > 0 ? rows[rows.length - 1].ending : (costLineTotals.get(e.id) ?? 0),
      isRetained: !cfg || cfg.mode === "retained",
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
