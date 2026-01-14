import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { currentMonthRange } from "./cashLoans";

describe("currentMonthRange", () => {
  it("returns start and end within the same month", () => {
    const fixed = new Date("2026-01-12T10:20:30.000Z");
    const range = currentMonthRange(fixed);
    assert.equal(range.startDate, "2026-01-01");
    assert.equal(range.endDate, "2026-01-12");
    assert.ok(range.from.startsWith("2026-01-01"));
    assert.ok(range.to.startsWith("2026-01-12"));
  });
});

