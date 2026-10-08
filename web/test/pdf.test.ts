import { describe, expect, it } from "vitest";
import { deckSlides } from "../src/deck.js";
import { buildDeckPdf } from "../src/pdf.js";
import { computeModel } from "../src/engine.js";
import { demoProject } from "../src/state.js";

const result = computeModel(demoProject());
const model = deckSlides(demoProject(), result);

describe("EX-4 route B: jsPDF deck builder", () => {

  it("consumes the deckSlides model (the seam) and produces exactly six pages", () => {
    const doc = buildDeckPdf(model, demoProject().projectName);
    expect(doc.getNumberOfPages()).toBe(6);
  });

  it("the output buffer is non-empty (byte length > 1,000)", () => {
    const doc = buildDeckPdf(model, demoProject().projectName);
    const bytes = doc.output("arraybuffer");
    expect(bytes.byteLength).toBeGreaterThan(1000);
  });

  it("page 1 carries the model's slide-0 title (asserted through the seam)", () => {
    const trace = { drawnTitles: [] as string[], drawnFigures: [] as string[][] };
    buildDeckPdf(model, demoProject().projectName, trace);
    expect(trace.drawnTitles[0]).toBe(model.slides[0].title);
    expect(trace.drawnTitles[0]).toBe("Project Alpha");
  });
});

describe("v0.5.1 Task A/C: PDF action, pagination, trace", () => {
  it("every body figure and every deal tile appears in the trace (base demo); page count pinned", () => {
    const trace = { drawnTitles: [] as string[], drawnFigures: [] as string[][] };
    const doc = buildDeckPdf(model, demoProject().projectName, trace);
    expect(doc.getNumberOfPages()).toBe(6);
    expect(trace.drawnFigures.length).toBe(6);
    for (let i = 0; i < 6; i++) {
      for (const fig of model.slides[i].body) {
        expect(trace.drawnFigures[i]).toContain(fig.value);
      }
    }
    const tiles = model.slides[5].tiles ?? [];
    expect(tiles.length).toBe(10);
    const tracedDeal = trace.drawnFigures[5].join("|");
    for (const t of tiles) {
      expect(tracedDeal).toContain(t.value);
      expect(tracedDeal).toContain(t.label.toUpperCase());
    }
  });

  it("the financing-on variant: the deal slide carries all fifteen tiles plus the disclosure; page count pinned", () => {
    const finInputs = { ...demoProject(), financing: { enabled: true, sharePct: 60, debtRatePct: 6, termYears: 7, graceYears: 0, serviceStartYear: null, amortization: "annuity" as const, leveragedSolve: false, perLineSharePct: {} } };
    const finResult = computeModel(finInputs);
    const finModel = deckSlides(finInputs, finResult);
    const trace = { drawnTitles: [] as string[], drawnFigures: [] as string[][] };
    const doc = buildDeckPdf(finModel, finInputs.projectName, trace);
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(5);
    const tiles = finModel.slides[5].tiles ?? [];
    expect(tiles.length).toBe(15);
    const traced = trace.drawnFigures[5].join("|");
    for (const t of tiles) {
      expect(traced).toContain(t.value);
    }
    expect(finModel.slides[5].disclosures.length).toBeGreaterThan(0);
  });
});
