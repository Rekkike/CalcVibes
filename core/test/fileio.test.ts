import { describe, expect, it } from "vitest";
import templateFile from "../../data/template-project.json";
import { computeModel } from "../src/engine.js";
import { EngineInputError } from "../src/validate.js";
import { parseProject, serializeProject, ProjectFileError } from "../src/fileio.js";
import type { ProjectFileSettings } from "../src/fileio.js";
import type { CostLine, ModelInputs } from "../src/types.js";

// The golden fromFile mapping, the template.golden.test.ts mapping of record.
function fromFile(file: typeof templateFile): ModelInputs {
  return {
    projectName: file.projectName,
    currency: (file as { settings?: { currency?: string } }).settings?.currency ?? (file as { currency?: string }).currency ?? "SEK",
    targetIrr: file.targetIrr,
    costs: file.costs.map((c) => ({ ...c, category: c.category as CostLine["category"] })),
    repayment: { ...file.repayment, firstCollectionYear: file.repayment.firstCollectionYear ?? null },
    appraisal: {
      wacc: file.appraisal.wacc,
      financeRate: file.appraisal.financeRate,
      reinvestmentRate: file.appraisal.reinvestmentRate,
      residual: { amount: file.appraisal.residual.amount, year: file.appraisal.residual.year },
    },
  };
}

const defaultSettings: ProjectFileSettings = { startYear: null, entryUnit: "thousands", scenarioTargets: null, scenarioTerms: null, scenarioBalloons: null };

// The multi-lease fixture of record (the web state.ts shape, replicated here so the core battery stands alone).
function multiLeaseFixture(): ModelInputs {
  return {
    projectName: "Multi-lease example",
    currency: "SEK",
    entryUnit: "ones",
    targetIrr: 8,
    costs: [
      { id: "c1", name: "Depreciable assets", category: "capex", amount: 20000000, startYear: 1, durationYears: 1, escalation: 0, depreciation: { mode: "straight-line", years: 33 } },
      { id: "c2", name: "Retained assets (land and buildings)", category: "capex", amount: 80000000, startYear: 1, durationYears: 1, escalation: 0, depreciation: { mode: "retained" } },
      { id: "c3", name: "Build (3-year program)", category: "recurring", amount: 5000000, startYear: 1, durationYears: 3, escalation: 0 },
    ],
    repayment: { graceYears: 0, termYears: 15, paymentsPerYear: 1, paymentEscalation: 0, balloon: 0 },
    contracts: [
      { id: "k1", label: "Contract one", startYear: 4, termYears: 15, paymentsPerYear: 1, graceYears: 0, escalationPerYear: 0, balloon: 0, mode: "solved", reinvestments: [{ year: 4, amount: 3000000 }] },
      { id: "k2", label: "Contract two", startYear: 19, termYears: 15, paymentsPerYear: 1, graceYears: 0, escalationPerYear: 0, balloon: 0, mode: "solved" },
      { id: "k3", label: "Lease three", startYear: 34, termYears: 20, paymentsPerYear: 1, graceYears: 0, escalationPerYear: 0, balloon: 0, mode: "solved" },
    ],
    appraisal: { wacc: 6, financeRate: 5, reinvestmentRate: 5, residual: { mode: "calculated", amount: 0, year: 54 } },
  } as ModelInputs;
}

function blankFixture(): ModelInputs {
  return {
    projectName: "",
    currency: "SEK",
    entryUnit: "thousands",
    targetIrr: 12,
    costs: [],
    repayment: { graceYears: 0, termYears: 7, paymentsPerYear: 1, paymentEscalation: 0, balloon: 0 },
  };
}

function validFileText(): string {
  const project = {
    projectName: "x",
    currency: "SEK",
    targetIrr: 10,
    costs: [],
    repayment: { graceYears: 0, termYears: 7, paymentsPerYear: 1, paymentEscalation: 0, balloon: 0 },
  };
  return serializeProject(project, defaultSettings);
}

