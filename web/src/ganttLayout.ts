// v0.6.13.2 Task C and Addenda 1 and 2: the adaptive Gantt, composed ONCE. The year window, the
// stacked sub-row assignment and the label placement are pure helpers consumed by the deck model
// (deck.ts ganttSlide); the section-free renderers (the Presentation SVG and the PDF) draw what the
// deck model carries and never recompute it — one story, one source.

// The shared label-width budget: the number of label characters that fit across the whole plot on
// every surface. The SVG plot is 840 px at 11 px type (about 147 characters) and the print plot is
// 225 mm at 6 pt type (about 190); the budget is the conservative figure, so a label composed to
// fit here fits on both.
export const GANTT_CHARS_ACROSS_PLOT = 110;
// A label placed above its bar wraps at this share of the plot width.
export const GANTT_LABEL_WRAP_SHARE = 0.45;
// A lane label wraps at this many characters (the lane label column is narrow on both surfaces).
export const GANTT_LANE_LABEL_CHARS = 16;

export interface GanttWindow {
  firstYear: number;
  lastYear: number;
  years: number;
  // true when the window is narrower than the program span
  narrowed: boolean;
}

// The adaptive year window (Addendum 2): the minimum start year to the maximum end year across the
// VISIBLE activities; with none, the program span (the degenerate guard — never a contentless axis).
// v0.6.18 Task F: an optional EXTENSION the user confirmed (the out-of-window milestone guard) widens the window
// beyond the activities' extent; it never narrows it and is clamped to the program span.
export interface GanttWindowExtension { firstYear?: number; lastYear?: number }
export function ganttWindow(visible: { startYear: number; endYear: number }[], spanYears: number, extension?: GanttWindowExtension): GanttWindow {
  const span = Math.max(1, spanYears);
  if (visible.length === 0) return { firstYear: 1, lastYear: span, years: span, narrowed: false };
  const firstYear = Math.max(1, Math.min(...visible.map((a) => a.startYear), extension?.firstYear ?? Infinity));
  const lastYear = Math.min(span, Math.max(...visible.map((a) => a.endYear), extension?.lastYear ?? -Infinity));
  if (lastYear < firstYear) return { firstYear: 1, lastYear: span, years: span, narrowed: false };
  const years = lastYear - firstYear + 1;
  return { firstYear, lastYear, years, narrowed: years < span };
}

// v0.6.17 — the sub-year positions, composed ONCE here (the month fields are positions, never money and
// never time value). A start bound opens at its month's opening, (month - 1) / 12; an end bound closes
// at its month's closing, month / 12; an absent start composes at the year's left edge (0) and an absent
// end at the year's right edge (1), so the year-grained rendering survives exactly. A marker (a gate or a
// milestone) stands at the year band's centre when it carries no month and at the centre of its month
// otherwise. All positions are in year columns from the window's left edge; the axis stays year-labeled.
export const monthOpening = (month?: number): number => (month === undefined ? 0 : (month - 1) / 12);
export const monthClosing = (month?: number): number => (month === undefined ? 1 : month / 12);
export function barPosition(win: { firstYear: number }, a: { startYear: number; endYear: number; startMonth?: number; endMonth?: number }): { left: number; right: number } {
  return { left: a.startYear - win.firstYear + monthOpening(a.startMonth), right: a.endYear - win.firstYear + monthClosing(a.endMonth) };
}
export function markerPosition(win: { firstYear: number }, year: number, month?: number): number {
  return year - win.firstYear + (month === undefined ? 0.5 : (month - 0.5) / 12);
}

// The gate-label stacking (the same-year overlap retirement): gates sharing a year band take label rows
// by proximity — greedy first-fit by position, a label spanning its text width centred on the gate line —
// so two gates differing by month stand at distinct positions and gates that still collide (the same
// month, or months too close for their labels) stack on successive rows. A gate alone in its year keeps
// row 0. No refusal: the stacking is the discipline.
export function layoutGateLabels(gates: { id: string; code: string | null; year: number; month?: number }[], win: GanttWindow): { id: string; pos: number; row: number }[] {
  const perChar = win.years / GANTT_CHARS_ACROSS_PLOT;
  const out = new Map<string, { id: string; pos: number; row: number }>();
  const byYear = new Map<number, typeof gates>();
  for (const g of gates) byYear.set(g.year, [...(byYear.get(g.year) ?? []), g]);
  for (const group of byYear.values()) {
    const placed = group.map((g, i) => ({ g, i, pos: markerPosition(win, g.year, g.month) })).sort((a, b) => a.pos - b.pos || a.i - b.i);
    const rowEnd: number[] = [];
    for (const p of placed) {
      const w = ((p.g.code ?? "Gate").length + 1) * perChar;
      let row = rowEnd.findIndex((end) => p.pos - w / 2 >= end);
      if (row === -1) { row = rowEnd.length; rowEnd.push(0); }
      rowEnd[row] = p.pos + w / 2;
      out.set(p.g.id, { id: p.g.id, pos: p.pos, row });
    }
  }
  return gates.map((g) => out.get(g.id) as { id: string; pos: number; row: number });
}

