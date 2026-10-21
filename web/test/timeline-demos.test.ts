// v0.6.13.1 Task B: the demo-authored timelines. Both demo fixtures carry a full-scale (DP1-DP8)
// authored timeline that is refusal-free against the fixture's own solved model, whose milestone
// ties agree with the engine events, and which composes the Gantt slide into the deck.
import { describe, expect, it } from "vitest";
import { computeModel } from "../src/engine.js";
import { deckSlides } from "../src/deck.js";
import { DECISION_POINT_SET, availableEngineEvents, demoProject, landNewbuildProject, shorePowerProgram, timelineAuthored, validateTimeline } from "../src/state.js";
import type { ModelInputs } from "../../core/src/types.js";

const demos: [string, () => ModelInputs][] = [
  ["landNewbuildProject", landNewbuildProject],
  ["shorePowerProgram", shorePowerProgram],
];

describe("v0.6.13.1 Task B: the demo-authored timelines", () => {
  for (const [name, make] of demos) {
    it(`${name}: full scale, DP1-DP8 once each in order, refusal-free, ties agree with the engine events`, () => {
      const inputs = make();
      const result = computeModel(inputs);
      const tl = inputs.timeline!;
      expect(timelineAuthored(inputs)).toBe(true);
      expect(tl.projectScale).toBe("full");
      expect(tl.decisionPoints.map((d) => d.code)).toEqual(DECISION_POINT_SET.map((b) => b.code));
      const years = tl.decisionPoints.map((d) => d.year);
      expect([...years].sort((a, b) => a - b)).toEqual(years);
      expect(new Set(tl.activities.map((a) => a.phase)).size).toBeGreaterThanOrEqual(2);
      expect(validateTimeline(inputs, result)).toEqual([]);
      const events = availableEngineEvents(inputs, result);
      for (const m of tl.milestones) {
        if (m.tie?.kind === "engine-event") {
          const e = m.tie.event;
          expect(events.find((x) => x.event === e)?.year).toBe(m.year);
        }
        if (m.tie?.kind === "activity") {
          const id = m.tie.activityId;
          expect(tl.activities.find((a) => a.id === id)?.endYear).toBe(m.year);
        }
      }
    });

    it(`${name}: the Gantt slide composes into the deck and the golden template still carries none`, () => {
      const inputs = make();
      const deck = deckSlides(inputs, computeModel(inputs), { startYear: null, entryUnit: "ones" });
      expect(deck.slides.map((s) => s.name)).toContain("timeline");
      const golden = demoProject();
      expect(golden.timeline).toBeUndefined();
      expect(deckSlides(golden, computeModel(golden), { startYear: null, entryUnit: "ones" }).slides.map((s) => s.name)).not.toContain("timeline");
    });
  }
});
