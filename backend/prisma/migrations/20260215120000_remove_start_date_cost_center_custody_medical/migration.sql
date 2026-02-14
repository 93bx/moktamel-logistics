-- DropColumn: Remove start_date_at, cost_center_code, custody_status, medical_expiry_at from EmploymentRecord
ALTER TABLE "EmploymentRecord" DROP COLUMN IF EXISTS "custody_status";
ALTER TABLE "EmploymentRecord" DROP COLUMN IF EXISTS "start_date_at";
ALTER TABLE "EmploymentRecord" DROP COLUMN IF EXISTS "medical_expiry_at";
ALTER TABLE "EmploymentRecord" DROP COLUMN IF EXISTS "cost_center_code";
