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

export const STAGE_GOLD = "#e8b84b";

export function SignedCashflowChart(props: {
  yearly: YearlyRow[];
  labelFor: (year: number) => string;
  valueFor: (v: number) => string;
}) {
  const { yearly, labelFor, valueFor } = props;
  const cum = yearly.map((y) => y.cumulative);
  const maxAbove = Math.max(...yearly.map((y) => y.inflow), ...cum, 0);
  const maxBelow = Math.max(...yearly.map((y) => y.cost), ...cum.map((v) => -v), 0);
  const span = Math.max(1e-12, maxAbove + maxBelow);
  const yFor = (v: number) => 100 - ((v + maxBelow) / span) * 100;
  const barW = 100 / Math.max(1, yearly.length * 2);
  const xFor = (i: number) => (i / Math.max(1, yearly.length)) * 100;
  const peakCostIdx = yearly.reduce((bi, y, i) => (y.cost > yearly[bi].cost ? i : bi), 0);
  const peakInflowIdx = yearly.reduce((bi, y, i) => (y.inflow > yearly[bi].inflow ? i : bi), 0);
  const zeroCrossIdx = cum.findIndex((v, i) => i > 0 && cum[i - 1] < 0 && v >= 0);
  const linePoints = cum.map((v, i) => `${xFor(i).toFixed(2)},${yFor(v).toFixed(2)}`).join(" ");
  const points = yearly.map((y, i) => {
    const base = xFor(i);
    return { cost: `${base.toFixed(2)},${yFor(0).toFixed(2)} ${base.toFixed(2)},${yFor(-y.cost).toFixed(2)} ${(base + barW).toFixed(2)},${yFor(-y.cost).toFixed(2)} ${(base + barW).toFixed(2)},${yFor(0).toFixed(2)}`, inflow: `${base.toFixed(2)},${yFor(0).toFixed(2)} ${base.toFixed(2)},${yFor(y.inflow).toFixed(2)} ${(base + barW).toFixed(2)},${yFor(y.inflow).toFixed(2)} ${(base + barW).toFixed(2)},${yFor(0).toFixed(2)}` };
  });
  return (
    <div data-testid="signed-cashflow" className="chart-block app-chart signed-cashflow">
      <div className="cashflow-peaks">
        <span data-testid="column-peak-cost" className={yearly[peakCostIdx] && yearly[peakCostIdx].cost > 0 ? "column-peak" : "column-peak hidden-peak"}>{yearly[peakCostIdx] && yearly[peakCostIdx].cost > 0 ? `Cost peak ${valueFor(yearly[peakCostIdx].cost)}` : "\u00a0"}</span>
        <span data-testid="column-peak-inflow" className={yearly[peakInflowIdx] && yearly[peakInflowIdx].inflow > 0 ? "column-peak inflow-peak" : "column-peak inflow-peak hidden-peak"}>{yearly[peakInflowIdx] && yearly[peakInflowIdx].inflow > 0 ? `Inflow peak ${valueFor(yearly[peakInflowIdx].inflow)}` : "\u00a0"}</span>
      </div>
      <div className="signed-cashflow-frame">
        <span data-testid="line-start-value" className="line-endpoint signed-top-value">{valueFor(cum[0] ?? 0)}</span>
        <span data-testid="line-end-value" className="line-endpoint signed-top-value">{valueFor(cum[cum.length - 1] ?? 0)}</span>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" className="signed-svg">
          <line data-testid="zero-baseline" x1={0} x2={100} y1={yFor(0).toFixed(2)} y2={yFor(0).toFixed(2)} stroke="var(--line)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          {yearly.map((y, i) => (
            <polygon key={"c" + y.year} data-chart-bar="cost" data-bar-year={y.year} data-signed="below" points={points[i].cost} fill={CHART_COLORS.costBar} />
          ))}
          {yearly.map((y, i) => (
            <polygon key={"i" + y.year} data-chart-bar="inflow" data-bar-year={y.year} data-signed="above" points={points[i].inflow} fill={CHART_COLORS.inflowBar} />
          ))}
          <polyline data-chart-line="cumulative" points={linePoints} fill="none" stroke={CHART_COLORS.cumulative} strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div className="line-years">
        <span data-testid="column-year-label-first" className="column-year-label">{labelFor(yearly[0]?.year ?? 1)}</span>
        {zeroCrossIdx > 0 && (
          <span data-testid="line-zero-crossing" className="column-year-label">zero at {labelFor(yearly[zeroCrossIdx].year)}</span>
        )}
        <span data-testid="column-year-label-last" className="column-year-label">{labelFor(yearly[yearly.length - 1]?.year ?? yearly.length)}</span>
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

export function bucketWidthFor(yearCount: number, cap: number): number {
  for (const w of [1, 2, 5, 10]) {
    if (Math.ceil(yearCount / w) <= cap) return w;
  }
  return Math.ceil(yearCount / cap);
}

