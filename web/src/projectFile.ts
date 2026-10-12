// The web save/load helpers of record (directive v0.6.3). The save path serializes
// the live editor state through the core file format and hands the browser a
// download; the naming convention is the slugified project name.
import { serializeProject } from "../../core/src/fileio.js";
import type { ProjectFileSettings } from "../../core/src/fileio.js";
import type { ModelInputs } from "../../core/src/types.js";

export function projectFileName(projectName: string): string {
  const slug = projectName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return (slug === "" ? "project" : slug) + ".calcvibes.json";
}

export function downloadProjectFile(inputs: ModelInputs, settings: ProjectFileSettings): void {
  const text = serializeProject(inputs, settings);
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = projectFileName(inputs.projectName);
  a.click();
  URL.revokeObjectURL(url);
}
