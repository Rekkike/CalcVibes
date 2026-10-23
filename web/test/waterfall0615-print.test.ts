import { describe, expect, it } from "vitest";
import { computeModel } from "../../core/src/engine.js";
import { deckSlides } from "../src/deck.js";
import { buildDeckPdf } from "../src/pdf.js";
import { shorePowerProgram } from "../src/state.js";

// v0.6.15 Task D — the print port. The printed investment slide carries BOTH sections: the ledger rows
// (individual lines, the subtotal, the operating segment, the total) and the stepped group columns; the
// operating segment is no longer omitted and the drawn rows reconcile to the total program cost.
function printed() {
  const inp = shorePowerProgram();
  const model = deckSlides(inp, computeModel(inp), { startYear: 2026, entryUnit: "thousands" });
  const trace = { drawnTitles: [] as string[], drawnFigures: [] as string[][] };
  const doc = buildDeckPdf(model, "P", trace);
  const idx = model.slides.findIndex((s) => s.name === "investment");
  return { model, drawn: trace.drawnFigures[idx], waterfall: model.slides[idx].waterfall!, pages: doc.getNumberOfPages(), trace };
}

describe("the printed investment slide", () => {
  it("draws every ledger row: the full line names, the values and the full-outflow shares", () => {
    const { drawn, waterfall } = printed();
    for (const r of waterfall.rows) {
      expect(drawn).toContain(r.name);
      expect(drawn).toContain(r.value);
      expect(drawn).toContain(r.share);
    }
    expect(drawn).toContain("Container shore power — engineering & studies (RSP JV)");
  });

  it("v0.6.18: the waterfall closes at the Capital program step on the print route too; the drawn values reconcile to the capital program, and the operating lines no longer print as a step", () => {
    const { drawn, waterfall } = printed();
    expect(drawn).toContain("Capital program");
    expect(drawn).toContain("€449 000 k");
    expect(drawn).not.toContain("€179 250 k");
    const parts = waterfall.rows.filter((r) => r.kind === "capital");
    expect(parts.reduce((a, r) => a + r.raw, 0)).toBeCloseTo(waterfall.totalRaw, 6);
    expect(waterfall.totalRaw).toBe(449000000);
  });

  it("draws the stepped columns: the group names and the group values", () => {
    const { drawn, waterfall } = printed();
    for (const c of waterfall.columns) {
      expect(drawn).toContain(c.name);
      expect(drawn).toContain(c.value);
    }
    expect(waterfall.columns.map((c) => c.name)).toContain("Container shore power");
  });

  it("a deck with no waterfall slot is unaffected (the golden template draws its rows through the ledger too)", () => {
    const inp = shorePowerProgram();
    const model = deckSlides(inp, computeModel(inp), { startYear: null, entryUnit: "thousands" });
    expect(() => buildDeckPdf(model, "P")).not.toThrow();
  });
});
