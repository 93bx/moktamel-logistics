-- CreateEnum
CREATE TYPE "OperatingPlatform" AS ENUM ('JAHEZ', 'HUNGERSTATION', 'NINJA');

-- CreateTable
CREATE TABLE "DailyOperation" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "employment_record_id" UUID NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "platform" "OperatingPlatform" NOT NULL,
    "orders_count" INTEGER NOT NULL,
    "total_revenue" DECIMAL(14,2) NOT NULL,
    "cash_collected" DECIMAL(14,2) NOT NULL,
    "tips" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "deduction_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "deduction_reason" TEXT,
    "status_code" TEXT NOT NULL DEFAULT 'RECORDED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_user_id" UUID,

    CONSTRAINT "DailyOperation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyOperation_company_id_date_idx" ON "DailyOperation"("company_id", "date");

-- CreateIndex
CREATE INDEX "DailyOperation_company_id_employment_record_id_idx" ON "DailyOperation"("company_id", "employment_record_id");

-- CreateIndex
CREATE INDEX "DailyOperation_company_id_platform_idx" ON "DailyOperation"("company_id", "platform");

-- AddForeignKey
ALTER TABLE "DailyOperation" ADD CONSTRAINT "DailyOperation_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyOperation" ADD CONSTRAINT "DailyOperation_employment_record_id_fkey" FOREIGN KEY ("employment_record_id") REFERENCES "EmploymentRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

