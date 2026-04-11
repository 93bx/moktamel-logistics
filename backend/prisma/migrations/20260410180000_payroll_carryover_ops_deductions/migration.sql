-- CreateEnum
CREATE TYPE "SalaryReceiptDifferenceProcessing" AS ENUM ('DEFERRAL_TO_NEXT_MONTH', 'ADMIN_EXEMPTION', 'MANUAL');

-- CreateEnum
CREATE TYPE "PayrollCarryoverStatus" AS ENUM ('PENDING', 'APPLIED');

-- AlterTable
ALTER TABLE "PayrollRunEmployee" ADD COLUMN "operations_deductions_total" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "PayrollRunEmployee" ADD COLUMN "carryover_adjustment_sar" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "SalaryReceipt" ADD COLUMN "difference_processing" "SalaryReceiptDifferenceProcessing";
ALTER TABLE "SalaryReceipt" ADD COLUMN "difference_manual_detail" TEXT;
ALTER TABLE "SalaryReceipt" ADD COLUMN "notes" TEXT;

-- CreateTable
CREATE TABLE "PayrollCarryoverItem" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "employment_record_id" UUID NOT NULL,
    "target_month" TIMESTAMP(3) NOT NULL,
    "adjustment_sar" DECIMAL(12,2) NOT NULL,
    "status" "PayrollCarryoverStatus" NOT NULL DEFAULT 'PENDING',
    "source_salary_receipt_id" UUID,
    "applied_payroll_run_employee_id" UUID,
    "label_code" TEXT NOT NULL DEFAULT 'CARRYOVER_FROM_PREVIOUS_MONTH',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollCarryoverItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PayrollCarryoverItem_source_salary_receipt_id_key" ON "PayrollCarryoverItem"("source_salary_receipt_id");

-- CreateIndex
CREATE INDEX "PayrollCarryoverItem_company_id_target_month_employment_record_id_idx" ON "PayrollCarryoverItem"("company_id", "target_month", "employment_record_id");

-- CreateIndex
CREATE INDEX "PayrollCarryoverItem_company_id_status_idx" ON "PayrollCarryoverItem"("company_id", "status");

-- AddForeignKey
ALTER TABLE "PayrollCarryoverItem" ADD CONSTRAINT "PayrollCarryoverItem_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollCarryoverItem" ADD CONSTRAINT "PayrollCarryoverItem_employment_record_id_fkey" FOREIGN KEY ("employment_record_id") REFERENCES "EmploymentRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollCarryoverItem" ADD CONSTRAINT "PayrollCarryoverItem_source_salary_receipt_id_fkey" FOREIGN KEY ("source_salary_receipt_id") REFERENCES "SalaryReceipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollCarryoverItem" ADD CONSTRAINT "PayrollCarryoverItem_applied_payroll_run_employee_id_fkey" FOREIGN KEY ("applied_payroll_run_employee_id") REFERENCES "PayrollRunEmployee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
