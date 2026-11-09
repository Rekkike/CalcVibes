import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { jsPDF } from "jspdf";
import { parseExportDate, parseExportDuration, parseTimelinePdf, TIMELINE_IMPORT_HEADERS } from "../src/timelineImport.js";
import { demoProject, timelineOf, validateTimeline } from "../src/state.js";
import type { TimelineActivity } from "../../core/src/types.js";

// v0.6.20 Task E: the generated fixture PDF in the described basic layout — a title line, one header line
// carrying the four lowercase words of record, and rows carrying days and months. It is authored here with
// jsPDF as a TEST FIXTURE and is never presented as a real export: the real exports carry confidential
// content and were not provided (the ruling of record), so the parser is pinned against this described
// layout. The fixture bytes are real PDF bytes, so the pins exercise the full extraction pipeline.
interface FixtureRow {
  name: string;
  start: string;
  end: string;
  duration: string;
}

const X = { aktivitet: 40, startdatum: 280, slutdatum: 380, varaktighet: 480, progress: 560 };
const HEADER_Y = 760;
const ROW_DY = 18;

function buildFixturePdf(opts: {
  rows: FixtureRow[];
  headers?: string[];
  title?: string;
  progress?: boolean;
  splitHeaderWord?: boolean;
  fontSize?: number;
}): ArrayBuffer {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  doc.setFontSize(opts.fontSize ?? 10);
  const headers = opts.headers ?? ["aktivitet", "startdatum", "slutdatum", "varaktighet"];
  if (opts.title !== undefined) doc.text(opts.title, X.aktivitet, 800);
  const xs = [X.aktivitet, X.startdatum, X.slutdatum, X.varaktighet];
  headers.forEach((h, i) => {
    if (opts.splitHeaderWord === true && h === "startdatum") {
      doc.text("start", xs[i], HEADER_Y);
      doc.text("datum", xs[i] + 22, HEADER_Y);
    } else {
      doc.text(h, xs[i], HEADER_Y);
    }
  });
  if (opts.progress === true) doc.text("progress", X.progress, HEADER_Y);
  opts.rows.forEach((r, i) => {
    const y = HEADER_Y - (i + 1) * ROW_DY;
    doc.text(r.name, X.aktivitet, y);
    doc.text(r.start, X.startdatum, y);
    doc.text(r.end, X.slutdatum, y);
    doc.text(r.duration, X.varaktighet, y);
    if (opts.progress === true) doc.text(`${(i + 1) * 25}%`, X.progress, y);
  });
  return doc.output("arraybuffer");
}

const basicRows: FixtureRow[] = [
  { name: "Projektering", start: "2026-01-15", end: "2027-06-30", duration: "18 mån" },
  { name: "Byggande", start: "15.7.2027", end: "2028-12-20", duration: "18 månader" },
  { name: "Driftstart 15 mars 2029", start: "2029-03-15", end: "2030-03-14", duration: "365 d" },
];

