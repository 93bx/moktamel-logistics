import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildFullName, buildInitials } from "./profile";

describe("profile helpers", () => {
  it("builds a normalized full name", () => {
    assert.equal(buildFullName("John", "Doe"), "John Doe");
    assert.equal(buildFullName("John", ""), "John");
  });

  it("builds uppercase initials with fallback", () => {
    assert.equal(buildInitials("john", "doe"), "JD");
    assert.equal(buildInitials("", ""), "U");
  });
});
