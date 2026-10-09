import { jsPDF } from "jspdf";
import { deckMoneyForDisplay } from "./engine.js";
import type { DeckModel } from "./deck.js";

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
          doc.setTextColor(t.tone === "ok" ? 5 : t.tone === "bad" ? 225 : 0, t.tone === "ok" ? 150 : t.tone === "bad" ? 29 : 0, t.tone === "ok" ? 105 : t.tone === "bad" ? 72 : 0);
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
      doc.setTextColor(180, 132, 10);
      doc.text(slide.solverScenario.label, 24, y);
      doc.setTextColor(0, 0, 0);
      doc.text(`Required solved rent: ${slide.solverScenario.requiredPayment ?? "not applicable"}`, 24, y + 6);
      if (trace) trace.drawnFigures[trace.drawnFigures.length - 1]?.push(slide.solverScenario.label);
      y += 12;
    }
    if (slide.verdict !== undefined) {
      const lines = doc.splitTextToSize(`Verdict: ${slide.verdict}`, 220);
      const needed = DISCLOSURE_LINE_HEIGHT * lines.length;
      if (y + needed > CONTENT_BOTTOM) { doc.addPage(); footerPage += 1; y = CONTENT_TOP; }
      doc.text(lines, 20, y);
      if (trace) trace.drawnFigures[trace.drawnFigures.length - 1]?.push(slide.verdict);
      y += needed;
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
    slidePageCount.push(footerPage - slideFirstPage + 1);
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
          doc.setFillColor(a >= t ? 5 : 225, a >= t ? 150 : 29, a >= t ? 105 : 72);
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
          const colors = ["#0074ba", "#34d399", "#fb7185", "#b45309", "#717273", "#103558"];
          let xAcc = 20;
          sc.data.forEach((d, di) => {
            const frac = d.value / chartTotal;
            const segW = 200 * frac;
            doc.setFillColor(colors[di % colors.length]);
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
            doc.setFillColor(52, 211, 153);
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
          doc.setFillColor(52, 211, 153);
          doc.rect(x, zeroY - barH, Math.max(0.5, barW), barH, "F");
        } else {
          doc.setFillColor(251, 113, 133);
          doc.rect(x, zeroY, Math.max(0.5, barW), barH, "F");
        }
        if (trace) trace.drawnFigures[trace.drawnFigures.length - 1]?.push(d.label);
      });
      doc.setDrawColor(232, 184, 75);
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
      doc.setTextColor(204, 233, 255);
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
      let acc = 0;
      const colors = ["#0074ba", "#34d399", "#fb7185", "#b45309", "#717273", "#103558"];
      const x0 = 240;
      slide.chart.data.forEach((d, di) => {
        const frac = d.value / chartTotal;
        doc.setFillColor(colors[di % colors.length]);
        doc.rect(x0, accY, 60 * frac, 6, "F");
        doc.setTextColor(50, 50, 50);
        doc.setFontSize(8);
        doc.text(`${d.label}`, x0 + 66, accY + 5);
        accY += 10;
        acc += frac;
      });
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
    } else if (slide.chart && slide.chart.kind === "bars" && slide.chart.data.length > 0) {
      const chartMax = Math.max(1, ...slide.chart.data.map((d) => d.value));
      const barW = Math.min(12, 220 / slide.chart.data.length);
      slide.chart.data.forEach((d, di) => {
        const h = (d.value / chartMax) * 40;
        doc.setFillColor(52, 211, 153);
        doc.rect(20 + di * (barW + 3), y + 44 - h, barW, h, "F");
      });
      y += 50;
    }
    doc.setFontSize(10);
    doc.setDrawColor(229, 229, 234);
    doc.line(14, 190, 283, 190);
    doc.text(`${projectName} — slide ${slideFirstPage} of ${total} slides — Generated from the live model`, 14, 195);
  });
  return doc;
}