describe("v0.6.3 project file format", () => {
  it("GOLDEN-ANCHOR: the golden four scalars on the template profile (the engine untouched)", () => {
    const r = computeModel(fromFile(templateFile));
    expect(r.costNpv).toBe(6632597.98343582);
    expect(r.paymentAmount).toBe(475309.1340746104);
    expect(r.paybackYears).toBe(6.959606064286818);
    expect(r.achievedIrr).toBe(0.120000000000001);
  });

  it("NO-DRIFT: the template profile through the file path computes the golden four scalars byte-identically", () => {
    const model = fromFile(templateFile);
    const back = parseProject(serializeProject(model, defaultSettings));
    expect(JSON.stringify(back.inputs)).toBe(JSON.stringify(model));
    const r = computeModel(back.inputs);
    expect(r.costNpv).toBe(6632597.98343582);
    expect(r.paymentAmount).toBe(475309.1340746104);
    expect(r.paybackYears).toBe(6.959606064286818);
    expect(r.achievedIrr).toBe(0.120000000000001);
  });

  it("RT-1: the template project round-trips with its settings, byte-identically", () => {
    const settings: ProjectFileSettings = { startYear: 2026, entryUnit: "ones", scenarioTargets: [8, 10, 12], scenarioTerms: [10, 15], scenarioBalloons: [0, 1000000] };
    const model = fromFile(templateFile);
    const text = serializeProject(model, settings);
    const back = parseProject(text);
    expect(JSON.stringify(back.inputs)).toBe(JSON.stringify(model));
    expect(JSON.stringify(back.settings)).toBe(JSON.stringify(settings));
    expect(serializeProject(back.inputs, back.settings)).toBe(text);
  });

  it("RT-2: the multi-lease fixture round-trips and computes identically", () => {
    const model = multiLeaseFixture();
    const text = serializeProject(model, defaultSettings);
    const back = parseProject(text);
    expect(JSON.stringify(back.inputs)).toBe(JSON.stringify(model));
    expect(JSON.stringify(back.settings)).toBe(JSON.stringify(defaultSettings));
    expect(serializeProject(back.inputs, back.settings)).toBe(text);
    const a = computeModel(model);
    const b = computeModel(back.inputs);
    expect(b.paymentAmount).toBe(a.paymentAmount);
    expect(b.paymentAmount).not.toBeNull();
  });

  it("BLANK-RT: the blank project round-trips", () => {
    const model = blankFixture();
    const text = serializeProject(model, defaultSettings);
    const back = parseProject(text);
    expect(JSON.stringify(back.inputs)).toBe(JSON.stringify(model));
    expect(serializeProject(back.inputs, back.settings)).toBe(text);
  });

  it("FILE-MALFORMED: invalid JSON and non-object payloads refuse with the named error", () => {
    expect(() => parseProject("{not json")).toThrowError(new ProjectFileError("FILE-MALFORMED: the file is not valid JSON and cannot be opened."));
    expect(() => parseProject("[]")).toThrowError(new ProjectFileError("FILE-MALFORMED: the file is not a project object and cannot be opened."));
  });

  it("FILE-KIND and FILE-VERSION: wrong kind and future versions refuse with the named errors", () => {
    const wrongKind = JSON.parse(validFileText());
    wrongKind.fileKind = "invest-export";
    expect(() => parseProject(JSON.stringify(wrongKind))).toThrowError(new ProjectFileError('FILE-KIND: the file declares kind "invest-export"; a CalcVibes project file declares "calcvibes-project".'));
    const wrongVersion = JSON.parse(validFileText());
    wrongVersion.fileVersion = 2;
    expect(() => parseProject(JSON.stringify(wrongVersion))).toThrowError(new ProjectFileError("FILE-VERSION: the file declares version 2; this application opens version 1 project files."));
  });

  it("FILE-PROJECT: the structural project guards refuse with the named errors", () => {
    const base = JSON.parse(validFileText());
    expect(() => parseProject(JSON.stringify({ fileKind: "calcvibes-project", fileVersion: 1, settings: base.settings }))).toThrowError(new ProjectFileError("FILE-PROJECT: the file carries no project object and cannot be opened."));
    const badCosts = JSON.parse(validFileText());
    badCosts.project.costs = "many";
    expect(() => parseProject(JSON.stringify(badCosts))).toThrowError(new ProjectFileError("FILE-PROJECT: the project's costs entry is not a list and cannot be opened."));
    const badContracts = JSON.parse(validFileText());
    badContracts.project.contracts = "several";
    expect(() => parseProject(JSON.stringify(badContracts))).toThrowError(new ProjectFileError("FILE-PROJECT: the project's contracts entry is not a list and cannot be opened."));
    const badRepayment = JSON.parse(validFileText());
    badRepayment.project.repayment = "later";
    expect(() => parseProject(JSON.stringify(badRepayment))).toThrowError(new ProjectFileError("FILE-PROJECT: the project's repayment entry is not an object and cannot be opened."));
    const badAppraisal = JSON.parse(validFileText());
    badAppraisal.project.appraisal = "later";
    expect(() => parseProject(JSON.stringify(badAppraisal))).toThrowError(new ProjectFileError("FILE-PROJECT: the project's appraisal entry is not an object and cannot be opened."));
  });

  it("FILE-SETTINGS: the settings guards refuse with the named errors", () => {
    const base = JSON.parse(validFileText());
    expect(() => parseProject(JSON.stringify({ fileKind: "calcvibes-project", fileVersion: 1, project: base.project }))).toThrowError(new ProjectFileError("FILE-SETTINGS: the file carries no settings object and cannot be opened."));
    const badYear = JSON.parse(validFileText());
    badYear.settings.startYear = 1800;
    expect(() => parseProject(JSON.stringify(badYear))).toThrowError(new ProjectFileError("FILE-SETTINGS: the start year is 1800; it must be null or a whole year between 1900 and 2200."));
    const badUnit = JSON.parse(validFileText());
    badUnit.settings.entryUnit = "myriads";
    expect(() => parseProject(JSON.stringify(badUnit))).toThrowError(new ProjectFileError('FILE-SETTINGS: the entry unit "myriads" is not one of ones, thousands, millions.'));
    const badTargets = JSON.parse(validFileText());
    badTargets.settings.scenarioTargets = "high";
    expect(() => parseProject(JSON.stringify(badTargets))).toThrowError(new ProjectFileError('FILE-SETTINGS: the "scenarioTargets" entry must be a list of numbers or null, not string.'));
    const badTerms = JSON.parse(validFileText());
    badTerms.settings.scenarioTerms = [10, "fifteen"];
    expect(() => parseProject(JSON.stringify(badTerms))).toThrowError(new ProjectFileError('FILE-SETTINGS: the "scenarioTerms" entry contains a value that is not a finite number.'));
  });

  it("TEMPLATE-ASSET-KIND: the template demo asset is not a project file and refuses by kind", () => {
    expect(() => parseProject(JSON.stringify(templateFile))).toThrowError(new ProjectFileError('FILE-KIND: the file declares kind "undefined"; a CalcVibes project file declares "calcvibes-project".'));
  });

  it("LOAD-INVALID: a well-formed but semantically invalid model parses; the engine refuses it (the always-valid-editor seam)", () => {
    const invalid = JSON.parse(validFileText());
    invalid.project.repayment.paymentsPerYear = 3;
    const back = parseProject(JSON.stringify(invalid));
    expect(back.inputs.repayment.paymentsPerYear).toBe(3);
    expect(() => computeModel(back.inputs)).toThrowError(EngineInputError);
  });
});
