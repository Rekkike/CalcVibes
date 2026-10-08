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
      doc.text(lines, 20, y);
      if (trace) trace.drawnFigures[trace.drawnFigures.length - 1]?.push(fig.value);
      y += needed;
    }
    doc.setFontSize(9);
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
    doc.text(`${projectName} — page ${slideFirstPage} of ${total} slides`, 20, 195);
  });
  return doc;
}
