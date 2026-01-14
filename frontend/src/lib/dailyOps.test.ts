import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDateRange } from "./dailyOps";

describe("buildDateRange", () => {
  it("returns empty strings when no date is provided", () => {
    assert.deepStrictEqual(buildDateRange(), { from: "", to: "" });
  });

  it("builds a full day range for valid dates", () => {
    const result = buildDateRange("2025-01-02");
    assert.equal(result.from, "2025-01-02T00:00:00.000Z");
    assert.equal(result.to, "2025-01-02T23:59:59.999Z");
  });

  it("returns empty for invalid dates", () => {
    assert.deepStrictEqual(buildDateRange("invalid-date"), { from: "", to: "" });
  });
});


