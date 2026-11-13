import type { LineTotal, YearlyRow } from "../../core/src/types.js";
import type { ReactNode } from "react";
import type { DeckFlow, DeckFlowBand, DeckGantt, DeckWaterfall } from "./deck.js";
import { percentOneForDisplay } from "./engine.js";
import { labelEm, wrapLabelEm } from "./ganttLayout.js";

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

// v0.6.18 Task B: each label carries its share of the ring's OWN total, one decimal. The deck passes the
// share composed in the deck model; the workspace ring (no deck model) formats the same fraction the arc
// draws through the same percentOneForDisplay formatter.
export function CompositionDonut(props: {
  lineTotals: (LineTotal & { share?: string })[];
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
    return { id: l.id, name: l.name, total: l.total, frac, d, color: DONUT_COLORS[i % DONUT_COLORS.length], share: l.share ?? percentOneForDisplay(frac) };
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
            <span className="row-name">{a.name} {valueFor(a.total)} <span data-donut-share={a.id} className="donut-share">{a.share}</span></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// v0.6.18 Task H1: the recovery bars draw the deck model's per-year series (the annual basis by default; the monthly
// basis only on request) — nothing is bucketed, nothing is recomputed here. A SHORT span draws a few wide bars
// (each capped in width); a LONG span draws one narrow bar per year in a scrollable grid with the year labels
// thinned to every n-th bar and the peak named once. One bar is named by the period note.
// The peak label is wider than its narrow column: a peak in the first third anchors the label at its column's left edge
// (it spills right over the empty labels), one in the last third at the right edge (it spills left), so the figure is
// never clipped by the scroll grid's edge; a peak in the middle stays centred.
const peakEdge = (k: number, n: number): string => (k < n / 3 ? " peak-start" : k >= (2 * n) / 3 ? " peak-end" : "");
export function RecoveryBars(props: {
  series: { label: string; value: number }[];
  peakFor: (value: number) => string;
  kicker?: string;
  periodNote?: string;
  basis?: "annual" | "monthly";
}) {
  const { series, peakFor, kicker, periodNote, basis = "annual" } = props;
  const max = Math.max(1, ...series.map((d) => d.value));
  const peakIdx = series.findIndex((d) => d.value === Math.max(...series.map((x) => x.value)));
  const labelStep = Math.max(1, Math.ceil(series.length / 12));
  const colMin = basis === "monthly" ? 6 : 26;
  return (
    <div data-testid="recovery-bars" data-basis={basis} className="chart-block">
      {kicker !== undefined && <p data-testid="chart-kicker" className="chart-kicker">{kicker}</p>}
      {periodNote !== undefined && <p data-testid="recovery-period-note" className="muted recovery-period-note">{periodNote}</p>}
      {/* the scrollable grid — the honest-overflow pattern (the app's .editor-scroll), so a long span scrolls
          instead of crowding and the labels never overlap at phone width. */}
      <div data-testid="recovery-scroll" className="recovery-scroll">
        <div className="recovery-grid" style={{ minWidth: `${series.length * colMin}px` }}>
          {series.map((d, k) => (
            <div key={k} data-recovery-column={k} data-bucket-width={1} className="recovery-column">
              <span data-testid="peak-label" className={k === peakIdx && d.value > 0 ? "peak-label" + peakEdge(k, series.length) : "peak-label peak-hidden"}>{k === peakIdx && d.value > 0 ? `${peakFor(d.value)} in ${d.label}` : "\u00a0"}</span>
              <svg viewBox={`0 0 10 ${Math.max(1, Math.round((d.value / max) * 100))}`} preserveAspectRatio="none" aria-hidden="true" className="recovery-bar-svg">
                <rect x={0} y={0} width={10} height={Math.max(1, Math.round((d.value / max) * 100))} fill={CHART_COLORS.inflowBar} rx={2} />
              </svg>
              <span data-testid="bar-year-label" {...(k % labelStep !== 0 ? { "data-thinned": "true" } : {})} className="bar-year-label">{k % labelStep === 0 ? d.label : "\u00a0"}</span>
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
// v0.6.15: the investment waterfall, repaired. The lower section is the classical stepped columns
// at GROUP level (the named groups, the operating segment, the reinvestments when present): with n
// steps the slot is 100/(n+1) percent; step i renders left = i*slot, width = 0.6*slot, bottom =
// cumulative-before, height = its share of the total (the vertical closure geometry of the delivered
// steps). The total is the (n+1)th column: ground-standing (bottom 0, height 100), the same width, in
// the neutral ink; dotted 1 px connectors carry each step top to the next base and the last top to the
// total; the value labels sit directly above the bar tops; the group names sit under the ground line
// (a wrap is permitted, the full name rides in the title attribute, no ellipsis, no key). Rendered
// from the deck model; nothing is recomputed here.
export function CostWaterfall(props: { waterfall: DeckWaterfall }) {
  const { columns } = props.waterfall;
  const n = columns.length;
  const slot = 100 / Math.max(1, n);
  const steps = columns.filter((c) => c.kind !== "total");
  const total = columns[n - 1];
  return (
    <div data-testid="cost-waterfall" className="chart-block">
      <div className="waterfall-track">
        {steps.map((c, i) => (
          <div key={c.id} data-waterfall-segment={c.id} data-waterfall-kind={c.kind} data-waterfall-step={i} className={"waterfall-segment" + (c.kind === "capital" ? "" : " waterfall-segment-" + c.kind)} style={{ bottom: `${c.bottomPct}%`, height: `${c.heightPct}%`, left: `${i * slot}%`, width: `${0.6 * slot}%` }} />
        ))}
        <div data-waterfall-total="true" data-waterfall-kind="total" data-waterfall-step={steps.length} className="waterfall-total-column" style={{ bottom: "0%", height: "100%", left: `${steps.length * slot}%`, width: `${0.6 * slot}%` }} />
        {steps.map((c, i) => (
          <span key={"conn-" + c.id} data-waterfall-connector={c.id} className="waterfall-connector" style={{ bottom: `${c.bottomPct + c.heightPct}%`, left: `${i * slot + 0.6 * slot}%`, width: `${0.4 * slot}%` }} />
        ))}
        {steps.map((c, i) => (
          <span key={"val-" + c.id} data-testid="waterfall-label" data-waterfall-kind={c.kind} className="waterfall-label waterfall-value" style={{ bottom: `calc(${c.bottomPct + c.heightPct}% + 4px)`, left: `${i * slot}%`, width: `${0.6 * slot}%` }}>{c.value}</span>
        ))}
        <span data-testid="waterfall-total-label" data-waterfall-kind="total" className="waterfall-label waterfall-value" style={{ bottom: "calc(100% + 4px)", left: `${steps.length * slot}%`, width: `${slot}%` }}>{total.name} {total.value}</span>
      </div>
      <div data-waterfall-ground="true" className="waterfall-ground" />
      <div className="waterfall-names">
        {columns.map((c) => (
          <span key={c.id} data-waterfall-name={c.id} title={c.name} className="waterfall-name" style={{ width: `${slot}%` }}>{c.name}</span>
        ))}
      </div>
    </div>
  );
}

// v0.6.15: the ledger waterfall (the upper section) at the individual-line level. Each capital cost
// line is a row: its FULL name (no truncation, no key), a bar floating on the shared left-baseline
// scale at its cumulative position (percent left and width), the value at the bar's end (never
// inside a bar), and the line's share of the TOTAL program cost, muted, at the row end (the one
// full-outflow basis of the slide). The capital subtotal is a hairline row with a tick at the capital
// position; the operating row is the hatched segment; the total is a full-width neutral bar at
// heavier weight; a thin hairline connector carries each bar's end to the next row, and the closure
// edge (the 100 percent line) runs through every row. HTML rows: real text at every width.
export function LedgerWaterfall(props: { waterfall: DeckWaterfall; kicker?: string }) {
  const { rows } = props.waterfall;
  return (
    <div data-testid="ledger-waterfall" className="chart-block ledger">
      {props.kicker !== undefined && <p data-testid="chart-kicker" className="chart-kicker">{props.kicker}</p>}
      {rows.map((r) => (
        <div key={r.id} data-ledger-row={r.id} data-ledger-kind={r.kind} className={"ledger-row ledger-row-" + r.kind}>
          <span data-ledger-label="name" className="ledger-name">{r.name}</span>
          <div className="ledger-track">
            <div data-ledger-edge="true" className="ledger-scale">
              <span data-ledger-bar={r.id} data-ledger-kind={r.kind} className={"ledger-bar ledger-bar-" + r.kind} style={{ left: `${r.startPct}%`, width: `${r.widthPct}%` }} />
              <span data-ledger-value="true" className="ledger-value" style={{ left: `calc(${r.startPct + r.widthPct}% + 6px)` }}>{r.value}</span>
              {r.kind !== "total" && (
                <span data-ledger-connector={r.id} className="ledger-connector" style={{ left: `${r.startPct + r.widthPct}%` }} />
              )}
            </div>
          </div>
          <span data-ledger-share="true" className="ledger-share">{r.share}</span>
        </div>
      ))}
    </div>
  );
}

export function HurdlePlot(props: {
  target: number;
  achieved: number;
  // v0.6.18 (AUD-10): the achieved IRR is null (no solution): no dot, the dash reads
  achievedMissing?: boolean;
  goalMet: boolean;
  solved?: boolean;
}) {
  const { target, achieved, goalMet, solved = false, achievedMissing = false } = props;
  const bound = Math.max(target, achieved) * 1.15;
  const scale = Math.max(1e-12, bound);
  return (
    <div data-testid="hurdle-plot" className="chart-block">
      <div className="hurdle-track">
        <span data-testid="hurdle-target-dot" data-hurdle="target" className="hurdle-dot" style={{ left: `${(target / scale) * 100}%` }} />
        {!achievedMissing && <span data-testid="hurdle-achieved-dot" data-hurdle="achieved" className={"hurdle-dot " + (goalMet ? "tone-ok" : "tone-bad")} style={{ left: `${(achieved / scale) * 100}%` }} />}
      </div>
      <div className="hurdle-labels">
        <span data-testid="hurdle-target-label" className="column-year-label">Target {target.toFixed(2)}%</span>
        <span data-testid="hurdle-margin-label" data-hurdle-mode={solved ? "solved" : "evaluated"} className="column-year-label">{solved ? "solved to the target" : achievedMissing ? "no achieved rate" : goalMet ? "clears the hurdle" : "below the hurdle"}</span>
        <span data-testid="hurdle-achieved-label" className="column-year-label">Achieved {achievedMissing ? "—" : `${achieved.toFixed(2)}%`}</span>
      </div>
    </div>
  );
}

// v0.6.13: the program Gantt (the deck grammar of record — SVG authored in code, no external chart
// library, direct labels, no free-form text). The three phases are horizontal lanes; activities
// are bars within their lane; decision points are full-height vertical gate lines labeled with
// their DP codes; milestones are diamonds each numbered with its composed ordinal; the axis is the shared yearHeader labels. It renders
// the deck model's gantt, never recomputing it.
export const GANTT_SVG = { labelW: 150, plotW: 840, top: 34, rowPad: 6, barH: 18, lineH: 13, barInset: 1.5 };
// The height of one sub-row: the padding, the reserved above-label lines and the bar.
const svgRowH = (lines: number) => GANTT_SVG.rowPad + (lines > 0 ? lines * GANTT_SVG.lineH + 3 : 0) + GANTT_SVG.barH;
// The height of a lane: its stacked sub-rows, never less than its own wrapped label needs.
export const ganttLaneHeight = (lane: DeckGantt["lanes"][number]): number =>
  Math.max(lane.rowLines.reduce((a, l) => a + svgRowH(l), 0) + GANTT_SVG.rowPad, lane.labelLines.length * 15 + 14);

// v0.6.17: the height of one gate-label row
const GATE_ROW_H = 14;
export function GanttChart(props: { gantt: DeckGantt }) {
  const { gantt } = props;
  const { labelW, plotW, top, rowPad, barH, lineH, barInset } = GANTT_SVG;
  const first = gantt.window.firstYear;
  const n = Math.max(1, gantt.window.lastYear - first + 1);
  const colW = plotW / n;
  const xStart = (y: number) => labelW + (y - first) * colW;
  const xMid = (y: number) => labelW + (y - first + 0.5) * colW;
  // v0.6.17: the composed sub-year position of a marker (year columns from the window start)
  const xAt = (pos: number) => labelW + pos * colW;
  const laneTops: number[] = [];
  let cursor = top;
  for (const lane of gantt.lanes) {
    laneTops.push(cursor);
    cursor += ganttLaneHeight(lane);
  }
  const lanesBottom = cursor;
  // v0.6.13.4: a milestone row (one per same-year stack position) is 30 units tall: the diamond, then its
  // ordinal centered beneath it. With no milestone the height stands as before.
  const milestoneRows = gantt.milestones.reduce((a, m) => Math.max(a, m.row + 1), 0);
  // v0.6.17: gate labels stacked on extra rows (the same-year relief) push the milestone area down
  const gateShift = Math.max(0, gantt.gateRows - 1) * GATE_ROW_H;
  const height = (milestoneRows === 0 ? lanesBottom + 44 : lanesBottom + 34 + (milestoneRows - 1) * 30 + 26) + gateShift;
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
        {gantt.monthGrid !== undefined && gantt.monthGrid.map((p) => (
          <line key={p} data-gantt-month-grid={p} x1={xAt(p)} x2={xAt(p)} y1={top} y2={lanesBottom} stroke={STAGE_CHART_COLORS.gridline} strokeOpacity={0.9} strokeDasharray="2 3" />
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
                const bx = xAt(b.left) + barInset;
                const bw = (b.right - b.left) * colW - 2 * barInset;
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
            <line x1={xAt(g.pos)} x2={xAt(g.pos)} y1={top - 6} y2={lanesBottom + 6 + g.row * GATE_ROW_H} stroke={STAGE_GOLD} strokeWidth={2} />
            <text x={xAt(g.pos)} y={lanesBottom + 20 + g.row * GATE_ROW_H} textAnchor="middle" fontSize={12} fill={STAGE_GOLD}>{g.code ?? "Gate"}</text>
          </g>
        ))}
        {gantt.milestones.map((m) => {
          const cx = xAt(m.pos);
          const cy = lanesBottom + 34 + gateShift + m.row * 30;
          return (
            <g key={m.id} data-gantt-milestone={m.id} data-milestone-ordinal={m.ordinal}>
              <polygon points={`${cx},${cy - 7} ${cx + 7},${cy} ${cx},${cy + 7} ${cx - 7},${cy}`} fill="#34d399" />
              <text data-gantt-milestone-number={m.ordinal} x={cx} y={cy + 19} textAnchor="middle" fontSize={12} fontWeight={700} fill={STAGE_CHART_COLORS.axisText}>{m.ordinal}</text>
              <title>{m.tooltip}</title>
            </g>
          );
        })}
      </svg>
      {gantt.caption !== null && <p data-testid="gantt-caption" className="muted">{gantt.caption}</p>}
    </div>
  );
}

// v0.6.22 Task B — the flow slide's two renderers. Geometry in SVG on one shared zero-based scale
// (the deck model composes the percents; nothing financial is recomputed here). v0.6.22.1 Task A —
// the direct-label seating: every band segment's name and value seat with its band as SVG text (the
// Gantt labelMode precedent; one label vocabulary on this surface), inside the band box when the
// rendered segment height admits the text at the established size, otherwise in the fixed-width
// label column directly beside its band — the income labels left of the income band, the use labels
// right of the use band, outside the ribbon space so a label never collides with a connector — each
// label vertically aligned to its segment through the same yAt/hAt mapping that draws the geometry.
// The two-band connected composition: the income band on the left, the use band on the right,
// truthful widths, ribbons only for nonzero flows; a signed (negative) equity band and its label
// render in the bad tone. The whole figure is one SVG block, centered in its container.
export const FLOW_BAND_COLORS = ["#38bdf8", "#34d399", "#e8b84b", "#c4b5fd", "#fb7185", "#22d3ee", "#a3e635", "#f0abfc"];

// The flow figure's geometry constants (exported for the pins). The plot mapping is unchanged from
// v0.6.22 (top, plotH, one shared zero-based scale); the frame stays symmetric — equal band widths,
// equal gutters. The fixed-width label column is the Gantt's labelW of record; the ribbon space is
// the gap between the band boxes the labels never enter. The established label size is the Gantt's
// 11 px inside-label; ONE admission rule for both bands: a segment admits its label inside the band
// box when its rendered height hAt(heightPct) is at least labelMinH — an 11 px line with the Gantt's
// +4 baseline offset and its descent needs h/2 + 4 + 3 <= h, i.e. h >= 14.
export const FLOW_BANDS_GEO = {
  top: 24,
  plotH: 360,
  bottomPad: 12,
  labelColW: 150,
  ribbonW: 240,
  bandMinW: 56,
  bandInset: 5,
  labelGap: 10,
  labelFont: 11,
  labelMinH: 14,
  lineH: 13,
} as const;

export function FlowBands(props: { flow: DeckFlow }) {
  const { flow } = props;
  const G = FLOW_BANDS_GEO;
  const allBands = [...flow.incomeBands, ...flow.useBands];
  // The band box is sized to the widest label line, measured per the Gantt's labelEm discipline (the
  // Helvetica advances scale with the type size): every label fits inside its band box on one line
  // at the established size, so the inside seating never overflows the band box.
  const bandW = Math.max(G.bandMinW, ...allBands.map((b) => Math.ceil(labelEm(`${b.label} ${b.value}`) * G.labelFont) + 2 * G.bandInset));
  const W = 2 * G.labelColW + 2 * bandW + G.ribbonW;
  const top = G.top;
  const plotH = G.plotH;
  const xLeft = G.labelColW;
  const xRight = W - G.labelColW - bandW;
  const yAt = (pct: number) => top + (pct / 100) * plotH;
  const hAt = (pct: number) => (pct / 100) * plotH;
  const midY = (b: DeckFlowBand) => yAt(b.topPct) + hAt(b.heightPct) / 2;
  const admitsInside = (b: DeckFlowBand) => hAt(b.heightPct) >= G.labelMinH;
  const labelText = (b: DeckFlowBand) => `${b.label} ${b.value}`;
  // One label renderer for both bands: inside the band box when the segment height admits the text,
  // otherwise the beside label column, vertically aligned to the segment through midY.
  const renderLabel = (b: DeckFlowBand, side: "income" | "use") => {
    const bad = b.signed && b.raw < 0;
    const inside = admitsInside(b);
    const mode = inside ? "inside" : "beside";
    const testid = side === "income" ? "data-flow-income-label" : "data-flow-use-label";
    const cls = "flow-label " + (inside ? "flow-label-inside" : "flow-label-beside") + (bad ? " flow-label-bad" : "");
    const group = (children: ReactNode) => (
      <g key={b.key} {...{ [testid]: b.key }} data-side={side} data-label-mode={mode} data-signed={b.signed ? "true" : "false"} className={"flow-label-group" + (bad ? " flow-label-bad" : "")}>
        {children}
      </g>
    );
    if (inside) {
      const cx = side === "income" ? xLeft + bandW / 2 : xRight + bandW / 2;
      return group(
        <text data-flow-label-line="0" x={cx} y={midY(b) + 4} textAnchor="middle" fontSize={G.labelFont} className={cls}>{labelText(b)}</text>
      );
    }
    const lines = wrapLabelEm(labelText(b), (G.labelColW - 12) / G.labelFont);
    const x = side === "income" ? xLeft - G.labelGap : xRight + bandW + G.labelGap;
    const anchor = side === "income" ? "end" : "start";
    const firstY = midY(b) - ((lines.length - 1) * G.lineH) / 2 + 4;
    return group(
      lines.map((line, k) => (
        <text key={k} data-flow-label-line={String(k)} x={x} y={firstY + k * G.lineH} textAnchor={anchor} fontSize={G.labelFont} className={cls}>{line}</text>
      ))
    );
  };
  return (
    <div data-testid="flow-bands" data-form="bands" className="chart-block flow-chart">
      <svg viewBox={`0 0 ${W} ${top + plotH + G.bottomPad}`} className="flow-svg" role="img" aria-label="What the collections pay for">
        {flow.connectors.map((c) => {
          const si = flow.incomeBands.findIndex((b) => b.key === c.sourceKey);
          const color = FLOW_BAND_COLORS[((si % FLOW_BAND_COLORS.length) + FLOW_BAND_COLORS.length) % FLOW_BAND_COLORS.length];
          const sx1 = xLeft + bandW;
          const sy1 = yAt(c.sourceTopPct);
          const sy2 = sy1 + hAt(c.sourceHeightPct);
          const ux1 = xRight;
          const uy1 = yAt(c.useTopPct);
          const uy2 = uy1 + hAt(c.useHeightPct);
          const mx = (sx1 + ux1) / 2;
          return (
            <path
              key={`${c.sourceKey}->${c.useKey}`}
              data-flow-connector={`${c.sourceKey}->${c.useKey}`}
              d={`M ${sx1} ${sy1} C ${mx} ${sy1}, ${mx} ${uy1}, ${ux1} ${uy1} L ${ux1} ${uy2} C ${mx} ${uy2}, ${mx} ${sy2}, ${sx1} ${sy2} Z`}
              fill={color}
              className="flow-connector"
            >
              <title>{`${c.sourceKey} \u2192 ${c.useKey}: ${c.value}`}</title>
            </path>
          );
        })}
        {flow.incomeBands.map((b, i) => (
          <rect
            key={b.key}
            data-flow-income-band={b.key}
            data-band-count={b.count}
            x={xLeft}
            y={yAt(b.topPct)}
            width={bandW}
            height={Math.max(0.5, hAt(b.heightPct))}
            fill={FLOW_BAND_COLORS[i % FLOW_BAND_COLORS.length]}
            className="flow-band flow-band-income"
          >
            <title>{`${b.label}: ${b.value}`}</title>
          </rect>
        ))}
        {flow.useBands.map((b, i) => (
          <rect
            key={b.key}
            data-flow-use-band={b.key}
            data-signed={b.signed ? "true" : "false"}
            x={xRight}
            y={yAt(b.topPct)}
            width={bandW}
            height={Math.max(0.5, hAt(b.heightPct))}
            className={"flow-band flow-band-use" + (b.signed && b.raw < 0 ? " flow-band-bad" : "")}
            fill={b.signed && b.raw < 0 ? "#fb7185" : FLOW_BAND_COLORS[i % FLOW_BAND_COLORS.length]}
          >
            <title>{`${b.label}: ${b.value}`}</title>
          </rect>
        ))}
        {flow.incomeBands.map((b) => renderLabel(b, "income"))}
        {flow.useBands.map((b) => renderLabel(b, "use"))}
      </svg>
    </div>
  );
}

// v0.6.22 Task B — the sequential bridge, the degradation form of the flow slide: six fixed steps
// (collections in, debt service out, operating out, reinvestment out, capital out, the remainder),
// zero-based on the income scale, the signed remainder drawn below the ground in the bad tone when
// negative. HTML stepped columns on the deck model's composed percents, like the cost waterfall.
export function FlowBridge(props: { flow: import("./deck.js").DeckFlow }) {
  const { flow } = props;
  const steps = flow.bridge;
  const n = steps.length;
  const slot = 100 / n;
  return (
    <div data-testid="flow-bridge" data-form="bridge" className="chart-block flow-bridge">
      <div className="waterfall-track flow-bridge-track">
        {steps.map((s, i) => (
          <div
            key={s.id}
            data-flow-step={s.id}
            data-flow-kind={s.kind}
            className={"flow-step flow-step-" + s.kind + (s.kind === "remainder" && s.raw < 0 ? " flow-step-bad" : "")}
            style={{ bottom: `${s.bottomPct}%`, height: `${Math.max(0.4, s.heightPct)}%`, left: `${i * slot}%`, width: `${0.6 * slot}%` }}
          />
        ))}
      </div>
      <div data-flow-ground="true" className="waterfall-ground" />
      <div className="waterfall-names">
        {steps.map((s, i) => (
          <span key={s.id} data-flow-step-name={s.id} className="waterfall-name" style={{ width: `${slot}%` }} title={`${s.label} ${s.value}`}>
            {s.label} <span className={"flow-step-value" + (s.kind === "remainder" && s.raw < 0 ? " tone-bad" : "")}>{s.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