describe("v0.6.20 Task A — the parser against the described basic layout", () => {
  it("COLUMNS: the four words of record locate the columns on the header line, in x order, case-insensitively and whitespace-tolerantly", async () => {
    const report = await parseTimelinePdf(buildFixturePdf({ rows: basicRows }), "fixture.pdf", 2026);
    expect(report.headerFound).toBe(true);
    expect(report.columns.map((c) => c.header)).toEqual([...TIMELINE_IMPORT_HEADERS]);
    expect(report.columns.map((c) => c.x)).toEqual([X.aktivitet, X.startdatum, X.slutdatum, X.varaktighet]);
    const upper = await parseTimelinePdf(buildFixturePdf({ rows: basicRows, headers: ["Aktivitet", "STARTDATUM", "SlutDatum", "Varaktighet"] }), "upper.pdf", 2026);
    expect(upper.headerFound).toBe(true);
    expect(upper.columns.map((c) => c.header)).toEqual([...TIMELINE_IMPORT_HEADERS]);
    const split = await parseTimelinePdf(buildFixturePdf({ rows: basicRows, splitHeaderWord: true }), "split.pdf", 2026);
    expect(split.headerFound).toBe(true);
    expect(split.columns.map((c) => c.header)).toEqual([...TIMELINE_IMPORT_HEADERS]);
  });

  it("ROWS: the rows compose with their names and dates; the year is the operative part and the days and months are the parse aid only", async () => {
    const report = await parseTimelinePdf(buildFixturePdf({ rows: basicRows, title: "Tidsplan export" }), "fixture.pdf", 2026);
    expect(report.ok).toBe(true);
    expect(report.rows.map((r) => r.name)).toEqual(["Projektering", "Byggande", "Driftstart 15 mars 2029"]);
    expect(report.rows.map((r) => r.start?.text)).toEqual(["2026-01-15", "15.7.2027", "2029-03-15"]);
    expect(report.rows.map((r) => [r.start?.year, r.start?.month, r.start?.day])).toEqual([[2026, 1, 15], [2027, 7, 15], [2029, 3, 15]]);
    expect(report.rows.map((r) => [r.end?.year, r.end?.month, r.end?.day])).toEqual([[2027, 6, 30], [2028, 12, 20], [2030, 3, 14]]);
    expect(report.counts.rowsFound).toBe(3);
    expect(report.counts.rowsParsed).toBe(3);
    expect(report.counts.rowsRefused).toBe(0);
  });

  it("PROGRESS DROPPED: an extra progress column is ignored and disclosed, never entering a row", async () => {
    const report = await parseTimelinePdf(buildFixturePdf({ rows: basicRows, progress: true }), "progress.pdf", 2026);
    expect(report.ignoredColumns.map((c) => c.text)).toEqual(["progress"]);
    expect(report.ignoredColumns[0].x).toBe(X.progress);
    expect(report.rows).toHaveLength(3);
    expect(report.rows.every((r) => r.durationText !== "25%" && !Object.values(r).some((v) => v === "25%"))).toBe(true);
    expect(report.candidates.every((c) => !("progress" in c))).toBe(true);
  });

  it("LAYOUT VARIANCE: when the extractor merges a closely spaced extra header into the neighboring item, the column intervals still keep the extra column's values out of the columns of record", async () => {
    // at 16 pt the gap between the varaktighet header (ends near 558) and the progress header at 560 is
    // small enough that the text extractor merges them into one item; the parser must still carve the
    // progress column out of the header line and keep the row's progress value out of the varaktighet cell
    const report = await parseTimelinePdf(buildFixturePdf({ rows: basicRows, progress: true, fontSize: 16 }), "merged.pdf", 2026);
    expect(report.headerFound).toBe(true);
    expect(report.columns.map((c) => c.header)).toEqual([...TIMELINE_IMPORT_HEADERS]);
    expect(report.ignoredColumns.length).toBeGreaterThan(0);
    expect(report.rows).toHaveLength(3);
    for (const r of report.rows) expect(r.durationText).not.toContain("%");
    expect(report.rows.map((r) => r.durationText)).toEqual(["18 mån", "18 månader", "365 d"]);
    expect(report.candidates).toHaveLength(3);
  });

  it("DURATION CHECK: a matching varaktighet reads consistent; a mismatch is disclosed and never overrides the dates", async () => {
    const report = await parseTimelinePdf(buildFixturePdf({ rows: basicRows }), "fixture.pdf", 2026);
    expect(report.rows[0].durationCheck).toBe("consistent");
    expect(report.rows[0].duration).toEqual({ value: 18, unit: "m", raw: "18 mån" });
    expect(report.rows[0].spanDays).toBe(532);
    expect(report.rows[1].durationCheck).toBe("consistent");
    expect(report.rows[2].durationCheck).toBe("consistent");
    expect(report.counts.durationMismatches).toBe(0);
    const bad = await parseTimelinePdf(buildFixturePdf({ rows: [{ name: "Fel varaktighet", start: "2026-01-15", end: "2027-06-30", duration: "5 dagar" }] }), "bad.pdf", 2026);
    expect(bad.rows[0].durationCheck).toBe("mismatch");
    expect(bad.rows[0].refusals.map((r) => r.code)).toContain("TIMELINE-IMPORT-DURATION");
    expect(bad.refusals.map((r) => r.code)).toContain("TIMELINE-IMPORT-DURATION");
    expect(bad.counts.durationMismatches).toBe(1);
    // the dates stand: the candidate still carries the date-derived program years, not the duration
    expect(bad.candidates).toEqual([{ id: "a1", label: "Fel varaktighet", startYear: 1, endYear: 2, phase: "production" }]);
  });
});

