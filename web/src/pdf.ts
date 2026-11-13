import { jsPDF } from "jspdf";
import { deckMoneyForDisplay, percentTwoForDisplay } from "./engine.js";
import type { CurrencyCode, EntryUnit } from "./engine.js";
import type { DeckModel, DeckDonut, DeckFlow, DeckGantt, DeckLedgerRow, DeckStepColumn, ScenarioTargetChart } from "./deck.js";

export interface DeckPdfTrace {
  drawnTitles: string[];
  drawnFigures: string[][];
}

export interface DeckPdfResult {
  doc: jsPDF;
  drawnTitles: string[];
}

const CONTENT_TOP = 55;
const CONTENT_BOTTOM = 185;
const FIGURE_LINE_HEIGHT = 8;
const DISCLOSURE_LINE_HEIGHT = 6;

// v0.6.5 Task H/W16: the print palette — the stage palette never appeared on the paper route.
// Every drawn element meets the contrast contract against the white page (>= 4.99:1 for the
// ink family; the semantic ok/bad tones carry their meaning in print-darkened form).
const PRINT_OK: [number, number, number] = [4, 120, 87]; // #047857
const PRINT_BAD: [number, number, number] = [190, 18, 60]; // #be123c
const PRINT_GOLD: [number, number, number] = [146, 100, 14]; // #92640e — the crossing gold in print ink
const PRINT_MUT: [number, number, number] = [50, 50, 50]; // caption ink on paper
// the print donut/segment palette: every entry >= 4.99:1 on white
const PRINT_DONUT_COLORS = ["#0074ba", "#047857", "#b45309", "#6d28d9", "#be123c", "#103558"];

// v0.6.21 Task A (findings W32, W33, W34) — the print-chart geometry contract and the theme mapping.
// W32: the content band is 14..283 mm (unchanged); every paper-route chart body is bounded to
// 20..277 mm, centered in that band (both midpoints 148.5 mm), with the bar width derived from the
// available width and the slot count and a proportional inter-bar gap, so no chart can reach the
// page edge at any fixture.
export const PDF_CONTENT_LEFT = 14;
export const PDF_CONTENT_RIGHT = 283;
export const PDF_CHART_LEFT = 20;
export const PDF_CHART_RIGHT = 277;
export const PDF_CHART_WIDTH = PDF_CHART_RIGHT - PDF_CHART_LEFT; // 257 mm
// The proportional inter-bar gap is 20 percent of the slot, so bars occupy 80 percent of it.
export const PDF_BAR_GAP_SHARE = 0.2;
export function chartSlots(count: number): { slot: number; gap: number; barW: number; x: (i: number) => number } {
  const n = Math.max(1, count);
  const slot = PDF_CHART_WIDTH / n;
  const gap = slot * PDF_BAR_GAP_SHARE;
  const barW = slot - gap;
  // the bar group is centered in the body: the half-gap at each end keeps 20..277 the outer bounds
  return { slot, gap, barW, x: (i: number) => PDF_CHART_LEFT + gap / 2 + i * slot };
}

// W33/W34: the PDF export's theme mapping. The stage vocabulary maps in full to the PDF surface —
// the #081c33 page, the light inks, the stage chart colors — and the dark stage is the DEFAULT
// (W34, superseding W33's light default); the light theme stays the explicit paper-and-toner option
// (the PRINT_* vocabulary of record above). The W30-audited contrast set of record, all computed
// against the stage #081c33: the peak label #ffffff at 17.15:1, the axis labels #e2e8f0 at 13.91:1,
// the caption #cce9ff at 13.61:1, the crossing gold #e8b84b at 9.30:1, and the stage chart colors
// #fb7185 and #34d399 at 6.37:1 and 8.92:1.
export type DeckPdfTheme = "dark" | "light";
export interface PdfThemePalette {
  page: [number, number, number];
  headerBand: [number, number, number];
  headerText: [number, number, number];
  ink: [number, number, number];
  mut: [number, number, number];
  caption: [number, number, number];
  peak: [number, number, number];
  onBar: [number, number, number];
  hairline: [number, number, number];
  gridline: [number, number, number];
  connector: [number, number, number];
  connectorSoft: [number, number, number];
  dash: [number, number, number];
  ground: [number, number, number];
  ok: [number, number, number];
  bad: [number, number, number];
  gold: [number, number, number];
  barPos: [number, number, number];
  barNeg: [number, number, number];
  capital: [number, number, number];
  total: [number, number, number];
  totalFill: [number, number, number];
  donut: string[];
  cardFill: [number, number, number];
  cardLine: [number, number, number];
  cardLabel: [number, number, number];
}
// The light paper route: exactly the PRINT_* vocabulary of record (white page, print inks).
export const PDF_THEME_LIGHT: PdfThemePalette = {
  page: [255, 255, 255],
  headerBand: [16, 53, 88],
  headerText: [255, 255, 255],
  ink: [0, 0, 0],
  mut: PRINT_MUT,
  caption: PRINT_MUT,
  peak: [0, 0, 0],
  onBar: [255, 255, 255],
  hairline: [229, 229, 234],
  gridline: [240, 240, 243],
  connector: [150, 150, 150],
  connectorSoft: [170, 170, 170],
  dash: [120, 120, 120],
  ground: [60, 60, 60],
  ok: PRINT_OK,
  bad: PRINT_BAD,
  gold: PRINT_GOLD,
  barPos: PRINT_OK,
  barNeg: PRINT_BAD,
  capital: [0, 116, 186],
  total: [16, 53, 88],
  totalFill: [231, 236, 242],
  donut: PRINT_DONUT_COLORS,
  cardFill: [255, 255, 255],
  cardLine: [229, 229, 234],
  cardLabel: [113, 114, 115],
};
// The dark stage route: the #081c33 page, the light inks, the stage chart colors; the translucent
// stage surfaces are composited over the page (rgba(30,41,59,0.6) -> (21,36,56), the
// rgba(148,163,184,0.16) gridline -> (30,50,72), the rgba(148,163,184,0.45) zero line -> (71,89,111)).
export const PDF_THEME_DARK: PdfThemePalette = {
  page: [8, 28, 51], // #081c33
  headerBand: [21, 36, 56],
  headerText: [255, 255, 255],
  ink: [255, 255, 255], // #ffffff at 17.15:1
  mut: [226, 232, 240], // #e2e8f0 at 13.91:1 (axis labels)
  caption: [204, 233, 255], // #cce9ff at 13.61:1
  peak: [255, 255, 255], // #ffffff at 17.15:1 (the peak label)
  onBar: [255, 255, 255],
  hairline: [29, 58, 95], // #1d3a5f
  gridline: [30, 50, 72],
  connector: [71, 89, 111],
  connectorSoft: [71, 89, 111],
  dash: [71, 89, 111],
  ground: [71, 89, 111],
  ok: [52, 211, 153], // #34d399 at 8.92:1
  bad: [251, 113, 133], // #fb7185 at 6.37:1
  gold: [232, 184, 75], // #e8b84b at 9.30:1 (the crossing gold)
  barPos: [52, 211, 153], // #34d399
  barNeg: [251, 113, 133], // #fb7185
  capital: [56, 189, 248], // #38bdf8, the stage accent at 8.01:1
  total: [226, 232, 240], // #e2e8f0
  totalFill: [21, 36, 56],
  donut: ["#38bdf8", "#34d399", "#e8b84b", "#fb7185", "#c4b5fd", "#e2e8f0"],
  cardFill: [21, 36, 56],
  cardLine: [29, 58, 95],
  cardLabel: [204, 233, 255],
};

function printColorOf(T: PdfThemePalette, index: number): string {
  return T.donut[index % T.donut.length];
}

function hexToRgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

