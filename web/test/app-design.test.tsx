import { describe, expect, it } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { App } from "../src/App.js";
import * as fs from "fs";

const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;
const byNav = (v: string) => document.querySelector('[data-nav="' + v + '"]') as HTMLElement;

describe("Task A: application-wide design system (structural pins)", () => {
  it("app-chrome token usage: the app shell consumes the tokens (a token flip goes red)", () => {
    const css = fs.readFileSync("src/index.css", "utf8");
    expect(css).toMatch(/\.app-root\s*\{\s*[^}]*font-family:\s*var\(--font\)/);
    expect(css).toMatch(/\.app-root\s*\{\s*[^}]*background:\s*var\(--surface\)/);
    expect(css).toMatch(/\.app-root button\.active\s*\{[^}]*var\(--accent\)/);
    expect(css).toMatch(/--accent:\s*#6366f1/);
    render(<App />);
    expect(document.querySelector(".app-root")).toBeTruthy();
  });

  it("the section-table alignment class exists with right alignment and tabular numerals", () => {
    const css = fs.readFileSync("src/index.css", "utf8");
    expect(css).toMatch(/\.app-root \.table-value-cell[^{]*\{[^}]*text-align:\s*right/);
    expect(css).toMatch(/\.app-root \.table-value-cell[^{]*\{[^}]*font-variant-numeric:\s*tabular-nums/);
  });

  it("warnings are visually distinct from disclosures (a flip back to muted goes red)", () => {
    const css = fs.readFileSync("src/index.css", "utf8");
    expect(css).toMatch(/\.app-root \.warning\s*\{[^}]*border-left:\s*3px solid var\(--bad\)/);
    expect(css).toMatch(/\.app-root \.warning\s*\{[^}]*background:\s*color-mix\(in srgb, var\(--bad\) 8%/);
    expect(css).toMatch(/\.app-root \.muted\s*\{[^}]*color:\s*var\(--mut\)/);
  });

  it("the viewport meta and a responsive rule are pinned", () => {
    const html = fs.readFileSync("index.html", "utf8");
    expect(html).toMatch(/name="viewport"/);
    const css = fs.readFileSync("src/index.css", "utf8");
    expect(css).toMatch(/@media \(max-width:\s*480px\)/);
    expect(css).toMatch(/@media \(max-width:\s*480px\)[\s\S]*?flex-direction:\s*column/);
  });

  it("deck content lock: the deck's five slides and the design conventions are untouched", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    const slides = document.querySelectorAll('[data-testid="presentation"] .deck-slide');
    expect(slides.length).toBe(5);
    const css = fs.readFileSync("src/index.css", "utf8");
    expect(css).toMatch(/\[data-testid="presentation"\] \.deck-figure-value\s*\{\s*[^}]*text-align:\s*right/);
  });

  it("Task C wiring pin: the entry point imports the stylesheet", () => {
    const entry = fs.readFileSync("src/main.tsx", "utf8");
    expect(entry).toMatch(/import\s+["'].*index\.css["']/);
  });
});

describe("Task C: carried observations", () => {
  it("STALE-STRING: the main-view reason names XLSX and PDF only; print and present stay enabled", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("costs"));
    const nameInput = document.querySelector('[data-line="c1"] [data-field="name"]') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "" } });
    const reason = document.querySelector('[data-testid="export-disabled-reason"]');
    expect(reason && reason.textContent).toContain("XLSX and PDF export are disabled");
    expect(reason && reason.textContent).not.toContain("print");
    expect((byAction("print-deck") as HTMLButtonElement).disabled).toBe(false);
    expect((byAction("present") as HTMLButtonElement).disabled).toBe(false);
    expect((byAction("export-xlsx") as HTMLButtonElement).disabled).toBe(true);
    expect((byAction("download-pdf") as HTMLButtonElement).disabled).toBe(true);
  });

  it("the presentation-mode PDF button shows a visible disabled reason", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("costs"));
    const nameInput = document.querySelector('[data-line="c1"] [data-field="name"]') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "" } });
    fireEvent.click(byAction("present"));
    const pdfBtn = document.querySelector('[data-testid="presentation"] [data-action="download-pdf"]') as HTMLButtonElement;
    expect(pdfBtn.disabled).toBe(true);
    const reason = document.querySelector('[data-testid="presentation"] [data-testid="export-disabled-reason"]');
    expect(reason && reason.textContent).toContain("disabled until the input issues are resolved");
  });

  it("the main-view Print deck action opens presentation mode (observation 2)", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("print-deck"));
    expect(document.querySelector('[data-testid="presentation"]')).toBeTruthy();
  });

  it("PDF disclosures join the drawnFigures trace (observation 5)", async () => {
    const { deckSlides } = await import("../src/deck.js");
    const { buildDeckPdf } = await import("../src/pdf.js");
    const { demoProject } = await import("../src/state.js");
    const { computeModel } = await import("../src/engine.js");
    const finInputs = { ...demoProject(), financing: { enabled: true, sharePct: 60, debtRatePct: 6, termYears: 7, graceYears: 0, serviceStartYear: null, amortization: "annuity" as const, leveragedSolve: false, perLineSharePct: {} } };
    const finResult = computeModel(finInputs);
    const finModel = deckSlides(finInputs, finResult);
    const trace = { drawnTitles: [] as string[], drawnFigures: [] as string[][] };
    buildDeckPdf(finModel, finInputs.projectName, trace);
    const tracedDeal = trace.drawnFigures[4].join("|");
    for (const d of finModel.slides[4].disclosures) {
      expect(tracedDeal).toContain(d);
    }
  });
});
