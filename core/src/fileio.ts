// The project file format of record (directive v0.6.3). The file IS the engine schema:
// a UTF-8 JSON document { fileKind, fileVersion, project, settings }, deterministic
// (no timestamps), with named refusals under the collect-all contract. Engine-blind.
import type { ModelInputs } from "./types.js";

export const FILE_KIND = "calcvibes-project";
export const FILE_VERSION = 1;

export type FileEntryUnit = "ones" | "thousands" | "millions";
const ENTRY_UNIT_VALUES: FileEntryUnit[] = ["ones", "thousands", "millions"];

export interface ProjectFileSettings {
  startYear: number | null;
  entryUnit: FileEntryUnit;
  scenarioTargets: number[] | null;
  scenarioTerms: number[] | null;
  scenarioBalloons: number[] | null;
  // v0.6.10 Task G.6: the settings' grant-scale list rides the file additively; FILE_VERSION
  // stays 1 (absent parses as the empty behavior — null).
  scenarioGrantScales?: number[] | null;
}

export class ProjectFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectFileError";
  }
}

export function serializeProject(inputs: ModelInputs, settings: ProjectFileSettings): string {
  const file = {
    fileKind: FILE_KIND,
    fileVersion: FILE_VERSION,
    project: inputs,
    settings,
  };
  return JSON.stringify(file, null, 2) + "\n";
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function readNumberList(v: unknown, field: string): number[] | null {
  if (v === null || undefined === v) return null;
  if (!Array.isArray(v)) throw new ProjectFileError(`FILE-SETTINGS: the "${field}" entry must be a list of numbers or null, not ${typeof v}.`);
  for (const item of v) {
    if (typeof item !== "number" || !Number.isFinite(item)) {
      throw new ProjectFileError(`FILE-SETTINGS: the "${field}" entry contains a value that is not a finite number.`);
    }
  }
  return v as number[];
}

function readSettings(v: unknown): ProjectFileSettings {
  if (!isPlainObject(v)) {
    throw new ProjectFileError("FILE-SETTINGS: the file carries no settings object and cannot be opened.");
  }
  const startYear = v.startYear;
  if (startYear !== null && (typeof startYear !== "number" || !Number.isInteger(startYear) || startYear < 1900 || startYear > 2200)) {
    throw new ProjectFileError(`FILE-SETTINGS: the start year is ${String(startYear)}; it must be null or a whole year between 1900 and 2200.`);
  }
  const entryUnit = v.entryUnit;
  if (typeof entryUnit !== "string" || !(ENTRY_UNIT_VALUES as string[]).includes(entryUnit)) {
    throw new ProjectFileError(`FILE-SETTINGS: the entry unit "${String(entryUnit)}" is not one of ones, thousands, millions.`);
  }
  return {
    startYear: (startYear as number | null),
    entryUnit: entryUnit as FileEntryUnit,
    scenarioTargets: readNumberList(v.scenarioTargets, "scenarioTargets"),
    scenarioTerms: readNumberList(v.scenarioTerms, "scenarioTerms"),
    scenarioBalloons: readNumberList(v.scenarioBalloons, "scenarioBalloons"),
    scenarioGrantScales: readNumberList(v.scenarioGrantScales, "scenarioGrantScales"),
  };
}

export function parseProject(text: string): { inputs: ModelInputs; settings: ProjectFileSettings } {
  let file: unknown;
  try {
    file = JSON.parse(text);
  } catch {
    throw new ProjectFileError("FILE-MALFORMED: the file is not valid JSON and cannot be opened.");
  }
  if (!isPlainObject(file)) {
    throw new ProjectFileError("FILE-MALFORMED: the file is not a project object and cannot be opened.");
  }
  const record = file as Record<string, unknown>;
  if (record.fileKind !== FILE_KIND) {
    throw new ProjectFileError(`FILE-KIND: the file declares kind "${String(record.fileKind)}"; a CalcVibes project file declares "${FILE_KIND}".`);
  }
  if (record.fileVersion !== FILE_VERSION) {
    throw new ProjectFileError(`FILE-VERSION: the file declares version ${String(record.fileVersion)}; this application opens version ${FILE_VERSION} project files.`);
  }
  if (!isPlainObject(record.project)) {
    throw new ProjectFileError("FILE-PROJECT: the file carries no project object and cannot be opened.");
  }
  const project = record.project as Record<string, unknown>;
  if (project.costs !== undefined && !Array.isArray(project.costs)) {
    throw new ProjectFileError("FILE-PROJECT: the project's costs entry is not a list and cannot be opened.");
  }
  if (project.contracts !== undefined && !Array.isArray(project.contracts)) {
    throw new ProjectFileError("FILE-PROJECT: the project's contracts entry is not a list and cannot be opened.");
  }
  if (project.repayment !== undefined && !isPlainObject(project.repayment)) {
    throw new ProjectFileError("FILE-PROJECT: the project's repayment entry is not an object and cannot be opened.");
  }
  if (project.appraisal !== undefined && !isPlainObject(project.appraisal)) {
    throw new ProjectFileError("FILE-PROJECT: the project's appraisal entry is not an object and cannot be opened.");
  }
  const settings = readSettings(record.settings);
  return { inputs: project as unknown as ModelInputs, settings };
}