// v0.6.5 Task C/W13: the composition donut on the print route — pie-slice polygons through
// doc.lines, a white center circle, the center total, and direct labels beside the geometry.
function drawPrintDonut(doc: jsPDF, T: PdfThemePalette, donut: DeckDonut, x: number, y: number, currency: CurrencyCode, unit: EntryUnit, trace?: DeckPdfTrace): number {
  const total = Math.max(1e-12, donut.segments.reduce((a, s) => a + s.value, 0));
  const cx = x + 22;
  const cy = y + 26;
  const outerR = 17;
  const innerR = 11;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(T.ink[0], T.ink[1], T.ink[2]);
  doc.text(donut.title, x, y + 4);
  doc.setFont("helvetica", "normal");
  if (trace) trace.drawnFigures[trace.drawnFigures.length - 1]?.push(donut.title);
  let acc = 0;
  if (donut.segments.length <= 1) {
    const zc = hexToRgb(printColorOf(T, 0)); doc.setFillColor(zc[0], zc[1], zc[2]);
    doc.circle(cx, cy, outerR, "F");
  } else {
    for (let i = 0; i < donut.segments.length; i++) {
      const a0 = -(acc / total) * 2 * Math.PI - Math.PI / 2;
      acc += donut.segments[i].value;
      const a1 = -(acc / total) * 2 * Math.PI - Math.PI / 2;
      const path: number[][] = [];
      const p0x = cx + outerR * Math.cos(a0);
      const p0y = cy + outerR * Math.sin(a0);
      path.push([p0x - cx, p0y - cy]);
      const chunks = Math.max(1, Math.ceil(Math.abs(a1 - a0) / (Math.PI / 2)));
      const dChunk = (a1 - a0) / chunks;
      for (let k = 0; k < chunks; k++) {
        const aStart = a0 + k * dChunk;
        const aEnd = aStart + dChunk;
        const f = (4 / 3) * Math.tan(dChunk / 4) * outerR;
        const sx = cx + outerR * Math.cos(aStart);
        const sy = cy + outerR * Math.sin(aStart);
        const ex = cx + outerR * Math.cos(aEnd);
        const ey = cy + outerR * Math.sin(aEnd);
        const c1x = sx - f * Math.sin(aStart);
        const c1y = sy + f * Math.cos(aStart);
        const c2x = ex + f * Math.sin(aEnd);
        const c2y = ey - f * Math.cos(aEnd);
        path.push([c1x - sx, c1y - sy, c2x - sx, c2y - sy, ex - sx, ey - sy]);
      }
      const pex = cx + outerR * Math.cos(a1);
      const pey = cy + outerR * Math.sin(a1);
      path.push([cx - pex, cy - pey]);
      const pc = hexToRgb(printColorOf(T, i)); doc.setFillColor(pc[0], pc[1], pc[2]);
      doc.lines(path, cx, cy, [1, 1], "F", true);
    }
  }
  doc.setFillColor(T.page[0], T.page[1], T.page[2]);
  doc.circle(cx, cy, innerR, "F");
  doc.setFontSize(7);
  doc.setTextColor(T.ink[0], T.ink[1], T.ink[2]);
  const centerLines = doc.splitTextToSize(deckMoneyForDisplay(total, currency, unit), innerR * 2 - 2) as string[];
  doc.text(centerLines[centerLines.length - 1], cx, cy + 1, { align: "center" });
  if (trace) trace.drawnFigures[trace.drawnFigures.length - 1]?.push(deckMoneyForDisplay(total, currency, unit));
  let labY = y + 12;
  donut.segments.forEach((s, si) => {
    const pc = hexToRgb(printColorOf(T, si)); doc.setFillColor(pc[0], pc[1], pc[2]);
    doc.rect(x + 46, labY - 2.5, 3, 3, "F");
    doc.setFontSize(7);
    doc.setTextColor(T.mut[0], T.mut[1], T.mut[2]);
    // v0.6.18 Task B: the label carries the segment's share of the ring's own total (the deck model's
    // one-decimal string; the print route never recomputes it)
    const labelText = `${s.label} ${deckMoneyForDisplay(s.value, currency, unit)}${s.share !== undefined ? ` · ${s.share}` : ""}`;
    doc.text(labelText, x + 51, labY);
    doc.setTextColor(T.ink[0], T.ink[1], T.ink[2]);
    if (trace) trace.drawnFigures[trace.drawnFigures.length - 1]?.push(labelText);
    labY += 5;
  });
  if (donut.disclosure !== undefined) {
    doc.setFontSize(7);
    doc.setTextColor(T.mut[0], T.mut[1], T.mut[2]);
    const dLines = doc.splitTextToSize(donut.disclosure, 120) as string[];
    doc.text(dLines, x, y + 48);
    doc.setTextColor(T.ink[0], T.ink[1], T.ink[2]);
    if (trace) trace.drawnFigures[trace.drawnFigures.length - 1]?.push(donut.disclosure);
    return Math.max(58, 48 + dLines.length * 3 + 4);
  }
  return 52;
}

// v0.6.5 Task B/W11: the scenarios target chart on the print route — zero-based bars, verdict
// colors in print ink, the break-even target marked as the crossing with its caption.
// v0.6.9 Task G (finding W29): the vertical geometry scales by `scale` (default 1) so the
// scenarios slide can reserve its block heights and fit whole within the content band.
function drawPrintScenarioTarget(doc: jsPDF, T: PdfThemePalette, tc: ScenarioTargetChart, y: number, currency: CurrencyCode, unit: EntryUnit, trace?: DeckPdfTrace, scale = 1): number {
  const n = Math.max(1, tc.points.length);
  // v0.6.21 W32: re-bounded and centered under the geometry contract (the 20..220 band retired).
  const geo = chartSlots(n);
  doc.setFontSize(8);
  doc.setTextColor(T.caption[0], T.caption[1], T.caption[2]);
  doc.text(tc.kicker, PDF_CHART_LEFT, y);
  doc.setTextColor(T.ink[0], T.ink[1], T.ink[2]);
  if (tc.mode === "solved") {
    const maxV = Math.max(1e-12, ...tc.points.map((p) => p.value));
    const baseline = y + 30 * scale;
    doc.setDrawColor(T.hairline[0], T.hairline[1], T.hairline[2]);
    doc.line(PDF_CHART_LEFT, baseline, PDF_CHART_RIGHT, baseline);
    tc.points.forEach((p, i) => {
      const h = (Math.max(0, p.value) / maxV) * 22 * scale;
      doc.setFillColor(T.barPos[0], T.barPos[1], T.barPos[2]);
      doc.rect(geo.x(i), baseline - h, geo.barW, h, "F");
    });
    tc.points.forEach((p, i) => {
      doc.setFontSize(6);
      doc.setTextColor(T.mut[0], T.mut[1], T.mut[2]);
      doc.text(p.label, geo.x(i) + geo.barW / 2, baseline + 4 * scale, { align: "center", maxWidth: geo.barW + 2 });
      const valText = deckMoneyForDisplay(p.value, currency, unit);
      doc.text(valText, geo.x(i) + geo.barW / 2, baseline + 8 * scale, { align: "center", maxWidth: geo.barW + 6 });
      doc.setTextColor(T.ink[0], T.ink[1], T.ink[2]);
      if (trace) {
        trace.drawnFigures[trace.drawnFigures.length - 1]?.push(p.label);
        trace.drawnFigures[trace.drawnFigures.length - 1]?.push(valText);
      }
    });
    return 46 * scale;
  }
  const zeroY = y + 18 * scale;
  const maxAbs = Math.max(1e-12, ...tc.points.map((p) => Math.abs(p.value)));
  tc.points.forEach((p, i) => {
    const h = (Math.abs(p.value) / maxAbs) * 12 * scale;
    const col = p.met ? PRINT_OK : PRINT_BAD;
    doc.setFillColor(col[0], col[1], col[2]);
    if (p.value >= 0) doc.rect(geo.x(i), zeroY - h, geo.barW, h, "F");
    else doc.rect(geo.x(i), zeroY, geo.barW, h, "F");
  });
  doc.setDrawColor(T.hairline[0], T.hairline[1], T.hairline[2]);
  doc.line(PDF_CHART_LEFT, zeroY, PDF_CHART_RIGHT, zeroY);
  if (tc.breakEvenTarget !== null && n > 0) {
    const first = tc.points[0].target;
    const last = tc.points[n - 1].target;
    const frac = tc.breakEvenTarget <= first ? 0 : tc.breakEvenTarget >= last ? 1 : (tc.breakEvenTarget - first) / (last - first);
    const bx = PDF_CHART_LEFT + frac * PDF_CHART_WIDTH;
    doc.setDrawColor(T.gold[0], T.gold[1], T.gold[2]);
    doc.setLineWidth(0.6);
    doc.line(bx, y + 8 * scale, bx, y + 30 * scale);
    doc.setLineWidth(0.2);
    const caption = `break-even at ${percentTwoForDisplay(tc.breakEvenTarget)}`;
    doc.setFontSize(7);
    doc.setTextColor(T.gold[0], T.gold[1], T.gold[2]);
    doc.text(caption, bx, y + 34 * scale, { align: frac > 0.5 ? "right" : "left", maxWidth: 100 });
    doc.setTextColor(T.ink[0], T.ink[1], T.ink[2]);
    if (trace) trace.drawnFigures[trace.drawnFigures.length - 1]?.push(caption);
  }
  tc.points.forEach((p, i) => {
    doc.setFontSize(6);
    doc.setTextColor(T.mut[0], T.mut[1], T.mut[2]);
    doc.text(`${p.label} ${p.met ? "met" : "not met"}`, geo.x(i) + geo.barW / 2, y + 40 * scale, { align: "center", maxWidth: geo.barW + 8 });
    doc.setTextColor(T.ink[0], T.ink[1], T.ink[2]);
    if (trace) trace.drawnFigures[trace.drawnFigures.length - 1]?.push(`${p.label} ${p.met ? "met" : "not met"}`);
  });
  return 48 * scale;
}

