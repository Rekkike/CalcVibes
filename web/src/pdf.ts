import { jsPDF } from "jspdf";
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
    doc.setFontSize(10);
    if (slide.chart && slide.chart.kind === "donut" && slide.chart.data.length > 0) {
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
