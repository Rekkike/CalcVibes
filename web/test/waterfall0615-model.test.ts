import { describe, expect, it } from "vitest";
import { computeModel } from "../../core/src/engine.js";
import type { ModelInputs } from "../../core/src/types.js";
import { deckSlides } from "../src/deck.js";
import { deckMoneyForDisplay, percentOneForDisplay } from "../src/engine.js";
import { composeInvestment, demoProject, groupLabelOf, landNewbuildProject, shorePowerProgram } from "../src/state.js";

// v0.6.15 — the investment composition (the group aggregation, composed once) and the deck waterfall
// model both renderers consume.
const withGroups = (): ModelInputs => {
  const p = shorePowerProgram();
  const g: Record<string, string> = { p1: "Container shore power", p2: "Container shore power", p3: "Container shore power", p4: "Market pillar", p5: "Cruise terminal", p6: "Inland & public berths" };
  return { ...p, costs: p.costs.map((c) => ({ ...c, group: g[c.id] })) };
};
const slideOf = (inp: ModelInputs, startYear: number | null = null) => deckSlides(inp, computeModel(inp), { startYear, entryUnit: "thousands" }).slides.find((s) => s.name === "investment")!;

describe("the group label", () => {
  it("is the trimmed free text; empty or whitespace-only falls back to the category label", () => {
    const base = { id: "x", name: "X", amount: 1, startYear: 1, durationYears: 1, escalation: 0 };
    expect(groupLabelOf({ ...base, category: "capex", group: "  Land  " })).toBe("Land");
    expect(groupLabelOf({ ...base, category: "capex", group: "   " })).toBe("CAPEX");
    expect(groupLabelOf({ ...base, category: "recurring" })).toBe("Recurring");
    expect(groupLabelOf({ ...base, category: "recurring", group: "" })).toBe("Recurring");
  });
});

describe("the group aggregation (composed once)", () => {
  it("groups in first-appearance order, summing member lines; operating and reinvestments stay distinct", () => {
    const inp = withGroups();
    const c = composeInvestment(inp, computeModel(inp));
    expect(c.groups.map((g) => g.name)).toEqual(["Container shore power", "Market pillar", "Cruise terminal", "Inland & public berths"]);
    expect(c.groups.map((g) => g.total)).toEqual([284000000, 125000000, 20000000, 20000000]);
    expect(c.lines).toHaveLength(6);
    expect(c.operating).toMatchObject({ kind: "operating", total: 179250000 });
    expect(c.reinvestments).toBeNull();
    expect(c.capitalSubtotal).toBe(449000000);
    expect(c.groups.reduce((a, g) => a + g.total, 0)).toBe(c.capitalSubtotal);
  });

  it("an ungrouped project falls back to the category labels", () => {
    const inp = demoProject();
    const c = composeInvestment(inp, computeModel(inp));
    expect(c.groups.map((g) => g.name)).toEqual(["Recurring", "CAPEX"]);
    expect(c.groups.reduce((a, g) => a + g.total, 0)).toBe(c.capitalSubtotal);
  });

  it("a reinvestments segment is its own, never grouped (the multi-lease land fixture carries none; a contract with a reinvestment does)", () => {
    const inp: ModelInputs = { ...landNewbuildProject(), contracts: landNewbuildProject().contracts!.map((k, i) => (i === 0 ? { ...k, reinvestments: [{ year: 6, amount: 5000000 }] } : k)) };
    const c = composeInvestment(inp, computeModel(inp));
    expect(c.reinvestments).toMatchObject({ kind: "reinvestments", total: 5000000 });
    expect(c.groups.some((g) => g.kind !== "capital")).toBe(false);
  });
});

