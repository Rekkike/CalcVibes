// v0.6.20 — the timeline PDF import, web-side and additive. The parser reads a Gantt PDF exported from
// another project application (selectable text, clear column fields) and composes year-grained timeline
// activities from its rows. The application stays a client-side static site: the PDF is read in the
// browser through pdfjs-dist (Mozilla PDF.js, bundled by Vite as static assets; the worker loads from a
// static asset URL in the browser and from the local module file under Node), no backend, no upload,
// no cloud. The timeline layer stays engine-blind: the import writes TimelineActivity rows in the
// existing vocabulary only (no new model fields; the progress column of the export is dropped per the
// ruling of record).
//
// The columns are located by the words of record (aktivitet, startdatum, slutdatum, varaktighet), matched
// case-insensitively and whitespace-tolerantly, and every other header cell of the header line carves out
// its own column interval so an extra column (a progress column, for example) is ignored and disclosed
// rather than bleeding into a column of record. The dates parse in the standard numeric forms (ISO and the
// common European orderings) with the Swedish month names accepted; the YEAR is the operative part and the
// days and months are the parse aid only, dropped at composition. The varaktighet is a consistency check
// only: a mismatch is disclosed in the parse report and never overrides the dates. Every import produces
// the parse report — the rows found, the rows refused with their cause, and the summary counts — so a
// layout mismatch surfaces honestly rather than becoming garbage rows.
import type { TimelineActivity } from "../../core/src/types.js";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import workerAssetUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import { nextId } from "./state.js";

// In the browser build Vite turns the ?url import into the bundled worker asset and PDF.js runs a real
// Worker. Under Node (the test battery) the fake worker imports the worker module itself, which requires a
// file: URL, so there the module path is resolved locally.
const isNodeRuntime = typeof process !== "undefined" && typeof process.versions?.node === "string";
const importMeta = import.meta as ImportMeta & { resolve?: (specifier: string) => string };
pdfjsLib.GlobalWorkerOptions.workerSrc = isNodeRuntime && importMeta.resolve !== undefined
  ? importMeta.resolve("pdfjs-dist/legacy/build/pdf.worker.min.mjs")
  : workerAssetUrl;

export const TIMELINE_IMPORT_HEADERS = ["aktivitet", "startdatum", "slutdatum", "varaktighet"] as const;
export type TimelineImportHeader = (typeof TIMELINE_IMPORT_HEADERS)[number];

// The TIMELINE-IMPORT refusal family, collect-all: every outcome is disclosed in the report, never silent.
// The existing timeline validation (validateTimeline) is untouched in its firing rules; these codes live in
// the import report, which is view state and never enters the document.
export type TimelineImportCode =
  | "TIMELINE-IMPORT-NOT-PDF"
  | "TIMELINE-IMPORT-HEADERS"
  | "TIMELINE-IMPORT-DATE"
  | "TIMELINE-IMPORT-ZERO-ROWS"
  | "TIMELINE-IMPORT-BEFORE-START"
  | "TIMELINE-IMPORT-DURATION"
  | "TIMELINE-IMPORT-NO-START-YEAR";

export interface TimelineImportRefusal {
  code: TimelineImportCode;
  message: string;
}

export interface ParsedExportDate {
  year: number;
  month: number;
  day: number;
  text: string;
}

export type DurationCheck = "consistent" | "mismatch" | "unchecked";

export interface TimelineImportRow {
  row: number;
  name: string;
  startText: string;
  endText: string;
  durationText: string;
  start?: ParsedExportDate;
  end?: ParsedExportDate;
  startProgramYear?: number;
  endProgramYear?: number;
  beforeStart: boolean;
  duration?: { value: number; unit: string | null; raw: string };
  spanDays?: number;
  durationCheck: DurationCheck;
  durationDetail: string;
  refusals: TimelineImportRefusal[];
}

export interface TimelineImportColumn {
  header: TimelineImportHeader;
  x: number;
}

export interface TimelineImportIgnoredColumn {
  text: string;
  x: number;
}

export interface TimelineImportReport {
  fileName: string;
  ok: boolean;
  pages: number;
  headerFound: boolean;
  columns: TimelineImportColumn[];
  ignoredColumns: TimelineImportIgnoredColumn[];
  rows: TimelineImportRow[];
  candidates: TimelineActivity[];
  refusals: TimelineImportRefusal[];
  startYear: number | null;
  mapping: string;
  counts: {
    rowsFound: number;
    rowsParsed: number;
    rowsRefused: number;
    beforeStart: number;
    durationMismatches: number;
    durationUnchecked: number;
    linesNotRead: number;
  };
}

