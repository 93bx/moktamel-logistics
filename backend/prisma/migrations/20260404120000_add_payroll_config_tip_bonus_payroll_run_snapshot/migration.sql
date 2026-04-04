-- PayrollConfig: fields defined in schema.prisma but never added by earlier migrations
ALTER TABLE "PayrollConfig" ADD COLUMN "tip_recipient" TEXT NOT NULL DEFAULT 'REPRESENTATIVE';

ALTER TABLE "PayrollConfig" ADD COLUMN "count_bonus_enabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "PayrollConfig" ADD COLUMN "count_bonus_amount" DECIMAL(12, 2);

ALTER TABLE "PayrollConfig" ADD COLUMN "revenue_bonus_enabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "PayrollConfig" ADD COLUMN "revenue_bonus_amount" DECIMAL(12, 2);

-- PayrollRun: snapshot at month lock (approve payroll)
ALTER TABLE "PayrollRun" ADD COLUMN "config_snapshot" JSONB;
