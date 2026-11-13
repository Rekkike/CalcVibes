import { describe, expect, it } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { App } from "../src/App.js";
import { FlowBands, FLOW_BANDS_GEO } from "../src/charts.js";
import { composeFlowSlide } from "../src/deck.js";
import type { DeckFlow, DeckFlowBand } from "../src/deck.js";
import { computeModel, deckMoneyForDisplay } from "../src/engine.js";
import type { CurrencyCode } from "../src/engine.js";
import { composeFlow, demoProject, landNewbuildProject, shorePowerProgram, solarParkProject } from "../src/state.js";
import type { ModelInputs } from "../../core/src/types.js";

// v0.6.22.1 Task C — the pins for the direct-label seating on the FlowBands renderer: every label
// anchored to its band's segment by DOM assertions reading the composed position against the same
// mapping that draws the geometry (the band rect's x/y/width/height and the label text's x/y), the
// retired legend absent from the rendered tree, the symmetric frame composing as one centered block,
// the inside/beside admission rule at its boundary heights (one rule for both bands), and the
// bad-tone signed label. The FlowSection and the presentation inherit the seating through the same
// renderer.

const q = (sel: string) => document.querySelector(sel) as HTMLElement;
const qa = (sel: string) => Array.from(document.querySelectorAll(sel)) as HTMLElement[];
const num = (el: Element, attr: string) => Number(el.getAttribute(attr));

const viewOf = (inputs: ModelInputs): DeckFlow =>
  composeFlowSlide(composeFlow(inputs, computeModel(inputs)), (v) => deckMoneyForDisplay(v, inputs.currency as CurrencyCode, "ones"));

const band = (key: string, label: string, raw: number, value: string, signed: boolean, topPct: number, heightPct: number): DeckFlowBand =>
  ({ key, label, raw, value, count: 1, signed, topPct, heightPct });

const flowWith = (incomeBands: DeckFlowBand[], useBands: DeckFlowBand[]): DeckFlow => ({
  form: "bands",
  incomeBands,
  useBands,
  connectors: [],
  omittedConnectors: 0,
  scaleRaw: 100,
  caption: "",
  bridge: [],
  ledger: [],
  ledgerOmitted: 0,
  remainderNet: 0,
  remainderNetValue: "0",
  surplusRaw: 0,
  surplusValue: "0",
  shortfallRaw: 0,
  shortfallValue: "0",
  shortfallYears: 0,
  incomeNet: 100,
  incomeNetValue: "100",
  usesTotal: 100,
  usesTotalValue: "100",
});

// the boundary height in percent: hAt(heightPct) === FLOW_BANDS_GEO.labelMinH
const pctAt = (h: number) => (h / FLOW_BANDS_GEO.plotH) * 100;

