// v0.6.18 Tasks A and B: the operating-lines seat (the capital-only investment waterfall and the
// conditional operations slide) and the executive-summary donut percentages with their corrected
// disclosure. Everything is composed once in the deck model; the Presentation and the print route consume.
import { describe, expect, it } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { App } from "../src/App.js";
import { computeModel } from "../src/engine.js";
import { deckSlides } from "../src/deck.js";
import { buildDeckPdf } from "../src/pdf.js";
import { demoProject, landNewbuildProject, multiLeaseProject, shorePowerProgram, composeInvestment } from "../src/state.js";
import type { ModelInputs } from "../../core/src/types.js";

const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;
const deckOf = (inp: ModelInputs, extra: object = {}) => deckSlides(inp, computeModel(inp), { startYear: null, entryUnit: "ones", ...extra });
const slide = (inp: ModelInputs, name: string) => deckOf(inp).slides.find((s) => s.name === name);
const num = (s: string) => Number(s.replace(",", ".").replace("%", ""));

describe("v0.6.18 Task A: the conditional operations slide", () => {
  it("OPS-ABSENT: a project without operating lines gains no operations slide; the kicker numbering stays contiguous", () => {
    for (const make of [demoProject, multiLeaseProject]) {
      const inp = make();
      if ((inp.operatingLines ?? []).length > 0) continue;
      const d = deckOf(inp);
      expect(d.slides.some((s) => s.name === "operations")).toBe(false);
      const kickers = d.slides.filter((s) => s.name !== "title").map((s) => s.kickerNumber);
      expect(kickers).toEqual(kickers.map((_, i) => String(i + 1).padStart(2, "0")));
    }
    expect(demoProject().operatingLines ?? []).toHaveLength(0);
    expect(deckOf(demoProject()).slides.map((s) => s.name)).not.toContain("operations");
  });

  it("OPS-PRESENT: an operating-bearing project mounts the operations slide after the timeline slot, before the recovery; the numbering adapts", () => {
    const d = deckOf(shorePowerProgram());
    const names = d.slides.map((s) => s.name);
    expect(names).toEqual(["title", "summary", "investment", "timeline", "operations", "recovery", "coverage", "returns", "deal"]);
    expect(d.slides.filter((s) => s.name !== "title").map((s) => s.kickerNumber)).toEqual(["01", "02", "03", "04", "05", "06", "07", "08"]);
    const land = deckOf(landNewbuildProject()).slides.map((s) => s.name);
    expect(land.indexOf("operations")).toBe(land.indexOf("investment") + 2); // the land demo carries a timeline too
  });

  it("OPS-WATERFALL: the waterfall closes at the capital subtotal; the total program cost stays a labeled figure of the slide", () => {
    const inp = shorePowerProgram();
    const r = computeModel(inp);
    const inv = slide(inp, "investment")!;
    const c = composeInvestment(inp, r);
    const last = inv.waterfall!.rows[inv.waterfall!.rows.length - 1];
    expect(last).toMatchObject({ kind: "total", name: "Capital program", raw: c.capitalSubtotal });
    expect(inv.waterfall!.rows.every((x) => x.kind === "capital" || x.kind === "total")).toBe(true);
    expect(inv.waterfall!.columns.every((x) => x.kind === "capital" || x.kind === "total")).toBe(true);
    // the geometry closes at 100 percent of the CAPITAL program (the shares are of the capital program)
    const capRows = inv.waterfall!.rows.filter((x) => x.kind === "capital");
    expect(capRows.reduce((a, x) => a + x.widthPct, 0)).toBeCloseTo(100, 6);
    expect(capRows[capRows.length - 1].startPct + capRows[capRows.length - 1].widthPct).toBeCloseTo(100, 6);
    expect(inv.waterfall!.columns[inv.waterfall!.columns.length - 2].bottomPct + inv.waterfall!.columns[inv.waterfall!.columns.length - 2].heightPct).toBeCloseTo(100, 6);
    const total = inv.body.find((f) => f.label === "Total cost (nominal)")!;
    expect(total.rawValue).toBe(r.totalCost);
    expect(r.totalCost).toBeGreaterThan(c.capitalSubtotal);
    expect(inv.body.some((f) => f.label === "Operating lines total")).toBe(false);
    expect(inv.disclosures[0]).toContain("The total program cost also includes the operating lines");
  });

  it("OPS-BURN: the yearly burn is the engine's per-year operating series and sums to the operating total", () => {
    for (const make of [shorePowerProgram, landNewbuildProject]) {
      const inp = make();
      const r = computeModel(inp);
      const ops = slide(inp, "operations")!;
      expect(ops.chart!.kind).toBe("bars");
      const sum = ops.chart!.data.reduce((a, d) => a + d.value, 0);
      expect(sum).toBeCloseTo(r.operatingTotal, 4);
      expect(ops.chart!.data.every((d) => d.value > 0)).toBe(true);
      expect(ops.body[0]).toMatchObject({ label: "Operating lines total", rawValue: r.operatingTotal });
    }
  });

  it("OPS-CONTENT: the anchor figure, the share, the per-line figures, the action title and the single-instrument disclosure", () => {
    const inp = shorePowerProgram();
    const r = computeModel(inp);
    const ops = slide(inp, "operations")!;
    expect(ops.title).toBe("The operating lines add €179 250 000 of running cost over 20 years");
    expect(ops.body.map((f) => f.label)).toEqual(["Operating lines total", "Share of the total program cost", ...r.operatingLines.map((o) => `Operating line — ${o.label}`)]);
    expect(ops.body[0].disclosure).toBe("expensed as incurred; part of the total cost, not depreciated");
    expect(ops.body[1].value).toBe("28,5%");
    expect(ops.disclosures).toEqual(["The tariff recovers the total program cost, capital and operating together; no income is attributable to the operating lines alone, so no income is paired with them on this slide."]);
    expect(ops.body.some((f) => /income|collected|payment/i.test(f.label))).toBe(false);
  });

  it("OPS-RENDER: the Presentation draws the yearly bars from the deck series; the print route draws the same figures", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    const el = document.querySelector('[data-slide-name="operations"]') as HTMLElement;
    expect(el).toBeTruthy();
    expect(el.querySelector('[data-slide-chart="operations"] [data-testid="recovery-bars"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="chart-kicker"]')!.textContent).toBe("The operating cost per year");
    expect(el.textContent).toContain("Operating lines total");
    const inp = shorePowerProgram();
    const model = deckOf(inp);
    const trace = { drawnTitles: [] as string[], drawnFigures: [] as string[][] };
    buildDeckPdf(model, "P", trace);
    const idx = model.slides.findIndex((s) => s.name === "operations");
    const drawn = trace.drawnFigures[idx];
    expect(trace.drawnTitles).toContain(model.slides[idx].title);
    expect(drawn).toContain("€179 250 000");
    expect(drawn).toContain(model.slides[idx].chart!.data[0].label);
    expect(drawn).toContain("The operating cost per year");
  });
});

