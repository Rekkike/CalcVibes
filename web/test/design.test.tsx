import { describe, expect, it } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { App } from "../src/App.js";
import * as fs from "fs";

const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;

describe("Task G: the deck design system (structural pins)", () => {
  it("the stylesheet defines the token custom properties", () => {
    const css = fs.readFileSync("src/index.css", "utf8");
    expect(css).toMatch(/--font:\s*Inter/);
    expect(css).toMatch(/--accent:\s*#6366f1/);
    expect(css).toMatch(/--ink:/);
    expect(css).toMatch(/--muted:/);
    expect(css).toMatch(/--surface:/);
    expect(css).toMatch(/--content-width:\s*56rem/);
  });

  it("figure values are right-aligned via the alignment class", () => {
    const css = fs.readFileSync("src/index.css", "utf8");
    expect(css).toMatch(/\.deck-figure-value\s*\{\s*[^}]*text-align:\s*right/);
  });

  it("the composition bar is accent-token-driven (no second color literal)", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    fireEvent.keyDown(window, { key: "ArrowRight" });
    const bar = document.querySelector('[data-testid="composition-bar"]') as SVGElement;
    for (const seg of bar.querySelectorAll(".composition-bar-segment")) {
      expect((seg as SVGRectElement).getAttribute("fill")).toBe("var(--accent)");
    }
    expect(bar.innerHTML).not.toContain("#10b981");
  });

  it("header and footer chrome render on every slide; disclosures are muted", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    const slides = document.querySelectorAll('[data-testid="presentation"] .deck-slide');
    expect(slides.length).toBe(5);
    for (const s of slides) {
      expect((s as HTMLElement).querySelector(".deck-slide-header")).toBeTruthy();
      expect((s as HTMLElement).querySelector(".deck-slide-footer")).toBeTruthy();
    }
    const css = fs.readFileSync("src/index.css", "utf8");
    expect(css).toMatch(/\.deck-disclosure\s*\{\s*[^}]*color:\s*var\(--muted\)/);
    expect(css).toMatch(/\.deck-slide-header\s*\{\s*[^}]*color:\s*var\(--muted\)/);
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
