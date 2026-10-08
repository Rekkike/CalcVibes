import type { GridRow, LineTotal, YearlyRow } from "../../core/src/types.js";

export const CHART_COLORS = {
  costBar: "#fb7185",
  inflowBar: "#34d399",
  cumulative: "#0074ba",
};

export const STAGE_CHART_COLORS = {
  gridline: "rgba(148,163,184,0.16)",
  axisText: "#8ea0b8",
  zeroLine: "rgba(148,163,184,0.45)",
};

export function YearlyChart(props: { yearly: YearlyRow[]; labelFor: (year: number) => string; stage?: boolean }) {
  const { yearly, labelFor, stage = false } = props;
  const W = 780, H = 270, padL = 74, padB = 34;
  const max = Math.max(1, ...yearly.map((y) => Math.max(y.cost, y.inflow)));
  const plotW = W - padL - 16;
  const n = yearly.length;
  const groupW = plotW / Math.max(1, n);
  const barW = Math.min(14, groupW / 3);
  const yFor = (v: number) => H - padB - (v / max) * (H - padB - 20);
  const cumValues = yearly.map((y) => y.cumulative);
  const cumMin = Math.min(...cumValues, 0);
  const cumMax = Math.max(...cumValues, 1);
  const yCum = (v: number) => H - padB - ((v - cumMin) / (cumMax - cumMin)) * (H - padB - 20);
  return (
    <svg data-testid="yearly-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Yearly cost, inflow, and cumulative">
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <line key={f} x1={padL} x2={W - 8} y1={yFor(max * f)} y2={yFor(max * f)} stroke={stage ? STAGE_CHART_COLORS.gridline : "#e5e5ea"} />
      ))}
      <line x1={padL} x2={W - 8} y1={yFor(0)} y2={yFor(0)} stroke={stage ? STAGE_CHART_COLORS.zeroLine : "#343434"} />
      {yearly.map((y, i) => {
        const gx = padL + i * groupW;
        return (
          <g key={y.year}>
            <rect data-chart-bar="cost" x={gx + groupW / 2 - barW - 1} y={yFor(y.cost)} width={barW} height={yFor(0) - yFor(y.cost)} fill={CHART_COLORS.costBar} rx={3} />
            <rect data-chart-bar="inflow" x={gx + groupW / 2 + 1} y={yFor(y.inflow)} width={barW} height={yFor(0) - yFor(y.inflow)} fill={CHART_COLORS.inflowBar} rx={3} />
            <text x={gx + groupW / 2} y={H - 14} fontSize="10" textAnchor="middle" fill={stage ? STAGE_CHART_COLORS.axisText : "#717273"}>{labelFor(y.year)}</text>
          </g>
        );
      })}
      <polyline
        data-chart-line="cumulative"
        points={yearly.map((y, i) => `${padL + i * groupW + groupW / 2},${yCum(y.cumulative)}`).join(" ")}
        fill="none"
        stroke={CHART_COLORS.cumulative}
        strokeWidth={2.5}
      />
      <circle cx={padL + 6} cy={16} r={4} fill={CHART_COLORS.costBar} />
      <text x={padL + 14} y={19} fontSize="10" fill={stage ? STAGE_CHART_COLORS.axisText : "#717273"}>Cost</text>
      <circle cx={padL + 60} cy={16} r={4} fill={CHART_COLORS.inflowBar} />
      <text x={padL + 68} y={19} fontSize="10" fill={stage ? STAGE_CHART_COLORS.axisText : "#717273"}>Inflow</text>
      <circle cx={padL + 118} cy={16} r={4} fill={CHART_COLORS.cumulative} />
      <text x={padL + 126} y={19} fontSize="10" fill={stage ? STAGE_CHART_COLORS.axisText : "#717273"}>Cumulative</text>
    </svg>
  );
}

export function CompositionDonut(props: { lineTotals: LineTotal[]; stage?: boolean }) {
  const { lineTotals } = props;
  const total = Math.max(1e-12, lineTotals.reduce((a, l) => a + l.total, 0));
  const R = 58, SW = 24, C = 80;
  const colors = ["#0074ba", "#34d399", "#fb7185", "#b45309", "#717273", "#103558"];
  let acc = 0;
  return (
    <svg data-testid="composition-donut" viewBox="0 0 160 160" role="img" aria-label="Cost composition">
      {lineTotals.map((l, i) => {
        const frac = l.total / total;
        const start = acc;
        acc += frac;
        const a0 = start * 2 * Math.PI - Math.PI / 2;
        const a1 = acc * 2 * Math.PI - Math.PI / 2;
        const large = frac > 0.5 ? 1 : 0;
        const x1 = C + R * Math.cos(a1), y1 = C + R * Math.sin(a1);
        return (
          <path
            key={l.id}
            data-donut-segment={l.id}
            d={`M ${C + R} ${C} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} L ${(C + (R - SW) * Math.cos(a1)).toFixed(4)} ${(C + (R - SW) * Math.sin(a1)).toFixed(4)} A ${R - SW} ${R - SW} 0 ${large} 0 ${(C + (R - SW) * Math.cos(a0)).toFixed(4)} ${(C + (R - SW) * Math.sin(a0)).toFixed(4)} Z`}
            fill={colors[i % colors.length]}
          />
        );
      })}
    </svg>
  );
}

export function RecoveryBars(props: { collectionsGrid: GridRow[]; years: number; labelFor: (year: number) => string }) {
  const { collectionsGrid, years, labelFor } = props;
  const inflows = new Array<number>(years).fill(0);
  for (const row of collectionsGrid) {
    for (let k = 0; k < Math.min(years, row.amounts.length); k++) inflows[k] += row.amounts[k];
  }
  const W = 780, H = 270, padL = 74, padB = 34;
  const max = Math.max(1, ...inflows);
  const plotW = W - padL - 16;
  const groupW = plotW / Math.max(1, years);
  const barW = Math.min(28, groupW / 2);
  const yFor = (v: number) => H - padB - (v / max) * (H - padB - 20);
  return (
    <svg data-testid="recovery-bars" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Yearly collections">
      {[0, 0.5, 1].map((f) => (
        <line key={f} x1={padL} x2={W - 8} y1={yFor(max * f)} y2={yFor(max * f)} stroke={STAGE_CHART_COLORS.gridline} />
      ))}
      <line x1={padL} x2={W - 8} y1={yFor(0)} y2={yFor(0)} stroke={STAGE_CHART_COLORS.zeroLine} />
      {inflows.map((v, k) => (
        <g key={k}>
          <rect data-chart-bar="collection" x={padL + k * groupW + groupW / 2 - barW / 2} y={yFor(v)} width={barW} height={yFor(0) - yFor(v)} fill={CHART_COLORS.inflowBar} rx={3} />
          <text x={padL + k * groupW + groupW / 2} y={H - 14} fontSize="10" textAnchor="middle" fill={STAGE_CHART_COLORS.axisText}>{labelFor(k + 1)}</text>
        </g>
      ))}
    </svg>
  );
}