export function bucketSeries(values: number[], cap: number): { buckets: number[]; width: number } {
  const width = bucketWidthFor(values.length, cap);
  const buckets: number[] = [];
  for (let i = 0; i < values.length; i += width) {
    let sum = 0;
    for (let j = i; j < Math.min(values.length, i + width); j++) sum += values[j];
    buckets.push(sum);
  }
  return { buckets, width };
}

export const DONUT_COLORS = ["#0074ba", "#059669", "#b45309", "#7c3aed", "#db2777", "#0891b2", "#65a30d", "#c2410c"];

export function CompositionDonut(props: {
  lineTotals: LineTotal[];
  valueFor: (total: number) => string;
}) {
  const { lineTotals, valueFor } = props;
  const total = Math.max(1e-12, lineTotals.reduce((a, l) => a + l.total, 0));
  const cx = 60, cy = 60, r = 46, ringWidth = 22, rMid = r - ringWidth / 2;
  let acc = 0;
  const arcs = lineTotals.map((l, i) => {
    const frac = l.total / total;
    const start = (acc / total) * 2 * Math.PI - Math.PI / 2;
    acc += l.total;
    const end = (acc / total) * 2 * Math.PI - Math.PI / 2;
    const large = end - start > Math.PI ? 1 : 0;
    const x1 = cx + rMid * Math.cos(start), y1 = cy + rMid * Math.sin(start);
    const x2 = cx + rMid * Math.cos(end), y2 = cy + rMid * Math.sin(end);
    const d = frac >= 0.9999
      ? `M ${cx + rMid} ${cy} A ${rMid} ${rMid} 0 1 1 ${cx - rMid - 0.01} ${cy} A ${rMid} ${rMid} 0 1 1 ${cx + rMid} ${cy}`
      : `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${rMid} ${rMid} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
    return { id: l.id, name: l.name, total: l.total, frac, d, color: DONUT_COLORS[i % DONUT_COLORS.length] };
  });
  return (
    <div data-testid="composition-donut" className="chart-block composition-donut">
      <div className="donut-geometry">
        <svg viewBox="0 0 120 120" aria-hidden="true" className="donut-svg">
          {arcs.map((a) => (
            <path key={a.id} data-donut-segment={a.id} d={a.d} fill="none" stroke={a.color} strokeWidth={ringWidth} />
          ))}
          <circle data-testid="donut-center" cx={cx} cy={cy} r={r - ringWidth - 2} fill="none" stroke="none" />
        </svg>
        <span data-testid="donut-center-total" className="donut-center-total">{valueFor(total)}</span>
      </div>
      <ul className="donut-labels">
        {arcs.map((a) => (
          <li key={a.id} data-testid="donut-label" data-donut-label={a.id} className="donut-label">
            <span data-testid="donut-swatch" className="donut-swatch" style={{ background: a.color }} />
            <span className="row-name">{a.name} {valueFor(a.total)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RecoveryBars(props: {
  collectionsGrid: GridRow[];
  years: number;
  labelFor: (year: number) => string;
  peakFor: (value: number) => string;
  kicker?: string;
  cap?: number;
}) {
  const { collectionsGrid, years, labelFor, peakFor, kicker, cap = 20 } = props;
  const rawInflows = new Array<number>(years).fill(0);
  for (const row of collectionsGrid) {
    for (let k = 0; k < Math.min(years, row.amounts.length); k++) rawInflows[k] += row.amounts[k];
  }
  const { buckets: inflows, width } = bucketSeries(rawInflows, cap);
  const max = Math.max(1, ...inflows);
  const peakIdx = inflows.indexOf(Math.max(...inflows));
  return (
    <div data-testid="recovery-bars" className="chart-block">
      {kicker !== undefined && <p data-testid="chart-kicker" className="chart-kicker">{kicker}</p>}
      <div className="recovery-grid">
        {inflows.map((v, k) => (
          <div key={k} data-recovery-column={k} data-bucket-width={width} className="recovery-column">
            <span data-testid="peak-label" className={k === peakIdx && v > 0 ? "peak-label" : "peak-label peak-hidden"}>{k === peakIdx && v > 0 ? `${peakFor(v)} in ${labelFor(k * width + 1)}` : "\u00a0"}</span>
            <svg viewBox={`0 0 10 ${Math.max(1, Math.round((v / max) * 100))}`} preserveAspectRatio="none" aria-hidden="true" className="recovery-bar-svg">
              <rect x={0} y={0} width={10} height={Math.max(1, Math.round((v / max) * 100))} fill={CHART_COLORS.inflowBar} rx={2} />
            </svg>
            <span data-testid="bar-year-label" className="bar-year-label">{width === 1 ? labelFor(k + 1) : `${labelFor(k * width + 1)}–${labelFor(Math.min(years, (k + 1) * width))}`}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StageReturnsChart(props: {
  yearly: YearlyRow[];
  labelFor: (year: number) => string;
}) {
  const { yearly, labelFor } = props;
  const cum = yearly.map((y) => y.cumulative);
  const maxAbove = Math.max(...yearly.map((y) => y.inflow), ...cum, 0);
  const maxBelow = Math.max(...yearly.map((y) => y.cost), ...cum.map((v) => -v), 0);
  const span = Math.max(1e-12, maxAbove + maxBelow);
  const yFor = (v: number) => 100 - ((v + maxBelow) / span) * 100;
  const barW = 100 / Math.max(1, yearly.length * 2);
  const xFor = (i: number) => (i / Math.max(1, yearly.length)) * 100;
  const zeroCrossIdx = cum.findIndex((v, i) => i > 0 && cum[i - 1] < 0 && v >= 0);
  const linePoints = cum.map((v, i) => `${xFor(i).toFixed(2)},${yFor(v).toFixed(2)}`).join(" ");
  const points = yearly.map((y, i) => {
    const base = xFor(i);
    return { cost: `${base.toFixed(2)},${yFor(0).toFixed(2)} ${base.toFixed(2)},${yFor(-y.cost).toFixed(2)} ${(base + barW).toFixed(2)},${yFor(-y.cost).toFixed(2)} ${(base + barW).toFixed(2)},${yFor(0).toFixed(2)}`, inflow: `${base.toFixed(2)},${yFor(0).toFixed(2)} ${base.toFixed(2)},${yFor(y.inflow).toFixed(2)} ${(base + barW).toFixed(2)},${yFor(y.inflow).toFixed(2)} ${(base + barW).toFixed(2)},${yFor(0).toFixed(2)}` };
  });
  return (
    <div data-testid="stage-returns" className="chart-block stage-returns">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" className="stage-returns-svg">
        <line data-testid="stage-returns-zero" x1={0} x2={100} y1={yFor(0).toFixed(2)} y2={yFor(0).toFixed(2)} stroke="rgba(148,163,184,0.45)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        {yearly.map((y, i) => (
          <polygon key={"c" + y.year} data-stage-bar="cost" data-signed="below" points={points[i].cost} fill="rgba(251,113,133,0.85)" />
        ))}
        {yearly.map((y, i) => (
          <polygon key={"i" + y.year} data-stage-bar="inflow" data-signed="above" points={points[i].inflow} fill="rgba(52,211,153,0.85)" />
        ))}
        <polyline data-testid="stage-gold-line" points={linePoints} fill="none" stroke={STAGE_GOLD} strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="line-years">
        <span data-testid="stage-returns-first" className="column-year-label">{labelFor(yearly[0]?.year ?? 1)}</span>
        {zeroCrossIdx > 0 && (
          <span data-testid="stage-returns-crossing" className="column-year-label">break-even {labelFor(yearly[zeroCrossIdx].year)}</span>
        )}
        <span data-testid="stage-returns-last" className="column-year-label">{labelFor(yearly[yearly.length - 1]?.year ?? yearly.length)}</span>
      </div>
    </div>
  );
}

export function CostWaterfall(props: { lineTotals: LineTotal[]; total: number; valueFor: (v: number) => string; }) {
  const { lineTotals, total, valueFor } = props;
  const cap = Math.max(1e-12, total);
  let acc = 0;
  return (
    <div data-testid="cost-waterfall" className="chart-block">
      <ul className="waterfall-label-list">
        {lineTotals.map((l) => (
          <li key={l.id} data-testid="waterfall-label" className="waterfall-label">{l.name} {valueFor(l.total)}</li>
        ))}
      </ul>
      <div className="waterfall-track">
        {lineTotals.map((l) => {
          const frac = l.total / cap;
          const seg = (
            <div key={l.id} data-waterfall-segment={l.id} className="waterfall-segment" style={{ bottom: `${(acc / cap) * 100}%`, height: `${frac * 100}%` }}>
            </div>
          );
          acc += l.total;
          return seg;
        })}
        <div data-testid="waterfall-cap" className="waterfall-cap" style={{ bottom: "100%", width: "100%", height: "4px" }} />
      </div>
    </div>
  );
}
export function HurdlePlot(props: {
  target: number;
  achieved: number;
  goalMet: boolean;
  solved?: boolean;
}) {
  const { target, achieved, goalMet, solved = false } = props;
  const bound = Math.max(target, achieved) * 1.15;
  const scale = Math.max(1e-12, bound);
  return (
    <div data-testid="hurdle-plot" className="chart-block">
      <div className="hurdle-track">
        <span data-testid="hurdle-target-dot" data-hurdle="target" className="hurdle-dot" style={{ left: `${(target / scale) * 100}%` }} />
        <span data-testid="hurdle-achieved-dot" data-hurdle="achieved" className={"hurdle-dot " + (goalMet ? "tone-ok" : "tone-bad")} style={{ left: `${(achieved / scale) * 100}%` }} />
      </div>
      <div className="hurdle-labels">
        <span data-testid="hurdle-target-label" className="column-year-label">Target {target.toFixed(2)}%</span>
        <span data-testid="hurdle-margin-label" data-hurdle-mode={solved ? "solved" : "evaluated"} className="column-year-label">{solved ? "solved to the target" : goalMet ? "clears the hurdle" : "below the hurdle"}</span>
        <span data-testid="hurdle-achieved-label" className="column-year-label">Achieved {achieved.toFixed(2)}%</span>
      </div>
    </div>
  );
}