// v0.6.13: the program Gantt on the print route — the lanes, the stacked bars, the DP-coded gate
// lines, the milestone diamonds and the axis labels, in the print palette; it draws the deck model's
// gantt (the year window, the sub-row layout and the label placement composed once in the deck
// model) and never recomputes it. v0.6.13.2: the lanes flow across pages when the stacked layout is
// taller than the page — nothing is clipped; each page segment repeats the axis and the marker
// footer. Returns the y after the last segment.
export const GANTT_PDF = { labelW: 32, plotW: 257 - 32, axisH: 7, footerH: 16, rowPad: 1.2, barH: 4.2, lineH: 2.7, capLine: 3.4 };
// v0.6.17: the height of one stacked gate-label row on the print route
const GATE_ROW_PDF = 3.2;
const pdfRowH = (lines: number) => GANTT_PDF.rowPad + (lines > 0 ? lines * GANTT_PDF.lineH + 0.6 : 0) + GANTT_PDF.barH;
// v0.6.13.4: the marker footer grows with the milestone stack: each same-year row is 9 mm (the diamond, then
// its ordinal centered beneath it); with no milestone the footer stands at footerH.
const pdfFooterH = (g: DeckGantt) => {
  const rows = g.milestones.reduce((a, m) => Math.max(a, m.row + 1), 0);
  const base = rows === 0 ? GANTT_PDF.footerH : Math.max(GANTT_PDF.footerH, 19.5 + (rows - 1) * 9);
  return base + Math.max(0, g.gateRows - 1) * GATE_ROW_PDF;
};
const pdfLaneH = (l: DeckGantt["lanes"][number]) => Math.max(l.rowLines.reduce((a, n) => a + pdfRowH(n), 0) + GANTT_PDF.rowPad, l.labelLines.length * 3.4 + 2);
function drawPrintGantt(doc: jsPDF, T: PdfThemePalette, g: DeckGantt, y0: number, nextPage: () => number, trace?: DeckPdfTrace): number {
  const { labelW, plotW, axisH, rowPad, barH, lineH } = GANTT_PDF;
  const footerH = pdfFooterH(g);
  const x0 = 20 + labelW;
  const first = g.window.firstYear;
  const n = Math.max(1, g.window.lastYear - first + 1);
  const colW = plotW / n;
  const xStart = (yr: number) => x0 + (yr - first) * colW;
  const xMid = (yr: number) => x0 + (yr - first + 0.5) * colW;
  // v0.6.17: the composed sub-year position of a marker or a bar edge (year columns from the window start)
  const xAt = (pos: number) => x0 + pos * colW;
  const step = Math.max(1, Math.ceil(n / 14));
  const push = (s: string) => { if (trace) trace.drawnFigures[trace.drawnFigures.length - 1]?.push(s); };
  // segment the lanes by page capacity
  const segments: { top: number; lanes: DeckGantt["lanes"] }[] = [];
  let top = y0;
  let cur: DeckGantt["lanes"] = [];
  let used = axisH + footerH;
  for (const lane of g.lanes) {
    const h = pdfLaneH(lane);
    if (cur.length > 0 && top + used + h > CONTENT_BOTTOM) {
      segments.push({ top, lanes: cur });
      top = nextPage();
      cur = [];
      used = axisH + footerH;
    }
    cur.push(lane);
    used += h;
  }
  segments.push({ top, lanes: cur });
  let endY = y0;
  segments.forEach((seg) => {
    const lanesTop = seg.top + axisH;
    const heights = seg.lanes.map(pdfLaneH);
    const lanesBottom = lanesTop + heights.reduce((a, h) => a + h, 0);
    doc.setFontSize(7);
    doc.setTextColor(T.mut[0], T.mut[1], T.mut[2]);
    for (const a of g.axis) {
      doc.setDrawColor(T.hairline[0], T.hairline[1], T.hairline[2]);
      doc.line(xStart(a.year), lanesTop, xStart(a.year), lanesBottom);
      if ((a.year - first) % step === 0) {
        doc.text(a.label, xMid(a.year), seg.top + 4, { align: "center" });
        push(a.label);
      }
    }
    if (g.monthGrid !== undefined) {
      // the optional month gridlines (view state): hairlines in a lighter ink than the year lines
      doc.setDrawColor(T.gridline[0], T.gridline[1], T.gridline[2]);
      for (const p of g.monthGrid) doc.line(xAt(p), lanesTop, xAt(p), lanesBottom);
      doc.setDrawColor(T.hairline[0], T.hairline[1], T.hairline[2]);
    }
    doc.line(xStart(first + n), lanesTop, xStart(first + n), lanesBottom);
    let ly = lanesTop;
    seg.lanes.forEach((lane, i) => {
      doc.setDrawColor(T.connector[0], T.connector[1], T.connector[2]);
      doc.line(x0, ly, x0 + plotW, ly);
      doc.setFontSize(8);
      doc.setTextColor(T.ink[0], T.ink[1], T.ink[2]);
      lane.labelLines.forEach((line, k) => {
        doc.text(line, 20, ly + heights[i] / 2 - ((lane.labelLines.length - 1) * 3.4) / 2 + 1.2 + k * 3.4);
      });
      push(lane.label);
      const rowTops: number[] = [];
      let rc = ly + rowPad;
      lane.rowLines.forEach((l) => { rowTops.push(rc); rc += pdfRowH(l); });
      for (const b of lane.bars) {
        const rowTop = rowTops[b.row];
        const band = lane.rowLines[b.row] > 0 ? lane.rowLines[b.row] * lineH + 0.6 : 0;
        const bx = xAt(b.left) + 0.3;
        const bw = (b.right - b.left) * colW - 0.6;
        const by = rowTop + band;
        doc.setFillColor(T.capital[0], T.capital[1], T.capital[2]);
        doc.rect(bx, by, bw, barH, "F");
        doc.setFontSize(6);
        if (b.labelMode === "inside") {
          doc.setTextColor(T.onBar[0], T.onBar[1], T.onBar[2]);
          doc.text(b.label, bx + 1, by + barH / 2 + 0.8);
        } else {
          doc.setTextColor(T.ink[0], T.ink[1], T.ink[2]);
          b.lines.forEach((line, k) => doc.text(line, x0 + b.labelLeft * colW, rowTop + 2 + k * lineH));
        }
        push(b.label);
      }
      ly += heights[i];
    });
    doc.setDrawColor(T.connector[0], T.connector[1], T.connector[2]);
    doc.line(x0, lanesBottom, x0 + plotW, lanesBottom);
    for (const gate of g.gates) {
      doc.setDrawColor(T.gold[0], T.gold[1], T.gold[2]);
      doc.setLineWidth(0.6);
      doc.line(xAt(gate.pos), lanesTop - 2, xAt(gate.pos), lanesBottom + 2 + gate.row * GATE_ROW_PDF);
      doc.setLineWidth(0.2);
      doc.setFontSize(7);
      doc.setTextColor(T.gold[0], T.gold[1], T.gold[2]);
      const code = gate.code ?? "Gate";
      doc.text(code, xAt(gate.pos), lanesBottom + 6 + gate.row * GATE_ROW_PDF, { align: "center" });
      push(code);
    }
    for (const m of g.milestones) {
      const cx = xAt(m.pos);
      const cy = lanesBottom + 11 + Math.max(0, g.gateRows - 1) * GATE_ROW_PDF + m.row * 9;
      doc.setFillColor(T.ok[0], T.ok[1], T.ok[2]);
      doc.lines([[2.5, 2.5], [-2.5, 2.5], [-2.5, -2.5], [2.5, -2.5]], cx, cy - 2.5, [1, 1], "F", true);
      // the ordinal, centered beneath its diamond (7 pt; below the gate-code line, above the caption)
      doc.setFontSize(7);
      doc.setTextColor(T.ink[0], T.ink[1], T.ink[2]);
      doc.text(String(m.ordinal), cx, cy + 5.7, { align: "center" });
    }
    endY = lanesBottom + footerH;
  });
  // the axis-honesty caption (the window against the program span; the omitted-marker disclosure)
  if (g.caption !== null) {
    doc.setFontSize(7);
    doc.setTextColor(T.mut[0], T.mut[1], T.mut[2]);
    const lines = doc.splitTextToSize(g.caption, 257) as string[];
    if (endY + lines.length * GANTT_PDF.capLine > CONTENT_BOTTOM) endY = nextPage();
    doc.text(lines, 20, endY + 2);
    push(g.caption);
    endY += lines.length * GANTT_PDF.capLine + 1;
  }
  doc.setDrawColor(0, 0, 0);
  doc.setTextColor(T.ink[0], T.ink[1], T.ink[2]);
  doc.setFontSize(12);
  return endY;
}
// v0.6.15 Task D: the investment waterfall on the print route. The ledger draws the deck model's rows
// (the full line names wrapped, never truncated; a bar floating on the shared left-baseline scale; the
// value at the bar end; the muted full-outflow share at the row end; the subtotal hairline with its
// tick; the heavier total bar), and the stepped columns draw the group steps with the ground-standing
// total. Both consume the same composed model as the Presentation (the group aggregation is never
// recomputed here); the operating segment prints and the rows reconcile to the total.
function printBarColor(T: PdfThemePalette, kind: DeckLedgerRow["kind"] | DeckStepColumn["kind"]): [number, number, number] {
  return kind === "total" ? T.total : T.capital;
}