describe("v0.6.22.1 Task C — the direct-label seating on the FlowBands renderer", () => {
  it("ANCHOR: every band label is anchored to its segment — the composed position read against the geometry mapping", () => {
    for (const demo of [demoProject(), solarParkProject(), landNewbuildProject(), shorePowerProgram()]) {
      const flow = viewOf(demo);
      expect(flow.form).toBe("bands");
      const { container } = render(<FlowBands flow={flow} />);
      const root = container.querySelector('[data-testid="flow-bands"]') as HTMLElement;
      for (const [side, bands, bandAttr, labelAttr] of [
        ["income", flow.incomeBands, "data-flow-income-band", "data-flow-income-label"],
        ["use", flow.useBands, "data-flow-use-band", "data-flow-use-label"],
      ] as const) {
        for (const b of bands) {
          const rect = root.querySelector(`[${bandAttr}="${b.key}"]`) as Element;
          const rx = num(rect, "x"), ry = num(rect, "y"), rw = num(rect, "width"), rh = num(rect, "height");
          // the geometry mapping itself: the rect sits at yAt(topPct) with height hAt(heightPct)
          expect(ry).toBeCloseTo(FLOW_BANDS_GEO.top + (b.topPct / 100) * FLOW_BANDS_GEO.plotH, 6);
          expect(rh).toBeCloseTo(Math.max(0.5, (b.heightPct / 100) * FLOW_BANDS_GEO.plotH), 6);
          const g = root.querySelector(`[${labelAttr}="${b.key}"]`) as HTMLElement;
          expect(g).toBeTruthy();
          const mode = g.getAttribute("data-label-mode");
          const lines = Array.from(g.querySelectorAll("text"));
          // real text at every width: the lines join back to the composed name and reading-form value, never truncated
          expect(lines.map((t) => t.textContent).join(" ")).toBe(`${b.label} ${b.value}`);
          const first = lines[0];
          const lx = num(first, "x"), ly = num(first, "y");
          const mid = ry + rh / 2;
          if (mode === "inside") {
            expect(rh).toBeGreaterThanOrEqual(FLOW_BANDS_GEO.labelMinH); // the admission rule, read from the composed rect
            expect(lines.length).toBe(1);
            expect(first.getAttribute("text-anchor")).toBe("middle");
            expect(lx).toBeCloseTo(rx + rw / 2, 6); // centered in the band box
            expect(ly).toBeCloseTo(mid + 4, 6); // the Gantt inside-label baseline, on the segment mid
            expect(lx).toBeGreaterThanOrEqual(rx - 1e-9);
            expect(lx).toBeLessThanOrEqual(rx + rw + 1e-9);
          } else {
            expect(mode).toBe("beside");
            expect(rh).toBeLessThan(FLOW_BANDS_GEO.labelMinH);
            const k = lines.length;
            expect(ly).toBeCloseTo(mid - ((k - 1) * FLOW_BANDS_GEO.lineH) / 2 + 4, 6); // the block centered on the segment mid
            if (side === "income") {
              expect(first.getAttribute("text-anchor")).toBe("end");
              expect(lx).toBeCloseTo(rx - FLOW_BANDS_GEO.labelGap, 6);
              expect(lx).toBeLessThan(rx); // left of the income band, outside the ribbon space
            } else {
              expect(first.getAttribute("text-anchor")).toBe("start");
              expect(lx).toBeCloseTo(rx + rw + FLOW_BANDS_GEO.labelGap, 6);
              expect(lx).toBeGreaterThan(rx + rw); // right of the use band, outside the ribbon space
            }
          }
        }
      }
      // no label ever enters the ribbon space between the band boxes
      const incomeBand = root.querySelector("[data-flow-income-band]") as Element;
      const useBand = root.querySelector("[data-flow-use-band]") as Element;
      const ribbonL = num(incomeBand, "x") + num(incomeBand, "width");
      const ribbonR = num(useBand, "x");
      for (const t of Array.from(root.querySelectorAll(".flow-label-group text"))) {
        const x = num(t, "x");
        const anchor = t.getAttribute("text-anchor");
        if (anchor === "end") expect(x).toBeLessThanOrEqual(ribbonL);
        else if (anchor === "start") expect(x).toBeGreaterThanOrEqual(ribbonR);
        else expect(x).toBeGreaterThanOrEqual(ribbonL - num(incomeBand, "width") - 1e-9); // middle: inside a band box (checked per band above)
      }
    }
  });

  it("LEGEND-RETIRED: the below-figure swatch lists are gone from the rendered tree; the figure is one block", () => {
    const flow = viewOf(shorePowerProgram());
    const { container } = render(<FlowBands flow={flow} />);
    const root = container.querySelector('[data-testid="flow-bands"]') as HTMLElement;
    expect(root.querySelector('[data-testid="flow-labels"]')).toBeNull();
    expect(root.querySelector('[data-testid="flow-income-labels"]')).toBeNull();
    expect(root.querySelector('[data-testid="flow-use-labels"]')).toBeNull();
    expect(root.querySelector(".flow-label-col")).toBeNull();
    expect(root.querySelector(".flow-swatch")).toBeNull();
    expect(root.children.length).toBe(1);
    expect((root.firstElementChild as Element).tagName.toLowerCase()).toBe("svg");
  });

  it("CENTERED: the symmetric frame composes as one centered block — equal band widths, equal gutters, symmetric about the viewBox middle", () => {
    for (const demo of [demoProject(), landNewbuildProject(), shorePowerProgram()]) {
      const flow = viewOf(demo);
      const { container } = render(<FlowBands flow={flow} />);
      const root = container.querySelector('[data-testid="flow-bands"]') as HTMLElement;
      const svg = root.querySelector("svg") as Element;
      const vb = svg.getAttribute("viewBox")!.split(/\s+/).map(Number);
      const W = vb[2];
      const inB = root.querySelector("[data-flow-income-band]") as Element;
      const useB = root.querySelector("[data-flow-use-band]") as Element;
      const bwIn = num(inB, "width"), bwUse = num(useB, "width");
      const xL = num(inB, "x"), xR = num(useB, "x");
      expect(bwIn).toBeCloseTo(bwUse, 9); // equal band widths
      expect(xL).toBeCloseTo(FLOW_BANDS_GEO.labelColW, 9); // the income band sits after the fixed-width label column
      expect(W - (xR + bwUse)).toBeCloseTo(xL, 9); // equal gutters
      expect(xL + bwIn / 2 + (xR + bwUse / 2)).toBeCloseTo(W, 9); // the band centers symmetric about the middle
      expect(root.querySelectorAll("svg").length).toBe(1); // one figure block
    }
  });

  it("ADMISSION: at the boundary height the label seats inside, below it beside — one rule for both bands", () => {
    const pctIn = pctAt(FLOW_BANDS_GEO.labelMinH * 1.001);
    const pctOut = pctAt(FLOW_BANDS_GEO.labelMinH * 0.999);
    const flow = flowWith(
      [band("a", "Alpha source", 50, "50 kr", false, 0, pctIn), band("b", "Beta source", 50, "50 kr", false, pctIn, pctOut)],
      [band("X", "X use", 50, "50 kr", false, 0, pctIn), band("Y", "Y use", 50, "50 kr", false, pctIn, pctOut)],
    );
    const { container } = render(<FlowBands flow={flow} />);
    const root = container.querySelector('[data-testid="flow-bands"]') as HTMLElement;
    for (const [labelAttr, tallKey, shortKey] of [
      ["data-flow-income-label", "a", "b"],
      ["data-flow-use-label", "X", "Y"],
    ] as const) {
      const tall = root.querySelector(`[${labelAttr}="${tallKey}"]`) as HTMLElement;
      const short = root.querySelector(`[${labelAttr}="${shortKey}"]`) as HTMLElement;
      expect(tall.getAttribute("data-label-mode")).toBe("inside");
      expect(short.getAttribute("data-label-mode")).toBe("beside");
      // the boundary read from the composed rects: the tall segment's rendered height admits the text, the short one's does not
      const tallRect = root.querySelector(`[data-flow-${labelAttr.includes("income") ? "income" : "use"}-band="${tallKey}"]`) as Element;
      const shortRect = root.querySelector(`[data-flow-${labelAttr.includes("income") ? "income" : "use"}-band="${shortKey}"]`) as Element;
      expect(num(tallRect, "height")).toBeGreaterThanOrEqual(FLOW_BANDS_GEO.labelMinH);
      expect(num(shortRect, "height")).toBeLessThan(FLOW_BANDS_GEO.labelMinH);
    }
  });

  it("BAD-TONE: the signed negative equity label keeps the bad tone, seated like any other label (beside and inside)", () => {
    const pctOut = pctAt(FLOW_BANDS_GEO.labelMinH * 0.5);
    const pctIn = pctAt(FLOW_BANDS_GEO.labelMinH * 3);
    // beside form: the short negative segment seats in the right label column
    const beside = flowWith(
      [band("payments", "Payment stream", 100, "100 kr", false, 0, 100)],
      [band("Capital", "Capital", 160, "160 kr", false, 0, 60), band("Equity remainder", "Equity remainder", -60, "-60 kr", true, 60, pctOut)],
    );
    const r1 = render(<FlowBands flow={beside} />);
    const root1 = r1.container.querySelector('[data-testid="flow-bands"]') as HTMLElement;
    const eq1 = root1.querySelector('[data-flow-use-label="Equity remainder"]') as HTMLElement;
    expect(eq1.getAttribute("data-signed")).toBe("true");
    expect(eq1.getAttribute("data-label-mode")).toBe("beside");
    expect(eq1.getAttribute("class")).toContain("flow-label-bad");
    const texts1 = Array.from(eq1.querySelectorAll("text"));
    expect(texts1.every((t) => t.getAttribute("class")!.includes("flow-label-bad"))).toBe(true);
    expect(texts1.map((t) => t.textContent).join(" ")).toBe("Equity remainder -60 kr"); // the signed value in the reading form
    const bandRect1 = root1.querySelector('[data-flow-use-band="Equity remainder"]') as Element;
    expect(bandRect1.getAttribute("class")).toContain("flow-band-bad");
    expect(bandRect1.getAttribute("fill")).toBe("#fb7185");
    r1.unmount();
    // inside form: the tall negative segment seats inside its bad-toned band box
    const inside = flowWith(
      [band("payments", "Payment stream", 100, "100 kr", false, 0, 100)],
      [band("Equity remainder", "Equity remainder", -60, "-60 kr", true, 0, pctIn)],
    );
    const r2 = render(<FlowBands flow={inside} />);
    const root2 = r2.container.querySelector('[data-testid="flow-bands"]') as HTMLElement;
    const eq2 = root2.querySelector('[data-flow-use-label="Equity remainder"]') as HTMLElement;
    expect(eq2.getAttribute("data-label-mode")).toBe("inside");
    expect(eq2.getAttribute("class")).toContain("flow-label-bad");
    expect(eq2.getAttribute("data-signed")).toBe("true");
    r2.unmount();
  });

  it("SURFACE: the Plan flow surface inherits the seating through the same renderer — labels seated, legend absent, caption stays", () => {
    render(<App />);
    fireEvent.click(q('[data-action="load-demo"]'));
    fireEvent.click(q('[data-nav="flow"]'));
    const root = q('[data-testid="flow-bands"]');
    expect(root).toBeTruthy();
    expect(q('[data-flow-income-label="grant"]')).toBeTruthy();
    expect(q('[data-flow-income-label="funding-loan"]')).toBeTruthy();
    expect(q('[data-flow-use-label="Debt service"]')).toBeTruthy();
    // the label carries the composed name and reading-form value, the same strings as the band's own title
    for (const g of qa(".flow-label-group")) {
      const key = g.getAttribute("data-flow-income-label") ?? g.getAttribute("data-flow-use-label") ?? "";
      const rect = root.querySelector(`[data-flow-income-band="${key}"], [data-flow-use-band="${key}"]`) as Element;
      const title = rect.querySelector("title")!.textContent ?? "";
      const joined = Array.from(g.querySelectorAll("text")).map((t) => t.textContent).join(" ");
      expect(joined).toBe(title.replace(": ", " "));
    }
    // the retired legend is absent from the whole rendered tree
    expect(document.querySelector('[data-testid="flow-labels"]')).toBeNull();
    expect(document.querySelector('[data-testid="flow-income-labels"]')).toBeNull();
    expect(document.querySelector('[data-testid="flow-use-labels"]')).toBeNull();
    expect(document.querySelector(".flow-label-col")).toBeNull();
    expect(document.querySelector(".flow-swatch")).toBeNull();
    // the aggregation caption stays
    expect(q('[data-testid="flow-caption"]').textContent).toContain("4 tariff segments in one band");
    // both admission modes are exercised on the program demo: the tall tariff band inside, the short note band beside
    const modes = qa(".flow-label-group").map((g) => g.getAttribute("data-label-mode"));
    expect(modes).toContain("inside");
    expect(modes).toContain("beside");
  });

  it("PRESENTATION: the flow slide seats its labels through the same renderer", () => {
    render(<App />);
    fireEvent.click(q('[data-action="load-demo"]'));
    fireEvent.click(q('[data-action="present"]'));
    const slide = q('[data-slide-name="flow"]');
    const root = slide.querySelector('[data-testid="flow-bands"]') as HTMLElement;
    expect(root).toBeTruthy();
    expect(root.querySelectorAll("[data-flow-income-label]").length).toBe(3);
    expect(root.querySelectorAll("[data-flow-use-label]").length).toBe(4);
    expect(root.querySelectorAll("[data-flow-connector]").length).toBe(7);
    expect(slide.querySelector('[data-testid="flow-labels"]')).toBeNull();
    expect(slide.querySelector(".flow-swatch")).toBeNull();
    // anchor spot-check on the slide: the tariff label's composed position against its band rect
    const rect = root.querySelector('[data-flow-income-band="tariff"]') as Element;
    const g = root.querySelector('[data-flow-income-label="tariff"]') as HTMLElement;
    const ry = num(rect, "y"), rh = num(rect, "height");
    const t = g.querySelector("text") as Element;
    if (g.getAttribute("data-label-mode") === "inside") {
      expect(num(t, "y")).toBeCloseTo(ry + rh / 2 + 4, 6);
      expect(num(t, "x")).toBeCloseTo(num(rect, "x") + num(rect, "width") / 2, 6);
    } else {
      expect(num(t, "y")).toBeCloseTo(ry + rh / 2 + 4, 6);
      expect(num(t, "x")).toBeCloseTo(num(rect, "x") - FLOW_BANDS_GEO.labelGap, 6);
    }
    // the provenance presence note stays
    const slide2 = q('[data-testid="presentation"]');
    expect(slide2.textContent).toContain("Flow: present, composed from the emitted grids");
  });
});
