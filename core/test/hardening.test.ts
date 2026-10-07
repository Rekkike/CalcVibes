import { describe, expect, it } from "vitest";
import { assertTemplateIdentity } from "./_shared.js";

describe("CP-7 core hardening: inline copy identity", () => {
  it("the inline template copy is JSON-identical to the canonical template file", () => {
    expect(() => assertTemplateIdentity()).not.toThrow();
  });
});
