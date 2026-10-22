import { describe, expect, it } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import * as fs from "node:fs";
import { App } from "../src/App.js";
import { computeModel } from "../../core/src/engine.js";
import { deckSlides } from "../src/deck.js";
import { shorePowerProgram } from "../src/state.js";

const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;

// v0.6.15 — the combined investment waterfall as rendered on the deck: the ledger (individual lines,
// HTML rows) over the stepped columns (the groups).
function openInvestment() {
  render(<App />);
  fireEvent.click(byAction("load-demo"));
  fireEvent.click(byAction("present"));
  const slide = document.querySelector('[data-slide-name="investment"]') as HTMLElement;
  const inputs = shorePowerProgram();
  const model = deckSlides(inputs, computeModel(inputs), { startYear: 2026, entryUnit: "thousands" }).slides.find((s) => s.name === "investment")!.waterfall!;
  return { slide, model, ledger: slide.querySelector('[data-testid="ledger-waterfall"]') as HTMLElement, cols: slide.querySelector('[data-testid="cost-waterfall"]') as HTMLElement };
}
const pct = (el: HTMLElement, prop: "left" | "width" | "bottom" | "height") => parseFloat(el.style[prop]);

describe("the ledger waterfall (the upper section)", () => {
  it("replaces the composition rows on the investment slide; one ledger", () => {
    const { slide, ledger } = openInvestment();
    expect(ledger).toBeTruthy();
    expect(slide.querySelectorAll('[data-testid="ledger-waterfall"]').length).toBe(1);
    expect(slide.querySelector('[data-testid="composition-rows"]')).toBeNull();
  });

  it("rows: the capital lines with full names, the subtotal, the operating row, the total — in order", () => {
    const { ledger, model } = openInvestment();
    const rows = Array.from(ledger.querySelectorAll("[data-ledger-row]")) as HTMLElement[];
    expect(rows.map((r) => r.getAttribute("data-ledger-kind"))).toEqual(model.rows.map((r) => r.kind));
    expect(rows).toHaveLength(9);
    rows.forEach((r, i) => expect(r.querySelector('[data-ledger-label="name"]')!.textContent).toBe(model.rows[i].name));
    expect(rows[0].querySelector('[data-ledger-label="name"]')!.textContent).toBe("Container shore power — engineering & studies (RSP JV)");
  });

  it("the bars float on the shared scale as percent left and width; the closure identity reaches 100 percent; the stubs keep full rows", () => {
    const { ledger, model } = openInvestment();
    const bars = Array.from(ledger.querySelectorAll("[data-ledger-bar]")) as HTMLElement[];
    const barRows = model.rows.filter((r) => r.kind !== "subtotal");
    expect(bars).toHaveLength(barRows.length);
    bars.forEach((b, i) => {
      expect(pct(b, "left")).toBeCloseTo(barRows[i].startPct, 6);
      expect(pct(b, "width")).toBeCloseTo(barRows[i].widthPct, 6);
      expect(b.children.length).toBe(0);
      expect(b.textContent).toBe("");
    });
    const steps = bars.filter((b) => b.getAttribute("data-ledger-kind") !== "total");
    const last = steps[steps.length - 1];
    expect(pct(last, "left") + pct(last, "width")).toBeCloseTo(100, 6);
    const stubs = model.rows.filter((r) => r.id === "p5" || r.id === "p6");
    expect(stubs.map((s) => s.widthPct.toFixed(2))).toEqual(["3.18", "3.18"]);
    for (const s of stubs) expect(ledger.querySelector(`[data-ledger-row="${s.id}"] [data-ledger-value]`)!.textContent).toBe(s.value);
  });

  it("the values render beside the bar end through the deck formatters; the muted full-outflow percentage ends the row", () => {
    const { ledger, model } = openInvestment();
    for (const r of model.rows) {
      const row = ledger.querySelector(`[data-ledger-row="${r.id}"]`) as HTMLElement;
      expect(row.querySelector("[data-ledger-value]")!.textContent).toBe(r.value);
      expect(row.querySelector("[data-ledger-share]")!.textContent).toBe(r.share);
    }
    expect(model.rows[0].value).toBe("€74 000 k");
    expect(model.rows[0].share).toBe("11,8%");
  });

  it("the capital subtotal marker is a hairline row with a tick at the capital position and the gross capital", () => {
    const { ledger, model } = openInvestment();
    const sub = ledger.querySelector('[data-ledger-kind="subtotal"]') as HTMLElement;
    expect(sub.querySelector("[data-ledger-bar]")).toBeNull();
    const tick = sub.querySelector("[data-ledger-tick]") as HTMLElement;
    expect(pct(tick, "left")).toBeCloseTo(model.rows.find((r) => r.kind === "subtotal")!.startPct, 6);
    expect(sub.querySelector("[data-ledger-value]")!.textContent).toBe("€449 000 k");
  });

  it("the connectors carry the build from each bar end to the next row; the closure edge runs through every row", () => {
    const { ledger, model } = openInvestment();
    const conns = Array.from(ledger.querySelectorAll("[data-ledger-connector]")) as HTMLElement[];
    const stepRows = model.rows.filter((r) => r.kind === "capital" || r.kind === "operating" || r.kind === "reinvestments");
    expect(conns).toHaveLength(stepRows.length);
    conns.forEach((c, i) => expect(pct(c, "left")).toBeCloseTo(stepRows[i].startPct + stepRows[i].widthPct, 6));
    expect(ledger.querySelectorAll("[data-ledger-edge]").length).toBe(model.rows.length);
  });

  it("the total row is a full-width neutral bar at heavier weight; the operating row is visually distinct", () => {
    const { ledger } = openInvestment();
    const total = ledger.querySelector('[data-ledger-kind="total"] [data-ledger-bar]') as HTMLElement;
    expect(total.className).toContain("ledger-bar-total");
    expect(pct(total, "left")).toBe(0);
    expect(pct(total, "width")).toBe(100);
    const op = ledger.querySelector('[data-ledger-kind="operating"] [data-ledger-bar]') as HTMLElement;
    expect(op.className).toContain("ledger-bar-operating");
    const css = fs.readFileSync("src/index.css", "utf8");
    expect(css).toMatch(/\.ledger-bar-total\s*\{[^}]*background:\s*#e2e8f0/);
    expect(css).toMatch(/\.ledger-bar-operating\s*\{[^}]*repeating-linear-gradient/);
    expect(css).not.toMatch(/\.ledger-name[^{]*\{[^}]*text-overflow/);
  });
});

describe("the stepped columns (the lower section, at group level)", () => {
  it("n+1 slots: the group steps, the operating step, and the ground-standing total column of the same width", () => {
    const { cols, model } = openInvestment();
    const steps = Array.from(cols.querySelectorAll("[data-waterfall-segment]")) as HTMLElement[];
    expect(steps.map((s) => s.getAttribute("data-waterfall-kind"))).toEqual(["capital", "capital", "capital", "capital", "operating"]);
    const slot = 100 / model.columns.length;
    steps.forEach((s, i) => {
      expect(s.getAttribute("data-waterfall-step")).toBe(String(i));
      expect(pct(s, "left")).toBeCloseTo(i * slot, 6);
      expect(pct(s, "width")).toBeCloseTo(0.6 * slot, 6);
      expect(pct(s, "bottom")).toBeCloseTo(model.columns[i].bottomPct, 6);
      expect(pct(s, "height")).toBeCloseTo(model.columns[i].heightPct, 6);
    });
    const total = cols.querySelector('[data-waterfall-total="true"]') as HTMLElement;
    expect(total.getAttribute("data-waterfall-step")).toBe(String(steps.length));
    expect(pct(total, "bottom")).toBe(0);
    expect(pct(total, "height")).toBe(100);
    expect(pct(total, "left")).toBeCloseTo(steps.length * slot, 6);
    expect(pct(total, "width")).toBeCloseTo(0.6 * slot, 6);
    const last = steps[steps.length - 1];
    expect(pct(last, "bottom") + pct(last, "height")).toBeCloseTo(100, 6);
    expect(cols.querySelector('[data-testid="waterfall-cap"]')).toBeNull();
  });

  it("direct value labels above the bars; the total label verbatim; the group names under the ground line with the full name in the title", () => {
    const { cols, model } = openInvestment();
    const labels = Array.from(cols.querySelectorAll('[data-testid="waterfall-label"]')) as HTMLElement[];
    expect(labels.map((l) => l.textContent)).toEqual(model.columns.slice(0, 5).map((c) => c.value));
    expect(cols.querySelector('[data-testid="waterfall-total-label"]')!.textContent).toBe("Total program cost €628 250 k");
    expect(cols.querySelector("[data-waterfall-ground]")).toBeTruthy();
    const names = Array.from(cols.querySelectorAll("[data-waterfall-name]")) as HTMLElement[];
    expect(names.map((n) => n.textContent)).toEqual(model.columns.map((c) => c.name));
    names.forEach((n, i) => expect(n.getAttribute("title")).toBe(model.columns[i].name));
    for (const seg of Array.from(cols.querySelectorAll("[data-waterfall-segment]"))) {
      expect(seg.querySelector('[data-testid="waterfall-label"]')).toBeNull();
    }
  });

  it("the dotted connectors carry each step top to the next base and the last top to the total", () => {
    const { cols, model } = openInvestment();
    const conns = Array.from(cols.querySelectorAll("[data-waterfall-connector]")) as HTMLElement[];
    expect(conns).toHaveLength(5);
    conns.forEach((c, i) => expect(pct(c, "bottom")).toBeCloseTo(model.columns[i].bottomPct + model.columns[i].heightPct, 6));
  });
});
