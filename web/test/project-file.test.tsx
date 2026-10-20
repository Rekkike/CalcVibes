import { describe, expect, it } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import { App } from "../src/App.js";
import { projectFileName } from "../src/projectFile.js";
import { parseProject, serializeProject } from "../../core/src/fileio.js";
import { demoProject, shorePowerProgram } from "../src/state.js";

const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;
const byNav = (v: string) => document.querySelector('[data-nav="' + v + '"]') as HTMLElement;
const byTest = (v: string) => document.querySelector('[data-testid="' + v + '"]');
const fileInput = () => document.querySelector('[data-testid="open-project-input"]') as HTMLInputElement;

describe("v0.6.3 project file save/load", () => {
  it("APP-CHROME: the header carries Open project and Save project; save stays enabled on the blank project and on an invalid model", () => {
    render(<App />);
    expect(byTest("open-project")).toBeTruthy();
    const save = byTest("save-project") as HTMLButtonElement;
    expect(save).toBeTruthy();
    expect(save.disabled).toBe(false);
    // an invalid in-progress model (an emptied cost line name) must still be savable
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("costs"));
    fireEvent.change(document.querySelector('[data-line="p1"] [data-field="name"]') as HTMLInputElement, { target: { value: "" } });
    expect((byTest("save-project") as HTMLButtonElement).disabled).toBe(false);
  });

  it("OPEN-LOAD / SETTINGS-RESTORE: opening a project file loads the model and restores the start year, entry unit, and scenario lists", async () => {
    render(<App />);
    const settings = { startYear: 2026, entryUnit: "ones" as const, scenarioTargets: [8, 10, 12], scenarioTerms: [10, 15], scenarioBalloons: [0, 1000000] };
    const text = serializeProject(demoProject(), settings);
    fireEvent.change(fileInput(), { target: { files: [new File([text], "project-alpha.calcvibes.json", { type: "application/json" })] } });
    await waitFor(() => {
      expect((document.querySelector('[data-field="projectName"]') as HTMLInputElement).value).toBe("Project Alpha");
    });
    expect((document.querySelector('[data-field="startYear"]') as HTMLInputElement).value).toBe("2026");
    expect((document.querySelector('[data-field="entryUnit"]') as HTMLSelectElement).value).toBe("ones");
    fireEvent.click(byNav("scenarios"));
    const targets = Array.from(document.querySelectorAll('[data-field="scenario-target"]')) as HTMLInputElement[];
    expect(targets.map((el) => el.value)).toEqual(["8", "10", "12"]);
    const terms = Array.from(document.querySelectorAll('[data-field="scenario-term"]')) as HTMLInputElement[];
    expect(terms.map((el) => el.value)).toEqual(["10", "15"]);
    const balloons = Array.from(document.querySelectorAll('[data-field="scenario-balloon"]')) as HTMLInputElement[];
    expect(balloons.map((el) => el.value)).toEqual(["0", "1000000"]);
    expect(byTest("load-error")).toBeNull();
  });

  it("LOAD-ERR / NO-DEFAULT-DEMO: a malformed file surfaces the banner with the exact message and leaves the current project untouched (v0.6.10 re-anchor: the current project is the program demo)", async () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.change(fileInput(), { target: { files: [new File(["{not json"], "broken.calcvibes.json")] } });
    await waitFor(() => {
      expect(byTest("load-error")?.textContent).toBe("FILE-MALFORMED: the file is not valid JSON and cannot be opened.");
    });
    expect((document.querySelector('[data-field="projectName"]') as HTMLInputElement).value).toBe("Shore-power program (Rotterdam)");
    // the template demo asset is not a project file: the kind refusal surfaces too
    fireEvent.change(fileInput(), { target: { files: [new File([JSON.stringify({ schemaVersion: 8 })], "template-project.json")] } });
    await waitFor(() => {
      expect(byTest("load-error")?.textContent).toBe('FILE-KIND: the file declares kind "undefined"; a CalcVibes project file declares "calcvibes-project".');
    });
    expect((document.querySelector('[data-field="projectName"]') as HTMLInputElement).value).toBe("Shore-power program (Rotterdam)");
  });

  it("OPEN-INCOMPLETE (v0.6.12.1, AUD-1): a parseable but incomplete project file renders the refusal panel; the root is not blank and the current project is untouched", async () => {
    const { container } = render(<App />);
    fireEvent.click(byAction("load-demo"));
    const incomplete = JSON.stringify({ fileKind: "calcvibes-project", fileVersion: 1, project: { projectName: "x" }, settings: { startYear: null, entryUnit: "ones", scenarioTargets: null, scenarioTerms: null, scenarioBalloons: null } });
    fireEvent.change(fileInput(), { target: { files: [new File([incomplete], "incomplete.calcvibes.json", { type: "application/json" })] } });
    await waitFor(() => {
      expect(byTest("load-error")?.textContent).toBe("FILE-PROJECT: the project's costs entry is missing and the file cannot be opened.");
    });
    expect(container.innerHTML.length).toBeGreaterThan(0);
    expect(document.querySelector(".app-root")).toBeTruthy();
    expect((document.querySelector('[data-field="projectName"]') as HTMLInputElement).value).toBe("Shore-power program (Rotterdam)");
  });

  it("SAVE-NAME: the project file name is the slugified project name with the .calcvibes.json extension", () => {
    expect(projectFileName("Project Alpha")).toBe("project-alpha.calcvibes.json");
    expect(projectFileName("")).toBe("project.calcvibes.json");
    expect(projectFileName("Malmö Port 4!")).toBe("malm-port-4.calcvibes.json");
  });

  it("SAVE-STATE: clicking Save project serializes the live editor state through the file format (v0.6.10 re-anchor: the program demo; entry unit stays at the App default thousands, the loader does not sync it)", async () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    const captured: Blob[] = [];
    const origCreate = window.URL.createObjectURL;
    const origRevoke = window.URL.revokeObjectURL;
    window.URL.createObjectURL = ((b: Blob) => { captured.push(b); return "blob:mock"; }) as typeof URL.createObjectURL;
    window.URL.revokeObjectURL = (() => {}) as typeof URL.revokeObjectURL;
    try {
      fireEvent.click(byTest("save-project") as HTMLElement);
      expect(captured.length).toBe(1);
      const text = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsText(captured[0]);
      });
      const back = parseProject(text);
      expect(JSON.stringify(back.inputs)).toBe(JSON.stringify(shorePowerProgram()));
      expect(back.settings.entryUnit).toBe("thousands");
      expect(back.settings.startYear).toBe(2026); // the program loader presets the calendar start year
    } finally {
      window.URL.createObjectURL = origCreate;
      window.URL.revokeObjectURL = origRevoke;
    }
  });

  it("SAVE-OPEN ROUND-TRIP: a file saved by the app reopens into the same project (v0.6.7 re-anchor: the land demo; the slugifier strips ø and å as separators)", async () => {
    render(<App />);
    fireEvent.click(byAction("load-multi-lease-demo"));
    const captured: Blob[] = [];
    const origCreate = window.URL.createObjectURL;
    const origRevoke = window.URL.revokeObjectURL;
    window.URL.createObjectURL = ((b: Blob) => { captured.push(b); return "blob:mock"; }) as typeof URL.createObjectURL;
    window.URL.revokeObjectURL = (() => {}) as typeof URL.revokeObjectURL;
    try {
      fireEvent.click(byTest("save-project") as HTMLElement);
      const text = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsText(captured[0]);
      });
      fireEvent.click(byAction("new-project"));
      expect((document.querySelector('[data-field="projectName"]') as HTMLInputElement).value).toBe("");
      fireEvent.change(fileInput(), { target: { files: [new File([text], "mj-st-rnet-example.calcvibes.json")] } });
      await waitFor(() => {
        expect((document.querySelector('[data-field="projectName"]') as HTMLInputElement).value).toBe("Mjøstårnet example");
      });
    } finally {
      window.URL.createObjectURL = origCreate;
      window.URL.revokeObjectURL = origRevoke;
    }
  });
});

