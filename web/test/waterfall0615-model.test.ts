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

describe("the deck waterfall model: the ledger rows (v0.6.18: the capital program only)", () => {
  it("rows: every capital line with its full name, then the Capital program total; closure at 100 percent of the capital program", () => {
    const inp = withGroups();
    const r = computeModel(inp);
    const w = slideOf(inp).waterfall!;
    expect(w.rows.map((x) => x.kind)).toEqual(["capital", "capital", "capital", "capital", "capital", "capital", "total"]);
    expect(w.rows.slice(0, 6).map((x) => x.name)).toEqual(r.lineTotals.map((l) => l.name));
    expect(w.rows[0].name).toBe("Container shore power — engineering & studies (RSP JV)");
    const cap = 449000000;
    // percent left and width on the shared scale; each bar starts where the previous ended
    let acc = 0;
    for (const row of w.rows.filter((x) => x.kind === "capital")) {
      expect(row.startPct).toBeCloseTo((acc / cap) * 100, 9);
      expect(row.widthPct).toBeCloseTo((row.raw / cap) * 100, 9);
      acc += row.raw;
    }
    const last = w.rows[5];
    expect(last.startPct + last.widthPct).toBeCloseTo(100, 6);
    const total = w.rows[w.rows.length - 1];
    expect(total).toMatchObject({ startPct: 0, widthPct: 100, name: "Capital program", raw: cap, value: deckMoneyForDisplay(cap, "EUR", "thousands") });
    expect(w.totalRaw).toBe(cap);
    // the operating lines and the reinvestments never draw as steps
    expect(w.rows.some((x) => (x.kind as string) === "operating" || (x.kind as string) === "reinvestments" || (x.kind as string) === "subtotal")).toBe(false);
  });

  it("the shares are of the capital program: each row's share of the capital subtotal, closing at 100,0%; the one-decimal residue is disclosed, never smoothed", () => {
    const inp = withGroups();
    const r = computeModel(inp);
    const w = slideOf(inp).waterfall!;
    const first = w.rows[0];
    expect(first.share).toBe(percentOneForDisplay(r.lineTotals[0].total / 449000000));
    expect(first.share).toBe("16,5%");
    expect(w.rows.find((x) => x.kind === "total")!.share).toBe("100,0%");
    expect(w.rows.slice(0, 6).map((x) => x.share)).toEqual(["16,5%", "24,5%", "22,3%", "27,8%", "4,5%", "4,5%"]);
    // the shore-power one-decimal shares sum to 100.1 (the v0.6.10 honest residue)
    expect(w.rows.slice(0, 6).reduce((a, x) => a + Number(x.share.replace(",", ".").replace("%", "")), 0)).toBeCloseTo(100.1, 6);
    expect(w.rows.some((x) => x.share === "11,8%" || x.share === "28,5%")).toBe(false);
  });

  it("the total row carries the gross capital the funding block emits", () => {
    const inp = withGroups();
    const s = slideOf(inp);
    const total = s.waterfall!.rows.find((x) => x.kind === "total")!;
    expect(total.raw).toBe(449000000);
    expect(total.raw).toBe(s.funding!.grossRaw);
    expect(total.value).toBe(deckMoneyForDisplay(449000000, "EUR", "thousands"));
  });

  it("a capital-only project closes the same way: its lines, then the Capital program total", () => {
    const w = slideOf(demoProject()).waterfall!;
    expect(w.rows.map((x) => x.kind)).toEqual(["capital", "capital", "capital", "total"]);
    expect(w.rows[3].name).toBe("Capital program");
  });
});

describe("the composition-share basis stays disclosed (one basis throughout)", () => {
  it("the investment slide discloses the capital-program basis and names the segments of the total program cost beyond it", () => {
    const s = slideOf(withGroups());
    expect(s.disclosures).toEqual(["Shares are of the capital program: the capital lines, closing at the Capital program step. The total program cost also includes the operating lines (the operations slide shows the operating lines)."]);
    const land = slideOf(landNewbuildProject());
    expect(land.disclosures[0]).toContain("The total program cost also includes");
    const plain = slideOf(demoProject());
    expect(plain.disclosures).toEqual(["Shares are of the capital program: the capital lines, closing at the Capital program step."]);
    // the total program cost stays a labeled figure of the slide
    expect(s.body.map((f) => f.label)).toEqual(["Total cost (nominal)", "Cost NPV at target (discounted)"]);
    expect(s.body[0].rawValue).toBe(computeModel(withGroups()).totalCost);
  });

  it("J.1: the dead rows-chart field of the investment slide model is retired", () => {
    expect(slideOf(withGroups()).chart).toBeUndefined();
  });
});

describe("the deck waterfall model: the stepped columns at group level", () => {
  it("n+1 columns: the groups, then the ground-standing Capital program total", () => {
    const inp = withGroups();
    const w = slideOf(inp).waterfall!;
    const cap = 449000000;
    expect(w.columns.map((c) => c.name)).toEqual(["Container shore power", "Market pillar", "Cruise terminal", "Inland & public berths", "Capital program"]);
    expect(w.columns.map((c) => c.kind)).toEqual(["capital", "capital", "capital", "capital", "total"]);
    let acc = 0;
    for (const c of w.columns.slice(0, 4)) {
      expect(c.bottomPct).toBeCloseTo((acc / cap) * 100, 9);
      expect(c.heightPct).toBeCloseTo((c.raw / cap) * 100, 9);
      acc += c.raw;
    }
    const total = w.columns[4];
    expect(total).toMatchObject({ bottomPct: 0, heightPct: 100, value: deckMoneyForDisplay(cap, "EUR", "thousands") });
    expect(w.columns[3].bottomPct + w.columns[3].heightPct).toBeCloseTo(100, 6);
  });
});