describe("the deck waterfall model: the ledger rows", () => {
  it("rows: every line with its full name, the subtotal, the operating row, the total; closure at 100 percent", () => {
    const inp = withGroups();
    const r = computeModel(inp);
    const w = slideOf(inp).waterfall!;
    expect(w.rows.map((x) => x.kind)).toEqual(["capital", "capital", "capital", "capital", "capital", "capital", "subtotal", "operating", "total"]);
    expect(w.rows.slice(0, 6).map((x) => x.name)).toEqual(r.lineTotals.map((l) => l.name));
    expect(w.rows[0].name).toBe("Container shore power — engineering & studies (RSP JV)");
    // percent left and width on the shared scale; each bar starts where the previous ended
    let acc = 0;
    for (const row of w.rows.filter((x) => x.kind === "capital" || x.kind === "operating")) {
      expect(row.startPct).toBeCloseTo((acc / r.totalCost) * 100, 9);
      expect(row.widthPct).toBeCloseTo((row.raw / r.totalCost) * 100, 9);
      acc += row.raw;
    }
    const last = w.rows.find((x) => x.kind === "operating")!;
    expect(last.startPct + last.widthPct).toBeCloseTo(100, 6);
    const total = w.rows[w.rows.length - 1];
    expect(total).toMatchObject({ startPct: 0, widthPct: 100, name: "Total program cost", value: deckMoneyForDisplay(r.totalCost, "EUR", "thousands") });
  });

  it("the full-outflow percentages: each row's share of the total program cost; no capital-basis share anywhere", () => {
    const inp = withGroups();
    const r = computeModel(inp);
    const w = slideOf(inp).waterfall!;
    const first = w.rows[0];
    expect(first.share).toBe(percentOneForDisplay(r.lineTotals[0].total / r.totalCost));
    expect(first.share).toBe("11,8%");
    expect(w.rows.find((x) => x.kind === "operating")!.share).toBe("28,5%");
    expect(w.rows.find((x) => x.kind === "total")!.share).toBe("100,0%");
    expect(w.rows.some((x) => x.share === "16,5%" || x.share === "4,5%")).toBe(false);
  });

  it("the subtotal row carries the gross capital the funding block emits, at the capital share position", () => {
    const inp = withGroups();
    const r = computeModel(inp);
    const s = slideOf(inp);
    const sub = s.waterfall!.rows.find((x) => x.kind === "subtotal")!;
    expect(sub.raw).toBe(449000000);
    expect(sub.raw).toBe(s.funding!.grossRaw);
    expect(sub.value).toBe(deckMoneyForDisplay(449000000, "EUR", "thousands"));
    expect(sub.startPct).toBeCloseTo((449000000 / r.totalCost) * 100, 9);
  });

  it("a capital-only project carries no subtotal row (it would equal the total)", () => {
    const w = slideOf(demoProject()).waterfall!;
    expect(w.rows.some((x) => x.kind === "subtotal")).toBe(false);
    expect(w.rows.map((x) => x.kind)).toEqual(["capital", "capital", "capital", "total"]);
  });
});

describe("the composition-share basis stays disclosed (one basis throughout)", () => {
  it("the investment slide discloses the full-outflow basis; the capital-program basis disclosure is retired", () => {
    const s = slideOf(withGroups());
    expect(s.disclosures).toContain("Shares are of the total program cost, the full outflow: the capital lines, the operating lines and the reinvestments.");
    expect(s.disclosures.some((d) => d.includes("of the capital program"))).toBe(false);
  });
});

describe("the deck waterfall model: the stepped columns at group level", () => {
  it("n+1 columns: the groups, the operating segment, then the ground-standing total", () => {
    const inp = withGroups();
    const r = computeModel(inp);
    const w = slideOf(inp).waterfall!;
    expect(w.columns.map((c) => c.name)).toEqual(["Container shore power", "Market pillar", "Cruise terminal", "Inland & public berths", "Operating lines", "Total program cost"]);
    expect(w.columns.map((c) => c.kind)).toEqual(["capital", "capital", "capital", "capital", "operating", "total"]);
    let acc = 0;
    for (const c of w.columns.slice(0, 5)) {
      expect(c.bottomPct).toBeCloseTo((acc / r.totalCost) * 100, 9);
      expect(c.heightPct).toBeCloseTo((c.raw / r.totalCost) * 100, 9);
      acc += c.raw;
    }
    const total = w.columns[5];
    expect(total).toMatchObject({ bottomPct: 0, heightPct: 100, value: deckMoneyForDisplay(r.totalCost, "EUR", "thousands") });
    expect(w.columns[4].bottomPct + w.columns[4].heightPct).toBeCloseTo(100, 6);
  });
});
