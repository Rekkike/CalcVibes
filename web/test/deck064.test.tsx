import { describe, expect, it } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { App } from "../src/App.js";
import { computeModel, deckMoneyForDisplay, deckYearsForDisplay, feeForDisplay, percentTwoForDisplay } from "../src/engine.js";
import { deckSlides } from "../src/deck.js";
import { demoProject } from "../src/state.js";

const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;

describe("v0.6.4 Part B: the executive summary infographic slide", () => {
  it("SUMMARY-POSITION: the summary slide sits immediately after the title slide with kicker 01", () => {
    const demo = demoProject();
    const result = computeModel(demo);
    const deck = deckSlides(demo, result, { startYear: null, entryUnit: "ones" });
    expect(deck.slides.length).toBe(7);
    expect(deck.slides[0].name).toBe("title");
    expect(deck.slides[1].name).toBe("summary");
    expect(deck.slides[1].title).toBe("Executive summary");
    expect(deck.slides[1].kickerNumber).toBe("01");
  });

  it("SUMMARY-GOLDEN: the four golden scalars of the Project Alpha template profile reach the tiles raw and displayed", () => {
    const demo = demoProject();
    const result = computeModel(demo);
    expect(result.costNpv).toBe(6632597.98343582);
    expect(result.paymentAmount).toBe(475309.1340746104);
    expect(result.paybackYears).toBe(6.959606064286818);
    expect(result.achievedIrr).toBe(0.120000000000001);
    const deck = deckSlides(demo, result, { startYear: null, entryUnit: "ones" });
    const tiles = deck.slides[1].tiles ?? [];
    const byLabel = (l: string) => tiles.find((t) => t.label === l);
    expect(byLabel("Cost NPV")?.rawValue).toBe(6632597.98343582);
    expect(byLabel("Cost NPV")?.value).toBe(deckMoneyForDisplay(6632597.98343582, "SEK", "ones"));
    expect(byLabel("Achieved IRR")?.rawValue).toBe(0.120000000000001);
    expect(byLabel("Achieved IRR")?.value).toBe(percentTwoForDisplay(0.120000000000001));
    expect(byLabel("Payback")?.rawValue).toBe(6.959606064286818);
    expect(byLabel("Payback")?.value).toBe(deckYearsForDisplay(6.959606064286818));
    expect(byLabel("Solved payment")?.rawValue).toBe(475309.1340746104);
    // v0.6.9 Task F: the solved payment summary tile closes at the fee formatter (ones) — 475 309 kr.
    expect(byLabel("Solved payment")?.value).toBe(feeForDisplay(475309.1340746104, "SEK", "ones"));
  });

  it("SUMMARY-BLOCKS: the summary presents visual blocks only — collected versus cost, the verdict tile, and no prose", () => {
    const demo = demoProject();
    const result = computeModel(demo);
    const deck = deckSlides(demo, result, { startYear: null, entryUnit: "ones" });
    const tiles = deck.slides[1].tiles ?? [];
    const byLabel = (l: string) => tiles.find((t) => t.label === l);
    expect(byLabel("Collected vs cost")?.value).toBe(`${deckMoneyForDisplay(result.totalCollected, "SEK", "ones")} vs ${deckMoneyForDisplay(result.totalCost, "SEK", "ones")}`);
    expect(byLabel("Verdict")?.value).toBe("Target met");
    expect(byLabel("Verdict")?.tone).toBe("ok");
    expect(byLabel("Achieved IRR")?.tone).toBe("ok");
    expect(deck.slides[1].body).toEqual([]);
    expect(deck.slides[1].insights).toBeUndefined();
    expect(deck.slides[1].verdict).toBeUndefined();
    expect(deck.slides[1].disclosures).toEqual([]);
    expect(tiles.map((t) => t.label)).toEqual(["Cost NPV", "Achieved IRR", "Payback", "Solved payment", "Collected vs cost", "Verdict"]);
  });

  it("SUMMARY-NOT-MET: the fixed-tariff configuration renders the honest missed verdict and the null payback dash", () => {
    const fixed = { ...demoProject(), tariff: { mode: "fixed" as const, escalationPerYear: 2, rows: [], fixedAnnualAmount: 100000, manualPrices: null } };
    const result = computeModel(fixed);
    expect(result.goalMet).toBe(false);
    const deck = deckSlides(fixed, result, { startYear: null, entryUnit: "ones" });
    const tiles = deck.slides[1].tiles ?? [];
    const byLabel = (l: string) => tiles.find((t) => t.label === l);
    expect(byLabel("Verdict")?.value).toBe("Target missed");
    expect(byLabel("Verdict")?.tone).toBe("bad");
    expect(byLabel("Achieved IRR")?.tone).toBe("bad");
    expect(byLabel("Payback")?.value).toBe("—");
  });

  it("SUMMARY-RENDER: the summary renders as six large tile blocks with tones and no paragraphs", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    const slide = document.querySelector('[data-slide-name="summary"]') as HTMLElement;
    expect(slide).toBeTruthy();
    const tiles = slide.querySelectorAll('[data-testid="summary-tiles"] [data-tile]');
    expect(tiles.length).toBe(6);
    const labels = Array.from(tiles).map((t) => (t as HTMLElement).getAttribute("data-tile"));
    expect(labels).toEqual(["Cost NPV", "Achieved IRR", "Payback", "Solved payment", "Collected vs cost", "Verdict"]);
    expect(slide.querySelector('[data-tile="Achieved IRR"]')?.className).toContain("tone-ok");
    expect(slide.querySelector('[data-tile="Verdict"]')?.className).toContain("tone-ok");
    expect(slide.querySelectorAll(".deck-figure").length).toBe(0);
    expect(slide.querySelectorAll(".insight").length).toBe(0);
  });
});

