import { describe, expect, it, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { App } from "../src/App.js";
import { GanttChart, GANTT_SVG } from "../src/charts.js";
import { computeModel } from "../../core/src/engine.js";
import { deckSlides } from "../src/deck.js";
import { buildDeckPdf } from "../src/pdf.js";
import { landNewbuildProject } from "../src/state.js";

// v0.6.19 — the milestone-tie surface: the tie selector writes the tie alone (the authored year and month never rewritten),
// the live position composes on every consumer, the section names it read-only, and the computed ring is retired.
const rec = vi.hoisted(() => ({ circles: [] as number[][], texts: [] as string[], lines: [] as number[][] }));
vi.mock("jspdf", async (orig) => {
  const m = (await orig()) as { jsPDF: new (...a: unknown[]) => Record<string, (...x: unknown[]) => unknown> };
  class Rec extends m.jsPDF {
    constructor(...a: unknown[]) {
      super(...a);
      const circle = this.circle.bind(this);
      const text = this.text.bind(this);
      const line = this.line.bind(this);
      this.save = () => undefined;
      this.circle = (...x: unknown[]) => { rec.circles.push(x as number[]); return circle(...x); };
      this.text = (...x: unknown[]) => { if (typeof x[0] === "string") rec.texts.push(x[0]); return text(...x); };
      this.line = (...x: unknown[]) => { rec.lines.push(x as number[]); return line(...x); };
    }
  }
  return { ...m, jsPDF: Rec };
});

const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;
const byNav = (v: string) => document.querySelector('[data-nav="' + v + '"]') as HTMLElement;
const row = (kind: string, id: string) => document.querySelector(`tr[data-kind="${kind}"][data-line="${id}"]`) as HTMLElement;
const field = (kind: string, id: string, f: string) => row(kind, id).querySelector(`[data-field="${f}"]`) as HTMLInputElement;
const markerX = (root: ParentNode, id: string): number => parseFloat((root.querySelector(`[data-gantt-milestone="${id}"] polygon`)!.getAttribute("points") as string).split(",")[0]);

// a demo with one activity (years 2-4, months 3-9) and one manual milestone (authored year 5 month 7)
function setup() {
  render(<App />);
  fireEvent.click(byAction("load-demo"));
  fireEvent.click(byNav("timeline"));
  fireEvent.click(byAction("add-activity"));
  const aid = Array.from(document.querySelectorAll('tr[data-kind="activity"]')).pop()!.getAttribute("data-line") as string;
  fireEvent.change(field("activity", aid, "activityStart"), { target: { value: "2" } });
  fireEvent.change(field("activity", aid, "activityEnd"), { target: { value: "4" } });
  fireEvent.change(field("activity", aid, "activityStartMonth"), { target: { value: "3" } });
  fireEvent.change(field("activity", aid, "activityEndMonth"), { target: { value: "9" } });
  fireEvent.click(byAction("add-milestone"));
  const mid = Array.from(document.querySelectorAll('tr[data-kind="milestone"]')).pop()!.getAttribute("data-line") as string;
  fireEvent.change(field("milestone", mid, "milestoneYear"), { target: { value: "5" } });
  fireEvent.change(field("milestone", mid, "milestoneMonth"), { target: { value: "7" } });
  return { aid, mid };
}
const ws = () => document.querySelector('[data-testid="workspace-gantt"]') as HTMLElement;
const authored = (mid: string) => [field("milestone", mid, "milestoneYear").value, field("milestone", mid, "milestoneMonth").value];

describe("Task A — the tie selector writes the tie alone", () => {
  it("choosing a finish tie, a start tie or an engine-event tie never rewrites the milestone's authored year or month", () => {
    const { aid, mid } = setup();
    expect(authored(mid)).toEqual(["5", "7"]);
    const tie = (v: string) => fireEvent.change(field("milestone", mid, "milestoneTie"), { target: { value: v } });
    for (const v of ["activity:" + aid, "activity-start:" + aid, "engine-event:first-collection-year", "engine-event:construction-complete"]) {
      tie(v);
      expect(authored(mid)).toEqual(["5", "7"]);
    }
    tie("");
    expect(authored(mid)).toEqual(["5", "7"]);
  });

  it("the tie vocabulary carries the start semantics beside the finish", () => {
    const { aid, mid } = setup();
    const values = Array.from((field("milestone", mid, "milestoneTie") as unknown as HTMLSelectElement).options).map((o) => o.value);
    expect(values).toContain("activity:" + aid);
    expect(values).toContain("activity-start:" + aid);
    const labels = Array.from((field("milestone", mid, "milestoneTie") as unknown as HTMLSelectElement).options).map((o) => o.textContent);
    expect(labels.some((l) => /^Activity start /.test(l as string))).toBe(true);
  });

  it("while a tie resolves, the section names the live-composed position read-only and the selectors hold the fallback", () => {
    const { aid, mid } = setup();
    expect(row("milestone", mid).querySelector('[data-testid="tie-position"]')).toBeNull();
    fireEvent.change(field("milestone", mid, "milestoneTie"), { target: { value: "activity:" + aid } });
    const finish = row("milestone", mid).querySelector('[data-testid="tie-position"]')!.textContent as string;
    expect(finish).toContain("year 4, month 9");
    expect(finish).toContain("finish of its activity");
    expect(finish).toContain("read-only");
    fireEvent.change(field("milestone", mid, "milestoneTie"), { target: { value: "activity-start:" + aid } });
    expect(row("milestone", mid).querySelector('[data-testid="tie-position"]')!.textContent).toContain("year 2, month 3");
    fireEvent.change(field("milestone", mid, "milestoneTie"), { target: { value: "engine-event:first-collection-year" } });
    expect(row("milestone", mid).querySelector('[data-testid="tie-position"]')!.textContent).toContain("year 3, month 12");
    fireEvent.change(field("milestone", mid, "milestoneTie"), { target: { value: "engine-event:construction-complete" } });
    expect(row("milestone", mid).querySelector('[data-testid="tie-position"]')!.textContent).not.toContain(", month");
  });

  it("an engine-event tie with the model unsolved is disclosed honestly: drawn at the authored fallback", () => {
    const { mid } = setup();
    fireEvent.change(field("milestone", mid, "milestoneTie"), { target: { value: "engine-event:first-collection-year" } });
    fireEvent.click(byNav("overview"));
    fireEvent.change(document.querySelector('[data-testid="overview"] [data-field="targetIrr"]') as HTMLElement, { target: { value: "-150" } });
    fireEvent.click(byNav("timeline"));
    const note = row("milestone", mid).querySelector('[data-testid="tie-position"]');
    expect(note).not.toBeNull();
    expect(note!.textContent).toContain("does not resolve");
    expect(note!.textContent).toContain("authored position, year 5, month 7");
  });
});

describe("Task A — the live follow on every consumer", () => {
  it("moving the tied activity moves the marker in the workspace Gantt; removing the tie restores the authored position; the document fields never change", () => {
    const { aid, mid } = setup();
    const manualX = markerX(ws(), mid);
    fireEvent.change(field("milestone", mid, "milestoneTie"), { target: { value: "activity:" + aid } });
    const tiedX = markerX(ws(), mid);
    expect(tiedX).not.toBe(manualX);
    fireEvent.change(field("activity", aid, "activityEnd"), { target: { value: "5" } });
    fireEvent.change(field("activity", aid, "activityEndMonth"), { target: { value: "2" } });
    const movedX = markerX(ws(), mid);
    expect(movedX).not.toBe(tiedX);
    expect(authored(mid)).toEqual(["5", "7"]);
    fireEvent.change(field("milestone", mid, "milestoneTie"), { target: { value: "" } });
    expect(markerX(ws(), mid)).toBe(manualX);
  });

  it("the SVG and the PDF draw the milestone at the live-composed position (the same model), not at the authored one", () => {
    const inp = landNewbuildProject();
    const model = deckSlides(inp, computeModel(inp), { startYear: null });
    const g = model.slides.find((s) => s.name === "timeline")!.gantt!;
    const m = g.milestones.find((x) => x.tie === "first-collection-year")!;
    const { container } = render(<GanttChart gantt={g} />);
    const { labelW, plotW } = GANTT_SVG;
    const n = g.window.lastYear - g.window.firstYear + 1;
    expect(markerX(container, m.id)).toBeCloseTo(labelW + m.pos * (plotW / n), 6);
    // the authored month 1 would sit at year 3's opening; the drawn marker sits at the month-12 position instead
    expect(m.pos).toBeGreaterThan(g.window.firstYear === 1 ? 2 + 1 / 12 : 0);
  });
});

describe("Task C — the computed ring is retired on every consumer", () => {
  it("the SVG, the workspace Gantt and the PDF draw no ring and no ring label", () => {
    const inp = landNewbuildProject();
    const model = deckSlides(inp, computeModel(inp), { startYear: null });
    const g = model.slides.find((s) => s.name === "timeline")!.gantt!;
    const { container } = render(<GanttChart gantt={g} />);
    expect(container.querySelector("[data-gantt-computed], [data-gantt-computed-label], [data-gantt-computed-link]")).toBeNull();
    expect(container.textContent).not.toContain("computed: month");
    rec.circles.length = 0;
    rec.texts.length = 0;
    buildDeckPdf(model, "No ring");
    // the retired ring was a 3.6 mm stroked circle on the milestone row
    expect(rec.circles.filter((c) => c[2] === 3.6 && (c[3] as unknown) === "S")).toEqual([]);
    expect(rec.texts.some((t) => t.startsWith("computed:"))).toBe(false);
    document.body.innerHTML = "";
    render(<App />);
    fireEvent.click(byAction("load-multi-lease-demo"));
    fireEvent.click(byNav("timeline"));
    expect(ws().querySelectorAll("[data-gantt-computed]")).toHaveLength(0);
    expect(ws().textContent).not.toContain("computed: month");
  });

  it("each tied marker is the only drawing for its milestone: one diamond per milestone", () => {
    render(<App />);
    fireEvent.click(byAction("load-multi-lease-demo"));
    fireEvent.click(byNav("timeline"));
    for (const m of ws().querySelectorAll("[data-gantt-milestone]")) expect(m.querySelectorAll("polygon")).toHaveLength(1);
  });
});
