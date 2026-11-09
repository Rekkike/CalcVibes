import { describe, expect, it } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { App } from "../src/App.js";
import { computeModel } from "../src/engine.js";
import { ganttWindow, layoutLane, labelEm, GANTT_PLOT_EM, GANTT_PLOT_EM_PRINT } from "../src/ganttLayout.js";
import { shorePowerProgram, timelineOf, visibleLanes, programSpanYears } from "../src/state.js";

// v0.6.21 Task G — the two seated re-seat flags.
// (a) The H3 surface-aware option: the bar-label placement measure gains the surface-aware /
// less-conservative candidate as a builder proposal, seated where the measure proves needlessly
// tight; the Rotterdam KEEP-OR-RECALIBRATE question answers in the same composition. The
// composed-once discipline stands: any revision that re-composes the shared measure halts and asks.
// (b) The entry-unit exclusion retired: the entry-unit switch joins the unsaved-changes key.

const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;
const setUnit = (u: string) => fireEvent.change(document.querySelector('[data-field="entryUnit"]') as HTMLSelectElement, { target: { value: u } });

describe("v0.6.21 Task G(a) — the H3 surface-aware candidate and the Rotterdam KEEP-OR-RECALIBRATE answer", () => {
  it("the shared measure is unchanged (GANTT_PLOT_EM 76, composed once) and the print candidate is recorded at 106 em", () => {
    expect(GANTT_PLOT_EM).toBe(76);
    expect(GANTT_PLOT_EM_PRINT).toBe(106);
  });

  it("ROTTERDAM KEEP: the demo's one above-label still does not fit inside even at the print budget, so the shared measure is not needlessly tight there", () => {
    const inputs = shorePowerProgram();
    const result = computeModel(inputs);
    const tl = timelineOf(inputs);
    const span = programSpanYears(inputs, result)!;
    const win = ganttWindow(visibleLanes(tl).flatMap((l) => l.activities), span, (tl as { windowExtension?: { firstYear?: number; lastYear?: number } }).windowExtension);
    expect(win.years).toBe(5);
    const perEmShared = win.years / GANTT_PLOT_EM;
    const perEmPrint = win.years / GANTT_PLOT_EM_PRINT;
    let aboveCount = 0;
    for (const lane of visibleLanes(tl)) {
      const laid = layoutLane(lane.activities, win);
      for (const b of laid.bars) {
        const capShared = (b.right - b.left) / perEmShared - 1.6;
        const capPrint = (b.right - b.left) / perEmPrint - 1.6;
        const em = labelEm(b.label);
        if (b.labelMode === "above") {
          aboveCount += 1;
          // the needlessly-tight test: would the label fit inside on the looser print surface?
          expect(em).toBeGreaterThan(capPrint); // it would NOT fit even at 106 em — KEEP
        } else {
          expect(em).toBeLessThanOrEqual(capShared);
        }
      }
    }
    expect(aboveCount).toBe(1); // the quay cabling & commissioning bar (a 20.59 em label on a one-year bar)
  });
});

describe("v0.6.21 Task G(b) — the entry-unit switch joins the unsaved-changes key", () => {
  it("UNIT-DIRTY: switching the entry unit alone marks the document dirty (the guard stands on the next destructive action)", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    expect(document.querySelector('[data-testid="unsaved-guard"]')).toBeNull();
    setUnit("millions");
    fireEvent.click(byAction("new-project"));
    expect(document.querySelector('[data-testid="unsaved-guard"]')).toBeTruthy();
    fireEvent.click(byAction("guard-confirm"));
    expect((document.querySelector('[data-field="entryUnit"]') as HTMLSelectElement).value).toBe("thousands");
    expect(document.querySelector('[data-testid="unsaved-guard"]')).toBeNull();
  });

  it("UNIT-CLEAN-AFTER-SAVE: saving marks the unit switch clean (the key carries the unit)", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    setUnit("ones");
    fireEvent.click(document.querySelector('[data-testid="save-project"]') as HTMLElement);
    fireEvent.click(byAction("new-project"));
    expect(document.querySelector('[data-testid="unsaved-guard"]')).toBeNull();
  });
});