describe("v0.6.20 Task B — the year mapping and the phase", () => {
  it("YEAR MAPPING: the calendar years map through the project start year (program year = calendar year − start year + 1) and every imported activity takes the production phase", async () => {
    const report = await parseTimelinePdf(buildFixturePdf({ rows: basicRows }), "fixture.pdf", 2026);
    expect(report.startYear).toBe(2026);
    expect(report.mapping).toBe("Program year = calendar year − 2026 + 1 (the project start year is 2026).");
    expect(report.rows.map((r) => [r.startProgramYear, r.endProgramYear])).toEqual([[1, 2], [2, 3], [4, 5]]);
    expect(report.candidates).toEqual([
      { id: "a1", label: "Projektering", startYear: 1, endYear: 2, phase: "production" },
      { id: "a2", label: "Byggande", startYear: 2, endYear: 3, phase: "production" },
      { id: "a3", label: "Driftstart 15 mars 2029", startYear: 4, endYear: 5, phase: "production" },
    ]);
    // year-grained: no month fields are composed (the days and months of the export are the parse aid only)
    expect(report.candidates.every((c) => !("startMonth" in c) && !("endMonth" in c))).toBe(true);
  });

  it("BEFORE-START: a row falling before the start year is disclosed in the report and still composed; the standing TIMELINE-ACTIVITY-SPAN refusal then fires on the authored row", async () => {
    const rows: FixtureRow[] = [
      { name: "Förstudie", start: "2024-05-01", end: "2025-11-30", duration: "19 mån" },
      { name: "Projektering", start: "2026-01-15", end: "2027-06-30", duration: "18 mån" },
    ];
    const report = await parseTimelinePdf(buildFixturePdf({ rows }), "before.pdf", 2026);
    expect(report.rows[0].beforeStart).toBe(true);
    expect(report.rows[0].startProgramYear).toBe(-1);
    expect(report.rows[0].endProgramYear).toBe(0);
    expect(report.rows[0].refusals.map((r) => r.code)).toContain("TIMELINE-IMPORT-BEFORE-START");
    expect(report.refusals.map((r) => r.code)).toContain("TIMELINE-IMPORT-BEFORE-START");
    expect(report.counts.beforeStart).toBe(1);
    expect(report.candidates).toEqual([
      { id: "a1", label: "Förstudie", startYear: -1, endYear: 0, phase: "production" },
      { id: "a2", label: "Projektering", startYear: 1, endYear: 2, phase: "production" },
    ]);
    // the existing validation is untouched in its firing rules: the authored before-start row refuses section-locally
    const inputs = { ...demoProject(), timeline: { activities: report.candidates as TimelineActivity[], decisionPoints: [], milestones: [] } };
    const codes = validateTimeline(inputs, null).map((r) => r.code);
    expect(codes).not.toContain("TIMELINE-IMPORT-BEFORE-START");
    const withResult = validateTimeline(inputs, (await import("../src/engine.js")).computeModel(inputs));
    expect(withResult.map((r) => r.code)).toContain("TIMELINE-ACTIVITY-SPAN");
  });

  it("NO-START-YEAR: with no project start year set, the mapping is named as unavailable and no row composes", async () => {
    const report = await parseTimelinePdf(buildFixturePdf({ rows: basicRows }), "fixture.pdf", null);
    expect(report.ok).toBe(false);
    expect(report.candidates).toEqual([]);
    expect(report.refusals.map((r) => r.code)).toContain("TIMELINE-IMPORT-NO-START-YEAR");
  });
});

