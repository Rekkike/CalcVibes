// v0.6.20 — the PDF text extraction module of the timeline import, loaded LAZILY on the first import
// (the clearance increment: the extractor stays off the initial bundle, roughly 132 kB gzip, and loads
// only when the user actually imports a PDF). Vite code-splits this module and pdfjs-dist into their own
// chunks, fetched on demand. In the browser build Vite turns the ?url import into the bundled worker asset
// and PDF.js runs a real Worker; under Node (the test battery) the fake worker imports the worker module
// itself, which requires a file: URL, so there the module path is resolved locally. The application stays
// a client-side static site: no backend, no upload, no cloud.
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import workerAssetUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

const isNodeRuntime = typeof process !== "undefined" && typeof process.versions?.node === "string";
const importMeta = import.meta as ImportMeta & { resolve?: (specifier: string) => string };
pdfjsLib.GlobalWorkerOptions.workerSrc = isNodeRuntime && importMeta.resolve !== undefined
  ? importMeta.resolve("pdfjs-dist/legacy/build/pdf.worker.min.mjs")
  : workerAssetUrl;

export interface TextItem {
  str: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Line {
  page: number;
  y: number;
  items: TextItem[];
}

// Grouping tolerance for line reconstruction: items whose baselines differ by more than this many points
// belong to different lines.
const LINE_TOL = 3;

// Every page's text items with their coordinates (viewport coordinates, y measured from the top),
// grouped into lines.
export async function extractLines(data: Uint8Array): Promise<{ lines: Line[]; pages: number }> {
  const pdf = await pdfjsLib.getDocument({ data, isEvalSupported: false, disableFontFace: true, verbosity: pdfjsLib.VerbosityLevel.ERRORS }).promise;
  const pages = pdf.numPages;
  const lines: Line[] = [];
  for (let p = 1; p <= pages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    const items: TextItem[] = [];
    for (const it of tc.items) {
      const anyItem = it as unknown as { str: string; transform: number[]; width: number; height: number };
      items.push({ str: anyItem.str, x: anyItem.transform[4], y: anyItem.transform[5], w: anyItem.width, h: anyItem.height });
    }
    items.sort((a, b) => (a.y - b.y) || (a.x - b.x));
    let cur: Line | null = null;
    for (const it of items) {
      if (cur === null || Math.abs(it.y - cur.y) > LINE_TOL) {
        cur = { page: p, y: it.y, items: [] };
        lines.push(cur);
      }
      cur.items.push(it);
    }
    for (const l of lines) if (l.page === p) l.items.sort((a, b) => a.x - b.x);
  }
  return { lines, pages };
}