// The milestone-row stacking (the proximity rule, as the gates): milestones sharing a year band take rows by
// proximity — greedy first-fit by position, a footprint of the ordinal's width centred on the marker; ties
// on position break by the ordinal (the chronological rank), so monthless same-year milestones, which
// share the band's centre, keep today's rank rows exactly, and month-bearing milestones separate by their
// composed positions. A milestone alone in its year keeps row 0.
export function layoutMilestoneRows(ms: { id: string; year: number; month?: number; ordinal: number }[], win: GanttWindow): { id: string; pos: number; row: number }[] {
  const perChar = win.years / GANTT_CHARS_ACROSS_PLOT;
  const out = new Map<string, { id: string; pos: number; row: number }>();
  const byYear = new Map<number, typeof ms>();
  for (const m of ms) byYear.set(m.year, [...(byYear.get(m.year) ?? []), m]);
  for (const group of byYear.values()) {
    const placed = group.map((m) => ({ m, pos: markerPosition(win, m.year, m.month) })).sort((a, b) => a.pos - b.pos || a.m.ordinal - b.m.ordinal);
    const rowEnd: number[] = [];
    for (const p of placed) {
      const w = (String(p.m.ordinal).length + 1) * perChar;
      let row = rowEnd.findIndex((end) => p.pos - w / 2 >= end);
      if (row === -1) { row = rowEnd.length; rowEnd.push(0); }
      rowEnd[row] = p.pos + w / 2;
      out.set(p.m.id, { id: p.m.id, pos: p.pos, row });
    }
  }
  return ms.map((m) => out.get(m.id) as { id: string; pos: number; row: number });
}

export interface GanttBarIn { id: string; label: string; startYear: number; endYear: number; startMonth?: number; endMonth?: number }
export interface GanttBarLaid extends GanttBarIn {
  // v0.6.17: the composed sub-year edges, in year columns from the window start
  left: number;
  right: number;
  // the sub-row within the lane (0-based)
  row: number;
  // "inside": the label fits within its bar; "above": it renders on lines above the bar
  labelMode: "inside" | "above";
  lines: string[];
  // the left edge of an above-label, in year columns from the window start (>= 0)
  labelLeft: number;
  // the width of an above-label, in year columns
  labelWidth: number;
}
export interface GanttLaneLaid {
  rowCount: number;
  // the number of above-label lines each sub-row reserves (0 = none)
  rowLines: number[];
  bars: GanttBarLaid[];
}

// v0.6.18 Task H3 (the builder proposal, applied): the bar-label placement MEASURES its labels instead of counting
// characters. The advance widths below are the Helvetica widths (per 1000 em, ASCII 32-126; the dashes and the
// middle dot by name; any other glyph at 0.6 em), so a label's width in em is the same on every surface - a width
// scales with the type size. The plot is GANTT_PLOT_EM em wide: the SVG's 840 px at 11 px type (76.4 em) is the
// TIGHTER surface (the print plot is 225 mm at 6 pt, 106 em), so one figure - the SVG's - serves both and a label
// composed to fit it fits the print route with room to spare. The old 110-character budget, against the SVG's real
// ~147 and the print route's ~190, was the deliberately conservative guess this retires. The layout stays composed
// ONCE (one story, one source); a surface-aware budget - a second composition - would revise that contract and is
// left to the controller (halt-and-ask), not taken here.
const HELVETICA_ADVANCE = [280,280,350,550,550,890,660,190,330,330,390,580,280,330,280,280,550,550,550,550,550,550,550,550,550,550,280,280,580,580,580,550,1010,660,660,720,720,660,610,780,720,280,500,660,550,830,720,780,660,780,720,660,610,720,660,940,660,660,610,280,280,280,470,550,330,550,550,500,550,550,280,550,550,220,220,500,220,830,550,550,550,550,330,500,280,550,500,720,500,500,500,330,260,330,580];
export const GANTT_PLOT_EM = 76;
export function labelEm(label: string): number {
  let w = 0;
  for (const ch of label) {
    const c = ch.codePointAt(0) as number;
    if (c >= 32 && c <= 126) w += HELVETICA_ADVANCE[c - 32] / 1000;
    else if (ch === "\u2013") w += 0.55;
    else if (ch === "\u2014") w += 1;
    else if (ch === "\u00b7") w += 0.28;
    else w += 0.6;
  }
  return w;
}