describe("v0.6.20 Task D — the TIMELINE-IMPORT refusal family, collect-all", () => {
  it("NOT-PDF: a non-PDF file is refused whole, nothing read, nothing written", async () => {
    const bytes = new TextEncoder().encode("this is a plain text file, not a PDF at all");
    const report = await parseTimelinePdf(bytes, "notes.txt", 2026);
    expect(report.ok).toBe(false);
    expect(report.refusals).toEqual([{ code: "TIMELINE-IMPORT-NOT-PDF", message: expect.stringContaining("TIMELINE-IMPORT-NOT-PDF") }]);
    expect(report.rows).toEqual([]);
    expect(report.candidates).toEqual([]);
  });

  it("HEADERS UNMATCHED: the words of record not found on one line refuses the import and names the missing words", async () => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    doc.text("activity", 40, 760);
    doc.text("start", 280, 760);
    doc.text("end", 380, 760);
    doc.text("duration", 480, 760);
    doc.text("Something", 40, 742);
    doc.text("2026-01-15", 280, 742);
    const report = await parseTimelinePdf(doc.output("arraybuffer"), "english.pdf", 2026);
    expect(report.ok).toBe(false);
    expect(report.headerFound).toBe(false);
    expect(report.refusals).toHaveLength(1);
    expect(report.refusals[0].code).toBe("TIMELINE-IMPORT-HEADERS");
    for (const w of TIMELINE_IMPORT_HEADERS) expect(report.refusals[0].message).toContain(w);
    expect(report.candidates).toEqual([]);
  });

  it("DATES UNPARSED: the row is refused with its cause, the other rows still compose, and the refusal is collected", async () => {
    const rows: FixtureRow[] = [
      { name: "Bra rad", start: "2026-02-01", end: "2026-08-31", duration: "7 mån" },
      { name: "Trasig rad", start: "inte ett datum", end: "2027-01-01", duration: "11 mån" },
      { name: "Också trasig", start: "2026-01-01", end: "32.13.2026", duration: "1 år" },
    ];
    const report = await parseTimelinePdf(buildFixturePdf({ rows }), "mixed.pdf", 2026);
    expect(report.ok).toBe(true);
    expect(report.counts.rowsFound).toBe(3);
    expect(report.counts.rowsParsed).toBe(1);
    expect(report.counts.rowsRefused).toBe(2);
    expect(report.rows[1].refusals[0].code).toBe("TIMELINE-IMPORT-DATE");
    expect(report.rows[1].refusals[0].message).toContain("inte ett datum");
    expect(report.rows[2].refusals[0].code).toBe("TIMELINE-IMPORT-DATE");
    expect(report.refusals.map((r) => r.code)).toContain("TIMELINE-IMPORT-DATE");
    expect(report.candidates).toEqual([{ id: "a1", label: "Bra rad", startYear: 1, endYear: 1, phase: "production" }]);
  });

  it("ZERO-ROWS: a header with no rows below it is disclosed as an empty export, never a silent no-op", async () => {
    const report = await parseTimelinePdf(buildFixturePdf({ rows: [], title: "Tom export" }), "empty.pdf", 2026);
    expect(report.ok).toBe(false);
    expect(report.headerFound).toBe(true);
    expect(report.rows).toEqual([]);
    expect(report.refusals.map((r) => r.code)).toEqual(["TIMELINE-IMPORT-ZERO-ROWS"]);
    expect(report.candidates).toEqual([]);
  });

  it("COLLECT-ALL: every outcome lands in one report — the refused rows, the duration mismatch, and the before-start row together", async () => {
    const rows: FixtureRow[] = [
      { name: "Bra", start: "2026-01-01", end: "2026-12-31", duration: "12 mån" },
      { name: "Trasig", start: "nope", end: "2026-12-31", duration: "12 mån" },
      { name: "Felaktig varaktighet", start: "2026-01-01", end: "2026-12-31", duration: "3 dagar" },
      { name: "Före start", start: "2025-06-01", end: "2025-12-31", duration: "7 mån" },
    ];
    const report = await parseTimelinePdf(buildFixturePdf({ rows }), "all.pdf", 2026);
    const codes = report.refusals.map((r) => r.code);
    expect(codes).toContain("TIMELINE-IMPORT-DATE");
    expect(codes).toContain("TIMELINE-IMPORT-DURATION");
    expect(codes).toContain("TIMELINE-IMPORT-BEFORE-START");
    expect(report.counts).toEqual({ rowsFound: 4, rowsParsed: 3, rowsRefused: 1, beforeStart: 1, durationMismatches: 1, durationUnchecked: 1, linesNotRead: expect.any(Number) });
    expect(report.candidates.map((c) => c.label)).toEqual(["Bra", "Felaktig varaktighet", "Före start"]);
  });
});

