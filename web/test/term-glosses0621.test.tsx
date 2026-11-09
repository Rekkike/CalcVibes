import { describe, expect, it } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { App } from "../src/App.js";
import { TERM_GLOSSES } from "../src/engine.js";
import { deckSlides } from "../src/deck.js";
import { computeModel } from "../src/engine.js";
import { demoProject } from "../src/state.js";

// v0.6.21 Task C (Round 46 Supplement 7) — the term glosses: the five terms of record with the gloss
// texts verbatim, rendered on first appearance, once per surface, on the app's READ surfaces and the
// deck's tiles, with identical terminology everywhere.

const byNav = (v: string) => document.querySelector('[data-nav="' + v + '"]') as HTMLElement;
const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;

const GLOSSES_OF_RECORD: [string, string][] = [
  ["NPV", "the present value of the stream at the discount rate, in currency"],
  ["IRR", "the discount rate that zeroes the net present value"],
  ["MIRR", "the IRR recalculated with reinvestment at the stated rate rather than at the IRR itself"],
  ["DSCR", "the cash available in a year divided by the debt service due that year, below 1.0 meaning the year's collections cannot pay the year's debt"],
  ["WACC", "the weighted average cost of capital, the benchmark a positive NPV must clear"],
];

describe("v0.6.21 Task C — the glosses of record", () => {
  it("TERM-GLOSSES-OF-RECORD: the shared table carries the five terms with the verbatim glosses", () => {
    expect(TERM_GLOSSES.map((g) => [g.term, g.gloss])).toEqual(GLOSSES_OF_RECORD);
  });

  it("DECK: the deck model carries the glosses of record and the deal slide renders each once, verbatim", () => {
    const deck = deckSlides(demoProject(), computeModel(demoProject()), { startYear: null });
    expect(deck.glosses).toEqual(TERM_GLOSSES);
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    for (let i = 0; i < 8; i++) fireEvent.keyDown(window, { key: "ArrowRight" });
    const glosses = Array.from(document.querySelectorAll('[data-testid="term-gloss"]')) as HTMLElement[];
    expect(glosses.map((g) => g.getAttribute("data-term"))).toEqual(["NPV", "IRR", "MIRR", "DSCR", "WACC"]);
    for (const [term, gloss] of GLOSSES_OF_RECORD) {
      const el = glosses.find((g) => g.getAttribute("data-term") === term)!;
      expect(el.textContent).toBe(`${term} — ${gloss}`);
    }
  });

  it("APP READ SURFACES: each gloss appears once per surface at first appearance (results: NPV, WACC, IRR, DSCR)", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("results"));
    const terms = Array.from(document.querySelectorAll('[data-testid="results"] [data-testid="term-gloss"]')).map((g) => g.getAttribute("data-term"));
    expect(terms).toEqual(["IRR", "NPV", "WACC", "DSCR"]); // the kpi-row order: Achieved IRR card first
    for (const el of Array.from(document.querySelectorAll('[data-testid="results"] [data-testid="term-gloss"]'))) {
      const term = el.getAttribute("data-term")!;
      const gloss = GLOSSES_OF_RECORD.find(([t]) => t === term)![1];
      expect(el.textContent).toBe(`${term} — ${gloss}`);
    }
  });

  it("APPRAISAL SURFACE: WACC, NPV and MIRR glosses appear once each", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("appraisal"));
    const terms = Array.from(document.querySelectorAll('[data-testid="appraisal"] [data-testid="term-gloss"]')).map((g) => g.getAttribute("data-term"));
    expect(terms).toEqual(["WACC", "NPV", "MIRR"]);
  });

  it("SCENARIOS SURFACE: the IRR gloss appears once, at the target axis's first appearance", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("scenarios"));
    const terms = Array.from(document.querySelectorAll('[data-testid="term-gloss"]')).map((g) => g.getAttribute("data-term"));
    expect(terms).toEqual(["IRR"]);
  });
});
