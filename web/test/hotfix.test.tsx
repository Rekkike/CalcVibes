import { describe, expect, it } from "vitest";
import * as fs from "fs";

describe("Task H3: NO-TAUTOLOGY / PEAK-PDF-FORMAT", () => {
  it("NO-TAUTOLOGY: the deck suite contains no assertion of a value against itself", () => {
    const src = fs.readFileSync("test/deck.test.tsx", "utf8");
    const tautologies = src.match(/expect\((\w+(?:\.\w+)*)\)\s*\.toBe\(\1\)/g) ?? [];
    expect(tautologies).toEqual([]);
  });

  it("PEAK-PDF-FORMAT: the PDF mini-bars peak equals the formatter output at the unit in force", async () => {
    const { demoProject } = await import("../src/state.js");
    const { computeModel, deckMoneyForDisplay } = await import("../src/engine.js");
    const { deckSlides } = await import("../src/deck.js");
    const { buildDeckPdf } = await import("../src/pdf.js");
    const demo = demoProject();
    const result = computeModel(demo);
    const unit = "ones";
    const model = deckSlides(demo, result, { startYear: null });
    const bars = model.slides[4].summaryCharts?.[1];
    const peak = Math.max(...(bars?.data ?? []).map((d) => d.value));
    const expected = deckMoneyForDisplay(peak, "SEK", unit);
    const trace = { drawnTitles: [] as string[], drawnFigures: [] as string[][] };
    buildDeckPdf(model, "Project Alpha", trace);
    const tracedDeal = trace.drawnFigures[4].join("|");
    expect(tracedDeal).toContain(expected);
    expect(tracedDeal).not.toContain(String(peak));
  });
});

describe("Task H2: DONUT-WHOLE (retired with the donut per v0.5.6; the deck carries no circle chart)", () => {
  it("the deck scope contains no composition donut element", async () => {
    const { render: r2 } = await import("@testing-library/react");
    const { App } = await import("../src/App.js");
    const { fireEvent } = await import("@testing-library/react");
    const byAction2 = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;
    r2(<App />);
    fireEvent.click(byAction2("load-demo"));
    fireEvent.click(byAction2("present"));
    expect(document.querySelector('[data-testid="presentation"] [data-testid="composition-donut"]')).toBeNull();
  });
});

describe("Task H4: CONTRAST-SWEEP", () => {
  it("each named presentation-scope rule renders at #e2e8f0 or lighter", () => {
    const css = fs.readFileSync("src/index.css", "utf8");
    expect(css).toMatch(/\[data-testid="presentation"\] \{[^}]*color:\s*#e2e8f0/);
    expect(css).toMatch(/\[data-testid="presentation"\] \.deck-figure-label\s*\{[^}]*color:\s*#e2e8f0/);
    expect(css).toMatch(/\[data-testid="presentation"\] \.muted\s*\{[^}]*color:\s*#e2e8f0/);
    expect(css).toMatch(/\[data-testid="presentation"\] \.deck-tile \.stat-label\s*\{[^}]*color:\s*#e2e8f0/);
    const charts = fs.readFileSync("src/charts.tsx", "utf8");
    expect(charts).toMatch(/axisText:\s*"#e2e8f0"/);
    expect(charts).not.toMatch(/axisText:\s*"#8ea0b8"/);
  });
});

describe("Task H1: MOBILE-HEADER / HEADER-TONE", () => {
  it("MOBILE-HEADER: at 480px the header is static and the nav is a compact scrollable row", () => {
    const css = fs.readFileSync("src/index.css", "utf8");
    const mediaMatch = css.match(/@media \(max-width: 480px\)\s*\{([\s\S]*?)\n\}/);
    expect(mediaMatch).toBeTruthy();
    const media = mediaMatch![1];
    expect(media).toMatch(/\.app-root header\.app-header\s*\{[^}]*position:\s*static/);
    expect(media).toMatch(/\.app-root nav\s*\{[^}]*overflow-x:\s*auto/);
    expect(media).toMatch(/\.app-root nav\s*\{[^}]*flex-direction:\s*row/);
    expect(media).not.toMatch(/\.app-root header\.app-header\s*\{[^}]*flex-direction:\s*column/);
    expect(media).not.toMatch(/\.app-root nav\s*\{[^}]*flex-direction:\s*column/);
  });

  it("MOBILE-HEADER: the sticky layer carries the viewport guard", () => {
    const css = fs.readFileSync("src/index.css", "utf8");
    expect(css).toMatch(/\.app-root header\.app-header\s*\{[^}]*max-height:\s*100vh/);
    expect(css).toMatch(/\.app-root header\.app-header\s*\{[^}]*overflow-y:\s*auto/);
  });

  it("HEADER-TONE: the sticky header background consumes the theme tokens, not a hardcoded white", () => {
    const css = fs.readFileSync("src/index.css", "utf8");
    expect(css).toMatch(/\.app-root header\.app-header\s*\{[^}]*background:\s*color-mix\(in srgb, var\(--card\) 94%, transparent\)/);
    expect(css).not.toMatch(/rgba\(255,\s*255,\s*255,\s*0\.94\)/);
  });
});