describe("v0.6.20 — the date and duration parsers of record", () => {
  it("parseExportDate: the standard numeric forms, the European orderings, and the Swedish month names", () => {
    const cases: [string, [number, number, number] | null][] = [
      ["2026-01-15", [2026, 1, 15]],
      ["2026/1/5", [2026, 1, 5]],
      ["2026.12.31", [2026, 12, 31]],
      ["15.01.2026", [2026, 1, 15]],
      ["15/1-2026", [2026, 1, 15]],
      ["1-12-2026", [2026, 12, 1]],
      ["15 januari 2026", [2026, 1, 15]],
      ["15 jan 2026", [2026, 1, 15]],
      ["3 februari 2027", [2027, 2, 3]],
      ["28 februari 2028", [2028, 2, 28]],
      ["31 december 2026", [2026, 12, 31]],
      ["2026 januari 15", [2026, 1, 15]],
      ["15 jan. 2026", [2026, 1, 15]],
      ["2026-13-01", null],
      ["32.01.2026", null],
      ["2026-02-30", null],
      ["inte ett datum", null],
      ["", null],
      ["2026", null],
      ["15.01.26", null],
    ];
    for (const [input, expected] of cases) {
      const parsed = parseExportDate(input);
      if (expected === null) expect(parsed).toBeNull();
      else expect(parsed === null ? null : [parsed.year, parsed.month, parsed.day]).toEqual(expected);
    }
  });

  it("parseExportDuration: number with optional unit token, comma decimals, unknown units disclosed", () => {
    expect(parseExportDuration("18 mån")).toEqual({ value: 18, unit: "m", raw: "18 mån" });
    expect(parseExportDuration("90 dagar")).toEqual({ value: 90, unit: "d", raw: "90 dagar" });
    expect(parseExportDuration("4 v")).toEqual({ value: 4, unit: "w", raw: "4 v" });
    expect(parseExportDuration("2 år")).toEqual({ value: 2, unit: "y", raw: "2 år" });
    expect(parseExportDuration("1,5 år")).toEqual({ value: 1.5, unit: "y", raw: "1,5 år" });
    expect(parseExportDuration("540")).toEqual({ value: 540, unit: null, raw: "540" });
    expect(parseExportDuration("12w")).toEqual({ value: 12, unit: "w", raw: "12w" });
    expect(parseExportDuration("7 xyz")).toEqual({ value: 7, unit: "xyz", raw: "7 xyz" });
    expect(parseExportDuration("")).toBeNull();
    expect(parseExportDuration("abc")).toBeNull();
  });
});

describe("v0.6.20 — the lazy-load increment (clearance condition)", () => {
  it("LAZY-LOAD pin: the parser module carries no static pdfjs-dist import; the extractor module loads on the first parse", () => {
    const src = readFileSync("src/timelineImport.ts", "utf8");
    expect(src).not.toMatch(/^import[^\n]*pdfjs-dist/m);
    expect(src).not.toMatch(/^import[^\n]*\?url/m);
    expect(src).toContain('await import("./timelinePdfText.js")');
    const lazy = readFileSync("src/timelinePdfText.ts", "utf8");
    expect(lazy).toMatch(/^import \* as pdfjsLib from "pdfjs-dist\/legacy\/build\/pdf\.mjs";/m);
    expect(lazy).toMatch(/^import workerAssetUrl from "pdfjs-dist\/legacy\/build\/pdf\.worker\.min\.mjs\?url";/m);
  });
});

describe("v0.6.20 — the timeline layer stays engine-blind", () => {
  it("the composed candidates are plain TimelineActivity rows in the existing vocabulary: the demo project's timeline reads through unchanged", () => {
    const tl = timelineOf(demoProject());
    expect(Array.isArray(tl.activities)).toBe(true);
    const reportless = { activities: tl.activities, decisionPoints: tl.decisionPoints, milestones: tl.milestones };
    expect(Object.keys(reportless).sort()).toEqual(["activities", "decisionPoints", "milestones"]);
  });
});
