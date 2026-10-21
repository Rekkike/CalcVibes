import type { GridRow, LineTotal, YearlyRow } from "../../core/src/types.js";
import type { DeckGantt } from "./deck.js";

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
  // v0.6.9 Task H (finding W30): the stage accent — 8.01:1 on the always-dark stage
  // (#081c33), computed with the WCAG relative-luminance formula. The app keeps #0074ba
  // on its card surfaces (4.99:1 against white); the deck chart surfaces consume the stage accent.
  accent: "#38bdf8",
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
  accent?: string;
}) {
  const { lineTotals, valueFor, kicker, accent } = props;
  const barFill = accent ?? CHART_COLORS.accentBar;
  const total = Math.max(1e-12, lineTotals.reduce((a, l) => a + l.total, 0));
  const rows = lineTotals.map((l) => ({ ...l, sharePct: l.total / total }));
  return (
    <div data-testid="composition-rows" className="chart-block">
      {kicker !== undefined && <p data-testid="chart-kicker" className="chart-kicker">{kicker}</p>}
      {rows.map((r) => (
        <div key={r.id} data-composition-row={r.id} className="composition-row">
          <span data-row-label="name" className="row-name">{r.name}</span>
          {/* v0.6.9 Task E (finding W27): the share renders at one decimal — the integer form's
              accumulation to 101 percent on the port was the finding. v0.6.10 (disclosed): on
              the shore-power program fixture the one-decimal shares sum to 100.1 (16.5+24.5+
              22.3+27.8+4.5+4.5); the one-decimal rounding residue is honest and disclosed,
              never smoothed or re-weighted. */}
          <span data-row-label="share" className="row-share">{(Math.round(r.sharePct * 1000) / 10).toFixed(1)}%</span>
          <div className="row-bar-track">
            <svg viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true" className="row-bar-svg">
              <rect x={0} y={0} width={100 * r.sharePct} height={8} fill={barFill} rx={2} />
            </svg>
          </div>
          <span data-row-label="value" className="row-value">{valueFor(r.total)}</span>
        </div>
      ))}
    </div>
  );
}

