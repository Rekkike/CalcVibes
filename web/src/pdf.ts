import { jsPDF } from "jspdf";
import type { DeckModel } from "./deck.js";

export interface DeckPdfResult {
  doc: jsPDF;
  drawnTitles: string[];
}

export function buildDeckPdf(model: DeckModel, projectName: string): jsPDF;
export function buildDeckPdf(model: DeckModel, projectName: string, trace: { drawnTitles: string[] }): jsPDF;
export function buildDeckPdf(model: DeckModel, projectName: string, trace?: { drawnTitles: string[] }): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const total = model.slides.length;
  model.slides.forEach((slide, i) => {
    if (i > 0) doc.addPage();
    doc.setFontSize(24);
    if (trace) trace.drawnTitles.push(slide.title);
    doc.text(slide.title, 20, 30, { maxWidth: 257 });
    doc.setFontSize(12);
    let y = 55;
    for (const fig of slide.body) {
      const line = `${fig.label}: ${fig.value}${fig.disclosure !== undefined ? ` (${fig.disclosure})` : ""}`;
      const lines = doc.splitTextToSize(line, 220);
      doc.text(lines, 20, y);
      y += 8 * lines.length;
      if (y > 170) break;
    }
    doc.setFontSize(9);
    for (const d of slide.disclosures) {
      const lines = doc.splitTextToSize(d, 220);
      doc.text(lines, 20, y);
      y += 6 * lines.length;
    }
    doc.setFontSize(10);
    doc.text(`${projectName} — page ${i + 1} of ${total}`, 20, 195);
  });
  return doc;
}