function ledgerNameLines(doc: jsPDF, name: string): string[] {
  doc.setFontSize(7);
  return doc.splitTextToSize(name, 84) as string[];
}

function ledgerRowHeight(doc: jsPDF, r: DeckLedgerRow): number {
  return Math.max(5.2, ledgerNameLines(doc, r.name).length * 3 + 2.2);
}

function drawPrintLedgerRow(doc: jsPDF, T: PdfThemePalette, r: DeckLedgerRow, y: number, trace?: DeckPdfTrace): number {
  const x0 = 110;
  const plotW = 100;
  const lines = ledgerNameLines(doc, r.name);
  const h = Math.max(5.2, lines.length * 3 + 2.2);
  const mid = y + h / 2;
  doc.setFontSize(7);
  doc.setTextColor(T.ink[0], T.ink[1], T.ink[2]);
  if (r.kind === "total") doc.setFont("helvetica", "bold");
  doc.text(lines, 20, y + 3.4);
  doc.setFont("helvetica", "normal");
  {
    const bx = x0 + (r.startPct / 100) * plotW;
    const bw = Math.max(0.35, (r.widthPct / 100) * plotW);
    const bh = r.kind === "total" ? 4.4 : 3.2;
    const c = printBarColor(T, r.kind);
    doc.setFillColor(c[0], c[1], c[2]);
    doc.rect(bx, mid - bh / 2, bw, bh, "F");
  }
  const endPct = r.startPct + r.widthPct;
  if (r.kind === "capital") {
    // the hairline connector from this bar's end to the next row's start
    doc.setDrawColor(T.connectorSoft[0], T.connectorSoft[1], T.connectorSoft[2]);
    doc.line(x0 + (endPct / 100) * plotW, mid + 1.6, x0 + (endPct / 100) * plotW, y + h + 1.6);
    doc.setDrawColor(0, 0, 0);
  }
  doc.setTextColor(T.ink[0], T.ink[1], T.ink[2]);
  doc.text(r.value, x0 + (endPct / 100) * plotW + 2, mid + 0.9);
  doc.setTextColor(T.mut[0], T.mut[1], T.mut[2]);
  doc.text(r.share, 277, mid + 0.9, { align: "right" });
  doc.setTextColor(T.ink[0], T.ink[1], T.ink[2]);
  if (trace) {
    const f = trace.drawnFigures[trace.drawnFigures.length - 1];
    f?.push(r.name);
    f?.push(r.value);
    f?.push(r.share);
  }
  return h;
}

function drawPrintColumns(doc: jsPDF, T: PdfThemePalette, columns: DeckStepColumn[], y: number, trace?: DeckPdfTrace): number {
  const left = 20;
  const width = 257;
  const trackH = 26;
  const labelRoom = 8;
  const n = columns.length;
  const slot = width / Math.max(1, n);
  const top = y + labelRoom;
  const ground = top + trackH;
  doc.setLineWidth(0.2);
  const yOf = (pct: number) => ground - (pct / 100) * trackH;
  columns.forEach((c, i) => {
    const bx = left + i * slot;
    const bw = 0.6 * slot;
    const by = yOf(c.bottomPct + c.heightPct);
    const bh = Math.max(0.35, (c.heightPct / 100) * trackH);
    if (c.kind === "total") {
      doc.setDrawColor(T.total[0], T.total[1], T.total[2]);
      doc.setFillColor(T.totalFill[0], T.totalFill[1], T.totalFill[2]);
      doc.rect(bx, by, bw, bh, "FD");
      doc.setDrawColor(0, 0, 0);
    } else {
      const col = printBarColor(T, c.kind);
      doc.setFillColor(col[0], col[1], col[2]);
      doc.rect(bx, by, bw, bh, "F");
      // the dotted connector from this step's top to the next base (or the total's top)
      doc.setDrawColor(T.dash[0], T.dash[1], T.dash[2]);
      doc.setLineDashPattern([0.6, 0.8], 0);
      doc.line(bx + bw, by, bx + slot, by);
      doc.setLineDashPattern([], 0);
      doc.setDrawColor(0, 0, 0);
    }
    doc.setFontSize(7);
    doc.setTextColor(T.ink[0], T.ink[1], T.ink[2]);
    const label = c.kind === "total" ? `${c.name} ${c.value}` : c.value;
    doc.text(doc.splitTextToSize(label, slot * 0.95) as string[], bx + bw / 2, by - 1.6 - (c.kind === "total" ? 3 : 0), { align: "center" });
    if (trace) {
      const f = trace.drawnFigures[trace.drawnFigures.length - 1];
      f?.push(c.value);
    }
  });
  doc.setDrawColor(T.ground[0], T.ground[1], T.ground[2]);
  doc.setLineWidth(0.5);
  doc.line(left, ground, left + width, ground);
  doc.setLineWidth(0.2);
  doc.setDrawColor(0, 0, 0);
  doc.setFontSize(7);
  let namesH = 0;
  columns.forEach((c, i) => {
    const wrapped = doc.splitTextToSize(c.name, slot * 0.95) as string[];
    doc.text(wrapped, left + i * slot + 0.3 * slot, ground + 4, { align: "center" });
    namesH = Math.max(namesH, wrapped.length * 3.2);
    if (trace) trace.drawnFigures[trace.drawnFigures.length - 1]?.push(c.name);
  });
  return labelRoom + trackH + 4 + namesH + 3;
}

