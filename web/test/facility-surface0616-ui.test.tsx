import { describe, expect, it } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import { App } from "../src/App.js";

// v0.6.16 — the facility list surface: the term-sheet entry, the amount-first composition (derived
// shares at one decimal closing at 100.0, the drawn total beside the stated amount, the drift
// disclosure), the power-user override, add / remove / reorder, and the note retirement.
const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;
const byNav = (v: string) => document.querySelector('[data-nav="' + v + '"]') as HTMLElement;
const card = (id: string) => document.querySelector('[data-facility="' + id + '"]') as HTMLElement;
const field = (id: string, name: string) => card(id).querySelector('[data-field="' + name + '"]') as HTMLInputElement;
const ids = () => Array.from(document.querySelectorAll("[data-facility]")).map((e) => e.getAttribute("data-facility"));
const tenths = (t: string) => Math.round(parseFloat(t.replace(",", ".").replace("%", "")) * 10);

function openFinancing(demo: boolean) {
  render(<App />);
  if (demo) fireEvent.click(byAction("load-demo"));
  fireEvent.click(byNav("financing"));
}

describe("Task B — the term-sheet entry", () => {
  it("the blank app carries no facility; Add facility lands a term sheet with its scope choice; remove clears it", () => {
    openFinancing(false);
    expect(ids()).toEqual([]);
    fireEvent.click(byAction("add-facility"));
    expect(ids()).toEqual(["fac1"]);
    for (const f of ["facLabel", "facAmount", "facRate", "facTerm", "facGrace", "facStart", "facAmortization", "facScope"]) expect(field("fac1", f)).toBeTruthy();
    expect(field("fac1", "facScope").value).toBe("general");
    fireEvent.click(card("fac1").querySelector('[data-action="remove-facility"]') as HTMLElement);
    expect(ids()).toEqual([]);
  });

  it("a facility with no amount refuses through the standing issues summary by its FAC-* string", async () => {
    openFinancing(true);
    fireEvent.click(byAction("add-facility"));
    await waitFor(() => expect(document.querySelector('[data-testid="issues-summary"]')?.textContent).toContain("(FAC-AMOUNT)"));
  });

  it("facilities add and reorder; the program demo arrives migrated (the share-sized facility, then the note)", () => {
    openFinancing(true);
    expect(ids()).toEqual(["financing", "l1"]);
    fireEvent.click(byAction("add-facility"));
    expect(ids()).toEqual(["financing", "l1", "fac1"]);
    fireEvent.click(card("fac1").querySelector('[data-action="facility-up"]') as HTMLElement);
    expect(ids()).toEqual(["financing", "fac1", "l1"]);
    fireEvent.click(card("financing").querySelector('[data-action="facility-down"]') as HTMLElement);
    expect(ids()).toEqual(["fac1", "financing", "l1"]);
  });

  it("an ATTACHED facility names its scoped cost lines", () => {
    openFinancing(true);
    fireEvent.click(byAction("add-facility"));
    fireEvent.change(field("fac1", "facScope"), { target: { value: "attached" } });
    const boxes = card("fac1").querySelectorAll('[data-field="facScopeLine"]');
    expect(boxes.length).toBe(6);
    fireEvent.click(boxes[0]);
    expect((card("fac1").querySelectorAll('[data-field="facScopeLine"]')[0] as HTMLInputElement).checked).toBe(true);
  });

  it("the funding section keeps the grants alone; the interest-free note adds as a zero-rate dated-lump facility", () => {
    openFinancing(false);
    fireEvent.click(byAction("add-note-facility"));
    expect(card("fac1").getAttribute("data-facility-kind")).toBe("note");
    expect(field("fac1", "facRate").value).toBe("0");
    fireEvent.click(byNav("funding"));
    expect(document.querySelector('[data-field="fundingKind"]')).toBeNull();
    expect(document.querySelector("[data-funding-row]")).toBeNull();
  });
});

describe("Task C — the amount-first composition on the surface", () => {
  const setAmount = (id: string, entry: number) => fireEvent.change(field(id, "facAmount"), { target: { value: String(entry) } });
  // the program's costs run to year 5, so a general facility starts its service in year 6
  const addGeneral = () => {
    fireEvent.click(byAction("add-facility"));
    fireEvent.change(field("fac1", "facStart"), { target: { value: "6" } });
  };

  it("the derived shares display at one decimal per line and close to exactly 100.0", () => {
    openFinancing(true);
    addGeneral();
    setAmount("fac1", 50000);
    const cells = Array.from(card("fac1").querySelectorAll("[data-share]")).map((e) => e.textContent as string);
    expect(cells.length).toBeGreaterThan(1);
    for (const c of cells) expect(c).toMatch(/^\d+,\d%$/);
    expect(cells.reduce((a, c) => a + tenths(c), 0)).toBe(1000);
    expect(card("fac1").querySelector("[data-share-total]")?.textContent).toContain("100,0%");
  });

  it("the drawn total shows beside the stated amount; an oversized amount discloses the drift, a fitting one does not", () => {
    openFinancing(true);
    addGeneral();
    setAmount("fac1", 50000);
    expect(card("fac1").querySelector('[data-stat="facilityStated"]')?.textContent).toBeTruthy();
    expect(card("fac1").querySelector('[data-stat="facilityDrawn"]')?.textContent).toBeTruthy();
    expect(card("fac1").querySelector('[data-testid="facility-drift"]')).toBeNull();
    setAmount("fac1", 99999999);
    const drift = card("fac1").querySelector('[data-testid="facility-drift"]');
    expect(drift).toBeTruthy();
    expect(drift!.textContent).toContain("undrawn");
    expect(card("fac1").querySelector('[data-stat="facilityDrift"]')?.textContent).toBeTruthy();
  });

  it("the power-user path: the per-line override replaces the derivation and returns to the amount-first mode", () => {
    openFinancing(true);
    addGeneral();
    setAmount("fac1", 50000);
    expect(card("fac1").querySelector('[data-field="facLineShare"]')).toBeNull();
    fireEvent.click(field("fac1", "facOverride"));
    expect(card("fac1").querySelectorAll('[data-field="facLineShare"]').length).toBe(6);
    expect(field("fac1", "facAmount")).toBeNull();
    // the override leaves the derived shares as the starting point: the totals still close
    const cells = Array.from(card("fac1").querySelectorAll("[data-share]")).map((e) => e.textContent as string);
    expect(cells.reduce((a, c) => a + tenths(c), 0)).toBe(1000);
    fireEvent.click(field("fac1", "facOverride"));
    expect(field("fac1", "facAmount")).toBeTruthy();
    expect(card("fac1").querySelector('[data-field="facLineShare"]')).toBeNull();
  });

  it("the migrated share-sized facility arrives in the power-user mode with its per-line shares", () => {
    openFinancing(true);
    expect((field("financing", "facOverride")).checked).toBe(true);
    expect((card("financing").querySelector('[data-field="facLineShare"][data-line="p1"]') as HTMLInputElement).value).toBe("31.69");
  });
});
