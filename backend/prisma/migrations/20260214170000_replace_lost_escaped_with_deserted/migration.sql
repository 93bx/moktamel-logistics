-- Replace legacy Lost Contact and Escaped statuses with Deserted (data migration, no schema change)
UPDATE "EmploymentRecord"
SET "status_code" = 'EMPLOYMENT_STATUS_DESERTED'
WHERE "status_code" IN ('EMPLOYMENT_STATUS_LOST_CONTACT', 'EMPLOYMENT_STATUS_ESCAPED')
  AND "deleted_at" IS NULL;