describe("v0.6.4 Part A: the board-room simplification", () => {
  it("BOARD-HEADLINES: every content slide carries a short headline a director reads in ten seconds", () => {
    const demo = demoProject();
    const result = computeModel(demo);
    const deck = deckSlides(demo, result, { startYear: null, entryUnit: "ones" });
    expect(deck.slides[2].title).toBe("The investment");
    expect(deck.slides[3].title).toBe("The recovery — solved payments");
    expect(deck.slides[4].title).toBe("Coverage");
    expect(deck.slides[5].title).toBe("The returns");
    expect(deck.slides[6].title).toBe("The deal");
    for (let i = 1; i < deck.slides.length; i++) {
      expect(deck.slides[i].title.length).toBeLessThanOrEqual(40);
    }
  });

  it("BOARD-NO-DUPLICATES: the per-line cost rows live on the chart only; the investment body carries the headline figures", () => {
    const demo = demoProject();
    const result = computeModel(demo);
    const deck = deckSlides(demo, result, { startYear: null, entryUnit: "ones" });
    expect(deck.slides[2].body.map((f) => f.label)).toEqual(["Total cost (nominal)", "Cost NPV at target (discounted)"]);
    // v0.6.18 Task J.1: the dead rows-chart field is retired; the per-line rows live in the waterfall ledger
    expect(deck.slides[2].chart).toBeUndefined();
    for (const lt of result.lineTotals) {
      expect(deck.slides[2].waterfall!.rows.find((r) => r.name === lt.name)?.raw).toBe(lt.total);
    }
  });

  it("BOARD-RECOVERY: the recovery body is trimmed to the solved-payment figures with no insight prose", () => {
    const demo = demoProject();
    const result = computeModel(demo);
    const deck = deckSlides(demo, result, { startYear: null, entryUnit: "ones" });
    expect(deck.slides[3].body.map((f) => f.label)).toEqual(["Payments", "Payment per period", "Total collected (nominal)"]);
    expect(deck.slides[3].insights).toBeUndefined();
  });

  it("BOARD-DEAL: the deal slide carries the six-tile grid and the one-line verdict", () => {
    const demo = demoProject();
    const result = computeModel(demo);
    const deck = deckSlides(demo, result, { startYear: null, entryUnit: "ones" });
    expect((deck.slides[6].tiles ?? []).map((t) => t.label)).toEqual(["Total cost", "Total collected", "Net gain", "Achieved IRR", "NPV at WACC", "Payback (nominal)"]);
    expect(deck.slides[6].verdict).toBe(`Target met — net gain ${deckMoneyForDisplay(result.netGain, "SEK", "ones")}.`);
    expect(deck.slides[6].insights).toBeUndefined();
  });

  it("BOARD-RETAINS: the slide set, the provenance disclosure, and the scenarios slide survive the simplification", () => {
    const demo = demoProject();
    const result = computeModel(demo);
    const deck = deckSlides(demo, result, { startYear: null, entryUnit: "ones" });
    expect(deck.slides.map((s) => s.name)).toEqual(["title", "summary", "investment", "recovery", "coverage", "returns", "deal"]);
    expect(deck.provenance?.join(" ")).toContain("no scenarios set");
    const withAxes = deckSlides(demo, result, { startYear: null, entryUnit: "ones", scenarioTerms: [20] });
    expect(withAxes.slides.length).toBe(8);
    expect(withAxes.slides[7].name).toBe("scenarios");
    expect(withAxes.slides[7].title).toBe("The scenarios");
  });

  it("BOARD-CHART-FIRST: wherever a chart exists it is rendered before the slide's figures", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    for (const name of ["investment", "recovery", "coverage"]) {
      const slide = document.querySelector('[data-slide-name="' + name + '"]') as HTMLElement;
      const slot = slide.querySelector('[data-testid="deck-chart-slot"]') as HTMLElement;
      const firstFigure = slide.querySelector(".deck-figure") as HTMLElement;
      expect(slot).toBeTruthy();
      expect(firstFigure).toBeTruthy();
      expect(slot.compareDocumentPosition(firstFigure) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });
});

describe("v0.6.4 pins of record", () => {
  it("ENGINE-STRING-IMMUTABLE: the engine's payments-per-year refusal string is verbatim and unchanged", () => {
    const bad = { ...demoProject(), repayment: { ...demoProject().repayment, paymentsPerYear: 3 } };
    expect(() => computeModel(bad)).toThrow("Invalid model inputs: Repayment block has a payments-per-year that is not one of 1, 2, 4, 12.");
  });
});
