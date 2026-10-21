// v0.6.13.3 Task E: the language rectification. The timeline surfaces are English-only, carry no
// reference to an external project-management methodology, and name their decision points DP1-DP8.
// The expectation pins the titles, the disclosure and the outcome labels; the static sweep keeps the
// retired tokens out of web/src.
import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { DECISION_DISCLOSURE, DECISION_POINT_SET, DECISION_SCALE_CODES, landNewbuildProject, nextUnusedDecisionPoint, shorePowerProgram } from "../src/state.js";
import type { TimelineBlock } from "../../core/src/types.js";

const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : /\.(ts|tsx|css|html)$/.test(e.name) ? [path.join(dir, e.name)] : []));
const sources = (): { file: string; text: string }[] => walk("src").map((file) => ({ file, text: fs.readFileSync(file, "utf8") }));
const hits = (re: RegExp) => sources().flatMap(({ file, text }) => text.split(/\r?\n/).map((line, i) => ({ file, line: i + 1, text: line })).filter((l) => re.test(l.text)));

const TITLES: [string, string][] = [
  ["DP1", "Decision to start the project and initiate preparations"],
  ["DP2", "Decision to continue, abort, or redo preparation work"],
  ["DP3", "Decision that the basis is sufficient to commit to the remaining part of the project"],
  ["DP4", "Decision to start execution"],
  ["DP5", "Decision to continue or change the project commitment"],
  ["DP6", "Decision to approve delivery of the project's partial or final results"],
  ["DP7", "Decision to approve handover of responsibility for the project's results to operations"],
  ["DP8", "Decision to close the project"],
];

describe("v0.6.13.3 Task A: the decision-point vocabulary of record", () => {
  it("TITLES: the eight entries carry the DP codes and the English titles of record", () => {
    expect(DECISION_POINT_SET.map((d) => [d.code, d.title])).toEqual(TITLES);
  });

  it("SCALES: full is DP1-DP8; mini is DP1, DP3, DP4, DP8; every scale code is in the set", () => {
    expect(DECISION_SCALE_CODES.full).toEqual(["DP1", "DP2", "DP3", "DP4", "DP5", "DP6", "DP7", "DP8"]);
    expect(DECISION_SCALE_CODES.mini).toEqual(["DP1", "DP3", "DP4", "DP8"]);
    for (const c of [...DECISION_SCALE_CODES.full, ...DECISION_SCALE_CODES.mini]) expect(DECISION_POINT_SET.some((d) => d.code === c)).toBe(true);
  });

  it("DISCLOSURE: English-only, names the decision-point scale, implements and certifies no external methodology", () => {
    expect(DECISION_DISCLOSURE).toBe("The decision points follow the DP1–DP8 decision-point scale; this application does not implement or certify any external project-management methodology.");
  });

  it("NEXT-UNUSED: an added gate takes the next unused DP of the scale", () => {
    const block = (over: Partial<TimelineBlock> = {}): TimelineBlock => ({ activities: [], decisionPoints: [], milestones: [], ...over });
    expect(nextUnusedDecisionPoint(block())?.code).toBe("DP1");
    expect(nextUnusedDecisionPoint(block({ projectScale: "mini", decisionPoints: [{ id: "d1", title: "x", year: 1, code: "DP1" }] }))?.code).toBe("DP3");
  });
});

describe("v0.6.13.3 Task D: the demo gate entries", () => {
  it("FIXTURE-GATES: both demos seed DP1-DP8 with the English titles of record", () => {
    for (const make of [shorePowerProgram, landNewbuildProject]) {
      const gates = make().timeline!.decisionPoints;
      expect(gates.map((d) => d.id)).toEqual(["d1", "d2", "d3", "d4", "d5", "d6", "d7", "d8"]);
      expect(gates.map((d) => [d.code, d.title])).toEqual(TITLES);
    }
  });
});

describe("v0.6.13.3 Task E: the static sweep of web/src", () => {
  it("SWEEP-PPS: zero occurrences of the token PPS in any case", () => {
    expect(hits(/pps/i)).toEqual([]);
  });

  it("SWEEP-BP: zero occurrences of the BP code pattern BP1-BP8", () => {
    expect(hits(/\bBP[1-8]\b/)).toEqual([]);
    expect(hits(/BP[1-8]/)).toEqual([]);
  });

  it("SWEEP-SWEDISH: zero occurrences of the Swedish glosses and the seeded Swedish titles", () => {
    expect(hits(/fortsätta|förändra|lägga ner|beslutspunkter|Beslut om|Beslut att|Praktisk Projektstyrning|förberedel|projektåtagandet/i)).toEqual([]);
  });
});
