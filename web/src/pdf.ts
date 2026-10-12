import { jsPDF } from "jspdf";
import { deckMoneyForDisplay, percentTwoForDisplay } from "./engine.js";
import type { DeckModel, DeckDonut, ScenarioTargetChart } from "./deck.js";

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

// v0.6.5 Task H/W16: the print palette — the stage palette never appears on the paper route.
// Every drawn element meets the contrast contract against the white page (>= 4.99:1 for the
// ink family; the semantic ok/bad tones carry their meaning in print-darkened form).
const PRINT_OK: [number, number, number] = [4, 120, 87]; // #047857
const PRINT_BAD: [number, number, number] = [190, 18, 60]; // #be123c
const PRINT_GOLD: [number, number, number] = [146, 100, 14]; // #92640e — the crossing gold in print ink
const PRINT_MUT: [number, number, number] = [50, 50, 50]; // caption ink on paper
// the print donut/segment palette: every entry >= 4.99:1 on white
const PRINT_DONUT_COLORS = ["#0074ba", "#047857", "#b45309", "#6d28d9", "#be123c", "#103558"];

function printColorOf(index: number): string {
  return PRINT_DONUT_COLORS[index % PRINT_DONUT_COLORS.length];
}

// v0.6.5 Task C/W13: the composition donut on the print route — pie-slice polygons through
// doc.lines, a white center circle, the center total, and direct labels beside the geometry.
function drawPrintDonut(doc: jsPDF, donut: DeckDonut, x: number, y: number, currency: string, unit: string, trace?: DeckPdfTrace): number {
  const total = Math.max(1e-12, donut.segments.reduce((a, s) => a + s.value, 0));
  const cx = x + 22;
  const cy = y + 26;
  const outerR = 17;
  const innerR = 11;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text(donut.title, x, y + 4);
  doc.setFont("helvetica", "normal");
  if (trace) trace.drawnFigures[trace.drawnFigures.length - 1]?.push(donut.title);
  let acc = 0;
  if (donut.segments.length <= 1) {
    doc.setFillColor(printColorOf(0));
    doc.circle(cx, cy, outerR, "F");
  } else {
    for (let i = 0; i < donut.segments.length; i++) {
      const frac = donut.segments[i].value / total;
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
      doc.setFillColor(printColorOf(i));
      doc.lines(path, cx, cy, [1, 1], "F", true);
    }
  }
  doc.setFillColor(255, 255, 255);
  doc.circle(cx, cy, innerR, "F");
  doc.setFontSize(7);
  doc.setTextColor(0, 0, 0);
  const centerLines = doc.splitTextToSize(deckMoneyForDisplay(total, currency, unit), innerR * 2 - 2) as string[];
  doc.text(centerLines[centerLines.length - 1], cx, cy + 1, { align: "center" });
  if (trace) trace.drawnFigures[trace.drawnFigures.length - 1]?.push(deckMoneyForDisplay(total, currency, unit));
  let labY = y + 12;
  donut.segments.forEach((s, si) => {
    doc.setFillColor(printColorOf(si));
    doc.rect(x + 46, labY - 2.5, 3, 3, "F");
    doc.setFontSize(7);
    doc.setTextColor(PRINT_MUT[0], PRINT_MUT[1], PRINT_MUT[2]);
    doc.text(`${s.label} ${deckMoneyForDisplay(s.value, currency, unit)}`, x + 51, labY);
    doc.setTextColor(0, 0, 0);
    if (trace) trace.drawnFigures[trace.drawnFigures.length - 1]?.push(`${s.label} ${deckMoneyForDisplay(s.value, currency, unit)}`);
    labY += 5;
  });
  if (donut.disclosure !== undefined) {
    doc.setFontSize(7);
    doc.setTextColor(PRINT_MUT[0], PRINT_MUT[1], PRINT_MUT[2]);
    const dLines = doc.splitTextToSize(donut.disclosure, 120) as string[];
    doc.text(dLines, x, y + 48);
    doc.setTextColor(0, 0, 0);
    if (trace) trace.drawnFigures[trace.drawnFigures.length - 1]?.push(donut.disclosure);
  }
  return donut.disclosure !== undefined ? 58 : 52;
}

