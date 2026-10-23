import { describe, expect, it } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { App } from "../src/App.js";

const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;
const byNav = (v: string) => document.querySelector('[data-nav="' + v + '"]') as HTMLElement;

describe("Task A: NAV-PRESERVED / CONTROLS-PRESERVED / START-YEAR-RELOCATED", () => {
  it("NAV-PRESERVED: all twelve views render inside their four groups and each navigates on one click (v0.6.10: the funding view joins the finance group; v0.6.13: the timeline view joins the new plan group between finance and read)", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    const groups = document.querySelectorAll(".nav-group");
    expect(groups.length).toBe(4);
    const model = document.querySelector('[data-nav-group="model"]') as HTMLElement;
    const finance = document.querySelector('[data-nav-group="finance"]') as HTMLElement;
    const read = document.querySelector('[data-nav-group="read"]') as HTMLElement;
    const plan = document.querySelector('[data-nav-group="plan"]') as HTMLElement;
    expect(Array.from(groups).map((g) => g.getAttribute("data-nav-group"))).toEqual(["model", "finance", "plan", "read"]);
    expect(Array.from(plan.querySelectorAll("[data-nav]")).map((b) => b.getAttribute("data-nav"))).toEqual(["timeline"]);
    expect(Array.from(model.querySelectorAll("[data-nav]")).map((b) => b.getAttribute("data-nav")))
      .toEqual(["overview", "costs", "operating", "repayment", "tariff"]);
    expect(Array.from(finance.querySelectorAll("[data-nav]")).map((b) => b.getAttribute("data-nav")))
      .toEqual(["funding", "financing", "appraisal"]);
    expect(Array.from(read.querySelectorAll("[data-nav]")).map((b) => b.getAttribute("data-nav")))
      .toEqual(["results", "scenarios", "detail"]);
    expect(model.querySelector('[data-nav="costs"]')?.textContent).toBe("Cost model");
    for (const v of ["overview", "costs", "operating", "repayment", "tariff", "funding", "financing", "appraisal", "timeline", "results", "scenarios", "detail"]) {
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
    // v0.6.10 re-anchor: the demo button loads the program fixture; the met-case branch is
    // asserted against its engine fields (achieved IRR 6.05% against the target 6%; the net
    // flow carries 3 sign changes, so the honest ambiguity warning rides the statement).
    const { shorePowerProgram } = await import("../src/state.js");
    const { computeModel, percentForDisplay, roundForDisplay } = await import("../src/engine.js");
    const program = shorePowerProgram();
    const result = computeModel(program);
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("results"));
    const band = document.querySelector('[data-testid="answer-band"]') as HTMLElement;
    expect(band.className).toContain("tone-ok");
    const statement = document.querySelector('[data-testid="goal-check"]')?.textContent ?? "";
    expect(statement).toContain(`achieves an IRR of ${percentForDisplay(result.achievedIrr, 2)} against a target of ${roundForDisplay(program.targetIrr, 2)}%`);
    expect(statement).toContain("target achieved");
  });

  it("KPI-ROW: each card value equals its engine field through the display formatters; the financing branch renders the minimum DSCR (v0.6.10 re-anchor: the program fixture arrives financed — min DSCR 4.31887090724161 in year 23 → 2048; v0.6.14 re-anchor, the note unification: the municipal note's installments join the combined service — min DSCR 4.13984696765291 in year 7 → 2032)", async () => {
    const { shorePowerProgram, yearHeader } = await import("../src/state.js");
    const { computeModel, percentForDisplay, roundForDisplay, deckMoneyForDisplay, deckYearsForDisplay, dscrTwoForDisplay } = await import("../src/engine.js");
    const program = shorePowerProgram();
    const result = computeModel(program);
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("results"));
    const cards = Array.from(document.querySelectorAll('[data-testid="kpi-row"] .kpi-card'));
    expect(cards.length).toBe(4);
    const byLabel = (l: string) => cards.find((c) => c.querySelector(".kpi-label")?.textContent === l) as HTMLElement;
    expect(byLabel("Achieved IRR").querySelector(".kpi-value")?.textContent).toBe(percentForDisplay(result.achievedIrr, 2));
    expect(byLabel("Achieved IRR").querySelector(".kpi-chip")?.textContent).toBe(`vs ${roundForDisplay(program.targetIrr, 2)}% target`);
    expect(byLabel("Achieved IRR").className).toContain("tone-ok");
    expect(byLabel("NPV at WACC").querySelector(".kpi-value")?.textContent).toBe(deckMoneyForDisplay(result.npvAtWacc, "EUR", "thousands")); // v0.6.18 (AUD-17) re-anchor: the NPV KPI carries the entry unit in force (the fresh app is at thousands)
    expect(byLabel("Payback (nominal)").querySelector(".kpi-value")?.textContent).toBe(deckYearsForDisplay(result.paybackYears as number));
    // The financing branch: the minimum DSCR through the two-decimal DSCR formatter with
    // its calendar chip at the preset start year 2026.
    expect(byLabel("Min DSCR").querySelector(".kpi-value")?.textContent).toBe(dscrTwoForDisplay(result.financing!.minDscr!.value));
    expect(byLabel("Min DSCR").querySelector(".kpi-value")?.textContent).toBe("4.14");
    expect(byLabel("Min DSCR").querySelector(".kpi-chip")?.textContent).toBe(`in ${yearHeader(result.financing!.minDscr!.year, 2026)}`);
    expect(byLabel("Min DSCR").querySelector(".kpi-chip")?.textContent).toBe("in 2032");
  });

  it("FIGURE-BAND: the three figures equal their engine fields through the deck money variant; the note renders verbatim", async () => {
    // v0.6.10 re-anchor: the demo button loads the program fixture (EUR).
    const { shorePowerProgram } = await import("../src/state.js");
    const { computeModel, deckMoneyForDisplay } = await import("../src/engine.js");
    const result = computeModel(shorePowerProgram());
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("results"));
    const band = document.querySelector('[data-testid="figure-band"]') as HTMLElement;
    expect(band.querySelectorAll(".figure-item").length).toBe(3);
    expect(band.querySelector('[data-testid="figure-band"] .figure-value') === null ? null : Array.from(band.querySelectorAll(".figure-value")).map((e) => e.textContent))
      .toEqual([deckMoneyForDisplay(result.totalCost, "EUR", "thousands"), deckMoneyForDisplay(result.totalCollected, "EUR", "thousands"), deckMoneyForDisplay(result.netGain, "EUR", "thousands")]); // v0.6.18 (AUD-17) re-anchor: the figure band carries the entry unit in force
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

  it("WATERFALL-BUILD: the stepped columns at group level plus the operating kind, closing at a ground-standing total column; the labels flow through the deck money variant (v0.6.15 re-anchor)", async () => {
    // v0.6.15 re-anchor: the lower section aggregates the capital lines by their authored group (the program
    // fixture: Container shore power, Market pillar, Cruise terminal, Inland & public berths), then the operating
    // segment, then the total as the (n+1)th ground-standing column (bottom 0, height 100) replacing the 4 px cap
    // rule. The cumulative geometry (bottom and height percent) and the closure identity are the delivered ones.
    const { shorePowerProgram } = await import("../src/state.js");
    const { computeModel, deckMoneyForDisplay } = await import("../src/engine.js");
    const result = computeModel(shorePowerProgram());
    const group = (ids: string[]) => ids.reduce((a, id) => a + (result.lineTotals.find((l) => l.id === id)?.total ?? 0), 0);
    const expectedSegments = [
      { name: "Container shore power", total: group(["p1", "p2", "p3"]), kind: "capital" as const },
      { name: "Market pillar", total: group(["p4"]), kind: "capital" as const },
      { name: "Cruise terminal", total: group(["p5"]), kind: "capital" as const },
      { name: "Inland & public berths", total: group(["p6"]), kind: "capital" as const },
    ];
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    fireEvent.keyDown(window, { key: "ArrowRight" });
    const slide = document.querySelector('[data-slide-name="investment"]') as HTMLElement;
    const waterfall = slide.querySelector('[data-testid="cost-waterfall"]') as HTMLElement;
    const segments = waterfall.querySelectorAll("[data-waterfall-segment]");
    expect(segments.length).toBe(expectedSegments.length);
    // v0.6.18 Task A re-anchor: the waterfall closes at the Capital program step (the capital groups only)
    const cap = Math.max(1e-12, result.lineTotals.reduce((a, l) => a + l.total, 0));
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
    const totalEl = waterfall.querySelector('[data-waterfall-total="true"]') as HTMLElement;
    expect(parseFloat(totalEl.style.bottom)).toBe(0);
    expect(parseFloat(totalEl.style.height)).toBe(100);
    const totalLabel = waterfall.querySelector('[data-testid="waterfall-total-label"]') as HTMLElement;
    expect(totalLabel.getAttribute("data-waterfall-kind")).toBe("total");
    expect(totalLabel.textContent).toBe(`Capital program ${deckMoneyForDisplay(cap, "EUR", "thousands")}`);
    expect(totalLabel.textContent).toBe("Capital program €449 000 k");
    // the stepped geometry on n+1 slots: each column owns an equal slot, fills 60 percent of it; adjacent never overlap
    const stepEls = waterfall.querySelectorAll("[data-waterfall-step]");
    expect(stepEls.length).toBe(5);
    const slot = 100 / (expectedSegments.length + 1);
    for (let i = 0; i < stepEls.length; i++) {
      const seg = stepEls[i] as HTMLElement;
      expect(seg.getAttribute("data-waterfall-step")).toBe(String(i));
      expect(parseFloat(seg.style.left)).toBeCloseTo(i * slot, 6);
      expect(parseFloat(seg.style.width)).toBeCloseTo(0.6 * slot, 6);
    }
    const lastSeg = segments[segments.length - 1] as HTMLElement;
    expect(parseFloat(lastSeg.style.bottom) + parseFloat(lastSeg.style.height)).toBeCloseTo(100, 0);
    // direct value labels above the bars (none inside a segment)
    for (const seg of Array.from(segments)) {
      expect((seg as HTMLElement).querySelector('[data-testid="waterfall-label"]')).toBe(null);
    }
    const labels = waterfall.querySelectorAll('[data-testid="waterfall-label"]');
    expect(labels.length).toBe(expectedSegments.length);
    for (let i = 0; i < labels.length; i++) {
      expect(labels[i].textContent).toBe(deckMoneyForDisplay(expectedSegments[i].total, "EUR", "thousands"));
    }
    expect(slide.querySelectorAll('[data-testid="ledger-waterfall"]').length).toBe(1);
    expect(slide.querySelectorAll('[data-testid="composition-rows"]').length).toBe(0);
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
    // v0.6.10 re-anchor: the demo button loads the program fixture; the two dots map its
    // fields (target 6, achieved 6.05 on the same zero-based scale).
    const { shorePowerProgram } = await import("../src/state.js");
    const { computeModel } = await import("../src/engine.js");
    const program = shorePowerProgram();
    const res = computeModel(program);
    const target = program.targetIrr;
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
    // v0.6.10 re-anchor: the program fixture's dominant line is the market pillar
    // (p4, "Market pillar — bulk & liquid berths", total 125 000 000).
    const { shorePowerProgram } = await import("../src/state.js");
    const { computeModel } = await import("../src/engine.js");
    const result = computeModel(shorePowerProgram());
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
