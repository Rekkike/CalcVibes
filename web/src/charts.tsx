import type { GridRow, LineTotal, YearlyRow } from "../../core/src/types.js";

export const CHART_COLORS = {
  costBar: "#fb7185",
  inflowBar: "#34d399",
  cumulative: "#0074ba",
  accentBar: "#0074ba",
};

export const STAGE_CHART_COLORS = {
  gridline: "rgba(148,163,184,0.16)",
  axisText: "#e2e8f0",
  zeroLine: "rgba(148,163,184,0.45)",
};

export function CostInflowColumns(props: {
  yearly: YearlyRow[];
  labelFor: (year: number) => string;
  valueFor: (v: number) => string;
}) {
  const { yearly, labelFor, valueFor } = props;
  const max = Math.max(1, ...yearly.map((y) => Math.max(y.cost, y.inflow)));
  const peakCostIdx = yearly.reduce((bi, y, i) => (y.cost > yearly[bi].cost ? i : bi), 0);
  const peakInflowIdx = yearly.reduce((bi, y, i) => (y.inflow > yearly[bi].inflow ? i : bi), 0);
  return (
    <div data-testid="cost-inflow-columns" className="chart-block app-chart">
      <div className="paired-columns">
        {yearly.map((y, i) => (
          <div key={y.year} data-column-year={y.year} className="paired-column">
            <span data-testid="column-peak-cost" className={i === peakCostIdx && y.cost > 0 ? "column-peak" : "column-peak hidden-peak"}>{i === peakCostIdx && y.cost > 0 ? valueFor(y.cost) : "\u00a0"}</span>
            <svg viewBox="0 0 10 100" preserveAspectRatio="none" aria-hidden="true" className="paired-svg">
              <rect data-chart-bar="cost" x={0} y={100 - Math.round((y.cost / max) * 100)} width={10} height={Math.round((y.cost / max) * 100)} fill={CHART_COLORS.costBar} rx={2} />
            </svg>
            <span data-testid="column-peak-inflow" className={i === peakInflowIdx && y.inflow > 0 ? "column-peak inflow-peak" : "column-peak inflow-peak hidden-peak"}>{i === peakInflowIdx && y.inflow > 0 ? valueFor(y.inflow) : "\u00a0"}</span>
            <svg viewBox="0 0 10 100" preserveAspectRatio="none" aria-hidden="true" className="paired-svg">
              <rect data-chart-bar="inflow" x={0} y={100 - Math.round((y.inflow / max) * 100)} width={10} height={Math.round((y.inflow / max) * 100)} fill={CHART_COLORS.inflowBar} rx={2} />
            </svg>
            <span data-testid="column-year-label" className="column-year-label">{labelFor(y.year)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CumulativeLine(props: {
  yearly: YearlyRow[];
  labelFor: (year: number) => string;
  valueFor: (v: number) => string;
}) {
  const { yearly, labelFor, valueFor } = props;
  const values = yearly.map((y) => y.cumulative);
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const span = Math.max(1e-12, max - min);
  const xFor = (i: number) => yearly.length > 1 ? (i / (yearly.length - 1)) * 100 : 50;
  const yFor = (v: number) => 100 - ((v - min) / span) * 100;
  const zeroCrossIdx = values.findIndex((v, i) => i > 0 && values[i - 1] < 0 && v >= 0);
  const zeroY = yFor(0);
  const points = values.map((v, i) => `${xFor(i).toFixed(2)},${yFor(v).toFixed(2)}`).join(" ");
  return (
    <div data-testid="cumulative-line" className="chart-block app-chart">
      <div className="line-points">
        <span data-testid="line-start-value" className="line-endpoint">{valueFor(values[0] ?? 0)}</span>
        <span data-testid="line-end-value" className="line-endpoint">{valueFor(values[values.length - 1] ?? 0)}</span>
      </div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" className="cumulative-svg">
        <line data-testid="zero-baseline" x1={0} x2={100} y1={zeroY.toFixed(2)} y2={zeroY.toFixed(2)} stroke="var(--line)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        <polyline data-chart-line="cumulative" points={points} fill="none" stroke={CHART_COLORS.cumulative} strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="line-years">
        <span data-testid="line-first-year" className="column-year-label">{labelFor(yearly[0]?.year ?? 1)}</span>
        {zeroCrossIdx > 0 && (
          <span data-testid="line-zero-crossing" className="column-year-label">zero at {labelFor(yearly[zeroCrossIdx].year)}</span>
        )}
        <span data-testid="line-last-year" className="column-year-label">{labelFor(yearly[yearly.length - 1]?.year ?? yearly.length)}</span>
      </div>
    </div>
  );
}

export function CompositionRows(props: {
  lineTotals: LineTotal[];
  valueFor: (total: number) => string;
  kicker?: string;
}) {
  const { lineTotals, valueFor, kicker } = props;
  const total = Math.max(1e-12, lineTotals.reduce((a, l) => a + l.total, 0));
  const rows = lineTotals.map((l) => ({ ...l, sharePct: l.total / total }));
  return (
    <div data-testid="composition-rows" className="chart-block">
      {kicker !== undefined && <p data-testid="chart-kicker" className="chart-kicker">{kicker}</p>}
      {rows.map((r) => (
        <div key={r.id} data-composition-row={r.id} className="composition-row">
          <span data-row-label="name" className="row-name">{r.name}</span>
          <span data-row-label="share" className="row-share">{Math.round(r.sharePct * 100)}%</span>
          <div className="row-bar-track">
            <svg viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true" className="row-bar-svg">
              <rect x={0} y={0} width={100 * r.sharePct} height={8} fill={CHART_COLORS.accentBar} rx={2} />
            </svg>
          </div>
          <span data-row-label="value" className="row-value">{valueFor(r.total)}</span>
        </div>
      ))}
    </div>
  );
}

export function RecoveryBars(props: {
  collectionsGrid: GridRow[];
  years: number;
  labelFor: (year: number) => string;
  peakFor: (value: number) => string;
  kicker?: string;
}) {
  const { collectionsGrid, years, labelFor, peakFor, kicker } = props;
  const inflows = new Array<number>(years).fill(0);
  for (const row of collectionsGrid) {
    for (let k = 0; k < Math.min(years, row.amounts.length); k++) inflows[k] += row.amounts[k];
  }
  const max = Math.max(1, ...inflows);
  const peakIdx = inflows.indexOf(Math.max(...inflows));
  return (
    <div data-testid="recovery-bars" className="chart-block">
      {kicker !== undefined && <p data-testid="chart-kicker" className="chart-kicker">{kicker}</p>}
      <div className="recovery-grid">
        {inflows.map((v, k) => (
          <div key={k} data-recovery-column={k} className="recovery-column">
            <span data-testid="peak-label" className={k === peakIdx && v > 0 ? "peak-label" : "peak-label peak-hidden"}>{k === peakIdx && v > 0 ? peakFor(v) : "\u00a0"}</span>
            <svg viewBox={`0 0 10 ${Math.max(1, Math.round((v / max) * 100))}`} preserveAspectRatio="none" aria-hidden="true" className="recovery-bar-svg">
              <rect x={0} y={0} width={10} height={Math.max(1, Math.round((v / max) * 100))} fill={CHART_COLORS.inflowBar} rx={2} />
            </svg>
            <span data-testid="bar-year-label" className="bar-year-label">{labelFor(k + 1)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
