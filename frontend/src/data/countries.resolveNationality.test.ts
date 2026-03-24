import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveNationalityToStoredName } from "./countries";

describe("resolveNationalityToStoredName", () => {
  it("maps ISO code to English name", () => {
    assert.equal(resolveNationalityToStoredName("SA"), "Saudi Arabia");
    assert.equal(resolveNationalityToStoredName("sa"), "Saudi Arabia");
  });

  it("passes through English name", () => {
    assert.equal(resolveNationalityToStoredName("Saudi Arabia"), "Saudi Arabia");
  });

  it("returns empty for null/blank", () => {
    assert.equal(resolveNationalityToStoredName(null), "");
    assert.equal(resolveNationalityToStoredName("   "), "");
  });
});
