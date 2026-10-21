// v0.6.13.3 Tasks B and C: the rendered Timeline section and the deck slide carry the English-only,
// methodology-free wording: the outcome labels, the scale options, the disclosure and the DP gates.
import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { App } from "../src/App.js";
import { computeModel } from "../src/engine.js";
import { deckSlides } from "../src/deck.js";
import { DECISION_DISCLOSURE, DECISION_POINT_SET, landNewbuildProject, shorePowerProgram } from "../src/state.js";

const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;
const byNav = (v: string) => document.querySelector('[data-nav="' + v + '"]') as HTMLElement;

describe("v0.6.13.3 Task B: the Timeline section", () => {
  it("OUTCOMES: the outcome labels are plain English with the ids unchanged", () => {
    render(<App />);
    fireEvent.click(byNav("timeline"));
    fireEvent.click(byAction("add-gate"));
    const select = document.querySelector('[data-field="gateOutcome"]') as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => [o.value, o.textContent])).toEqual([
      ["", "Not yet held"], ["continue", "Continue"], ["change", "Change"], ["terminate", "Terminate"],
    ]);
  });

  it("SCALE-OPTIONS: the scale select names the DP sets", () => {
    render(<App />);
    fireEvent.click(byNav("timeline"));
    const select = document.querySelector('[data-field="projectScale"]') as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => [o.value, o.textContent])).toEqual([["full", "Full (DP1–DP8)"], ["mini", "Mini (DP1, DP3, DP4, DP8)"]]);
  });

  it("DISCLOSURE-RENDER: the disclosure paragraph is the decision-disclosure test id and carries the new text", () => {
    render(<App />);
    fireEvent.click(byNav("timeline"));
    expect(screen.getByTestId("decision-disclosure").textContent).toBe(DECISION_DISCLOSURE);
    expect(document.querySelector('[data-testid="pps-disclosure"]')).toBeNull();
  });

  it("ADDED-GATE: an added gate takes the DP code and its English title", () => {
    render(<App />);
    fireEvent.click(byNav("timeline"));
    fireEvent.click(byAction("add-gate"));
    expect(document.querySelector('[data-field="gateCode"]')!.textContent).toBe("DP1");
    expect((document.querySelector('[data-field="gateTitle"]') as HTMLInputElement).value).toBe(DECISION_POINT_SET[0].title);
  });
});

describe("v0.6.13.3 Task C: the deck slide", () => {
  it("DECK: the timeline slide carries the new disclosure and lists the DP gates with the English titles; the slide count and the lanes stand", () => {
    for (const make of [shorePowerProgram, landNewbuildProject]) {
      const inp = make();
      const deck = deckSlides(inp, computeModel(inp), { startYear: null });
      const slide = deck.slides.find((s) => s.name === "timeline")!;
      expect(slide.disclosures).toEqual([DECISION_DISCLOSURE]);
      const gates = slide.body.filter((f) => /^DP\d$/.test(f.label));
      expect(gates.map((g) => g.label)).toEqual(["DP1", "DP2", "DP3", "DP4", "DP5", "DP6", "DP7", "DP8"]);
      gates.forEach((g, i) => expect(g.value.startsWith(DECISION_POINT_SET[i].title + " — ")).toBe(true));
      expect(deck.slides.some((s) => s.body.some((f) => /^BP\d$/.test(f.label)))).toBe(false);
    }
  });
});
