import { describe, expect, it } from "vitest";
import { familyMedicinePreferenceAddition } from "../../src/lib/family-medicine-personalization";
const family = "aile-hekimligi";
const available = [family, "kardiyoloji", "dahiliye"];
describe("explicit family medicine branch opt-in", () => {
  it("preserves the implicit own-specialty fallback", () => {
    expect(familyMedicinePreferenceAddition([], "kardiyoloji", available)).toEqual({ status: "added", branches: ["kardiyoloji", family] });
  });
  it("adds only family medicine when no own branch is known", () => {
    expect(familyMedicinePreferenceAddition([], null, available)).toEqual({ status: "added", branches: [family] });
    expect(familyMedicinePreferenceAddition([], "unknown", available)).toEqual({ status: "added", branches: [family] });
  });
  it("preserves explicit choices and their order without adding the own specialty", () => {
    expect(familyMedicinePreferenceAddition(["dahiliye"], "kardiyoloji", available)).toEqual({ status: "added", branches: ["dahiliye", family] });
  });
  it("does not materialize an already effective family specialty", () => {
    expect(familyMedicinePreferenceAddition([], family, available)).toEqual({ status: "already-included", branches: [] });
    expect(familyMedicinePreferenceAddition([family, "kardiyoloji"], null, available)).toEqual({ status: "already-included", branches: [family, "kardiyoloji"] });
  });
  it("refuses a full list rather than silently dropping a preference", () => {
    const selected = Array.from({ length: 30 }, (_, index) => `branch-${index}`);
    expect(familyMedicinePreferenceAddition(selected, null, [...selected, family])).toEqual({ status: "limit", branches: selected });
  });
  it("allows a thirtieth branch and tolerates family already present at capacity", () => {
    const selected = Array.from({ length: 29 }, (_, index) => `branch-${index}`);
    expect(familyMedicinePreferenceAddition(selected, null, [...selected, family]).branches).toHaveLength(30);
    expect(familyMedicinePreferenceAddition([...selected, family], null, [...selected, family]).status).toBe("already-included");
  });
  it("deduplicates without mutating input arrays", () => {
    const selected = Object.freeze(["dahiliye", "dahiliye", "kardiyoloji"]);
    const choices = Object.freeze([...available]);
    expect(familyMedicinePreferenceAddition(selected, null, choices)).toEqual({ status: "added", branches: ["dahiliye", "kardiyoloji", family] });
    expect(selected).toEqual(["dahiliye", "dahiliye", "kardiyoloji"]);
  });
  it("fails safely when the target branch is not available", () => {
    expect(familyMedicinePreferenceAddition(["kardiyoloji"], null, ["kardiyoloji"])).toEqual({ status: "unavailable", branches: ["kardiyoloji"] });
  });
});
