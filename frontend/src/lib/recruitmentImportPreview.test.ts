import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  importImageThumbnailSrc,
  isImportDateColumn,
  isUuidLike,
  statusSelectModel,
  toDateInputValue,
} from "./recruitmentImportPreview";

describe("recruitmentImportPreview", () => {
  it("toDateInputValue extracts YYYY-MM-DD", () => {
    assert.equal(toDateInputValue("2026-03-24"), "2026-03-24");
    assert.equal(toDateInputValue("2026-03-24T00:00:00.000Z"), "2026-03-24");
    assert.equal(toDateInputValue(""), "");
  });

  it("statusSelectModel maps raw status", () => {
    assert.equal(statusSelectModel(""), "UNDER_PROCEDURE");
    assert.equal(statusSelectModel("UNDER_PROCEDURE"), "UNDER_PROCEDURE");
    assert.equal(statusSelectModel("draft"), "DRAFT");
  });

  it("isImportDateColumn", () => {
    assert.equal(isImportDateColumn("passport_expiry_at"), true);
    assert.equal(isImportDateColumn("full_name_ar"), false);
  });

  it("isUuidLike", () => {
    assert.equal(
      isUuidLike("00000000-0000-4000-8000-000000000001"),
      true,
    );
    assert.equal(isUuidLike("not-a-uuid"), false);
  });

  it("importImageThumbnailSrc prefers resolved file id", () => {
    assert.equal(
      importImageThumbnailSrc("aaa", "https://example.com/x.png"),
      "/api/files/aaa/view",
    );
  });

  it("importImageThumbnailSrc uses HTTPS cell", () => {
    assert.equal(
      importImageThumbnailSrc(null, "https://example.com/x.png"),
      "https://example.com/x.png",
    );
  });
});