// v0.6.22.2 — the flow slide on the print route: the COVERAGE BRIDGE, the rect-based equivalent of the
// deck slide's primary chart, drawn from the same composed slot (the deck model's flow; nothing is
// recomputed here) and bounded per the W32 geometry contract (every mark and every text call inside the
// chart body 20..277 mm). The steps sit in equal slots across the chart body in the coverage order of
// record; each bar spans its composed percents on the one zero-based axis; a dashed connector carries each
// running level into the next step; the zero line is drawn; the value prints above its bar end (below it
// for a negative remainder); the name and the detail lines print beneath the plot, wrapped to the slot,
// never truncated, no legend. A negative remainder and the shortfall years' line print in the bad tone.
// The caption and the bracketed ledger of authored pairings print beneath.
export const FLOW_PRINT_PLOT_H = 22; // sized so the slide's body figures, disclosures and chart fit one page
export const FLOW_PRINT_LABEL_PT = 6; // the flow print route's established label size
export const FLOW_PRINT_LINE_H = (FLOW_PRINT_LABEL_PT * 25.4 * 1.15) / 72; // jsPDF's line height at 6 pt (lineHeightFactor 1.15)
const FLOW_PRINT_VALUE_ROOM = 4; // the room above the plot for a value over the tallest bar
const FLOW_PRINT_BELOW_ROOM = 4; // the room under the plot for a value beneath a negative remainder
export const FLOW_PRINT_BAR_SHARE = 0.6;
function flowPrintNameLines(doc: jsPDF, flow: DeckFlow): { text: string; bad: boolean; head: boolean }[][] {
  const slot = PDF_CHART_WIDTH / Math.max(1, flow.steps.length);
  doc.setFontSize(FLOW_PRINT_LABEL_PT);
  return flow.steps.map((s) => {
    const out: { text: string; bad: boolean; head: boolean }[] = [];
    for (const line of doc.splitTextToSize(s.label, slot * 0.95) as string[]) out.push({ text: line, bad: false, head: true });
    for (const d of s.detail) for (const line of doc.splitTextToSize(d.text, slot * 0.95) as string[]) out.push({ text: line, bad: d.bad, head: false });
    return out;
  });
}
// The height the flow block takes on the page (the chart, the names, the caption and the ledger), so the
// page-break decision reads the same composition the drawing uses.
export function flowPrintHeight(doc: jsPDF, flow: DeckFlow): number {
  const names = flowPrintNameLines(doc, flow);
  const nameH = Math.max(0, ...names.map((l) => l.length)) * FLOW_PRINT_LINE_H;
  doc.setFontSize(7);
  const capLines = (doc.splitTextToSize(flow.caption, PDF_CHART_WIDTH) as string[]).length;
  const ledgerLines = flow.ledger.reduce((a, r) => a + (doc.splitTextToSize(`${r.sourceLabel} -> ${r.useLabel}: ${r.amount} (allocated ${r.allocated})`, PDF_CHART_WIDTH) as string[]).length, 0);
  return FLOW_PRINT_VALUE_ROOM + FLOW_PRINT_PLOT_H + FLOW_PRINT_BELOW_ROOM + 2 + nameH + 4 + capLines * 3.4 + 2 + ledgerLines * 3.4 + (flow.ledgerOmitted > 0 ? 3.4 : 0) + 2;
}
function drawPrintFlow(doc: jsPDF, T: PdfThemePalette, flow: DeckFlow, y: number, trace?: DeckPdfTrace): number {
  const startY = y;
  const push = (t: string) => { if (trace) trace.drawnFigures[trace.drawnFigures.length - 1]?.push(t); };
  const plotH = FLOW_PRINT_PLOT_H;
  const top = y + FLOW_PRINT_VALUE_ROOM;
  const yAt = (pct: number) => top + plotH * (1 - pct / 100);
  const n = Math.max(1, flow.steps.length);
  const slot = PDF_CHART_WIDTH / n;
  const barW = slot * FLOW_PRINT_BAR_SHARE;
  const barX = (i: number) => PDF_CHART_LEFT + i * slot + (slot - barW) / 2;
  // the zero line
  doc.setDrawColor(T.ground[0], T.ground[1], T.ground[2]);
  doc.setLineWidth(0.3);
  doc.line(PDF_CHART_LEFT, yAt(flow.zeroPct), PDF_CHART_RIGHT, yAt(flow.zeroPct));
  // the bars
  flow.steps.forEach((s, i) => {
    const fill = s.bad ? T.bad : s.kind === "in" ? T.capital : s.kind === "out" ? T.mut : T.ok;
    doc.setFillColor(fill[0], fill[1], fill[2]);
    doc.rect(barX(i), yAt(s.bottomPct + s.heightPct), barW, Math.max(0.3, (s.heightPct / 100) * plotH), "F");
  });
  // the dashed connectors carrying each running level into the next step
  doc.setDrawColor(T.mut[0], T.mut[1], T.mut[2]);
  doc.setLineWidth(0.2);
  doc.setLineDashPattern([0.6, 0.8], 0);
  flow.steps.slice(0, -1).forEach((s, i) => {
    doc.line(barX(i) + barW, yAt(s.endPct), barX(i + 1), yAt(s.endPct));
  });
  doc.setLineDashPattern([], 0);
  // the values at the bar ends
  doc.setFontSize(FLOW_PRINT_LABEL_PT);
  flow.steps.forEach((s, i) => {
    const below = s.raw < 0 && s.kind !== "out";
    const ink = s.bad ? T.bad : T.ink;
    doc.setTextColor(ink[0], ink[1], ink[2]);
    const vy = below ? yAt(s.bottomPct) + 2.6 : yAt(s.bottomPct + s.heightPct) - 1;
    doc.text(s.value, PDF_CHART_LEFT + i * slot + slot / 2, vy, { align: "center", maxWidth: slot * 0.95 });
    push(s.value);
  });
  // the names and the detail lines beneath the plot, wrapped to the slot
  const names = flowPrintNameLines(doc, flow);
  const namesTop = top + plotH + FLOW_PRINT_BELOW_ROOM + 2;
  names.forEach((lines, i) => {
    lines.forEach((l, k) => {
      const ink = l.bad ? T.bad : l.head ? T.ink : T.mut;
      doc.setTextColor(ink[0], ink[1], ink[2]);
      doc.text(l.text, PDF_CHART_LEFT + i * slot + slot / 2, namesTop + k * FLOW_PRINT_LINE_H, { align: "center", maxWidth: slot * 0.95 });
      push(l.text);
    });
  });
  const nameH = Math.max(0, ...names.map((l) => l.length)) * FLOW_PRINT_LINE_H;
  let yy = namesTop + nameH + 4;
  // the caption and the bracketed ledger lines
  doc.setFontSize(7);
  doc.setTextColor(T.mut[0], T.mut[1], T.mut[2]);
  const capLines = doc.splitTextToSize(flow.caption, PDF_CHART_WIDTH) as string[];
  doc.text(capLines, PDF_CHART_LEFT, yy);
  push(flow.caption);
  yy += capLines.length * 3.4 + 2;
  for (const r of flow.ledger) {
    const line = `${r.sourceLabel} -> ${r.useLabel}: ${r.amount} (allocated ${r.allocated})`;
    const wrapped = doc.splitTextToSize(line, PDF_CHART_WIDTH) as string[];
    doc.text(wrapped, PDF_CHART_LEFT, yy);
    push(line);
    yy += wrapped.length * 3.4;
  }
  if (flow.ledgerOmitted > 0) {
    const line = `${flow.ledgerOmitted} more authored pairings are listed on the Flow surface in the app.`;
    doc.text(line, PDF_CHART_LEFT, yy);
    yy += 3.4;
  }
  doc.setTextColor(T.ink[0], T.ink[1], T.ink[2]);
  return yy - startY + 2;
}

