-- CreateEnum
CREATE TYPE "PayrollRunStatus" AS ENUM ('DRAFT', 'LOCKED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PayrollEmployeeStatus" AS ENUM ('PAID', 'NOT_PAID');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('BANK_TRANSFER', 'CASH', 'OTHER');

-- CreateEnum
CREATE TYPE "PayrollDocumentType" AS ENUM ('EMPLOYEE_STATEMENT', 'CONSOLIDATED_SHEET');

-- CreateEnum
CREATE TYPE "DocumentSequenceType" AS ENUM ('SALARY_RECEIPT', 'PAYROLL_DOC');

-- CreateTable
CREATE TABLE "PayrollRun" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "month" TIMESTAMP(3) NOT NULL,
    "status" "PayrollRunStatus" NOT NULL DEFAULT 'DRAFT',
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generated_by_user_id" UUID NOT NULL,
    "locked_at" TIMESTAMP(3),
    "locked_by_user_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_user_id" UUID,

    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRunEmployee" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "payroll_run_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "employee_code" TEXT,
    "employee_name_en" TEXT,
    "employee_name_ar" TEXT,
    "employee_avatar_url" TEXT,
    "status" "PayrollEmployeeStatus" NOT NULL DEFAULT 'NOT_PAID',
    "base_salary" DECIMAL(12,2) NOT NULL,
    "monthly_target" INTEGER NOT NULL,
    "orders_count" INTEGER NOT NULL,
    "working_days" INTEGER NOT NULL,
    "target_difference" INTEGER NOT NULL,
    "deduction_method" TEXT NOT NULL,
    "total_deductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "scheduled_loan_installments" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_outstanding_loans" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_unreceived_cash" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_bonus" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "salary_after_deductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_revenue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "average_cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "calculation_details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_user_id" UUID,

    CONSTRAINT "PayrollRunEmployee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryReceipt" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "payroll_run_employee_id" UUID NOT NULL,
    "receipt_number" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL,
    "payment_date" TIMESTAMP(3) NOT NULL,
    "attachment_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" UUID,
    "ip_address" TEXT,
    "user_agent" TEXT,

    CONSTRAINT "SalaryReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollDocument" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "payroll_run_id" UUID NOT NULL,
    "payroll_run_employee_id" UUID,
    "document_number" TEXT NOT NULL,
    "document_type" "PayrollDocumentType" NOT NULL,
    "month" TIMESTAMP(3) NOT NULL,
    "file_url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" UUID,

    CONSTRAINT "PayrollDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentSequence" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "month" TIMESTAMP(3) NOT NULL,
    "sequence_type" "DocumentSequenceType" NOT NULL,
    "current_number" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DocumentSequence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PayrollRun_company_id_status_idx" ON "PayrollRun"("company_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_company_id_month_key" ON "PayrollRun"("company_id", "month");

-- CreateIndex
CREATE INDEX "PayrollRunEmployee_company_id_payroll_run_id_idx" ON "PayrollRunEmployee"("company_id", "payroll_run_id");

-- CreateIndex
CREATE INDEX "PayrollRunEmployee_company_id_status_idx" ON "PayrollRunEmployee"("company_id", "status");

-- CreateIndex
CREATE INDEX "PayrollRunEmployee_company_id_employee_code_idx" ON "PayrollRunEmployee"("company_id", "employee_code");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryReceipt_payroll_run_employee_id_key" ON "SalaryReceipt"("payroll_run_employee_id");

-- CreateIndex
CREATE INDEX "SalaryReceipt_company_id_receipt_number_idx" ON "SalaryReceipt"("company_id", "receipt_number");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryReceipt_company_id_payroll_run_employee_id_key" ON "SalaryReceipt"("company_id", "payroll_run_employee_id");

-- CreateIndex
CREATE INDEX "PayrollDocument_company_id_month_idx" ON "PayrollDocument"("company_id", "month");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollDocument_company_id_month_document_type_payroll_run__key" ON "PayrollDocument"("company_id", "month", "document_type", "payroll_run_employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentSequence_company_id_month_sequence_type_key" ON "DocumentSequence"("company_id", "month", "sequence_type");

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRunEmployee" ADD CONSTRAINT "PayrollRunEmployee_payroll_run_id_fkey" FOREIGN KEY ("payroll_run_id") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRunEmployee" ADD CONSTRAINT "PayrollRunEmployee_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "EmploymentRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryReceipt" ADD CONSTRAINT "SalaryReceipt_payroll_run_employee_id_fkey" FOREIGN KEY ("payroll_run_employee_id") REFERENCES "PayrollRunEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollDocument" ADD CONSTRAINT "PayrollDocument_payroll_run_id_fkey" FOREIGN KEY ("payroll_run_id") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollDocument" ADD CONSTRAINT "PayrollDocument_payroll_run_employee_id_fkey" FOREIGN KEY ("payroll_run_employee_id") REFERENCES "PayrollRunEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
