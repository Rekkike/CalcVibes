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
export function ganttWindow(visible: { startYear: number; endYear: number }[], spanYears: number): GanttWindow {
  const span = Math.max(1, spanYears);
  if (visible.length === 0) return { firstYear: 1, lastYear: span, years: span, narrowed: false };
  const firstYear = Math.max(1, Math.min(...visible.map((a) => a.startYear)));
  const lastYear = Math.min(span, Math.max(...visible.map((a) => a.endYear)));
  if (lastYear < firstYear) return { firstYear: 1, lastYear: span, years: span, narrowed: false };
  const years = lastYear - firstYear + 1;
  return { firstYear, lastYear, years, narrowed: years < span };
}

export interface GanttBarIn { id: string; label: string; startYear: number; endYear: number }
export interface GanttBarLaid extends GanttBarIn {
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
  const perChar = years / GANTT_CHARS_ACROSS_PLOT;
  const sorted = [...bars].sort((a, b) => a.startYear - b.startYear || a.endYear - b.endYear || a.id.localeCompare(b.id));
  const rowEnd: number[] = [];
  const rowLines: number[] = [];
  const laid: GanttBarLaid[] = [];
  for (const b of sorted) {
    const left = b.startYear - win.firstYear;
    const right = b.endYear - win.firstYear + 1;
    const insideCapacity = Math.floor((right - left) / perChar) - 2;
    let mode: "inside" | "above" = "inside";
    let lines = [b.label];
    let labelLeft = left;
    let labelWidth = 0;
    let footLeft = left;
    let footRight = right;
    if (b.label.length > insideCapacity) {
      mode = "above";
      lines = wrapLabel(b.label, Math.max(12, Math.floor(GANTT_CHARS_ACROSS_PLOT * GANTT_LABEL_WRAP_SHARE)));
      labelWidth = (Math.max(...lines.map((l) => l.length)) + 1) * perChar;
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
    laid.push({ ...b, row, labelMode: mode, lines, labelLeft, labelWidth });
  }
  return { rowCount: rowEnd.length, rowLines, bars: laid };
}