export function buildDeckPdf(model: DeckModel, projectName: string): jsPDF;
export function buildDeckPdf(model: DeckModel, projectName: string, trace?: DeckPdfTrace, theme?: DeckPdfTheme): jsPDF;
// v0.6.21 W33/W34: the theme parameter defaults to "dark" — the dark stage is the PDF export's
// DEFAULT (W34); "light" is the explicit paper-and-toner option (the PRINT_* vocabulary of record).
export function buildDeckPdf(model: DeckModel, projectName: string, trace?: DeckPdfTrace, theme: DeckPdfTheme = "dark"): jsPDF {
  const T = theme === "dark" ? PDF_THEME_DARK : PDF_THEME_LIGHT;
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const total = model.slides.length;
  let footerPage = 0;
  const paintPage = () => {
    doc.setFillColor(T.page[0], T.page[1], T.page[2]);
    doc.rect(0, 0, 297, 210, "F");
  };
  const addPage = () => {
    doc.addPage();
    footerPage += 1;
    paintPage();
  };
  paintPage();
  model.slides.forEach((slide) => {
    if (trace) trace.drawnFigures.push([]);
    if (footerPage > 0) addPage();
    footerPage += 1;
    const slideFirstPage = footerPage;
    // v0.6.9 Task G (finding W29): the scenarios slide reserves its block heights before
    // drawing — the body, the disclosures, the rows chart, and the target chart are measured
    // up front and the chart heights scale so the whole slide fits within
    // CONTENT_TOP..CONTENT_BOTTOM; no continuation page is created within the slide. The
    // measurement uses the exact font states the drawing paths use (body at 12, disclosures
    // at 9), so the reservation is exact for the fixtures of record.
    const allowBreak = slide.name !== "scenarios";
    let sceChartScale = 1;
    if (!allowBreak) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(12);
      const bodyH = slide.body.reduce(
        (a, fig) => a + FIGURE_LINE_HEIGHT * (doc.splitTextToSize(`${fig.label}: ${fig.value}${fig.disclosure !== undefined ? ` (${fig.disclosure})` : ""}`, 220) as string[]).length,
        0,
      );
      doc.setFontSize(9);
      const discH = slide.disclosures.reduce((a, d) => a + DISCLOSURE_LINE_HEIGHT * (doc.splitTextToSize(d, 220) as string[]).length, 0);
      const rows = slide.chart !== undefined && slide.chart.kind === "rows" ? slide.chart.data.length : 0;
      const rowsH = rows > 0 ? 7 * rows + 2 : 0;
      const targetH = slide.targetChart !== undefined && slide.targetChart.points.length >= 2 ? (slide.targetChart.mode === "solved" ? 46 : 48) : 0;
      const chartsH = rowsH + targetH;
      const available = CONTENT_BOTTOM - CONTENT_TOP - bodyH - discH;
      if (chartsH > 0 && available < chartsH) {
        // The charts scale to the measured space; the floor keeps a pathological fixture from
        // collapsing the diagrams entirely (disclosed in the completion report).
        sceChartScale = Math.max(0.35, available / chartsH);
      }
      doc.setFontSize(12);
    }
    doc.setFillColor(T.headerBand[0], T.headerBand[1], T.headerBand[2]);
    doc.rect(0, 0, 297, 14, "F");
    doc.setTextColor(T.headerText[0], T.headerText[1], T.headerText[2]);
    doc.setFontSize(9);
    doc.text(projectName.toUpperCase(), 14, 9.5);
    doc.setTextColor(T.ink[0], T.ink[1], T.ink[2]);
    doc.setFontSize(24);
    if (trace) trace.drawnTitles.push(slide.title);
    doc.text(slide.title, 20, 30, { maxWidth: 257 });
    doc.setFontSize(12);
    let y = CONTENT_TOP;
    // v0.6.13: the timeline slide draws its Gantt first, beneath the title.
    if (slide.gantt !== undefined) {
      y = drawPrintGantt(doc, T, slide.gantt, y, () => { addPage(); return CONTENT_TOP; }, trace) + 2;
    }
    // v0.6.5 Task I: the deal slide is verdict-led — the verdict draws first, before the tiles.
    if (slide.verdict !== undefined) {
      const lines = doc.splitTextToSize(`Verdict: ${slide.verdict}`, 257) as string[];
      const needed = DISCLOSURE_LINE_HEIGHT * lines.length;
      if (y + needed > CONTENT_BOTTOM) { addPage(); y = CONTENT_TOP; }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(lines, 20, y + 4);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(12);
      if (trace) trace.drawnFigures[trace.drawnFigures.length - 1]?.push(slide.verdict);
      y += needed + 4;
    }
    if (slide.tiles !== undefined && slide.tiles.length > 0) {
      const cols = 5;
      const cardW = 49;
      const cardH = 15;
      const gap = 3;
      const rows = Math.ceil(slide.tiles.length / cols);
      for (let r = 0; r < rows; r++) {
        if (y + cardH > CONTENT_BOTTOM) { addPage(); y = CONTENT_TOP; }
        for (let c = 0; c < cols; c++) {
          const t = slide.tiles[r * cols + c];
          if (t === undefined) break;
          const x = 20 + c * (cardW + gap);
          doc.setDrawColor(T.hairline[0], T.hairline[1], T.hairline[2]);
          doc.setFillColor(T.cardFill[0], T.cardFill[1], T.cardFill[2]);
          doc.roundedRect(x, y, cardW, cardH, 2, 2, "FD");
          doc.setFontSize(6);
          doc.setTextColor(T.cardLabel[0], T.cardLabel[1], T.cardLabel[2]);
          doc.text(t.label.toUpperCase(), x + 3, y + 5, { maxWidth: cardW - 6 });
          doc.setFontSize(9);
          const tv: [number, number, number] = t.tone === "ok" ? T.ok : t.tone === "bad" ? T.bad : T.ink;
          doc.setTextColor(tv[0], tv[1], tv[2]);
          const valLines = doc.splitTextToSize(t.value, cardW - 6) as string[];
          doc.text(valLines[valLines.length - 1], x + cardW - 3, y + cardH - 3, { align: "right" });
          doc.setTextColor(T.ink[0], T.ink[1], T.ink[2]);
          if (trace) {
            trace.drawnFigures[trace.drawnFigures.length - 1]?.push(t.value);
            trace.drawnFigures[trace.drawnFigures.length - 1]?.push(t.label.toUpperCase());
          }
        }
        y += cardH + gap;
      }
      y += 2;
    }
    // v0.6.5 Task C/W13: the paired composition donuts join the print route.
    if (slide.donuts !== undefined && slide.donuts.length > 0) {
      for (let di = 0; di < slide.donuts.length; di += 2) {
        if (y + 52 > CONTENT_BOTTOM) { addPage(); y = CONTENT_TOP; }
        const hLeft = drawPrintDonut(doc, T, slide.donuts[di], 20, y, model.currency ?? "SEK", model.unit ?? "ones", trace);
        const right = slide.donuts[di + 1];
        const hRight = right !== undefined ? drawPrintDonut(doc, T, right, 155, y, model.currency ?? "SEK", model.unit ?? "ones", trace) : 0;
        y += Math.max(hLeft, hRight);
      }
    }
    for (const fig of slide.body) {
      const line = `${fig.label}: ${fig.value}${fig.disclosure !== undefined ? ` (${fig.disclosure})` : ""}`;
      const lines = doc.splitTextToSize(line, 220);
      const needed = FIGURE_LINE_HEIGHT * lines.length;
      if (allowBreak && y + needed > CONTENT_BOTTOM) {
        addPage();
        y = CONTENT_TOP;
      }
      doc.setDrawColor(T.hairline[0], T.hairline[1], T.hairline[2]);
      doc.setFillColor(T.cardFill[0], T.cardFill[1], T.cardFill[2]);
      doc.roundedRect(18, y - 5, 221, needed + 3, 2, 2, "FD");
      doc.text(lines, 20, y);
      if (trace) trace.drawnFigures[trace.drawnFigures.length - 1]?.push(fig.value);
      y += needed;
    }
    doc.setFontSize(9);
    if (slide.insights !== undefined) {
      for (const d of slide.insights) {
        const lines = doc.splitTextToSize(`Insight: ${d}`, 220);
        const needed = DISCLOSURE_LINE_HEIGHT * lines.length;
        if (y + needed > CONTENT_BOTTOM) { addPage(); y = CONTENT_TOP; }
        doc.text(lines, 20, y);
        if (trace) trace.drawnFigures[trace.drawnFigures.length - 1]?.push(d);
        y += needed;
      }
    }
    if (slide.solverScenario !== null && slide.solverScenario !== undefined) {
      doc.setFontSize(9);
      doc.setTextColor(T.gold[0], T.gold[1], T.gold[2]);
      doc.text(slide.solverScenario.label, 24, y);
      doc.setTextColor(T.ink[0], T.ink[1], T.ink[2]);
      doc.text(`Required solved rent: ${slide.solverScenario.requiredPayment ?? "not applicable"}`, 24, y + 6);
      if (trace) trace.drawnFigures[trace.drawnFigures.length - 1]?.push(slide.solverScenario.label);
      y += 12;
    }
    for (const d of slide.disclosures) {
      const lines = doc.splitTextToSize(d, 220);
      const needed = DISCLOSURE_LINE_HEIGHT * lines.length;
      if (allowBreak && y + needed > CONTENT_BOTTOM) {
        addPage();
        y = CONTENT_TOP;
      }
      doc.text(lines, 20, y);
      if (trace) trace.drawnFigures[trace.drawnFigures.length - 1]?.push(d);
      y += needed;
    }
    if (slide.summaryCharts !== undefined) {
      for (const sc of slide.summaryCharts) {
        if (y + 45 > CONTENT_BOTTOM) { addPage(); y = CONTENT_TOP; }
        if (sc.kind === "hurdle" && sc.data.length >= 2) {
          const t = sc.data[0].value;
          const a = sc.data[1].value;
          doc.setFontSize(7);
          doc.setTextColor(50, 50, 50);
          doc.text(`Target ${t.toFixed(2)}%`, 24, y);
          doc.setTextColor(T.ink[0], T.ink[1], T.ink[2]);
          // v0.6.18 (AUD-10): a null achieved IRR reads "—" and draws no achieved dot
          const missing = sc.achievedMissing === true;
          const achievedText = missing ? "Achieved —" : `Achieved ${a.toFixed(2)}%`;
          doc.text(sc.solved === true ? "solved to the target" : missing ? "no achieved rate" : a >= t ? "clears the hurdle" : "below the hurdle", 120, y);
          doc.text(achievedText, 216, y, { align: "right" });
          doc.setFillColor(T.capital[0], T.capital[1], T.capital[2]);
          doc.circle(40 + (t / (Math.max(t, a) * 1.15)) * 160, y + 5, 1.4, "F");
          if (!missing) {
            const hc: [number, number, number] = a >= t ? T.ok : T.bad;
            doc.setFillColor(hc[0], hc[1], hc[2]);
            doc.circle(40 + (a / (Math.max(t, a) * 1.15)) * 160, y + 5, 1.4, "F");
          }
          if (trace) {
            trace.drawnFigures[trace.drawnFigures.length - 1]?.push(`Target ${t.toFixed(2)}%`);
            trace.drawnFigures[trace.drawnFigures.length - 1]?.push(achievedText);
          }
          y += 14;
        } else if (sc.kind === "rows" && sc.data.length > 0) {
          const chartTotal = Math.max(1e-12, sc.data.reduce((a, d) => a + d.value, 0));
          let rowY = y;
          sc.data.forEach((d, di) => {
            const sharePct = Math.round((d.value / chartTotal) * 100);
            const valText = deckMoneyForDisplay(d.value, model.currency ?? "SEK", model.unit ?? "ones");
            doc.setFontSize(7);
            doc.setTextColor(50, 50, 50);
            doc.text(`${d.label} ${sharePct}%`, 24, rowY);
            doc.setFillColor(T.capital[0], T.capital[1], T.capital[2]);
            doc.rect(120, rowY - 3, Math.max(0.5, 100 * (d.value / chartTotal)), 4, "F");
            doc.setTextColor(T.ink[0], T.ink[1], T.ink[2]);
            doc.text(valText, 216, rowY, { align: "right" });
            if (trace) {
              trace.drawnFigures[trace.drawnFigures.length - 1]?.push(`${d.label} ${sharePct}%`);
              trace.drawnFigures[trace.drawnFigures.length - 1]?.push(valText);
            }
            rowY += 7;
          });
          y = rowY + 2;
        } else if (sc.kind === "donut" && sc.data.length > 0) {
          const chartTotal = Math.max(1e-12, sc.data.reduce((a, d) => a + d.value, 0));
          let xAcc = PDF_CHART_LEFT;
          sc.data.forEach((d, di) => {
            const frac = d.value / chartTotal;
            const segW = PDF_CHART_WIDTH * frac;
            const pc2 = hexToRgb(printColorOf(T, di)); doc.setFillColor(pc2[0], pc2[1], pc2[2]);
            doc.rect(xAcc, y, segW, 6, "F");
            xAcc += segW;
          });
          doc.setFontSize(7);
          doc.setTextColor(50, 50, 50);
          let labY = y + 12;
          sc.data.forEach((d) => {
            const sharePct = Math.round((d.value / chartTotal) * 100);
            const labelText = `${d.label} ${sharePct}%`;
            doc.text(labelText, 20, labY);
            labY += 5;
            if (trace) trace.drawnFigures[trace.drawnFigures.length - 1]?.push(labelText);
          });
          y = labY + 2;
        } else if (sc.kind === "bars" && sc.data.length > 0) {
          const chartMax = Math.max(1, ...sc.data.map((d) => d.value));
          const peakIdx = sc.data.findIndex((d) => d.value === chartMax);
          const geo = chartSlots(sc.data.length);
          sc.data.forEach((d, di) => {
            const h = (d.value / chartMax) * 26;
            doc.setFillColor(T.barPos[0], T.barPos[1], T.barPos[2]);
            doc.rect(geo.x(di), y + 30 - h, geo.barW, h, "F");
          });
          doc.setFontSize(6);
          doc.setTextColor(T.mut[0], T.mut[1], T.mut[2]);
          sc.data.forEach((d, di) => {
            doc.text(d.label, geo.x(di) + geo.barW / 2, y + 34, { align: "center", maxWidth: geo.barW + 2 });
            if (trace) trace.drawnFigures[trace.drawnFigures.length - 1]?.push(d.label);
          });
          doc.setFontSize(8);
          doc.setTextColor(T.ink[0], T.ink[1], T.ink[2]);
          const peakText = deckMoneyForDisplay(chartMax, model.currency ?? "SEK", model.unit ?? "ones");
          doc.setTextColor(T.peak[0], T.peak[1], T.peak[2]);
          doc.text(peakText, geo.x(peakIdx) + geo.barW / 2, y + 26 - (chartMax / chartMax) * 26 - 2, { align: "center" });
          if (trace) trace.drawnFigures[trace.drawnFigures.length - 1]?.push(peakText);
          y += 38;
        }
      }
    }
    doc.setFontSize(10);
    if (slide.chart && slide.chart.kind === "coverage" && slide.chart.data.length > 0) {
      const covData = slide.chart.data;
      const chartMax = Math.max(1, ...covData.map((d) => Math.abs(d.value)));
      const zeroY = y + 30;
      // v0.6.21 W32: the coverage path re-bounded and centered under the geometry contract (the
      // 20..220 band retired); the axis labels compose thinned like the deck's model
      // (charts.tsx: every ceil(n/12)-th label), so a long span cannot crowd the axis.
      const geo = chartSlots(covData.length);
      const covLabelStep = Math.max(1, Math.ceil(covData.length / 12));
      doc.setDrawColor(T.hairline[0], T.hairline[1], T.hairline[2]);
      doc.line(PDF_CHART_LEFT, zeroY, PDF_CHART_RIGHT, zeroY);
      covData.forEach((d, di) => {
        const barH = Math.min(22, (Math.abs(d.value) / chartMax) * 22);
        const x = geo.x(di);
        const barW = geo.barW;
        if (d.value >= 0) {
          doc.setFillColor(T.barPos[0], T.barPos[1], T.barPos[2]);
          doc.rect(x, zeroY - barH, Math.max(0.5, barW), barH, "F");
        } else {
          doc.setFillColor(T.barNeg[0], T.barNeg[1], T.barNeg[2]);
          doc.rect(x, zeroY, Math.max(0.5, barW), barH, "F");
        }
      });
      doc.setDrawColor(T.gold[0], T.gold[1], T.gold[2]);
      covData.forEach((d, di) => {
        const x = PDF_CHART_LEFT + (di / Math.max(1, covData.length - 1)) * PDF_CHART_WIDTH;
        const yy = zeroY - (d.value / chartMax) * 22;
        if (di > 0) {
          const prev = covData[di - 1];
          const px = PDF_CHART_LEFT + ((di - 1) / Math.max(1, covData.length - 1)) * PDF_CHART_WIDTH;
          const py = zeroY - (prev.value / chartMax) * 22;
          doc.line(px, py, x, yy);
        }
      });
      // v0.6.9 Task H.1 (finding W30): the coverage year labels draw at the print ink
      // PRINT_MUT (12.82:1 against white) at font 7 — the pale 6pt ink (113,114,115, 4.82:1)
      // is retired at this, the print route's faintest surviving site.
      doc.setFontSize(7);
      doc.setTextColor(T.mut[0], T.mut[1], T.mut[2]);
      covData.forEach((d, di) => {
        if (di % covLabelStep !== 0) return;
        const x = PDF_CHART_LEFT + (di / Math.max(1, covData.length - 1)) * PDF_CHART_WIDTH;
        doc.text(d.label, x, y + 36, { align: "center", maxWidth: 20 });
        if (trace) trace.drawnFigures[trace.drawnFigures.length - 1]?.push(d.label);
      });
      doc.setTextColor(T.mut[0], T.mut[1], T.mut[2]);
      doc.text("The cumulative line crosses the axis where the outlay is covered.", 120, y + 42, { align: "center", maxWidth: 180 });
      doc.setTextColor(T.ink[0], T.ink[1], T.ink[2]);
      y += 50;
    } else if (slide.chart && slide.chart.kind === "rows" && slide.chart.data.length > 0 && slide.waterfall === undefined) {
      const chartTotal = Math.max(1e-12, slide.chart.data.reduce((a, d) => a + d.value, 0));
      // v0.6.9 Task G: on the scenarios slide the row height scales to the reserved space
      // (sceChartScale is 1 everywhere else, including the investment slide's rows chart).
      const rowStep = 7 * sceChartScale;
      const rowGap = 2 * sceChartScale;
      let rowY = y;
      slide.chart.data.forEach((d) => {
        const sharePct = Math.round((d.value / chartTotal) * 100);
        const valText = deckMoneyForDisplay(d.value, model.currency ?? "SEK", model.unit ?? "ones");
        doc.setFontSize(7);
        doc.setTextColor(50, 50, 50);
        doc.text(`${d.label} ${sharePct}%`, 24, rowY);
        doc.setFillColor(T.capital[0], T.capital[1], T.capital[2]);
        doc.rect(120, rowY - 3, Math.max(0.5, 100 * (d.value / chartTotal)), 4, "F");
        doc.setTextColor(T.ink[0], T.ink[1], T.ink[2]);
        doc.text(valText, 216, rowY, { align: "right" });
        if (trace) {
          trace.drawnFigures[trace.drawnFigures.length - 1]?.push(`${d.label} ${sharePct}%`);
          trace.drawnFigures[trace.drawnFigures.length - 1]?.push(valText);
        }
        rowY += rowStep;
      });
      y = rowY + rowGap;
    } else if (slide.chart && slide.chart.kind === "donut" && slide.chart.data.length > 0) {
      let accY = y;
      const chartTotal = Math.max(1e-12, slide.chart.data.reduce((a, d) => a + d.value, 0));
      const colors = T.donut;
      const x0 = 240;
      slide.chart.data.forEach((d, di) => {
        const frac = d.value / chartTotal;
        doc.setFillColor(colors[di % colors.length]);
        doc.rect(x0, accY, 60 * frac, 6, "F");
        doc.setTextColor(50, 50, 50);
        doc.setFontSize(8);
        doc.text(`${d.label}`, x0 + 66, accY + 5);
        accY += 10;
      });
      doc.setFontSize(12);
      doc.setTextColor(T.ink[0], T.ink[1], T.ink[2]);
    } else if (slide.chart && slide.chart.kind === "bars" && slide.chart.data.length > 0) {
      // v0.6.18: the per-year bars carry their year labels (thinned on a long span) and the peak figure, drawn
      // from the deck model's series (the operations slide's yearly burn rides the same branch)
      const bars = slide.chart.data;
      const chartMax = Math.max(1, ...bars.map((d) => d.value));
      // v0.6.21 W32: the print-chart geometry contract — the chart body is bounded to 20..277 mm,
      // centered in the 14..283 mm content band; the bar width derives from the available width and
      // the slot count with a proportional inter-bar gap.
      const geo = chartSlots(bars.length);
      const labelStep = Math.max(1, Math.ceil(bars.length / 14));
      const peakIdx = bars.findIndex((d) => d.value === chartMax);
      if (slide.chart.kicker !== undefined) {
        doc.setFontSize(8);
        doc.setTextColor(T.mut[0], T.mut[1], T.mut[2]);
        doc.text(slide.chart.kicker, 20, y);
        if (trace) trace.drawnFigures[trace.drawnFigures.length - 1]?.push(slide.chart.kicker);
        y += 4;
        if (slide.chart.periodNote !== undefined) {
          doc.setFontSize(7);
          doc.text(slide.chart.periodNote, 20, y);
          if (trace) trace.drawnFigures[trace.drawnFigures.length - 1]?.push(slide.chart.periodNote);
          y += 4;
        }
        doc.setTextColor(T.ink[0], T.ink[1], T.ink[2]);
        y += 1;
      }
      bars.forEach((d, di) => {
        const h = (d.value / chartMax) * 40;
        doc.setFillColor(T.barPos[0], T.barPos[1], T.barPos[2]);
        doc.rect(geo.x(di), y + 44 - h, geo.barW, h, "F");
      });
      doc.setFontSize(6);
      doc.setTextColor(T.mut[0], T.mut[1], T.mut[2]);
      bars.forEach((d, di) => {
        if (di % labelStep !== 0) return;
        doc.text(d.label, geo.x(di) + geo.barW / 2, y + 48, { align: "center" });
        if (trace) trace.drawnFigures[trace.drawnFigures.length - 1]?.push(d.label);
      });
      if (chartMax > 1 || bars.some((d) => d.value > 0)) {
        const peakText = deckMoneyForDisplay(chartMax, model.currency ?? "SEK", model.unit ?? "ones");
        doc.setFontSize(7);
        doc.setTextColor(T.peak[0], T.peak[1], T.peak[2]);
        doc.text(peakText, geo.x(peakIdx) + geo.barW / 2, y + 44 - 40 - 1.5, { align: "center" });
        if (trace) trace.drawnFigures[trace.drawnFigures.length - 1]?.push(peakText);
      }
      doc.setFontSize(10);
      y += 54;
    }
    // v0.6.15 Task D: the investment waterfall — the ledger rows, then the stepped columns.
    if (slide.waterfall !== undefined) {
      let edgeTop = y;
      const drawEdge = (to: number) => {
        // the closure edge: the 100 percent line runs through every ledger row
        doc.setDrawColor(T.connector[0], T.connector[1], T.connector[2]);
        doc.setLineDashPattern([0.8, 0.8], 0);
        doc.line(110 + 100, edgeTop, 110 + 100, to);
        doc.setLineDashPattern([], 0);
        doc.setDrawColor(0, 0, 0);
      };
      for (const r of slide.waterfall.rows) {
        const h = ledgerRowHeight(doc, r);
        if (allowBreak && y + h > CONTENT_BOTTOM) { drawEdge(y); addPage(); y = CONTENT_TOP; edgeTop = y; }
        y += drawPrintLedgerRow(doc, T, r, y, trace);
      }
      drawEdge(y);
      y += 3;
      const colH = 8 + 26 + 4 + 7 + 3;
      if (allowBreak && y + colH > CONTENT_BOTTOM) { addPage(); y = CONTENT_TOP; }
      y += drawPrintColumns(doc, T, slide.waterfall.columns, y, trace);
      doc.setFontSize(10);
    }
    // v0.6.22 Task E: the flow slide's primary chart draws on the print route from the same
    // composed slot, bounded per the W32 geometry contract.
    if (slide.flow !== undefined) {
      const flowH = flowPrintHeight(doc, slide.flow);
      if (allowBreak && y + flowH > CONTENT_BOTTOM) { addPage(); y = CONTENT_TOP; }
      y += drawPrintFlow(doc, T, slide.flow, y, trace);
      doc.setFontSize(10);
    }
    // v0.6.10 Task G.5: the funding breakdown renders through the deck's PDF pipeline — after
    // the rows chart on the investment slide; the headline figures plus the rows list,
    // text-only (the slide carries the structured block from deck.ts; the PDF draws it).
    if (slide.funding !== undefined) {
      const f = slide.funding;
      doc.setFontSize(9);
      const fundingLines: string[] = [
        `${f.grossLabel}: ${f.gross}`,
        `Grants: ${f.grants}`,
        `Net private capital: ${f.net}`,
        `Grant intensity: ${f.intensity}`,
      ];
      for (const r of f.rows) {
        fundingLines.push(`${r.label} (${r.kind === "grant" ? "grant" : "interest-free note"}, year ${r.year}${r.term != null ? `, term ${r.term} years` : ""}): ${r.value}`);
      }
      for (const line of fundingLines) {
        const wrapped = doc.splitTextToSize(line, 220) as string[];
        const needed = DISCLOSURE_LINE_HEIGHT * wrapped.length;
        if (allowBreak && y + needed > CONTENT_BOTTOM) { addPage(); y = CONTENT_TOP; }
        doc.text(wrapped, 20, y);
        if (trace) trace.drawnFigures[trace.drawnFigures.length - 1]?.push(line);
        y += needed;
      }
      doc.setFontSize(10);
    }
    // v0.6.5 Task B/W11: the scenarios target chart joins the print route.
    // v0.6.9 Task G: the scenarios slide never breaks here — the reserved, scaled height
    // is guaranteed within the content band by the up-front measurement above.
    if (slide.targetChart !== undefined && slide.targetChart.points.length >= 2) {
      if (allowBreak && y + 50 > CONTENT_BOTTOM) { addPage(); y = CONTENT_TOP; }
      y += drawPrintScenarioTarget(doc, T, slide.targetChart, y, model.currency ?? "SEK", model.unit ?? "ones", trace, sceChartScale);
    }
    doc.setFontSize(10);
    doc.setDrawColor(T.hairline[0], T.hairline[1], T.hairline[2]);
    doc.line(14, 190, 283, 190);
    doc.setTextColor(T.mut[0], T.mut[1], T.mut[2]);
    doc.text(`${projectName} — slide ${slideFirstPage} of ${total} slides — Generated from the live model`, 14, 195);
  });
  return doc;
}
