-- Add new fields to EmploymentRecord
ALTER TABLE "EmploymentRecord" ADD COLUMN "target_type" TEXT;
ALTER TABLE "EmploymentRecord" ADD COLUMN "target_deduction_type" TEXT;

-- Backfill from PayrollConfig (orders-based default)
UPDATE "EmploymentRecord" e
SET 
  target_type = CASE 
    WHEN e.monthly_target_amount IS NOT NULL THEN 'TARGET_TYPE_REVENUE'
    ELSE 'TARGET_TYPE_ORDERS'
  END,
  target_deduction_type = CASE
    WHEN pc.calculation_method = 'FIXED_DEDUCTION' THEN 'DEDUCTION_FIXED'
    WHEN pc.calculation_method = 'REVENUE' THEN 'DEDUCTION_REVENUE_TIERS'
    ELSE 'DEDUCTION_ORDERS_TIERS'
  END
FROM "PayrollConfig" pc
WHERE e.company_id = pc.company_id
  AND e.status_code = 'EMPLOYMENT_STATUS_ACTIVE';

-- Refactor PayrollConfig
ALTER TABLE "PayrollConfig" ADD COLUMN "orders_deduction_tiers" JSONB;
ALTER TABLE "PayrollConfig" ADD COLUMN "revenue_deduction_tiers" JSONB;
ALTER TABLE "PayrollConfig" ADD COLUMN "revenue_unit_amount" DECIMAL(12,2);

-- Copy existing tiers to orders_deduction_tiers (most common case)
UPDATE "PayrollConfig" 
SET orders_deduction_tiers = deduction_tiers
WHERE calculation_method IN ('ORDERS_COUNT', 'FIXED_DEDUCTION')
  AND deduction_tiers IS NOT NULL;

UPDATE "PayrollConfig"
SET revenue_deduction_tiers = deduction_tiers,
    revenue_unit_amount = unit_amount
WHERE calculation_method = 'REVENUE'
  AND deduction_tiers IS NOT NULL;

-- Drop old columns
ALTER TABLE "PayrollConfig" DROP COLUMN "calculation_method";
ALTER TABLE "PayrollConfig" DROP COLUMN "monthly_target";
ALTER TABLE "PayrollConfig" DROP COLUMN "monthly_target_amount";
ALTER TABLE "PayrollConfig" DROP COLUMN "unit_amount";
ALTER TABLE "PayrollConfig" DROP COLUMN "deduction_tiers";
