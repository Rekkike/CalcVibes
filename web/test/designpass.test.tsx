import { describe, expect, it } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { App } from "../src/App.js";

const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;
const byNav = (v: string) => document.querySelector('[data-nav="' + v + '"]') as HTMLElement;

describe("Task A: NAV-PRESERVED / CONTROLS-PRESERVED / START-YEAR-RELOCATED", () => {
  it("NAV-PRESERVED: all ten views render inside their three groups and each navigates on one click", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    const groups = document.querySelectorAll(".nav-group");
    expect(groups.length).toBe(3);
    const model = document.querySelector('[data-nav-group="model"]') as HTMLElement;
    const finance = document.querySelector('[data-nav-group="finance"]') as HTMLElement;
    const read = document.querySelector('[data-nav-group="read"]') as HTMLElement;
    expect(Array.from(model.querySelectorAll("[data-nav]")).map((b) => b.getAttribute("data-nav")))
      .toEqual(["overview", "costs", "operating", "repayment", "tariff"]);
    expect(Array.from(finance.querySelectorAll("[data-nav]")).map((b) => b.getAttribute("data-nav")))
      .toEqual(["financing", "appraisal"]);
    expect(Array.from(read.querySelectorAll("[data-nav]")).map((b) => b.getAttribute("data-nav")))
      .toEqual(["results", "scenarios", "detail"]);
    expect(model.querySelector('[data-nav="costs"]')?.textContent).toBe("Cost model");
    for (const v of ["overview", "costs", "operating", "repayment", "tariff", "financing", "appraisal", "results", "scenarios", "detail"]) {
      fireEvent.click(byNav(v));
      expect(byNav(v).className).toContain("active");
    }
  });

  it("CONTROLS-PRESERVED: every header control of record renders with its identifier", () => {
    render(<App />);
    const header = document.querySelector("header.app-header") as HTMLElement;
    expect(header.querySelector('[data-action="new-project"]')).toBeTruthy();
    expect(header.querySelector('[data-action="load-demo"]')).toBeTruthy();
    expect(header.querySelector('[data-action="present"]')).toBeTruthy();
    expect(header.querySelector('[data-action="download-pdf"]')).toBeTruthy();
    expect(header.querySelector('[data-action="print-deck"]')).toBeTruthy();
    expect(header.querySelector('[data-action="export-xlsx"]')).toBeTruthy();
    expect(header.querySelector('[data-field="entryUnit"]')).toBeTruthy();
    expect(header.querySelector('[data-field="theme"]')).toBeTruthy();
    expect(header.querySelector('[data-testid="version"]')).toBeTruthy();
    expect(header.querySelector("h1")).toBeTruthy();
  });

  it("START-YEAR-RELOCATED: the field renders inside the overview section; the header carries none", () => {
    render(<App />);
    const header = document.querySelector("header.app-header") as HTMLElement;
    expect(header.querySelector('[data-field="startYear"]')).toBeNull();
    expect(document.querySelector('[data-testid="overview"] [data-field="startYear"]')).toBeTruthy();
    const field = document.querySelector('[data-testid="overview"] [data-field="startYear"]') as HTMLInputElement;
    fireEvent.change(field, { target: { value: "1899" } });
    expect(document.querySelector('[data-testid="start-year-error"]')?.textContent).toBe("Project start year must be between 1900 and 2200.");
    fireEvent.change(field, { target: { value: "2024" } });
    expect(document.querySelector('[data-testid="start-year-error"]')).toBeNull();
  });
});

