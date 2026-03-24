import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { RECRUITMENT_IMPORT_COLUMN_KEYS } from "./recruitmentImportColumns";

describe("RECRUITMENT_IMPORT_COLUMN_KEYS", () => {
  it("includes passport_image_url and has stable length", () => {
    assert.ok(RECRUITMENT_IMPORT_COLUMN_KEYS.includes("passport_image_url"));
    assert.equal(RECRUITMENT_IMPORT_COLUMN_KEYS.length, 16);
  });
});
