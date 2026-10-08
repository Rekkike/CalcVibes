import { describe, expect, it } from "vitest";
import { deckSlides } from "../src/deck.js";
import { buildDeckPdf } from "../src/pdf.js";
import { computeModel } from "../src/engine.js";
import { demoProject } from "../src/state.js";

describe("EX-4 route B: jsPDF deck builder", () => {
  const result = computeModel(demoProject());
  const model = deckSlides(demoProject(), result);

  it("consumes the deckSlides model (the seam) and produces exactly five pages", () => {
    const doc = buildDeckPdf(model, demoProject().projectName);
    expect(doc.getNumberOfPages()).toBe(5);
  });

  it("the output buffer is non-empty (byte length > 1,000)", () => {
    const doc = buildDeckPdf(model, demoProject().projectName);
    const bytes = doc.output("arraybuffer");
    expect(bytes.byteLength).toBeGreaterThan(1000);
  });

  it("page 1 carries the model's slide-0 title (asserted through the seam)", () => {
    const trace: { drawnTitles: string[] } = { drawnTitles: [] };
    buildDeckPdf(model, demoProject().projectName, trace);
    expect(trace.drawnTitles[0]).toBe(model.slides[0].title);
    expect(trace.drawnTitles[0]).toBe("Project Alpha");
  });
});