// v0.6.5 Task B/W11: the scenarios target chart on the print route — zero-based bars, verdict
// colors in print ink, the break-even target marked as the crossing with its caption.
function drawPrintScenarioTarget(doc: jsPDF, tc: ScenarioTargetChart, y: number, currency: string, unit: string, trace?: DeckPdfTrace): number {
  const n = Math.max(1, tc.points.length);
  const barW = Math.min(20, 200 / n);
  doc.setFontSize(8);
  doc.setTextColor(PRINT_MUT[0], PRINT_MUT[1], PRINT_MUT[2]);
  doc.text(tc.kicker, 20, y);
  doc.setTextColor(0, 0, 0);
  if (tc.mode === "solved") {
    const maxV = Math.max(1e-12, ...tc.points.map((p) => p.value));
    const baseline = y + 30;
    doc.setDrawColor(229, 229, 234);
    doc.line(20, baseline, 220, baseline);
    tc.points.forEach((p, i) => {
      const h = (Math.max(0, p.value) / maxV) * 22;
      doc.setFillColor(PRINT_OK[0], PRINT_OK[1], PRINT_OK[2]);
      doc.rect(20 + i * (barW + 2), baseline - h, barW, h, "F");
    });
    tc.points.forEach((p, i) => {
      doc.setFontSize(6);
      doc.setTextColor(PRINT_MUT[0], PRINT_MUT[1], PRINT_MUT[2]);
      doc.text(p.label, 20 + i * (barW + 2) + barW / 2, baseline + 4, { align: "center", maxWidth: barW + 2 });
      const valText = deckMoneyForDisplay(p.value, currency, unit);
      doc.text(valText, 20 + i * (barW + 2) + barW / 2, baseline + 8, { align: "center", maxWidth: barW + 6 });
      doc.setTextColor(0, 0, 0);
      if (trace) {
        trace.drawnFigures[trace.drawnFigures.length - 1]?.push(p.label);
        trace.drawnFigures[trace.drawnFigures.length - 1]?.push(valText);
      }
    });
    return 46;
  }
  const zeroY = y + 18;
  const maxAbs = Math.max(1e-12, ...tc.points.map((p) => Math.abs(p.value)));
  tc.points.forEach((p, i) => {
    const h = (Math.abs(p.value) / maxAbs) * 12;
    const col = p.met ? PRINT_OK : PRINT_BAD;
    doc.setFillColor(col[0], col[1], col[2]);
    if (p.value >= 0) doc.rect(20 + i * (barW + 2), zeroY - h, barW, h, "F");
    else doc.rect(20 + i * (barW + 2), zeroY, barW, h, "F");
  });
  doc.setDrawColor(229, 229, 234);
  doc.line(20, zeroY, 220, zeroY);
  if (tc.breakEvenTarget !== null && n > 0) {
    const first = tc.points[0].target;
    const last = tc.points[n - 1].target;
    const frac = tc.breakEvenTarget <= first ? 0 : tc.breakEvenTarget >= last ? 1 : (tc.breakEvenTarget - first) / (last - first);
    const bx = 20 + frac * 200;
    doc.setDrawColor(PRINT_GOLD[0], PRINT_GOLD[1], PRINT_GOLD[2]);
    doc.setLineWidth(0.6);
    doc.line(bx, y + 8, bx, y + 30);
    doc.setLineWidth(0.2);
    const caption = `break-even at ${percentTwoForDisplay(tc.breakEvenTarget)}`;
    doc.setFontSize(7);
    doc.setTextColor(PRINT_GOLD[0], PRINT_GOLD[1], PRINT_GOLD[2]);
    doc.text(caption, bx, y + 34, { align: frac > 0.5 ? "right" : "left", maxWidth: 100 });
    doc.setTextColor(0, 0, 0);
    if (trace) trace.drawnFigures[trace.drawnFigures.length - 1]?.push(caption);
  }
  tc.points.forEach((p, i) => {
    doc.setFontSize(6);
    doc.setTextColor(PRINT_MUT[0], PRINT_MUT[1], PRINT_MUT[2]);
    doc.text(`${p.label} ${p.met ? "met" : "not met"}`, 20 + i * (barW + 2) + barW / 2, y + 40, { align: "center", maxWidth: barW + 8 });
    doc.setTextColor(0, 0, 0);
    if (trace) trace.drawnFigures[trace.drawnFigures.length - 1]?.push(`${p.label} ${p.met ? "met" : "not met"}`);
  });
  return 48;
}