describe("Task B: ANSWER-BAND / KPI-ROW / FIGURE-BAND / COVERAGE-BOTTOM", () => {
  it("ANSWER-BAND: the statement equals its computed branch for the met case, tone-coded", async () => {
    // v0.6.7 re-anchor: the demo button loads the port fixture; the met-case branch is asserted
    // against its engine fields (achieved IRR 6% against the target 6%).
    const { shorePowerProject } = await import("../src/state.js");
    const { computeModel, percentForDisplay, roundForDisplay } = await import("../src/engine.js");
    const port = shorePowerProject();
    const result = computeModel(port);
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("results"));
    const band = document.querySelector('[data-testid="answer-band"]') as HTMLElement;
    expect(band.className).toContain("tone-ok");
    const statement = document.querySelector('[data-testid="goal-check"]')?.textContent ?? "";
    expect(statement).toContain(`achieves an IRR of ${percentForDisplay(result.achievedIrr, 2)} against a target of ${roundForDisplay(port.targetIrr, 2)}%`);
    expect(statement).toContain("target achieved");
  });

  it("KPI-ROW: each card value equals its engine field through the display formatters; the absent-financing branch is honest", async () => {
    // v0.6.7 re-anchor: the demo button loads the port fixture (EUR); the KPI values flow through
    // the display formatters at the results band's unit default.
    const { shorePowerProject } = await import("../src/state.js");
    const { computeModel, percentForDisplay, roundForDisplay, deckMoneyForDisplay, deckYearsForDisplay } = await import("../src/engine.js");
    const port = shorePowerProject();
    const result = computeModel(port);
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("results"));
    const cards = Array.from(document.querySelectorAll('[data-testid="kpi-row"] .kpi-card'));
    expect(cards.length).toBe(4);
    const byLabel = (l: string) => cards.find((c) => c.querySelector(".kpi-label")?.textContent === l) as HTMLElement;
    expect(byLabel("Achieved IRR").querySelector(".kpi-value")?.textContent).toBe(percentForDisplay(result.achievedIrr, 2));
    expect(byLabel("Achieved IRR").querySelector(".kpi-chip")?.textContent).toBe(`vs ${roundForDisplay(port.targetIrr, 2)}% target`);
    expect(byLabel("Achieved IRR").className).toContain("tone-ok");
    expect(byLabel("NPV at WACC").querySelector(".kpi-value")?.textContent).toBe(deckMoneyForDisplay(result.npvAtWacc, "EUR", "ones"));
    expect(byLabel("Payback (nominal)").querySelector(".kpi-value")?.textContent).toBe(deckYearsForDisplay(result.paybackYears as number));
    expect(byLabel("Min DSCR").querySelector(".kpi-value")?.textContent).toBe("not applicable");
  });

  it("FIGURE-BAND: the three figures equal their engine fields through the deck money variant; the note renders verbatim", async () => {
    // v0.6.7 re-anchor: the demo button loads the port fixture (EUR).
    const { shorePowerProject } = await import("../src/state.js");
    const { computeModel, deckMoneyForDisplay } = await import("../src/engine.js");
    const result = computeModel(shorePowerProject());
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("results"));
    const band = document.querySelector('[data-testid="figure-band"]') as HTMLElement;
    expect(band.querySelectorAll(".figure-item").length).toBe(3);
    expect(band.querySelector('[data-testid="figure-band"] .figure-value') === null ? null : Array.from(band.querySelectorAll(".figure-value")).map((e) => e.textContent))
      .toEqual([deckMoneyForDisplay(result.totalCost, "EUR", "ones"), deckMoneyForDisplay(result.totalCollected, "EUR", "ones"), deckMoneyForDisplay(result.netGain, "EUR", "ones")]);
    expect(band.querySelector(".caveat")?.textContent).toBe("Nominal figures are undiscounted; the cost NPV and achieved IRR are discounted.");
  });

  it("COVERAGE-BOTTOM: the coverage chart renders after the working surface in the DOM order", async () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("results"));
    const section = document.querySelector('[data-testid="results"]') as HTMLElement;
    const children = Array.from(section.children);
    const tableIdx = children.findIndex((c) => c.getAttribute("data-testid") === "yearly-table");
    const coverageIdx = children.findIndex((c) => c.getAttribute("data-testid") === "coverage-chart");
    expect(tableIdx).toBeGreaterThan(-1);
    expect(coverageIdx).toBeGreaterThan(tableIdx);
    const coverage = document.querySelector('[data-testid="coverage-chart"]') as HTMLElement;
    expect(coverage.querySelector('[data-testid="signed-cashflow"]')).toBeTruthy();
  });
});

