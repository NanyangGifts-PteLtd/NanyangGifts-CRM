import { describe, expect, it } from "vitest";
import { toNullableDateValue } from "./date-values";

describe("toNullableDateValue", () => {
  it("persists a cleared date input as null", () => {
    expect(toNullableDateValue("")).toBeNull();
    expect(toNullableDateValue("   ")).toBeNull();
  });

  it("preserves a selected date", () => {
    expect(toNullableDateValue("2026-11-03")).toBe("2026-11-03");
  });
});
