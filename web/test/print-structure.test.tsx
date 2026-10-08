import { describe, expect, it } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { App } from "../src/App.js";
import * as fs from "fs";

const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;

describe("Task B: full-deck print rendering", () => {
  it("all five slide sections are mounted in the presentation DOM with active flags", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    const slides = document.querySelectorAll('[data-testid="presentation"] .deck-slide');
    expect(slides.length).toBe(5);
    const names = Array.from(slides).map((s) => (s as HTMLElement).getAttribute("data-slide-name"));
    expect(names).toEqual(["title", "investment", "recovery", "returns", "deal"]);
    const active = Array.from(slides).map((s) => (s as HTMLElement).getAttribute("data-slide-active"));
    expect(active).toEqual(["true", "false", "false", "false", "false"]);
    // navigation chrome per slide: header and footer
    for (const s of slides) {
      expect((s as HTMLElement).querySelector(".deck-slide-header")).toBeTruthy();
      expect((s as HTMLElement).querySelector(".deck-slide-footer")).toBeTruthy();
    }
  });

  it("the print rules target all slides: page-break on the print class, inactive slides shown in print", async () => {
    const css = fs.readFileSync("src/index.css", "utf8");
    expect(css).toContain(".deck-slide-print { page-break-after: always; }");
    expect(css).toContain('.deck-slide[data-slide-active="false"] { display: block; }');
    expect(css).toContain("button { display: none; }");
  });
});

describe("Task E: composition, one figure (re-anchored to the donut per v0.5.5 Task B)", () => {
  it("the deck investment slide carries exactly one composition figure: the labeled donut", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(document.querySelector('[data-testid="composition-bar"]')).toBeNull();
    const donut = document.querySelector('[data-slide-name="investment"] [data-testid="composition-donut"]');
    expect(donut).toBeTruthy();
    expect((donut as SVGElement).querySelectorAll("[data-donut-segment]").length).toBe(3);
  });
});