describe("v0.6.10 Task G.6: the funding block rides the project file additively", () => {
  it("FUNDING-ROUND-TRIP: serialize→parse→serialize on the program fixture is byte-identical and the parsed project computes the figures of record", async () => {
    const { computeModel } = await import("../src/engine.js");
    const settings = { startYear: 2026, entryUnit: "thousands" as const, scenarioTargets: [4, 6, 8], scenarioTerms: [15, 20, 25], scenarioBalloons: [0, 8, 16], scenarioGrantScales: [0, 0.5, 1] };
    const first = serializeProject(shorePowerProgram(), settings);
    const back = parseProject(first);
    const second = serializeProject(back.inputs, back.settings);
    expect(second).toBe(first); // the Task G.6 byte-identity pin
    // the funding block, the tariff spans, and the display labels survive the round trip
    expect(back.inputs.funding?.rows.length).toBe(4);
    expect(back.inputs.tariff?.span).toEqual({ startYear: 3, termYears: 20 });
    expect(back.inputs.tariff?.volumeUnitLabel).toBe("GWh");
    expect(back.inputs.tariff?.priceUnitLabel).toBe("€ct/kWh");
    expect(back.inputs.tariff?.priceDisplayDivisor).toBe(10000);
    expect(back.settings.scenarioGrantScales).toEqual([0, 0.5, 1]);
    // the parsed project computes identically to the fixture (equality, not tolerance)
    const direct = computeModel(shorePowerProgram());
    const r = computeModel(back.inputs);
    expect(r.paymentAmount).toBe(direct.paymentAmount);
    expect(r.totalCost).toBe(direct.totalCost);
    expect(r.totalCollected).toBe(direct.totalCollected);
    expect(r.achievedIrr).toBe(direct.achievedIrr);
    expect(r.fundingView?.grantsTotal).toBe(direct.fundingView?.grantsTotal);
    expect(r.fundingView?.fundingNpv).toBe(direct.fundingView?.fundingNpv);
    // the verified pins of record
    expect(r.paymentAmount).toBe(2843365.6055825967);
    expect(r.fundingView?.grantsTotal).toBe(173500000);
    expect(r.fundingView?.fundingNpv).toBe(140055345.14230645);
  });

  it("FILE-V1-ADDITIVE: a version-1 file without the new fields parses with the empty behavior and computes identically to today", async () => {
    const { computeModel } = await import("../src/engine.js");
    // a pre-v0.6.10 shape: the program project with the funding block, the tariff spans,
    // and the display labels removed, and settings without the grant-scale list.
    const stripped = JSON.parse(JSON.stringify(shorePowerProgram())) as typeof shorePowerProgram extends () => infer I ? I : never;
    const s = stripped as unknown as { funding?: unknown; tariff?: Record<string, unknown> & { rows?: Array<Record<string, unknown>> } };
    delete s.funding;
    if (s.tariff) {
      delete s.tariff.span;
      delete s.tariff.volumeUnitLabel;
      delete s.tariff.priceUnitLabel;
      delete s.tariff.priceDisplayDivisor;
      if (Array.isArray(s.tariff.rows)) {
        for (const row of s.tariff.rows) delete row.span;
      }
    }
    const file = serializeProject(stripped as never, { startYear: null, entryUnit: "thousands", scenarioTargets: null, scenarioTerms: null, scenarioBalloons: null });
    expect(JSON.parse(file).fileVersion).toBe(1); // FILE_VERSION stays 1
    const back = parseProject(file); // absence parses (additive optional fields)
    expect(back.settings.scenarioGrantScales ?? null).toBeNull(); // absent = the empty behavior
    expect(back.inputs.funding ?? null).toBeNull();
    expect(back.inputs.tariff?.span ?? null).toBeNull();
    // the parsed project computes identically to the same project computed directly today
    const r = computeModel(back.inputs);
    const direct = computeModel(JSON.parse(JSON.stringify(stripped)) as never);
    expect(r.paymentAmount).toBe(direct.paymentAmount);
    expect(r.totalCollected).toBe(direct.totalCollected);
    expect(r.achievedIrr).toBe(direct.achievedIrr);
    expect(r.fundingView ?? null).toBeNull(); // the empty behavior: no funding view
  });
});