export function buildDeckPdf(model: DeckModel, projectName: string): jsPDF;
export function buildDeckPdf(model: DeckModel, projectName: string, trace: DeckPdfTrace): jsPDF;
export function buildDeckPdf(model: DeckModel, projectName: string, trace?: DeckPdfTrace): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const total = model.slides.length;
  let footerPage = 0;
  const slidePageCount: number[] = [];
  model.slides.forEach((slide) => {
    if (trace) trace.drawnFigures.push([]);
    if (footerPage > 0) doc.addPage();
    footerPage += 1;
    const slideFirstPage = footerPage;
    doc.setFillColor(16, 53, 88);
    doc.rect(0, 0, 297, 14, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.text(projectName.toUpperCase(), 14, 9.5);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(24);
    if (trace) trace.drawnTitles.push(slide.title);
    doc.text(slide.title, 20, 30, { maxWidth: 257 });
    doc.setFontSize(12);
    let y = CONTENT_TOP;
    // v0.6.5 Task I: the deal slide is verdict-led — the verdict draws first, before the tiles.
    if (slide.verdict !== undefined) {
      const lines = doc.splitTextToSize(`Verdict: ${slide.verdict}`, 257) as string[];
      const needed = DISCLOSURE_LINE_HEIGHT * lines.length;
      if (y + needed > CONTENT_BOTTOM) { doc.addPage(); footerPage += 1; y = CONTENT_TOP; }
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
        if (y + cardH > CONTENT_BOTTOM) { doc.addPage(); footerPage += 1; y = CONTENT_TOP; }
        for (let c = 0; c < cols; c++) {
          const t = slide.tiles[r * cols + c];
          if (t === undefined) break;
          const x = 20 + c * (cardW + gap);
          doc.setDrawColor(229, 229, 234);
          doc.setFillColor(255, 255, 255);
          doc.roundedRect(x, y, cardW, cardH, 2, 2, "FD");
          doc.setFontSize(6);
          doc.setTextColor(113, 114, 115);
          doc.text(t.label.toUpperCase(), x + 3, y + 5, { maxWidth: cardW - 6 });
          doc.setFontSize(9);
          const tv: [number, number, number] = t.tone === "ok" ? PRINT_OK : t.tone === "bad" ? PRINT_BAD : [0, 0, 0];
          doc.setTextColor(tv[0], tv[1], tv[2]);
          const valLines = doc.splitTextToSize(t.value, cardW - 6) as string[];
          doc.text(valLines[valLines.length - 1], x + cardW - 3, y + cardH - 3, { align: "right" });
          doc.setTextColor(0, 0, 0);
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
        if (y + 52 > CONTENT_BOTTOM) { doc.addPage(); footerPage += 1; y = CONTENT_TOP; }
        const hLeft = drawPrintDonut(doc, slide.donuts[di], 20, y, model.currency ?? "SEK", model.unit ?? "ones", trace);
        const right = slide.donuts[di + 1];
        const hRight = right !== undefined ? drawPrintDonut(doc, right, 155, y, model.currency ?? "SEK", model.unit ?? "ones", trace) : 0;
        y += Math.max(hLeft, hRight);
      }
    }
    for (const fig of slide.body) {
      const line = `${fig.label}: ${fig.value}${fig.disclosure !== undefined ? ` (${fig.disclosure})` : ""}`;
      const lines = doc.splitTextToSize(line, 220);
      const needed = FIGURE_LINE_HEIGHT * lines.length;
      if (y + needed > CONTENT_BOTTOM) {
        doc.addPage();
        footerPage += 1;
        y = CONTENT_TOP;
      }
      doc.setDrawColor(229, 229, 234);
      doc.setFillColor(255, 255, 255);
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
        if (y + needed > CONTENT_BOTTOM) { doc.addPage(); footerPage += 1; y = CONTENT_TOP; }
        doc.text(lines, 20, y);
        if (trace) trace.drawnFigures[trace.drawnFigures.length - 1]?.push(d);
        y += needed;
      }
    }
    if (slide.solverScenario !== null && slide.solverScenario !== undefined) {
      doc.setFontSize(9);
      doc.setTextColor(PRINT_GOLD[0], PRINT_GOLD[1], PRINT_GOLD[2]);
      doc.text(slide.solverScenario.label, 24, y);
      doc.setTextColor(0, 0, 0);
      doc.text(`Required solved rent: ${slide.solverScenario.requiredPayment ?? "not applicable"}`, 24, y + 6);
      if (trace) trace.drawnFigures[trace.drawnFigures.length - 1]?.push(slide.solverScenario.label);
      y += 12;
    }
    for (const d of slide.disclosures) {
      const lines = doc.splitTextToSize(d, 220);
      const needed = DISCLOSURE_LINE_HEIGHT * lines.length;
      if (y + needed > CONTENT_BOTTOM) {
        doc.addPage();
        footerPage += 1;
        y = CONTENT_TOP;
      }
      doc.text(lines, 20, y);
      if (trace) trace.drawnFigures[trace.drawnFigures.length - 1]?.push(d);
      y += needed;
    }
    if (slide.summaryCharts !== undefined) {
      for (const sc of slide.summaryCharts) {
        if (y + 45 > CONTENT_BOTTOM) { doc.addPage(); footerPage += 1; y = CONTENT_TOP; }
        if (sc.kind === "hurdle" && sc.data.length >= 2) {
          const t = sc.data[0].value;
          const a = sc.data[1].value;
          doc.setFontSize(7);
          doc.setTextColor(50, 50, 50);
          doc.text(`Target ${t.toFixed(2)}%`, 24, y);
          doc.setTextColor(0, 0, 0);
          doc.text(sc.solved === true ? "solved to the target" : a >= t ? "clears the hurdle" : "below the hurdle", 120, y);
          doc.text(`Achieved ${a.toFixed(2)}%`, 216, y, { align: "right" });
          doc.setFillColor(0, 116, 186);
          doc.circle(40 + (t / (Math.max(t, a) * 1.15)) * 160, y + 5, 1.4, "F");
          const hc: [number, number, number] = a >= t ? PRINT_OK : PRINT_BAD;
          doc.setFillColor(hc[0], hc[1], hc[2]);
          doc.circle(40 + (a / (Math.max(t, a) * 1.15)) * 160, y + 5, 1.4, "F");
          if (trace) {
            trace.drawnFigures[trace.drawnFigures.length - 1]?.push(`Target ${t.toFixed(2)}%`);
            trace.drawnFigures[trace.drawnFigures.length - 1]?.push(`Achieved ${a.toFixed(2)}%`);
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
            doc.setFillColor(0, 116, 186);
            doc.rect(120, rowY - 3, Math.max(0.5, 100 * (d.value / chartTotal)), 4, "F");
            doc.setTextColor(0, 0, 0);
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
          let xAcc = 20;
          sc.data.forEach((d, di) => {
            const frac = d.value / chartTotal;
            const segW = 200 * frac;
            doc.setFillColor(printColorOf(di));
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
          const barW = Math.min(14, 200 / sc.data.length);
          sc.data.forEach((d, di) => {
            const h = (d.value / chartMax) * 26;
            doc.setFillColor(PRINT_OK[0], PRINT_OK[1], PRINT_OK[2]);
            doc.rect(20 + di * (barW + 2), y + 30 - h, barW, h, "F");
          });
          doc.setFontSize(6);
          doc.setTextColor(113, 114, 115);
          sc.data.forEach((d, di) => {
            doc.text(d.label, 20 + di * (barW + 2) + barW / 2, y + 34, { align: "center", maxWidth: barW + 2 });
            if (trace) trace.drawnFigures[trace.drawnFigures.length - 1]?.push(d.label);
          });
          doc.setFontSize(8);
          doc.setTextColor(0, 0, 0);
          const peakText = deckMoneyForDisplay(chartMax, model.currency ?? "SEK", model.unit ?? "ones");
          doc.text(peakText, 20 + peakIdx * (barW + 2) + barW / 2, y + 26 - (chartMax / chartMax) * 26 - 2, { align: "center" });
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
      doc.setDrawColor(229, 229, 234);
      doc.line(20, zeroY, 220, zeroY);
      covData.forEach((d, di) => {
        const barH = Math.min(22, (Math.abs(d.value) / chartMax) * 22);
        const x = 20 + (di / Math.max(1, covData.length)) * 200;
        const barW = 200 / Math.max(1, covData.length) - 1;
        if (d.value >= 0) {
          doc.setFillColor(PRINT_OK[0], PRINT_OK[1], PRINT_OK[2]);
          doc.rect(x, zeroY - barH, Math.max(0.5, barW), barH, "F");
        } else {
          doc.setFillColor(PRINT_BAD[0], PRINT_BAD[1], PRINT_BAD[2]);
          doc.rect(x, zeroY, Math.max(0.5, barW), barH, "F");
        }
        if (trace) trace.drawnFigures[trace.drawnFigures.length - 1]?.push(d.label);
      });
      doc.setDrawColor(PRINT_GOLD[0], PRINT_GOLD[1], PRINT_GOLD[2]);
      covData.forEach((d, di) => {
        const x = 20 + (di / Math.max(1, covData.length - 1)) * 200;
        const yy = zeroY - (d.value / chartMax) * 22;
        if (di > 0) {
          const prev = covData[di - 1];
          const px = 20 + ((di - 1) / Math.max(1, covData.length - 1)) * 200;
          const py = zeroY - (prev.value / chartMax) * 22;
          doc.line(px, py, x, yy);
        }
      });
      doc.setFontSize(6);
      doc.setTextColor(113, 114, 115);
      covData.forEach((d, di) => {
        const x = 20 + (di / Math.max(1, covData.length - 1)) * 200;
        doc.text(d.label, x, y + 36, { align: "center", maxWidth: 20 });
      });
      doc.setTextColor(PRINT_MUT[0], PRINT_MUT[1], PRINT_MUT[2]);
      doc.text("The cumulative line crosses the axis where the outlay is covered.", 120, y + 42, { align: "center", maxWidth: 180 });
      doc.setTextColor(0, 0, 0);
      y += 50;
    } else if (slide.chart && slide.chart.kind === "rows" && slide.chart.data.length > 0) {
      const chartTotal = Math.max(1e-12, slide.chart.data.reduce((a, d) => a + d.value, 0));
      let rowY = y;
      slide.chart.data.forEach((d) => {
        const sharePct = Math.round((d.value / chartTotal) * 100);
        const valText = deckMoneyForDisplay(d.value, model.currency ?? "SEK", model.unit ?? "ones");
        doc.setFontSize(7);
        doc.setTextColor(50, 50, 50);
        doc.text(`${d.label} ${sharePct}%`, 24, rowY);
        doc.setFillColor(0, 116, 186);
        doc.rect(120, rowY - 3, Math.max(0.5, 100 * (d.value / chartTotal)), 4, "F");
        doc.setTextColor(0, 0, 0);
        doc.text(valText, 216, rowY, { align: "right" });
        if (trace) {
          trace.drawnFigures[trace.drawnFigures.length - 1]?.push(`${d.label} ${sharePct}%`);
          trace.drawnFigures[trace.drawnFigures.length - 1]?.push(valText);
        }
        rowY += 7;
      });
      y = rowY + 2;
    } else if (slide.chart && slide.chart.kind === "donut" && slide.chart.data.length > 0) {
      let accY = y;
      const chartTotal = Math.max(1e-12, slide.chart.data.reduce((a, d) => a + d.value, 0));
      const colors = PRINT_DONUT_COLORS;
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
      doc.setTextColor(0, 0, 0);
    } else if (slide.chart && slide.chart.kind === "bars" && slide.chart.data.length > 0) {
      const chartMax = Math.max(1, ...slide.chart.data.map((d) => d.value));
      const barW = Math.min(12, 220 / slide.chart.data.length);
      slide.chart.data.forEach((d, di) => {
        const h = (d.value / chartMax) * 40;
        doc.setFillColor(PRINT_OK[0], PRINT_OK[1], PRINT_OK[2]);
        doc.rect(20 + di * (barW + 3), y + 44 - h, barW, h, "F");
      });
      y += 50;
    }
    // v0.6.5 Task B/W11: the scenarios target chart joins the print route.
    if (slide.targetChart !== undefined && slide.targetChart.points.length >= 2) {
      if (y + 50 > CONTENT_BOTTOM) { doc.addPage(); footerPage += 1; y = CONTENT_TOP; }
      y += drawPrintScenarioTarget(doc, slide.targetChart, y, model.currency ?? "SEK", model.unit ?? "ones", trace);
    }
    doc.setFontSize(10);
    doc.setDrawColor(229, 229, 234);
    doc.line(14, 190, 283, 190);
    doc.text(`${projectName} — slide ${slideFirstPage} of ${total} slides — Generated from the live model`, 14, 195);
  });
  return doc;
}