interface TextItem {
  str: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Line {
  page: number;
  y: number;
  items: TextItem[];
}

const squash = (s: string): string => s.toLowerCase().replace(/\s+/g, "");
const tidy = (s: string): string => s.replace(/\s+/g, " ").trim();

// The Swedish month names (full and the common abbreviations), case-insensitive.
const SV_MONTHS: Record<string, number> = {
  januari: 1, februari: 2, mars: 3, april: 4, maj: 5, juni: 6, juli: 7, augusti: 8, september: 9, oktober: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, okt: 10, nov: 11, dec: 12,
};

const realDate = (y: number, m: number, d: number): boolean => {
  if (!Number.isInteger(y) || y < 1000 || y > 9999) return false;
  if (!Number.isInteger(m) || m < 1 || m > 12) return false;
  if (!Number.isInteger(d) || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};

// The date forms of record: ISO (2026-01-15, 2026/1/15, 2026.01.15), the common European orderings
// (15.01.2026, 15/1-2026, 15-1-2026), and the day-month-name-year forms with the Swedish month names
// (15 januari 2026, 15 jan 2026, 15 jan. 2026), plus the year-month-name-day twin. The year is the
// operative part; the month and day are the parse aid (and the duration check's aid).
export function parseExportDate(raw: string): ParsedExportDate | null {
  const t = tidy(raw).toLowerCase();
  if (t === "") return null;
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(t);
  if (m !== null) {
    const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3]);
    if (realDate(y, mo, d)) return { year: y, month: mo, day: d, text: tidy(raw) };
    return null;
  }
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(t);
  if (m !== null) {
    const d = Number(m[1]); const mo = Number(m[2]); const y = Number(m[3]);
    if (realDate(y, mo, d)) return { year: y, month: mo, day: d, text: tidy(raw) };
    return null;
  }
  m = /^(\d{1,2})\.?\s+([a-zåäö]+)\.?\s+(\d{4})$/.exec(t);
  if (m !== null) {
    const d = Number(m[1]); const mo = SV_MONTHS[m[2]]; const y = Number(m[3]);
    if (mo !== undefined && realDate(y, mo, d)) return { year: y, month: mo, day: d, text: tidy(raw) };
    return null;
  }
  m = /^(\d{4})\s+([a-zåäö]+)\.?\s+(\d{1,2})$/.exec(t);
  if (m !== null) {
    const y = Number(m[1]); const mo = SV_MONTHS[m[2]]; const d = Number(m[3]);
    if (mo !== undefined && realDate(y, mo, d)) return { year: y, month: mo, day: d, text: tidy(raw) };
    return null;
  }
  return null;
}

// The varaktighet of the export: a number with an optional unit token (dagar/d, veckor/v/w, månader/m,
// år/y, and the English twins). A bare number carries no unit and is checked against every common unit.
const DURATION_UNITS: Record<string, string> = {
  "d": "d", dag: "d", dagar: "d", day: "d", days: "d",
  "v": "w", vecka: "w", veckor: "w", w: "w", week: "w", weeks: "w",
  "m": "m", mån: "m", månad: "m", månader: "m", month: "m", months: "m",
  "år": "y", ar: "y", y: "y", year: "y", years: "y",
};

export interface ParsedDuration {
  value: number;
  unit: string | null;
  raw: string;
}

export function parseExportDuration(raw: string): ParsedDuration | null {
  const t = tidy(raw).toLowerCase();
  if (t === "") return null;
  const m = /^(\d+(?:[.,]\d+)?)\s*([a-zåäö]*)\.?$/.exec(t);
  if (m === null) return null;
  const value = Number(m[1].replace(",", "."));
  if (!Number.isFinite(value) || value < 0) return null;
  const token = m[2];
  const unit = token === "" ? null : DURATION_UNITS[token];
  if (token !== "" && unit === undefined) return { value, unit: token, raw: tidy(raw) };
  return { value, unit, raw: tidy(raw) };
}

const unitLabel = (u: string | null): string => (u === null ? "(no unit)" : u === "d" ? "days" : u === "w" ? "weeks" : u === "m" ? "months" : u === "y" ? "years" : `'${u}'`);