describe("Task B (continued): the not-met answer branch", () => {
  it("ANSWER-BAND not-met: a below-target configuration renders the falls-short branch with the bad tone", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("tariff"));
    fireEvent.change(document.querySelector('[data-field="tariffMode"]') as HTMLElement, { target: { value: "fixed" } });
    fireEvent.change(document.querySelector('[data-field="tariffFixed"]') as HTMLElement, { target: { value: "100" } });
    fireEvent.click(byNav("results"));
    const band = document.querySelector('[data-testid="answer-band"]') as HTMLElement;
    expect(band.className).toContain("tone-bad");
    const statement = document.querySelector('[data-testid="goal-check"]')?.textContent ?? "";
    expect(statement).toContain("The project falls short");
    expect(statement).toContain("target not achieved");
    const cards = Array.from(document.querySelectorAll('[data-testid="kpi-row"] .kpi-card'));
    const irrCard = cards.find((c) => c.querySelector(".kpi-label")?.textContent === "Achieved IRR") as HTMLElement;
    expect(irrCard.className).toContain("tone-bad");
  });
});

describe("Task C: COVERAGE-SLIDE / WATERFALL-BUILD / HURDLE-TRACE / TONE-SEMANTICS / TAKEAWAY-KICKERS", () => {
  it("COVERAGE-SLIDE: the deck counts seven slides; the coverage slide sits between recovery and returns with the engine cumulative curve", async () => {
    const { demoProject } = await import("../src/state.js");
    const { computeModel, deckYearsForDisplay } = await import("../src/engine.js");
    const { deckSlides } = await import("../src/deck.js");
    const result = computeModel(demoProject());
    const deck = deckSlides(demoProject(), result, { startYear: null });
    expect(deck.slides.length).toBe(7);
    expect(deck.slides.map((s) => s.name)).toEqual(["title", "summary", "investment", "recovery", "coverage", "returns", "deal"]);
    const coverage = deck.slides[4];
    expect(coverage.title).toBe("Coverage");
    expect(coverage.chart?.kind).toBe("coverage");
    expect(coverage.chart?.data.length).toBe(result.yearly.length);
    for (let k = 0; k < (coverage.chart?.data.length ?? 0); k++) {
      expect(coverage.chart?.data[k].value).toBe(result.yearly[k].cumulative);
    }
    const nominalPayback = coverage.body.find((f) => f.label === "Nominal payback");
    expect(nominalPayback?.value).toBe(deckYearsForDisplay(result.paybackYears as number));
  });

  it("COVERAGE-SLIDE rendered (re-anchored per v0.6R): the signed stage chart mounts with the gold cumulative line, the zero baseline, the break-even label, and the crossing caption", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    for (let i = 0; i < 3; i++) fireEvent.keyDown(window, { key: "ArrowRight" });
    const stage = document.querySelector('[data-slide-name="coverage"] [data-testid="stage-returns"]') as HTMLElement;
    expect(stage).toBeTruthy();
    expect(stage.querySelector('[data-testid="stage-returns-zero"]')).toBeTruthy();
    expect(stage.querySelector('[data-testid="stage-gold-line"]')?.getAttribute("stroke")).toBe("#e8b84b");
    expect(stage.querySelectorAll('[data-stage-bar="cost"]').length).toBeGreaterThan(0);
    expect(stage.querySelectorAll('[data-stage-bar="inflow"]').length).toBeGreaterThan(0);
    expect(stage.querySelector('[data-testid="stage-returns-crossing"]')?.textContent).toContain("break-even");
    const caption = document.querySelector('[data-slide-name="coverage"] [data-testid="crossing-caption"]');
    expect(caption?.textContent).not.toMatch(/\d/);
  });

  it("WATERFALL-BUILD: one segment per cost line plus the operating and reinvestment kinds; the labels flow through the deck money variant", async () => {
    // v0.6.8 re-anchor: the waterfall is honest to the whole cost program. The demo button
    // loads the port fixture — five capital lines plus the operating-lines segment, six
    // segments in all, no reinvestments. The build is derived from the engine fields and
    // closes exactly at the cap.
    const { shorePowerProject } = await import("../src/state.js");
    const { computeModel, deckMoneyForDisplay } = await import("../src/engine.js");
    const result = computeModel(shorePowerProject());
    const reinvestments = (result.contractsInfo ?? []).reduce((a, c) => a + c.reinvestments.reduce((b, ri) => b + ri.amount, 0), 0);
    const expectedSegments = [
      ...result.lineTotals.map((l) => ({ id: l.id, name: l.name, total: l.total, kind: "capital" as const })),
      ...(result.operatingTotal > 0 ? [{ id: "operating", name: "Operating lines", total: result.operatingTotal, kind: "operating" as const }] : []),
      ...(reinvestments > 0 ? [{ id: "reinvestments", name: "Reinvestments", total: reinvestments, kind: "reinvestments" as const }] : []),
    ];
    expect(expectedSegments.length).toBe(6);
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    fireEvent.keyDown(window, { key: "ArrowRight" });
    const slide = document.querySelector('[data-slide-name="investment"]') as HTMLElement;
    const waterfall = slide.querySelector('[data-testid="cost-waterfall"]') as HTMLElement;
    const segments = waterfall.querySelectorAll("[data-waterfall-segment]");
    expect(segments.length).toBe(expectedSegments.length);
    const cap = Math.max(1e-12, result.totalCost);
    let accShare = 0;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i] as HTMLElement;
      const frac = expectedSegments[i].total / cap;
      expect(seg.getAttribute("data-waterfall-kind")).toBe(expectedSegments[i].kind);
      expect(parseFloat(seg.style.height)).toBeCloseTo(frac * 100, 0);
      expect(parseFloat(seg.style.bottom)).toBeCloseTo(accShare * 100, 0);
      accShare += frac;
    }
    expect(accShare).toBeCloseTo(1, 6);
    const capEl = waterfall.querySelector('[data-testid="waterfall-cap"]') as HTMLElement;
    expect(parseFloat(capEl.style.bottom)).toBeCloseTo(100, 0);
    // v0.6.9 Task A: the stepped geometry — each segment owns an equal slot, fills 60 percent
    // of it, and the cap spans the full width; adjacent steps never overlap.
    const stepEls = waterfall.querySelectorAll("[data-waterfall-step]");
    expect(stepEls.length).toBe(6);
    const slot = 100 / expectedSegments.length;
    for (let i = 0; i < stepEls.length; i++) {
      const seg = stepEls[i] as HTMLElement;
      expect(seg.getAttribute("data-waterfall-step")).toBe(String(i));
      expect(parseFloat(seg.style.left)).toBeCloseTo(i * slot, 6);
      expect(parseFloat(seg.style.width)).toBeCloseTo(0.6 * slot, 6);
      if (i < stepEls.length - 1) {
        expect(parseFloat(seg.style.left) + parseFloat(seg.style.width)).toBeLessThanOrEqual((i + 1) * slot + 1e-9);
      }
    }
    const lastSeg = stepEls[stepEls.length - 1] as HTMLElement;
    expect(parseFloat(lastSeg.style.bottom) + parseFloat(lastSeg.style.height)).toBeCloseTo(100, 0);
    expect(capEl.style.width).toBe("100%");
    for (const seg of Array.from(segments)) {
      expect((seg as HTMLElement).querySelector('[data-testid="waterfall-label"]')).toBe(null);
    }
    const labels = waterfall.querySelectorAll('[data-testid="waterfall-label"]');
    expect(labels.length).toBe(expectedSegments.length);
    for (let i = 0; i < labels.length; i++) {
      expect(labels[i].textContent).toContain(expectedSegments[i].name);
      expect(labels[i].textContent).toContain(deckMoneyForDisplay(expectedSegments[i].total, "EUR", "thousands"));
    }
    expect(slide.querySelectorAll('[data-testid="composition-rows"]').length).toBe(1);
  });

  it("WATERFALL-CLOSURE: the segment program closes at the cap on all five fixtures (v0.6.9 Task A.4 re-pin)", async () => {
    const { demoProject, multiLeaseProject, solarParkProject, shorePowerProject, landNewbuildProject } = await import("../src/state.js");
    const { computeModel } = await import("../src/engine.js");
    const pinnedTotals: Record<string, number> = {
      template: 7849860,
      "multi-lease": 118000000,
      solar: 18733048.32214572,
      port: 269591641.24463195,
      land: 599071344.7435848,
    };
    const fixtures = [
      ["template", demoProject],
      ["multi-lease", multiLeaseProject],
      ["solar", solarParkProject],
      ["port", shorePowerProject],
      ["land", landNewbuildProject],
    ] as const;
    for (const [name, make] of fixtures) {
      const result = computeModel(make());
      expect(result.totalCost).toBeCloseTo(pinnedTotals[name], 6);
      const reinvestments = (result.contractsInfo ?? []).reduce((a, c) => a + c.reinvestments.reduce((b, ri) => b + ri.amount, 0), 0);
      const segments = [
        ...result.lineTotals.map((l) => ({ total: l.total, kind: "capital" as const })),
        ...(result.operatingTotal > 0 ? [{ total: result.operatingTotal, kind: "operating" as const }] : []),
        ...(reinvestments > 0 ? [{ total: reinvestments, kind: "reinvestments" as const }] : []),
      ];
      expect(segments.length).toBeGreaterThanOrEqual(1);
      const segSum = segments.reduce((a, s) => a + s.total, 0);
      expect(segSum).toBeCloseTo(result.totalCost, 6);
    }
  });

  it("HURDLE-TRACE: the two dots map the engine achieved IRR and the input target on one zero-based scale; the tone flips with goalMet", async () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    for (let i = 0; i < 5; i++) fireEvent.keyDown(window, { key: "ArrowRight" });
    const plot = document.querySelector('[data-testid="hurdle-plot"]') as HTMLElement;
    const targetDot = plot.querySelector('[data-testid="hurdle-target-dot"]') as HTMLElement;
    const achievedDot = plot.querySelector('[data-testid="hurdle-achieved-dot"]') as HTMLElement;
    // v0.6.7 re-anchor: the demo button loads the port fixture; the two dots map its fields.
    const { shorePowerProject } = await import("../src/state.js");
    const { computeModel } = await import("../src/engine.js");
    const port = shorePowerProject();
    const res = computeModel(port);
    const target = port.targetIrr;
    const achieved = (res.achievedIrr ?? 0) * 100;
    const scale = Math.max(target, achieved) * 1.15;
    expect(parseFloat(targetDot.style.left)).toBeCloseTo((target / scale) * 100, 0);
    expect(parseFloat(achievedDot.style.left)).toBeCloseTo((achieved / scale) * 100, 0);
    expect(achievedDot.className).toContain("tone-ok");
    expect(plot.querySelector('[data-testid="hurdle-margin-label"]')?.textContent).toContain("solved to the target");
    expect(plot.querySelector('[data-testid="hurdle-margin-label"]')?.getAttribute("data-hurdle-mode")).toBe("solved");
  });

  it("TONE-SEMANTICS: the met case tones the tiles; the not-met case renders the bad tones", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    for (let i = 0; i < 6; i++) fireEvent.keyDown(window, { key: "ArrowRight" });
    const npvTile = document.querySelector('[data-tile="NPV at WACC"]') as HTMLElement;
    expect(npvTile.className).toContain("tone-ok");
    const netGainTile = document.querySelector('[data-tile="Net gain"]') as HTMLElement;
    expect(netGainTile.className).toContain("tone-ok");
    fireEvent.click(byAction("exit-presentation"));
    fireEvent.click(byNav("tariff"));
    fireEvent.change(document.querySelector('[data-field="tariffMode"]') as HTMLElement, { target: { value: "fixed" } });
    fireEvent.change(document.querySelector('[data-field="tariffFixed"]') as HTMLElement, { target: { value: "100" } });
    fireEvent.click(byAction("present"));
    for (let i = 0; i < 6; i++) fireEvent.keyDown(window, { key: "ArrowRight" });
    const npvTileBad = document.querySelector('[data-tile="NPV at WACC"]') as HTMLElement;
    expect(npvTileBad.className).toContain("tone-bad");
    const irrTileBad = document.querySelector('[data-tile="Achieved IRR"]') as HTMLElement;
    expect(irrTileBad.className).toContain("tone-bad");
  });

  it("TAKEAWAY-KICKERS: the investment kicker names the dominant line from the argmax over the engine lineTotals", async () => {
    // v0.6.7 re-anchor: the port fixture's dominant line is "Substations & grid connections".
    const { shorePowerProject } = await import("../src/state.js");
    const { computeModel } = await import("../src/engine.js");
    const result = computeModel(shorePowerProject());
    const dominant = result.lineTotals.reduce((b, l) => (l.total > b.total ? l : b), result.lineTotals[0]);
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    fireEvent.keyDown(window, { key: "ArrowRight" });
    const kicker = document.querySelector('[data-slide-name="investment"] [data-testid="chart-kicker"]')?.textContent;
    expect(kicker).toBe(`${dominant.name} dominates the cost base`);
    expect(kicker).not.toMatch(/\d/);
  });
});
