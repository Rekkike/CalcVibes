import { describe, expect, it } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { App } from "../src/App.js";
import * as fs from "fs";

const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;

describe("Task G: the deck design system (structural pins)", () => {
  it("the stylesheet defines the token custom properties", () => {
    const css = fs.readFileSync("src/index.css", "utf8");
    expect(css).toMatch(/--font:\s*Inter/);
    expect(css).toMatch(/--accent:\s*#0074ba/);
    expect(css).toMatch(/--ink:/);
    expect(css).toMatch(/--mut:/);
    expect(css).toMatch(/--card:/);
    expect(css).toMatch(/--content-width:\s*56rem/);
  });

  it("figure values are right-aligned via the alignment class", () => {
    const css = fs.readFileSync("src/index.css", "utf8");
    expect(css).toMatch(/\.deck-figure-value\s*\{\s*[^}]*text-align:\s*right/);
  });

  it("the labeled composition rows are the investment slide's one composition figure (re-anchored per v0.6.5 Task C/W13: the donut lives on the summary slide only)", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(document.querySelector('[data-slide-name="investment"] [data-testid="composition-donut"]')).toBeNull();
    expect(document.querySelectorAll('[data-slide-name="summary"] [data-testid="composition-donut"]').length).toBe(2);
    const rows = document.querySelector('[data-slide-name="investment"] [data-testid="composition-rows"]') as HTMLElement;
    expect(rows.querySelectorAll("[data-composition-row]").length).toBe(3);
    expect(rows.querySelectorAll('[data-testid="donut-segment-label"]').length).toBe(0);
  });

  it("header and footer chrome render on every slide; disclosures are muted", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    const slides = document.querySelectorAll('[data-testid="presentation"] .deck-slide');
    expect(slides.length).toBe(7);
    for (const s of slides) {
      expect((s as HTMLElement).querySelector(".deck-slide-header")).toBeTruthy();
      expect((s as HTMLElement).querySelector(".deck-slide-footer")).toBeTruthy();
    }
    const css = fs.readFileSync("src/index.css", "utf8");
    expect(css).toMatch(/\.deck-disclosure\s*\{[^}]*color:\s*var\(--mut\)/);
    expect(css).toMatch(/\[data-testid="presentation"\] \.deck-slide-header\s*\{[^}]*color:\s*#e2e8f0/);
  });

  it("the financing variant renders its disclosures (the ambiguity warning stays distinct but calm)", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(document.querySelector('[data-nav="financing"]') as HTMLElement);
    fireEvent.click(document.querySelector('[data-field="finEnabled"]') as HTMLElement);
    fireEvent.click(byAction("present"));
    for (let i = 0; i < 4; i++) fireEvent.keyDown(window, { key: "ArrowRight" });
    const deal = document.querySelector('[data-slide-name="deal"]') as HTMLElement;
    expect(deal.querySelector(".warning")).toBeTruthy();
  });
});
