import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import { jsPDF } from "jspdf";
import { createHash } from "node:crypto";
import { App } from "../src/App.js";
import { demoProject } from "../src/state.js";
import { serializeProject, parseProject } from "../../core/src/fileio.js";
import type { ModelInputs, TimelineBlock } from "../../core/src/types.js";

// v0.6.20 Task E: the UI pins of the import — the no-write pin (a refused import leaves the document
// byte-identical), the replace pin (an accepted import replaces the activities grid wholesale, the gates and
// the milestones untouched), the report pins (the TIMELINE-IMPORT refusals surface in the review panel),
// and the authoring pin (the accepted rows are authored, editable, saved and loaded). The fixture PDF is
// generated here with jsPDF in the described basic layout — a test artifact, never presented as a real
// export.

const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;
const byNav = (v: string) => document.querySelector('[data-nav="' + v + '"]') as HTMLElement;
const byTest = (v: string) => document.querySelector('[data-testid="' + v + '"]');
const all = (sel: string) => Array.from(document.querySelectorAll(sel)) as HTMLElement[];
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

const X = { aktivitet: 40, startdatum: 280, slutdatum: 380, varaktighet: 480, progress: 560 };

interface FixtureRow { name: string; start: string; end: string; duration: string }

function buildFixturePdf(rows: FixtureRow[], headers = ["aktivitet", "startdatum", "slutdatum", "varaktighet"]): ArrayBuffer {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  doc.setFontSize(10);
  doc.text("Tidsplan", X.aktivitet, 800);
  headers.forEach((h, i) => doc.text(h, [X.aktivitet, X.startdatum, X.slutdatum, X.varaktighet][i], 760));
  rows.forEach((r, i) => {
    const y = 760 - (i + 1) * 18;
    doc.text(r.name, X.aktivitet, y);
    doc.text(r.start, X.startdatum, y);
    doc.text(r.end, X.slutdatum, y);
    doc.text(r.duration, X.varaktighet, y);
  });
  return doc.output("arraybuffer");
}

const fixtureRows: FixtureRow[] = [
  { name: "Projektering", start: "2026-01-15", end: "2027-06-30", duration: "18 mån" },
  { name: "Byggande", start: "15.7.2027", end: "2028-12-20", duration: "18 månader" },
  { name: "Driftsättning", start: "2029-03-15", end: "2030-03-14", duration: "365 d" },
];

const baseTimeline: TimelineBlock = {
  activities: [
    { id: "a1", label: "Hand-authored activity", startYear: 1, endYear: 2, phase: "prestudy" },
    { id: "a2", label: "Second authored", startYear: 3, endYear: 4, phase: "production" },
  ],
  decisionPoints: [{ id: "d1", title: "Decision to start the project and initiate preparations", year: 1, code: "DP1" }],
  milestones: [{ id: "m1", label: "Hand-authored milestone", year: 5 }],
};

const project = (): ModelInputs => ({ ...demoProject(), projectLengthYears: 12, timeline: baseTimeline });
const settings = { startYear: 2026, entryUnit: "ones" as const, scenarioTargets: null, scenarioTerms: null, scenarioBalloons: null };

async function openProject() {
  render(<App />);
  const text = serializeProject(project(), settings);
  fireEvent.change(byTest("open-project-input") as HTMLInputElement, { target: { files: [new File([text], "p.calcvibes.json", { type: "application/json" })] } });
  await waitFor(() => {
    expect((document.querySelector('[data-field="projectName"]') as HTMLInputElement).value).toBe("Project Alpha");
  });
  fireEvent.click(byNav("timeline"));
  await waitFor(() => {
    expect(byTest("timeline-activities")).toBeTruthy();
  });
}