// Wrap a label by its measured width (em), breaking at spaces and hard-splitting a word wider than the line.
// Never truncates: the joined lines carry every character of the label.
export function wrapLabelEm(label: string, maxEm: number): string[] {
  const words = label.split(/\s+/).filter((w) => w !== "");
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let cur = "";
  for (let w of words) {
    while (labelEm(w) > maxEm) {
      if (cur !== "") { lines.push(cur); cur = ""; }
      let k = 1;
      while (k < w.length && labelEm(w.slice(0, k + 1)) <= maxEm) k++;
      lines.push(w.slice(0, k));
      w = w.slice(k);
    }
    if (cur === "") cur = w;
    else if (labelEm(cur + " " + w) <= maxEm) cur += " " + w;
    else { lines.push(cur); cur = w; }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

// Wrap a label into lines of at most max characters, breaking at spaces and hard-splitting a word
// longer than the line. Never truncates: the joined lines carry every character of the label.
export function wrapLabel(label: string, max: number): string[] {
  const words = label.split(/\s+/).filter((w) => w !== "");
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let cur = "";
  for (let w of words) {
    while (w.length > max) {
      if (cur !== "") { lines.push(cur); cur = ""; }
      lines.push(w.slice(0, max));
      w = w.slice(max);
    }
    if (cur === "") cur = w;
    else if ((cur + " " + w).length <= max) cur += " " + w;
    else { lines.push(cur); cur = w; }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

// The stacked sub-row layout (Addendum 1) with the label rule. Each bar takes a footprint: its own
// span when the label fits inside it; otherwise the wider of the bar and its above-label, shifted
// left when the label would cross the window edge. Bars are placed greedily first-fit by start year
// on the first sub-row whose last footprint ends at or before the new footprint begins (the renderers inset every bar, so adjacent bars keep a visible gap), so
// no bar and no label ever overlaps or touches another.
export function layoutLane(bars: GanttBarIn[], win: GanttWindow): GanttLaneLaid {
  const years = win.years;
  const perEm = years / GANTT_PLOT_EM;
  const pos = new Map(bars.map((b) => [b.id, barPosition(win, b)]));
  const sorted = [...bars].sort((a, b) => (pos.get(a.id) as { left: number }).left - (pos.get(b.id) as { left: number }).left || (pos.get(a.id) as { right: number }).right - (pos.get(b.id) as { right: number }).right || a.id.localeCompare(b.id));
  const rowEnd: number[] = [];
  const rowLines: number[] = [];
  const laid: GanttBarLaid[] = [];
  for (const b of sorted) {
    const { left, right } = pos.get(b.id) as { left: number; right: number };
    // the bar's room in em, less the label's inset and right gap (about 1.6 em at the SVG's 11 px)
    const insideCapacity = (right - left) / perEm - 1.6;
    let mode: "inside" | "above" = "inside";
    let lines = [b.label];
    let labelLeft = left;
    let labelWidth = 0;
    let footLeft = left;
    let footRight = right;
    if (labelEm(b.label) > insideCapacity) {
      mode = "above";
      lines = wrapLabelEm(b.label, GANTT_PLOT_EM * GANTT_LABEL_WRAP_SHARE);
      labelWidth = (Math.max(...lines.map((l) => labelEm(l))) + 1) * perEm;
      labelLeft = Math.max(0, Math.min(left, years - labelWidth));
      footLeft = Math.min(left, labelLeft);
      footRight = Math.max(right, labelLeft + labelWidth);
    }
    let row = rowEnd.findIndex((end) => footLeft >= end);
    if (row === -1) {
      row = rowEnd.length;
      rowEnd.push(0);
      rowLines.push(0);
    }
    rowEnd[row] = footRight;
    rowLines[row] = Math.max(rowLines[row], mode === "above" ? lines.length : 0);
    laid.push({ ...b, left, right, row, labelMode: mode, lines, labelLeft, labelWidth });
  }
  return { rowCount: rowEnd.length, rowLines, bars: laid };
}