describe("v0.6.18 Task B: the donut percentages and the corrected disclosure", () => {
  it("SHARES: every segment carries its share of the ring's OWN total, one decimal; the residue is disclosed, never smoothed", () => {
    for (const make of [shorePowerProgram, landNewbuildProject, demoProject]) {
      const inp = make();
      for (const d of slide(inp, "summary")!.donuts!) {
        const total = d.segments.reduce((a, s) => a + s.value, 0);
        for (const s of d.segments) {
          expect(s.share).toBeDefined();
          expect(num(s.share!)).toBeCloseTo(Math.round((s.value / total) * 1000) / 10, 6);
        }
        const sum = d.segments.reduce((a, s) => a + num(s.share!), 0);
        expect(Math.abs(sum - 100)).toBeLessThanOrEqual(0.05 * d.segments.length + 1e-9);
      }
    }
    // the shore-power outflow ring: the six one-decimal shares sum to 100.1 (the v0.6.10 honest residue)
    const out = slide(shorePowerProgram(), "summary")!.donuts!.find((d) => d.id === "outflows")!;
    expect(out.segments.map((s) => s.share)).toEqual(["16,5%", "24,5%", "22,3%", "27,8%", "4,5%", "4,5%"]);
    expect(out.segments.reduce((a, s) => a + num(s.share!), 0)).toBeCloseTo(100.1, 6);
  });

  it("DISCLOSURE: the outflow ring names its basis and the percentages' basis on every project; the stale 'shown separately' wording is gone", () => {
    const withOps = slide(shorePowerProgram(), "summary")!.donuts!.find((d) => d.id === "outflows")!;
    expect(withOps.disclosure).toBe("The outflow ring shows the capital lines; the operating lines are excluded (they are part of the total cost and appear on the operations slide). Percentages are shares of the ring's own total.");
    const plain = slide(demoProject(), "summary")!.donuts!.find((d) => d.id === "outflows")!;
    expect(plain.disclosure).toBe("The outflow ring shows the capital lines. Percentages are shares of the ring's own total.");
    const reinv: ModelInputs = { ...landNewbuildProject(), contracts: landNewbuildProject().contracts!.map((k, i) => (i === 0 ? { ...k, reinvestments: [{ year: 6, amount: 5000000 }] } : k)) };
    const r = slide(reinv, "summary")!.donuts!.find((d) => d.id === "outflows")!;
    expect(r.disclosure).toBe("The outflow ring shows the capital lines plus the reinvestments; the operating lines are excluded (they are part of the total cost and appear on the operations slide). Percentages are shares of the ring's own total.");
    expect(r.segments.map((s) => s.id)).toContain("reinvestments");
    for (const inp of [shorePowerProgram(), landNewbuildProject(), demoProject()]) {
      for (const d of slide(inp, "summary")!.donuts!) expect(d.disclosure).toContain("Percentages are shares of the ring's own total.");
      expect(JSON.stringify(deckOf(inp))).not.toContain("shown separately");
    }
  });

  it("BASIS-UNCHANGED: the land fixture's outflow ring still holds its three capital lines", () => {
    const out = slide(landNewbuildProject(), "summary")!.donuts!.find((d) => d.id === "outflows")!;
    expect(out.segments.map((s) => s.value)).toEqual([45000000, 320000000, 55000000]);
  });

  it("ROUTES: the app donut, the deck donuts and the print labels carry the share of the ring's own total", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    const labels = Array.from(document.querySelectorAll('[data-donut="outflows"] [data-donut-share]')).map((e) => e.textContent);
    expect(labels).toEqual(["16,5%", "24,5%", "22,3%", "27,8%", "4,5%", "4,5%"]);
    const inp = shorePowerProgram();
    const model = deckOf(inp);
    const trace = { drawnTitles: [] as string[], drawnFigures: [] as string[][] };
    buildDeckPdf(model, "P", trace);
    const drawn = trace.drawnFigures[model.slides.findIndex((s) => s.name === "summary")];
    const seg = model.slides[1].donuts![0].segments[0];
    expect(drawn.some((x) => x.includes(seg.label) && x.endsWith(`· ${seg.share}`))).toBe(true);
    expect(drawn).toContain(model.slides[1].donuts![0].disclosure!);
    expect(drawn).toContain(model.slides[1].donuts![1].disclosure!);
  });

  it("WORKSPACE-RING: the workspace composition ring formats the same fraction the arc draws", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(document.querySelector('[data-nav="costs"]') as HTMLElement);
    const wrap = document.querySelector('[data-testid="composition-donut-wrap"]') as HTMLElement;
    const shares = Array.from(wrap.querySelectorAll("[data-donut-share]")).map((e) => e.textContent);
    expect(shares).toEqual(["16,5%", "24,5%", "22,3%", "27,8%", "4,5%", "4,5%"]);
  });
});