// The save path is captured through the real download seam: URL.createObjectURL is stubbed to hold the
// Blob, and its text is the serialized project document.
let savedBlobs: Blob[] = [];
const origCreate = URL.createObjectURL;
const origRevoke = URL.revokeObjectURL;
beforeEach(() => {
  savedBlobs = [];
  (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = (b: Blob) => { savedBlobs.push(b); return "blob:mock"; };
  (URL as unknown as { revokeObjectURL: (u: string) => void }).revokeObjectURL = () => undefined;
});
afterEach(() => {
  (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = origCreate;
  (URL as unknown as { revokeObjectURL: (u: string) => void }).revokeObjectURL = origRevoke;
});

const readBlobText = (b: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(reader.error ?? new Error("read failed"));
  reader.readAsText(b);
});

async function savedText(): Promise<string> {
  fireEvent.click(byTest("save-project") as HTMLButtonElement);
  await waitFor(() => expect(savedBlobs.length).toBeGreaterThan(0));
  const blob = savedBlobs[savedBlobs.length - 1];
  savedBlobs = [];
  return readBlobText(blob);
}

function pickPdf(bytes: ArrayBuffer | string, name = "gantt-export.pdf") {
  const file = new File([bytes as BlobPart], name, { type: "application/pdf" });
  fireEvent.change(byTest("timeline-import-input") as HTMLInputElement, { target: { files: [file] } });
}

const activityRows = () => all('tr[data-kind="activity"]').map((r) => r.getAttribute("data-line") as string);
const gateRows = () => all('tr[data-kind="gate"]').map((r) => r.getAttribute("data-line") as string);
const milestoneRows = () => all('tr[data-kind="milestone"]').map((r) => r.getAttribute("data-line") as string);
const activityField = (id: string, f: string) => document.querySelector(`tr[data-kind="activity"][data-line="${id}"] [data-field="${f}"]`) as HTMLInputElement;

describe("v0.6.20 Task C — the import button and the review step", () => {
  it("SEAT: the import affordance sits in the Timeline section and no demo gains the import (no review panel without a user-chosen file)", async () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("timeline"));
    expect(byAction("import-pdf")).toBeTruthy();
    expect(byTest("timeline-import-input")).toBeTruthy();
    expect(byTest("timeline-import-review")).toBeNull();
    expect(byTest("timeline-import-note")).toBeNull();
  });

  it("REVIEW STEP: choosing a file composes the parse report panel; nothing is written before the explicit accept", async () => {
    await openProject();
    expect(activityRows()).toEqual(["a1", "a2"]);
    pickPdf(buildFixturePdf(fixtureRows));
    await waitFor(() => expect(byTest("timeline-import-review")).toBeTruthy());
    expect(byTest("timeline-import-review")!.textContent).toContain("gantt-export.pdf");
    expect(byTest("timeline-import-mapping")!.textContent).toContain("calendar year − 2026 + 1");
    expect(all('[data-testid="timeline-import-rows"] tr[data-row]').length).toBe(3);
    expect((byAction("import-accept") as HTMLButtonElement).disabled).toBe(false);
    // nothing composes without the accept: the grid still carries the authored rows
    expect(activityRows()).toEqual(["a1", "a2"]);
    expect(byTest("timeline-import-note")).toBeNull();
  });

  it("REPLACE PIN: ACCEPT authors the parsed rows and replaces the activities grid wholesale; the gates and the milestones are untouched", async () => {
    await openProject();
    pickPdf(buildFixturePdf(fixtureRows));
    await waitFor(() => expect(byTest("timeline-import-review")).toBeTruthy());
    fireEvent.click(byAction("import-accept"));
    await waitFor(() => expect(byTest("timeline-import-note")).toBeTruthy());
    expect(activityRows()).toEqual(["a1", "a2", "a3"]);
    expect(activityField("a1", "activityLabel").value).toBe("Projektering");
    expect(activityField("a1", "activityStart").value).toBe("1");
    expect(activityField("a1", "activityEnd").value).toBe("2");
    expect((activityField("a2", "activityPhase") as unknown as HTMLSelectElement).value).toBe("production");
    expect(activityField("a3", "activityLabel").value).toBe("Driftsättning");
    // the gates and the milestones are untouched
    expect(gateRows()).toEqual(["d1"]);
    expect(milestoneRows()).toEqual(["m1"]);
    const note = byTest("timeline-import-note")!.textContent ?? "";
    expect(note).toContain("replaced wholesale");
    expect(note).toContain("2 previous activities removed");
    expect(note).toContain("decision gates and the milestones are untouched");
    // the review panel is gone after the accept
    expect(byTest("timeline-import-review")).toBeNull();
    // the authored rows are in the saved document
    const text = await savedText();
    const loaded = parseProject(text);
    expect(loaded.inputs.timeline?.activities.map((a) => [a.id, a.label, a.startYear, a.endYear, a.phase])).toEqual([
      ["a1", "Projektering", 1, 2, "production"],
      ["a2", "Byggande", 2, 3, "production"],
      ["a3", "Driftsättning", 4, 5, "production"],
    ]);
    expect(loaded.inputs.timeline?.decisionPoints).toEqual(baseTimeline.decisionPoints);
    expect(loaded.inputs.timeline?.milestones).toEqual(baseTimeline.milestones);
  });

  it("NO-WRITE PIN: a refused import leaves the document byte-identical (the not-a-PDF refusal, then REFUSE; the save hash is unchanged)", async () => {
    await openProject();
    const before = await savedText();
    const beforeHash = sha(before);
    pickPdf(new TextEncoder().encode("definitely not a pdf").buffer as ArrayBuffer, "notes.txt");
    await waitFor(() => expect(byTest("timeline-import-review")).toBeTruthy());
    expect(all('[data-testid="timeline-import-refusals"] [data-refusal]').map((li) => li.getAttribute("data-refusal"))).toEqual(["TIMELINE-IMPORT-NOT-PDF"]);
    expect((byAction("import-accept") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(byAction("import-refuse"));
    await waitFor(() => expect(byTest("timeline-import-note")).toBeTruthy());
    expect(byTest("timeline-import-note")!.textContent).toContain("nothing was written");
    expect(byTest("timeline-import-review")).toBeNull();
    expect(activityRows()).toEqual(["a1", "a2"]);
    expect(gateRows()).toEqual(["d1"]);
    expect(milestoneRows()).toEqual(["m1"]);
    const after = await savedText();
    expect(sha(after)).toBe(beforeHash);
    expect(after).toBe(before);
  });

  it("NO-WRITE PIN (valid file, refused): even a parseable export leaves the document byte-identical when REFUSE is chosen", async () => {
    await openProject();
    const before = await savedText();
    pickPdf(buildFixturePdf(fixtureRows));
    await waitFor(() => expect(byTest("timeline-import-review")).toBeTruthy());
    fireEvent.click(byAction("import-refuse"));
    const after = await savedText();
    expect(sha(after)).toBe(sha(before));
    expect(activityRows()).toEqual(["a1", "a2"]);
  });
});

describe("v0.6.20 Task D — the report pins in the review panel", () => {
  it("HEADERS UNMATCHED: an export without the words of record refuses whole, ACCEPT stays disabled", async () => {
    await openProject();
    pickPdf(buildFixturePdf(fixtureRows, ["activity", "start", "end", "duration"]), "english.pdf");
    await waitFor(() => expect(byTest("timeline-import-review")).toBeTruthy());
    expect(all('[data-testid="timeline-import-refusals"] [data-refusal]').map((li) => li.getAttribute("data-refusal"))).toEqual(["TIMELINE-IMPORT-HEADERS"]);
    expect((byAction("import-accept") as HTMLButtonElement).disabled).toBe(true);
    expect(all('[data-testid="timeline-import-rows"] tr[data-row]').length).toBe(0);
    fireEvent.click(byAction("import-refuse"));
    expect(activityRows()).toEqual(["a1", "a2"]);
  });

  it("DATES UNPARSED / DURATION MISMATCH / BEFORE-START / ZERO-ROWS: each surfaces in the report with its code, and the refused row never composes", async () => {
    await openProject();
    const rows: FixtureRow[] = [
      { name: "Bra rad", start: "2026-02-01", end: "2026-08-31", duration: "7 mån" },
      { name: "Trasig rad", start: "okänt", end: "2027-01-01", duration: "11 mån" },
      { name: "Fel varaktighet", start: "2026-01-01", end: "2026-12-31", duration: "3 dagar" },
      { name: "Före startår", start: "2025-06-01", end: "2025-12-31", duration: "7 mån" },
    ];
    pickPdf(buildFixturePdf(rows), "mixed.pdf");
    await waitFor(() => expect(byTest("timeline-import-review")).toBeTruthy());
    const codes = all('[data-testid="timeline-import-refusals"] [data-refusal]').map((li) => li.getAttribute("data-refusal"));
    expect(codes).toContain("TIMELINE-IMPORT-DATE");
    expect(codes).toContain("TIMELINE-IMPORT-DURATION");
    expect(codes).toContain("TIMELINE-IMPORT-BEFORE-START");
    const rowRefusals = all('[data-testid="timeline-import-rows"] tr[data-row] [data-refusal]').map((li) => li.getAttribute("data-refusal"));
    expect(rowRefusals).toContain("TIMELINE-IMPORT-DATE");
    expect(rowRefusals.filter((c) => c === "TIMELINE-IMPORT-DURATION").length).toBe(1);
    expect(rowRefusals).toContain("TIMELINE-IMPORT-BEFORE-START");
    const verdicts = all('[data-field="durationCheck"]').map((td) => td.getAttribute("data-verdict"));
    expect(verdicts).toEqual(["consistent", "unchecked", "mismatch", "consistent"]);
    // the parsed rows compose on accept, the refused row does not
    fireEvent.click(byAction("import-accept"));
    await waitFor(() => expect(activityRows()).toEqual(["a1", "a2", "a3"]));
    expect(activityField("a1", "activityLabel").value).toBe("Bra rad");
    expect(activityField("a2", "activityLabel").value).toBe("Fel varaktighet");
    expect(activityField("a3", "activityLabel").value).toBe("Före startår");
    expect(activityField("a3", "activityStart").value).toBe("0");
    // the before-start authored row falls under the standing TIMELINE-ACTIVITY-SPAN refusal (section-local)
    await waitFor(() => {
      const codes2 = all('[data-testid="timeline-refusals"] [data-refusal]').map((li) => li.getAttribute("data-refusal"));
      expect(codes2).toContain("TIMELINE-ACTIVITY-SPAN");
    });
  });

  it("ZERO-ROWS: an export with the header but no rows is disclosed, ACCEPT stays disabled, REFUSE writes nothing", async () => {
    await openProject();
    const before = await savedText();
    pickPdf(buildFixturePdf([]), "empty.pdf");
    await waitFor(() => expect(byTest("timeline-import-review")).toBeTruthy());
    expect(all('[data-testid="timeline-import-refusals"] [data-refusal]').map((li) => li.getAttribute("data-refusal"))).toEqual(["TIMELINE-IMPORT-ZERO-ROWS"]);
    expect((byAction("import-accept") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(byAction("import-refuse"));
    const after = await savedText();
    expect(sha(after)).toBe(sha(before));
  });
});

describe("v0.6.20 Task E — the authoring pin", () => {
  it("AUTHORED-EDIT-SAVE: the accepted rows are editable in the grid and saved with the project", async () => {
    await openProject();
    pickPdf(buildFixturePdf(fixtureRows));
    await waitFor(() => expect(byTest("timeline-import-review")).toBeTruthy());
    fireEvent.click(byAction("import-accept"));
    await waitFor(() => expect(activityRows()).toEqual(["a1", "a2", "a3"]));
    // editable like any authored activity
    fireEvent.change(activityField("a2", "activityLabel"), { target: { value: "Byggande etapp 1" } });
    fireEvent.change(activityField("a2", "activityEnd"), { target: { value: "4" } });
    expect(activityField("a2", "activityLabel").value).toBe("Byggande etapp 1");
    expect(activityField("a2", "activityEnd").value).toBe("4");
    // saved: the project file round-trips the authored, edited rows
    const text = await savedText();
    const loaded = parseProject(text);
    const acts = loaded.inputs.timeline?.activities ?? [];
    expect(acts.map((a) => [a.id, a.label, a.startYear, a.endYear, a.phase])).toEqual([
      ["a1", "Projektering", 1, 2, "production"],
      ["a2", "Byggande etapp 1", 2, 4, "production"],
      ["a3", "Driftsättning", 4, 5, "production"],
    ]);
    expect(loaded.settings.startYear).toBe(2026);
  });

  it("AUTHORED-LOAD: a saved project carrying imported rows opens back into the app with those rows in the grid", async () => {
    const imported: TimelineBlock = {
      activities: [
        { id: "a1", label: "Projektering", startYear: 1, endYear: 2, phase: "production" },
        { id: "a2", label: "Byggande etapp 1", startYear: 2, endYear: 4, phase: "production" },
      ],
      decisionPoints: baseTimeline.decisionPoints,
      milestones: baseTimeline.milestones,
    };
    render(<App />);
    const text = serializeProject({ ...demoProject(), projectLengthYears: 12, timeline: imported }, settings);
    fireEvent.change(byTest("open-project-input") as HTMLInputElement, { target: { files: [new File([text], "roundtrip.calcvibes.json", { type: "application/json" })] } });
    await waitFor(() => expect((document.querySelector('[data-field="projectName"]') as HTMLInputElement).value).toBe("Project Alpha"));
    fireEvent.click(byNav("timeline"));
    await waitFor(() => expect(activityRows()).toEqual(["a1", "a2"]));
    expect(activityField("a1", "activityLabel").value).toBe("Projektering");
    expect(activityField("a2", "activityLabel").value).toBe("Byggande etapp 1");
    expect((activityField("a1", "activityPhase") as unknown as HTMLSelectElement).value).toBe("production");
    expect(byTest("timeline-import-review")).toBeNull();
    expect(gateRows()).toEqual(["d1"]);
    expect(milestoneRows()).toEqual(["m1"]);
  });
});
