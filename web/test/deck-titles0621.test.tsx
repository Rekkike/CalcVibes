import { describe, expect, it } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import { App } from "../src/App.js";
import { deckSlides } from "../src/deck.js";
import { computeModel } from "../src/engine.js";
import { demoProject, deckTitlesOf } from "../src/state.js";
import { serializeProject, parseProject } from "../../core/src/fileio.js";
import type { ModelInputs } from "../../core/src/types.js";

// v0.6.21 Task E — the author-overridable deck titles: an optional per-slide title override in the
// project document (additive field, declared web-side, carried through the project file), the
// data-driven title the default and the fallback, composed once at the deck-model build, so no deck
// slide draws a stale title. The FILE_VERSION handling per the round-trip contract: additive field,
// back-compatibility pinned (a file without the field parses exactly as before).

const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;

const withTitles = (t: Record<string, string>): ModelInputs => ({ ...demoProject(), deckTitles: t } as ModelInputs);

describe("v0.6.21 Task E — the author-overridable deck titles", () => {
  it("DEFAULT: with no overrides the data-driven titles stand, byte-identical to the un-overridden model", () => {
    const plain = deckSlides(demoProject(), computeModel(demoProject()), { startYear: null });
    const overridden = deckSlides(withTitles({}), computeModel(demoProject()), { startYear: null });
    expect(overridden.slides.map((s) => s.title)).toEqual(plain.slides.map((s) => s.title));
    expect(plain.slides[0].title).toBe("Project Alpha");
  });

  it("OVERRIDE: a per-slide override wins at the deck-model build; a blank override falls back to the data-driven title; an unknown slide name is ignored", () => {
    const inputs = withTitles({ title: "Alpha — the board view", recovery: "  ", nope: "ignored" });
    const deck = deckSlides(inputs, computeModel(demoProject()), { startYear: null });
    const byName = new Map(deck.slides.map((s) => [s.name, s.title]));
    expect(byName.get("title")).toBe("Alpha — the board view");
    const plain = deckSlides(demoProject(), computeModel(demoProject()), { startYear: null });
    const plainByName = new Map(plain.slides.map((s) => [s.name, s.title]));
    expect(byName.get("recovery")).toBe(plainByName.get("recovery")); // blank override: the fallback
    expect([...byName.keys()].some((k) => k === "nope")).toBe(false);
  });

  it("COMPOSED-ONCE / NO-STALE-TITLE: the model recomposes from the current document on every build", () => {
    const first = deckSlides(withTitles({ title: "First override" }), computeModel(demoProject()), { startYear: null });
    expect(first.slides[0].title).toBe("First override");
    const second = deckSlides(withTitles({ title: "Second override" }), computeModel(demoProject()), { startYear: null });
    expect(second.slides[0].title).toBe("Second override");
  });

  it("ROUND-TRIP: the override persists through the project file and back; a file without the field parses as before (back-compat pin, FILE_VERSION unchanged)", () => {
    const settings = { startYear: null, entryUnit: "ones" as const, scenarioTargets: null, scenarioTerms: null, scenarioBalloons: null };
    const text = serializeProject(withTitles({ title: "Saved override" }), settings);
    const loaded = parseProject(text);
    expect(deckTitlesOf(loaded.inputs)).toEqual({ title: "Saved override" });
    const deck = deckSlides(loaded.inputs, computeModel(loaded.inputs), { startYear: null });
    expect(deck.slides[0].title).toBe("Saved override");
    // back-compat: a legacy file without the field
    const legacy = serializeProject(demoProject(), settings);
    const parsed = parseProject(legacy);
    expect(deckTitlesOf(parsed.inputs)).toEqual({});
    expect(deckSlides(parsed.inputs, computeModel(parsed.inputs), { startYear: null }).slides[0].title).toBe("Project Alpha");
  });

  it("UI: the overview editor writes the override, the presentation draws it, and clearing it restores the data-driven title", async () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    // author the override through the overview editor
    fireEvent.click(document.querySelector('[data-testid="deck-titles-editor"] summary')!);
    const input = document.querySelector('[data-field="deck-title"][data-slide-name="title"]') as HTMLInputElement;
    expect(input.placeholder).toBeTruthy(); // the data-driven title is the placeholder
    fireEvent.change(input, { target: { value: "Rotterdam — the program view" } });
    expect(input.value).toBe("Rotterdam — the program view");
    // the deck draws the override
    fireEvent.click(byAction("present"));
    await waitFor(() => {
      expect(document.querySelector('[data-slide-name="title"] .deck-slide-title, [data-slide-name="title"] h2, [data-slide-name="title"]')?.textContent).toContain("Rotterdam — the program view");
    });
    const titleEl = Array.from(document.querySelectorAll('[data-slide-name="title"] *')).find((el) => el.textContent === "Rotterdam — the program view");
    expect(titleEl).toBeTruthy();
    fireEvent.click(byAction("exit-presentation"));
    // clearing the override restores the data-driven title in the next build
    fireEvent.click(document.querySelector('[data-testid="deck-titles-editor"] summary')!);
    fireEvent.change(document.querySelector('[data-field="deck-title"][data-slide-name="title"]') as HTMLInputElement, { target: { value: "" } });
    expect((document.querySelector('[data-field="deck-title"][data-slide-name="title"]') as HTMLInputElement).value).toBe("");
    fireEvent.click(byAction("present"));
    await waitFor(() => {
      const titleEl = Array.from(document.querySelectorAll('[data-slide-name="title"] *')).find((el) => el.textContent === "Shore-power program (Rotterdam)");
      expect(titleEl).toBeTruthy();
    });
  });
});
