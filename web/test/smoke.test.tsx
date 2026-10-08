import { describe, expect, it } from "vitest";
import { computeModel } from "../src/engine.js";
import { demoProject } from "../src/state.js";

describe("smoke: UI consumes the identical engine", () => {
  it("baseline model through the UI import path pins paymentAmount 475,309.13407 within 0.01", () => {
    const result = computeModel(demoProject());
    expect(Math.abs((result.paymentAmount as number) - 475309.13407)).toBeLessThan(0.01);
  });
});