// The consistency check only: the parsed duration against the span of the parsed dates. Inclusive counting
// is the convention (a 2026-01-15 to 2026-01-15 activity is one day, one month, and spans one calendar
// month inclusive). The verdict never alters the dates.
function durationCheck(value: number, unit: string | null, start: ParsedExportDate, end: ParsedExportDate): { verdict: DurationCheck; detail: string; spanDays: number } {
  const spanDays = Math.round((Date.UTC(end.year, end.month - 1, end.day) - Date.UTC(start.year, start.month - 1, start.day)) / 86400000) + 1;
  const monthsInclusive = (end.year - start.year) * 12 + (end.month - start.month) + 1;
  const yearsFloat = spanDays / 365.25;
  const weeksFloat = spanDays / 7;
  const expected: [string, number, number][] = [
    ["d", spanDays, 1],
    ["w", weeksFloat, 0.15],
    ["m", monthsInclusive, 0.5],
    ["y", yearsFloat, 0.1],
  ];
  const units = unit === null ? expected : expected.filter(([u]) => u === unit);
  const hit = units.find(([, exp, tol]) => Math.abs(value - exp) <= tol);
  const detail = `the dates span ${spanDays} day${spanDays === 1 ? "" : "s"} inclusive (${monthsInclusive} calendar month${monthsInclusive === 1 ? "" : "s"} inclusive, ${weeksFloat.toFixed(2)} weeks, ${yearsFloat.toFixed(2)} years); the varaktighet reads as ${value} ${unitLabel(unit)}`;
  if (units.length === 0) return { verdict: "unchecked", detail: `${detail}; the unit is not recognized, so no check was made`, spanDays };
  return hit !== undefined ? { verdict: "consistent", detail, spanDays } : { verdict: "mismatch", detail, spanDays };
}

// Grouping tolerance for line reconstruction: items whose baselines differ by more than this many points
// belong to different lines.
const LINE_TOL = 3;