// v0.6.8 Task G (finding W23): the scenarios comparison chart — zero-based comparison bars with
// direct labels (the parameter label and the payment value), no composition-share column. It
// reuses the established chart vocabulary (the scenario target bars class); no chart library.
export function ScenarioComparisonBars(props: {
  data: { label: string; value: number }[];
  valueFor: (v: number) => string;
  kicker?: string;
}) {
  const { data, valueFor, kicker } = props;
  const max = Math.max(1e-12, ...data.map((d) => Math.abs(d.value)));
  return (
    <div data-testid="scenario-comparison-chart" className="chart-block scenario-comparison-chart">
      {kicker !== undefined && <p data-testid="chart-kicker" className="chart-kicker">{kicker}</p>}
      {data.map((d) => (
        <div key={d.label} data-scenario-comparison-row={d.label} className="scenario-comparison-row">
          <span data-scenario-label={d.label} className="row-name">{d.label}</span>
          <div className="row-bar-track">
            <svg viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true" className="row-bar-svg">
              {/* v0.6.9 Task H (finding W30): the deck-only comparison bars consume the stage accent
                  (8.01:1 on the stage); the app keeps #0074ba on its card surfaces. */}
              <rect x={0} y={0} width={100 * (Math.abs(d.value) / max)} height={8} fill={STAGE_CHART_COLORS.accent} rx={2} />
            </svg>
          </div>
          <span data-scenario-value={d.label} className="row-value">{valueFor(d.value)}</span>
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
  // v0.6.8 Task C (finding W22): when the bucket width is greater than 1, the range label renders
  // only on every ceil(bucketCount / 8)th column; the thinned columns render an empty label with
  // data-thinned="true". At width 1 the yearly label set is the designed shape and is unchanged.
  const thinStep = width > 1 ? Math.ceil(inflows.length / 8) : 1;
  return (
    <div data-testid="recovery-bars" className="chart-block">
      {kicker !== undefined && <p data-testid="chart-kicker" className="chart-kicker">{kicker}</p>}
      {/* v0.6.9 Task B (finding W26): the scrollable bucket grid — the honest-overflow pattern
          (the app's .editor-scroll) so the axis labels never overlap at phone width. */}
      <div data-testid="recovery-scroll" className="recovery-scroll">
        <div className="recovery-grid">
          {inflows.map((v, k) => (
            <div key={k} data-recovery-column={k} data-bucket-width={width} className="recovery-column">
              <span data-testid="peak-label" className={k === peakIdx && v > 0 ? "peak-label" : "peak-label peak-hidden"}>{k === peakIdx && v > 0 ? (width === 1 ? `${peakFor(v)} in ${labelFor(k * width + 1)}` : `${peakFor(v)} in ${labelFor(k * width + 1)}\u2013${labelFor(Math.min(years, (k + 1) * width))}`) : "\u00a0"}</span>
              <svg viewBox={`0 0 10 ${Math.max(1, Math.round((v / max) * 100))}`} preserveAspectRatio="none" aria-hidden="true" className="recovery-bar-svg">
                <rect x={0} y={0} width={10} height={Math.max(1, Math.round((v / max) * 100))} fill={CHART_COLORS.inflowBar} rx={2} />
              </svg>
              <span data-testid="bar-year-label" {...(width > 1 && k % thinStep !== 0 ? { "data-thinned": "true" } : {})} className="bar-year-label">{width === 1 ? labelFor(k + 1) : (k % thinStep === 0 ? `${labelFor(k * width + 1)}\u2013${labelFor(Math.min(years, (k + 1) * width))}` : "\u00a0")}</span>
            </div>
          ))}
        </div>
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

export interface WaterfallSegment {
  id: string;
  name: string;
  total: number;
  kind: "capital" | "operating" | "reinvestments";
}

// v0.6.8 Task A (finding W18): the honest cost waterfall. The props are a general segment list —
// the capital lines, then the operating segment, then the reinvestments segment when present — and
// the build closes exactly at the cap (totalCost). The operating and reinvestments segments carry a
// visually distinct class so the investment basis and the operating basis are never conflated.
// v0.6.9 Task A (finding W26): the classical stepped waterfall — with n segments the slot is
// 100/n percent; segment i renders left = i*slot, width = 0.6*slot (a floating step), gaining
// data-waterfall-step; the vertical extents are unchanged (bottom = cumulative-before, height =
// segment share of the cap) so the closure pins survive verbatim; the cap spans the full track.
export function CostWaterfall(props: { segments: WaterfallSegment[]; total: number; valueFor: (v: number) => string; }) {
  const { segments, total, valueFor } = props;
  const cap = Math.max(1e-12, total);
  const n = Math.max(1, segments.length);
  const slot = 100 / n;
  let acc = 0;
  return (
    <div data-testid="cost-waterfall" className="chart-block">
      <div className="waterfall-track">
        {segments.map((s, i) => {
          const frac = s.total / cap;
          const seg = (
            <div key={s.id} data-waterfall-segment={s.id} data-waterfall-kind={s.kind} data-waterfall-step={i} className={"waterfall-segment" + (s.kind === "capital" ? "" : " waterfall-segment-" + s.kind)} style={{ bottom: `${(acc / cap) * 100}%`, height: `${frac * 100}%`, left: `${i * slot}%`, width: `${0.6 * slot}%` }}>
            </div>
          );
          acc += s.total;
          return seg;
        })}
        {/* v0.6.10 Task E.4 (W31): the closing total bar — the cap renders as a labeled total
            element carrying data-waterfall-total; the label list gains the closing entry with
            the totalCost value. The closure identity and the 100.0 percent fill pins stand
            verbatim; the geometry is unchanged. */}
        <div data-testid="waterfall-cap" data-waterfall-total="true" className="waterfall-cap" style={{ bottom: "100%", width: "100%", height: "4px" }} />
      </div>
      <ul className="waterfall-label-list">
        {segments.map((s) => (
          <li key={s.id} data-testid="waterfall-label" data-waterfall-kind={s.kind} className="waterfall-label">{s.name} {valueFor(s.total)}</li>
        ))}
        <li data-testid="waterfall-total-label" data-waterfall-kind="total" className="waterfall-label">Total program cost {valueFor(total)}</li>
      </ul>
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

// v0.6.13: the program Gantt (the deck grammar of record — SVG authored in code, no external chart
// library, direct labels, no free-form text). The three phases are horizontal lanes; activities
// are bars within their lane; decision points are full-height vertical gate lines labeled with
// their BP codes; milestones are diamonds; the axis is the shared yearHeader labels. It renders
// the deck model's gantt, never recomputing it.
export const GANTT_SVG = { labelW: 150, plotW: 840, top: 34, rowPad: 6, barH: 18, lineH: 13, barInset: 1.5 };
// The height of one sub-row: the padding, the reserved above-label lines and the bar.
const svgRowH = (lines: number) => GANTT_SVG.rowPad + (lines > 0 ? lines * GANTT_SVG.lineH + 3 : 0) + GANTT_SVG.barH;
// The height of a lane: its stacked sub-rows, never less than its own wrapped label needs.
export const ganttLaneHeight = (lane: DeckGantt["lanes"][number]): number =>
  Math.max(lane.rowLines.reduce((a, l) => a + svgRowH(l), 0) + GANTT_SVG.rowPad, lane.labelLines.length * 15 + 14);

export function GanttChart(props: { gantt: DeckGantt }) {
  const { gantt } = props;
  const { labelW, plotW, top, rowPad, barH, lineH, barInset } = GANTT_SVG;
  const first = gantt.window.firstYear;
  const n = Math.max(1, gantt.window.lastYear - first + 1);
  const colW = plotW / n;
  const xStart = (y: number) => labelW + (y - first) * colW;
  const xMid = (y: number) => labelW + (y - first + 0.5) * colW;
  const laneTops: number[] = [];
  let cursor = top;
  for (const lane of gantt.lanes) {
    laneTops.push(cursor);
    cursor += ganttLaneHeight(lane);
  }
  const lanesBottom = cursor;
  const height = lanesBottom + 44;
  const step = Math.max(1, Math.ceil(n / 12));
  return (
    <div data-testid="gantt-chart" className="chart-block gantt-chart">
      <svg viewBox={`0 0 ${labelW + plotW + 10} ${height}`} role="img" aria-label="Program timeline" className="gantt-svg">
        {gantt.axis.map((a) => (
          <g key={a.year}>
            <line x1={xStart(a.year)} x2={xStart(a.year)} y1={top} y2={lanesBottom} stroke={STAGE_CHART_COLORS.gridline} />
            {(a.year - first) % step === 0 && (
              <text data-gantt-axis={a.year} x={xMid(a.year)} y={top - 10} textAnchor="middle" fontSize={12} fill={STAGE_CHART_COLORS.axisText}>{a.label}</text>
            )}
          </g>
        ))}
        <line x1={xStart(first + n)} x2={xStart(first + n)} y1={top} y2={lanesBottom} stroke={STAGE_CHART_COLORS.gridline} />
        {gantt.lanes.map((lane, i) => {
          const laneTop = laneTops[i];
          const laneH = ganttLaneHeight(lane);
          const rowTops: number[] = [];
          let rc = laneTop + rowPad;
          lane.rowLines.forEach((l) => { rowTops.push(rc); rc += svgRowH(l); });
          return (
            <g key={lane.phase} data-gantt-lane={lane.phase} data-lane-rows={lane.rowCount}>
              <line x1={labelW} x2={labelW + plotW} y1={laneTop} y2={laneTop} stroke={STAGE_CHART_COLORS.zeroLine} />
              {lane.labelLines.map((line, k) => (
                <text key={k} data-gantt-lane-label={lane.phase} x={labelW - 10} y={laneTop + laneH / 2 - ((lane.labelLines.length - 1) * 15) / 2 + 4 + k * 15} textAnchor="end" fontSize={13} fill={STAGE_CHART_COLORS.axisText}>{line}</text>
              ))}
              {lane.bars.map((b) => {
                const rowTop = rowTops[b.row];
                const band = lane.rowLines[b.row] > 0 ? lane.rowLines[b.row] * lineH + 3 : 0;
                const bx = xStart(b.startYear) + barInset;
                const bw = (b.endYear - b.startYear + 1) * colW - 2 * barInset;
                const by = rowTop + band;
                return (
                  <g key={b.id} data-gantt-bar={b.id} data-row={b.row} data-label-mode={b.labelMode}>
                    <rect x={bx} y={by} width={bw} height={barH} rx={3} fill={STAGE_CHART_COLORS.accent} />
                    {b.labelMode === "inside" ? (
                      <text data-gantt-label={b.id} x={bx + 5} y={by + barH / 2 + 4} fontSize={11} fill="#081c33">{b.label}</text>
                    ) : (
                      b.lines.map((line, k) => (
                        <text key={k} data-gantt-label={b.id} x={labelW + b.labelLeft * colW} y={rowTop + 11 + k * lineH} fontSize={11} fill={STAGE_CHART_COLORS.axisText}>{line}</text>
                      ))
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}
        <line x1={labelW} x2={labelW + plotW} y1={lanesBottom} y2={lanesBottom} stroke={STAGE_CHART_COLORS.zeroLine} />
        {gantt.gates.map((g) => (
          <g key={g.id} data-gantt-gate={g.id} data-gate-code={g.code ?? ""}>
            <line x1={xMid(g.year)} x2={xMid(g.year)} y1={top - 6} y2={lanesBottom + 6} stroke={STAGE_GOLD} strokeWidth={2} />
            <text x={xMid(g.year)} y={lanesBottom + 20} textAnchor="middle" fontSize={12} fill={STAGE_GOLD}>{g.code ?? "Gate"}</text>
          </g>
        ))}
        {gantt.milestones.map((m) => {
          const cx = xMid(m.year);
          const cy = lanesBottom + 34;
          return (
            <g key={m.id} data-gantt-milestone={m.id}>
              <polygon points={`${cx},${cy - 7} ${cx + 7},${cy} ${cx},${cy + 7} ${cx - 7},${cy}`} fill="#34d399" />
              <title>{m.label}</title>
            </g>
          );
        })}
      </svg>
      {gantt.caption !== null && <p data-testid="gantt-caption" className="muted">{gantt.caption}</p>}
    </div>
  );
}
