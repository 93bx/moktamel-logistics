-- Add profile/company fields required by the Profile page.
ALTER TABLE "Company"
ADD COLUMN "email" TEXT;

ALTER TABLE "User"
ADD COLUMN "first_name" TEXT,
ADD COLUMN "last_name" TEXT,
ADD COLUMN "profile_picture_url" TEXT;

-- Backfill split name values from legacy "name" where possible.
UPDATE "User"
SET
  "first_name" = NULLIF(SPLIT_PART(COALESCE("name", ''), ' ', 1), ''),
  "last_name" = NULLIF(
    BTRIM(
      SUBSTRING(
        COALESCE("name", '')
        FROM CHAR_LENGTH(SPLIT_PART(COALESCE("name", ''), ' ', 1)) + 1
      )
    ),
    ''
  )
WHERE "name" IS NOT NULL;

ALTER TABLE "User"
DROP COLUMN "name";