async function extractLines(data: Uint8Array): Promise<{ lines: Line[]; pages: number }> {
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

// A word token with its estimated x position. The extractor may merge two closely spaced cells into one
// text item, so positions inside an item are estimated proportionally to the item width; the column
// assignment tolerance below absorbs that estimation error, which stays far smaller than a clear column
// gap of the described basic layout.
interface Word {
  text: string;
  x: number;
  end: number;
  cw: number;
}

function wordsOf(line: Line): Word[] {
  const out: Word[] = [];
  for (const it of line.items) {
    const cw = it.str.length > 0 ? it.w / it.str.length : 0;
    let cur = "";
    let start = 0;
    const push = (endIdx: number) => {
      if (cur !== "") out.push({ text: cur, x: it.x + start * cw, end: it.x + endIdx * cw, cw });
      cur = "";
    };
    for (let i = 0; i < it.str.length; i++) {
      if (/\s/.test(it.str[i])) {
        push(i);
        start = i + 1;
      } else cur += it.str[i];
    }
    push(it.str.length);
  }
  return out.sort((a, b) => a.x - b.x);
}

// The anchor x of a word of record inside a line: the estimated x of the character where the match starts
// in the squashed concatenation of the line's words (a header split across items or words still matches).
function anchorOf(words: Word[], word: string): number | null {
  let acc = "";
  const spans: { ch: number; w: Word; local: number }[] = [];
  for (const w of words) {
    const s = squash(w.text);
    for (let i = 0; i < s.length; i++) spans.push({ ch: acc.length + i, w, local: i });
    acc += s;
  }
  const idx = acc.indexOf(word);
  if (idx < 0) return null;
  const hit = spans.find((s) => s.ch === idx);
  return hit === undefined ? null : hit.w.x + hit.local * hit.w.cw;
}

// Join the words of one column into cell text: a gap wider than the kerning threshold separates words, a
// kerning-level gap concatenates, so a date split across two runs reassembles and separate words stay
// separate.
function joinWords(words: Word[]): string {
  let out = "";
  let prevEnd = Number.NEGATIVE_INFINITY;
  for (const w of words) {
    if (out !== "" && w.x - prevEnd > 1.5) out += " ";
    out += w.text;
    prevEnd = w.end;
  }
  return tidy(out);
}

const isPdfBytes = (bytes: Uint8Array): boolean => {
  const head = bytes.subarray(0, 1024);
  const text = Array.from(head.slice(0, 1024)).map((b) => String.fromCharCode(b)).join("");
  return text.includes("%PDF-");
};

// The import entry point. Composes the candidate rows once (the renderers consume them); the parse report
// carries every outcome. The candidate activities are authored shapes: fresh ids, the production phase
// (the phase is underivable from the export and is editable after authoring), year-grained spans mapped
// through the project start year, no months (the days and months of the export are the parse aid only).
export async function parseTimelinePdf(data: ArrayBuffer | Uint8Array, fileName: string, startYear: number | null): Promise<TimelineImportReport> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const base = {
    fileName, ok: false, pages: 0, headerFound: false, columns: [] as TimelineImportColumn[], ignoredColumns: [] as TimelineImportIgnoredColumn[],
    rows: [] as TimelineImportRow[], candidates: [] as TimelineActivity[], refusals: [] as TimelineImportRefusal[], startYear,
    mapping: startYear === null
      ? "The project has no start year set, so the calendar years of the export cannot be mapped to program years."
      : `Program year = calendar year − ${startYear} + 1 (the project start year is ${startYear}).`,
    counts: { rowsFound: 0, rowsParsed: 0, rowsRefused: 0, beforeStart: 0, durationMismatches: 0, durationUnchecked: 0, linesNotRead: 0 },
  };
  if (!isPdfBytes(bytes)) {
    return { ...base, refusals: [{ code: "TIMELINE-IMPORT-NOT-PDF", message: `The file "${fileName}" is not a PDF (no %PDF- header in its first 1024 bytes): nothing was read and nothing was written (TIMELINE-IMPORT-NOT-PDF).` }] };
  }
  let lines: Line[];
  let pages: number;
  try {
    ({ lines, pages } = await extractLines(bytes));
  } catch (err) {
    return { ...base, refusals: [{ code: "TIMELINE-IMPORT-NOT-PDF", message: `The file "${fileName}" could not be read as a PDF (${err instanceof Error ? err.message : String(err)}): nothing was read and nothing was written (TIMELINE-IMPORT-NOT-PDF).` }] };
  }
  // The header line is the line carrying the most words of record; all four must be present on it.
  let headerLine: Line | null = null;
  let headerScore = 0;
  const foundWords: TimelineImportHeader[] = [];
  for (const line of lines) {
    const acc = line.items.map((it) => squash(it.str)).join("");
    const found = TIMELINE_IMPORT_HEADERS.filter((w) => acc.includes(w));
    if (found.length > headerScore) { headerScore = found.length; headerLine = line; foundWords.length = 0; foundWords.push(...found); }
  }
  if (headerLine === null || headerScore < TIMELINE_IMPORT_HEADERS.length) {
    const missing = TIMELINE_IMPORT_HEADERS.filter((w) => !foundWords.includes(w));
    return {
      ...base, pages,
      refusals: [{
        code: "TIMELINE-IMPORT-HEADERS",
        message: `The column headers of record were not all found on one line of "${fileName}": found ${foundWords.length === 0 ? "none" : foundWords.join(", ")}, missing ${missing.join(", ")}. No columns were located and no rows were read (TIMELINE-IMPORT-HEADERS).`,
      }],
    };
  }
  const columns: TimelineImportColumn[] = [];
  const headerWords = wordsOf(headerLine);
  for (const w of TIMELINE_IMPORT_HEADERS) {
    const x = anchorOf(headerWords, w);
    if (x !== null) columns.push({ header: w, x });
  }
  // Every header word carves out a column interval, so an extra column (a progress column, even when the
  // extractor merged it into the neighboring header item) is ignored and disclosed instead of bleeding
  // into a column of record. The assignment tolerance absorbs the position estimation inside a merged
  // item and stays far smaller than a clear column gap of the described basic layout.
  const anchors = headerWords.map((w) => ({ text: w.text, x: w.x }));
  const headerH = Math.max(1, ...headerLine.items.map((it) => it.h));
  const tol = Math.max(4, 0.3 * headerH);
  const columnOf = (x: number): number => {
    let idx = 0;
    for (let i = 0; i < anchors.length; i++) if (x >= anchors[i].x - tol) idx = i;
    return idx;
  };
  const ignoredColumns: TimelineImportIgnoredColumn[] = [];
  for (const a of anchors) {
    if (!TIMELINE_IMPORT_HEADERS.some((w) => squash(a.text).includes(w) || w.includes(squash(a.text)))) ignoredColumns.push(a);
  }
  const cellText = (line: Line, header: TimelineImportHeader): string => {
    const idx = anchors.findIndex((a) => TIMELINE_IMPORT_HEADERS.some((w) => w === header && (squash(a.text).includes(w) || w.includes(squash(a.text)))));
    if (idx < 0) return "";
    return joinWords(wordsOf(line).filter((w) => columnOf(w.x) === idx));
  };
  // The rows are the lines below the header line on its page, and below a repeated header line on any
  // further page; lines on a page without a header line are not read as rows and are disclosed in the
  // counts (never silently dropped).
  const rows: TimelineImportRow[] = [];
  const refusals: TimelineImportRefusal[] = [];
  let linesNotRead = 0;
  const isHeaderLine = (l: Line): boolean => TIMELINE_IMPORT_HEADERS.every((w) => l.items.map((it) => squash(it.str)).join("").includes(w));
  for (const line of lines) {
    if (isHeaderLine(line)) continue;
    const belowSomeHeader = lines.some((h) => isHeaderLine(h) && h.page === line.page && h.y < line.y);
    if (!belowSomeHeader) { linesNotRead++; continue; }
    const cells = TIMELINE_IMPORT_HEADERS.map((h) => cellText(line, h));
    if (cells.every((c) => c === "")) { linesNotRead++; continue; }
    const row: TimelineImportRow = {
      row: rows.length + 1,
      name: cells[0], startText: cells[1], endText: cells[2], durationText: cells[3],
      beforeStart: false, durationCheck: "unchecked", durationDetail: "", refusals: [],
    };
    const start = parseExportDate(row.startText);
    const end = parseExportDate(row.endText);
    if (start === null || end === null) {
      const which = start === null && end === null ? `startdatum "${row.startText}" and slutdatum "${row.endText}"` : start === null ? `startdatum "${row.startText}"` : `slutdatum "${row.endText}"`;
      row.refusals.push({
        code: "TIMELINE-IMPORT-DATE",
        message: `Row ${row.row} ("${row.name === "" ? "unnamed" : row.name}") is refused: ${which} is not a recognized date form (ISO, the common European orderings, or a Swedish month name); the accepted forms are YYYY-MM-DD, DD.MM.YYYY, and "15 januari 2026". The row was not composed (TIMELINE-IMPORT-DATE).`,
      });
    } else {
      row.start = start;
      row.end = end;
      if (startYear === null) {
        row.refusals.push({ code: "TIMELINE-IMPORT-NO-START-YEAR", message: `Row ${row.row} ("${row.name === "" ? "unnamed" : row.name}") parsed (${start.text} to ${end.text}) but the project has no start year, so its calendar years cannot be mapped to program years (TIMELINE-IMPORT-NO-START-YEAR).` });
      } else {
        row.startProgramYear = start.year - startYear + 1;
        row.endProgramYear = end.year - startYear + 1;
        row.beforeStart = row.startProgramYear < 1 || row.endProgramYear < 1;
        if (row.beforeStart) {
          row.refusals.push({
            code: "TIMELINE-IMPORT-BEFORE-START",
            message: `Row ${row.row} ("${row.name === "" ? "unnamed" : row.name}") falls before the project start year ${startYear}: ${start.text} maps to program year ${row.startProgramYear} and ${end.text} to program year ${row.endProgramYear} (program year = calendar year − ${startYear} + 1). The row is disclosed and still composed; it falls under the standing TIMELINE-ACTIVITY-SPAN refusal once authored (TIMELINE-IMPORT-BEFORE-START).`,
          });
        }
      }
      const dur = parseExportDuration(row.durationText);
      if (dur !== null) {
        row.duration = { value: dur.value, unit: dur.unit, raw: dur.raw };
        const check = durationCheck(dur.value, dur.unit, start, end);
        row.durationCheck = check.verdict;
        row.durationDetail = check.detail;
        row.spanDays = check.spanDays;
        if (check.verdict === "mismatch") {
          row.refusals.push({
            code: "TIMELINE-IMPORT-DURATION",
            message: `Row ${row.row} ("${row.name === "" ? "unnamed" : row.name}"): the varaktighet "${row.durationText}" does not match the dates — ${check.detail}. The mismatch is disclosed only; the dates stand and were not overridden (TIMELINE-IMPORT-DURATION).`,
          });
        } else if (check.verdict === "unchecked") {
          row.refusals.push({ code: "TIMELINE-IMPORT-DURATION", message: `Row ${row.row} ("${row.name === "" ? "unnamed" : row.name}"): the varaktighet "${row.durationText}" could not be checked — ${check.detail} (TIMELINE-IMPORT-DURATION).` });
        }
      } else if (row.durationText !== "") {
        row.durationCheck = "unchecked";
        row.durationDetail = `the varaktighet "${row.durationText}" is not a number with an optional unit, so no check was made`;
        row.refusals.push({ code: "TIMELINE-IMPORT-DURATION", message: `Row ${row.row} ("${row.name === "" ? "unnamed" : row.name}"): the varaktighet "${row.durationText}" could not be parsed as a duration; the dates stand (TIMELINE-IMPORT-DURATION).` });
      }
    }
    rows.push(row);
  }
  const parsedRows = rows.filter((r) => r.start !== undefined && r.end !== undefined && r.startProgramYear !== undefined);
  const refusedRows = rows.filter((r) => r.refusals.some((x) => x.code === "TIMELINE-IMPORT-DATE" || x.code === "TIMELINE-IMPORT-NO-START-YEAR"));  const beforeStartRows = rows.filter((r) => r.beforeStart);
  const mismatchRows = rows.filter((r) => r.durationCheck === "mismatch");
  const uncheckedRows = rows.filter((r) => r.durationCheck === "unchecked");
  // The candidates are composed once, here: fresh ids (the accepted import replaces the activities grid
  // wholesale), the production phase, and the program years mapped through the project start year.
  const candidates: TimelineActivity[] = [];
  const taken: string[] = [];
  for (const r of parsedRows) {
    if (r.startProgramYear === undefined || r.endProgramYear === undefined) continue;
    const id = nextId("a", taken);
    taken.push(id);
    candidates.push({ id, label: r.name, startYear: r.startProgramYear, endYear: r.endProgramYear, phase: "production" });
  }
  if (startYear === null && rows.length > 0) {
    refusals.push({ code: "TIMELINE-IMPORT-NO-START-YEAR", message: `The project has no start year set, so no row of "${fileName}" could be mapped to program years: set the project start year and import again (TIMELINE-IMPORT-NO-START-YEAR).` });
  }
  if (rows.length === 0) {
    refusals.push({ code: "TIMELINE-IMPORT-ZERO-ROWS", message: `The header line of "${fileName}" was located but no rows were found below it: the export reads as empty, and an empty import is disclosed rather than acting as a silent no-op (TIMELINE-IMPORT-ZERO-ROWS).` });
  }
  if (beforeStartRows.length > 0) {
    refusals.push({ code: "TIMELINE-IMPORT-BEFORE-START", message: `${beforeStartRows.length} row${beforeStartRows.length === 1 ? "" : "s"} of "${fileName}" fall before the project start year ${startYear} and are disclosed row by row above; they still compose on accept and fall under the standing TIMELINE-ACTIVITY-SPAN refusal once authored (TIMELINE-IMPORT-BEFORE-START).` });
  }
  if (mismatchRows.length > 0) {
    refusals.push({ code: "TIMELINE-IMPORT-DURATION", message: `${mismatchRows.length} row${mismatchRows.length === 1 ? "" : "s"} of "${fileName}" carry a varaktighet that does not match the parsed dates; the mismatches are disclosed row by row above and the dates were never overridden (TIMELINE-IMPORT-DURATION).` });
  }
  if (refusedRows.length > 0) {
    refusals.push({ code: "TIMELINE-IMPORT-DATE", message: `${refusedRows.length} row${refusedRows.length === 1 ? "" : "s"} of "${fileName}" ${refusedRows.length === 1 ? "was" : "were"} refused because a date did not parse (or no start year is set); the causes are listed row by row above and the refused rows were not composed (TIMELINE-IMPORT-DATE).` });
  }
  const ok = candidates.length > 0;
  return {
    ...base, pages, headerFound: true, columns, ignoredColumns, rows, candidates, refusals, ok,
    counts: {
      rowsFound: rows.length,
      rowsParsed: parsedRows.length,
      rowsRefused: refusedRows.length,
      beforeStart: beforeStartRows.length,
      durationMismatches: mismatchRows.length,
      durationUnchecked: uncheckedRows.length,
      linesNotRead,
    },
  };
}
