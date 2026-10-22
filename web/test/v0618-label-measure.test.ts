// v0.6.18 Task H3 (the builder proposal, applied): the bar-label placement measures its labels (Helvetica advance
// widths, in em) against the plot's width in em, instead of counting characters against a conservative budget. The
// layout stays composed once: no surface parameter, one figure that fits the tighter surface.
import { describe, expect, it } from "vitest";
import { jsPDF } from "jspdf";
import { computeModel } from "../src/engine.js";
import { deckSlides } from "../src/deck.js";
import { GANTT_PLOT_EM, ganttWindow, labelEm, layoutLane, wrapLabelEm } from "../src/ganttLayout.js";
import { GANTT_SVG } from "../src/charts.js";
import { GANTT_PDF } from "../src/pdf.js";
import { shorePowerProgram } from "../src/state.js";

const LABELS = [
  "Container pillar: engineering & studies (RSP JV)", "Cruise terminal shore power", "Inland & public berths", "Interior & hotel fit-out",
  "Site acquisition and prestudy (lakeside plot)", "WWWWWWWW activity label number 4 MMMMMMMMMMMM", "iiiiiiiiiiiiiiiiiiiiiiiiiiiiii", "Handover, lease commencement and operations start",
  "Turnkey construction (18-storey timber tower)", "O&M and monitoring", "Debt facility", "Förberedelser och tillstånd – etapp 1", "FIRST COLLECTION YEAR: THE LEASES BEGIN", "1234567890 1234567890",
];

describe("v0.6.18 H3: the measure", () => {
  it("ADVANCE-WIDTHS: the em measure matches the real Helvetica widths within 3 percent (the metrics of the SVG and the print route)", () => {
    const doc = new jsPDF({ unit: "mm" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(100);
    const real = (s: string) => (doc.getTextWidth(s) * 72) / 25.4 / 100;
    for (const s of LABELS) expect(Math.abs(labelEm(s) - real(s)) / real(s), s).toBeLessThan(0.03);
  });

  it("TIGHTER-SURFACE: the shared plot figure does not exceed either surface's real plot in em (the SVG's 840 px at 11 px; the print plot at 6 pt)", () => {
    expect(GANTT_PLOT_EM).toBeLessThanOrEqual(GANTT_SVG.plotW / 11);
    expect(GANTT_PLOT_EM).toBeLessThanOrEqual(GANTT_PDF.plotW / ((6 * 25.4) / 72));
    // the recalibration keeps close to the tighter surface (not the retired 110-character guess)
    expect(GANTT_PLOT_EM).toBeGreaterThan(GANTT_SVG.plotW / 11 - 1);
  });

  it("FITS: a label placed inside its bar fits it on both surfaces by the REAL widths; a label placed above does not fit its bar", () => {
    const doc = new jsPDF({ unit: "mm" });
    doc.setFont("helvetica", "normal");
    for (const yearsInWindow of [3, 6, 12, 23]) {
      const win = ganttWindow([{ startYear: 1, endYear: yearsInWindow }], yearsInWindow);
      for (const span of [1, 2, 3, Math.max(1, yearsInWindow - 1)]) {
        const bars = LABELS.map((label, i) => ({ id: "a" + i, label, startYear: 1, endYear: Math.min(yearsInWindow, span) }));
        const lane = layoutLane(bars, win);
        for (const b of lane.bars) {
          const barPx = ((b.right - b.left) * GANTT_SVG.plotW) / win.years - 2 * GANTT_SVG.barInset;
          const barMm = ((b.right - b.left) * GANTT_PDF.plotW) / win.years - 0.6;
          doc.setFontSize(11);
          const px = (doc.getTextWidth(b.label) * 72) / 25.4;
          doc.setFontSize(6);
          const mm = doc.getTextWidth(b.label);
          if (b.labelMode === "inside") {
            expect(px + 10, `${b.label} @${yearsInWindow}/${span}`).toBeLessThanOrEqual(barPx);
            expect(mm + 2).toBeLessThanOrEqual(barMm);
          } else {
            expect(px + 10, `${b.label} above @${yearsInWindow}/${span}`).toBeGreaterThan(barPx * 0.9);
          }
        }
      }
    }
  });

  it("MORE-INSIDE: the measured placement keeps more labels inside their bars than the retired character budget did (the shore-power prestudy label)", () => {
    const inp = shorePowerProgram();
    const g = deckSlides(inp, computeModel(inp), { startYear: null }).slides.find((s) => s.name === "timeline")!.gantt!;
    const a1 = g.lanes.flatMap((l) => l.bars).find((b) => b.id === "a1")!;
    // 48 characters in a 2-year bar of a 5-year window: the old budget (110 characters, 2 year-columns = 44) put it above
    expect(a1.label.length).toBe(48);
    expect(a1.labelMode).toBe("inside");
  });

  it("WRAP: wrapLabelEm never loses a character, keeps every line within the measure and splits an over-wide word", () => {
    const long = "Container pillar: engineering & studies (RSP JV) with an extraordinarilylongunbrokenwordthatexceedsthelinebudgetbymuch";
    const lines = wrapLabelEm(long, 20);
    expect(lines.every((l) => l.length === 1 || labelEm(l) <= 20)).toBe(true);
    expect(lines.join(" ").replace(/\s+/g, "")).toBe(long.replace(/\s+/g, ""));
    expect(wrapLabelEm("", 20)).toEqual([""]);
  });

  it("ONE-SOURCE: the layout takes no surface parameter — the same composed lanes feed the SVG and the print route", () => {
    expect(layoutLane.length).toBe(2);
    expect(wrapLabelEm.length).toBe(2);
  });
});
