-- CreateTable
CREATE TABLE "PayrollConfig" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "calculation_method" TEXT NOT NULL,
    "monthly_target" INTEGER,
    "monthly_target_amount" DECIMAL(14,2),
    "bonus_per_order" DECIMAL(12,2),
    "minimum_salary" DECIMAL(12,2) DEFAULT 400,
    "unit_amount" DECIMAL(12,2),
    "deduction_per_order" DECIMAL(12,2),
    "deduction_tiers" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_user_id" UUID,

    CONSTRAINT "PayrollConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PayrollConfig_company_id_idx" ON "PayrollConfig"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollConfig_company_id_key" ON "PayrollConfig"("company_id");

-- AddForeignKey
ALTER TABLE "PayrollConfig" ADD CONSTRAINT "PayrollConfig_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
