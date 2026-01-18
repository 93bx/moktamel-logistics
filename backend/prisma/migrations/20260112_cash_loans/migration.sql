-- CreateEnum
CREATE TYPE "CashTransactionType" AS ENUM ('RECEIPT', 'LOAN', 'DEDUCTION', 'HANDOVER_EXPENSE', 'HANDOVER_SETTLEMENT');

-- CreateEnum
CREATE TYPE "CashTransactionStatus" AS ENUM ('DRAFT', 'APPROVED', 'PENDING');

-- CreateEnum
CREATE TYPE "CashHandoverStatus" AS ENUM ('DRAFT', 'APPROVED');

-- CreateTable
CREATE TABLE "CashTransaction" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "employment_record_id" UUID,
    "supervisor_user_id" UUID,
    "batch_id" UUID,
    "type" "CashTransactionType" NOT NULL,
    "status" "CashTransactionStatus" NOT NULL DEFAULT 'DRAFT',
    "amount" DECIMAL(14,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "receipt_no" TEXT,
    "attachment_file_id" UUID,
    "balance_after" DECIMAL(14,2),
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" UUID,
    "updated_by_user_id" UUID,

    CONSTRAINT "CashTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HandoverBatch" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "supervisor_user_id" UUID NOT NULL,
    "status" "CashHandoverStatus" NOT NULL DEFAULT 'DRAFT',
    "date" TIMESTAMP(3) NOT NULL,
    "expenses_total" DECIMAL(14,2) NOT NULL,
    "handed_over_amount" DECIMAL(14,2) NOT NULL,
    "wallet_balance_snapshot" DECIMAL(14,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" UUID,
    "updated_by_user_id" UUID,

    CONSTRAINT "HandoverBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HandoverExpense" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "statement" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "receipt_file_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" UUID,
    "updated_by_user_id" UUID,

    CONSTRAINT "HandoverExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletBalance" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" UUID,

    CONSTRAINT "WalletBalance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CashTransaction_company_id_receipt_no_key" ON "CashTransaction"("company_id", "receipt_no");

-- CreateIndex
CREATE INDEX "CashTransaction_company_id_employment_record_id_idx" ON "CashTransaction"("company_id", "employment_record_id");

-- CreateIndex
CREATE INDEX "CashTransaction_company_id_date_idx" ON "CashTransaction"("company_id", "date");

-- CreateIndex
CREATE INDEX "CashTransaction_company_id_supervisor_user_id_idx" ON "CashTransaction"("company_id", "supervisor_user_id");

-- CreateIndex
CREATE INDEX "HandoverBatch_company_id_supervisor_user_id_idx" ON "HandoverBatch"("company_id", "supervisor_user_id");

-- CreateIndex
CREATE INDEX "HandoverBatch_company_id_date_idx" ON "HandoverBatch"("company_id", "date");

-- CreateIndex
CREATE INDEX "HandoverExpense_company_id_batch_id_idx" ON "HandoverExpense"("company_id", "batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "WalletBalance_company_id_user_id_key" ON "WalletBalance"("company_id", "user_id");

-- CreateIndex
CREATE INDEX "WalletBalance_company_id_idx" ON "WalletBalance"("company_id");

-- AddForeignKey
ALTER TABLE "CashTransaction" ADD CONSTRAINT "CashTransaction_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashTransaction" ADD CONSTRAINT "CashTransaction_employment_record_id_fkey" FOREIGN KEY ("employment_record_id") REFERENCES "EmploymentRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashTransaction" ADD CONSTRAINT "CashTransaction_supervisor_user_id_fkey" FOREIGN KEY ("supervisor_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashTransaction" ADD CONSTRAINT "CashTransaction_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "HandoverBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashTransaction" ADD CONSTRAINT "CashTransaction_attachment_file_id_fkey" FOREIGN KEY ("attachment_file_id") REFERENCES "FileObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandoverBatch" ADD CONSTRAINT "HandoverBatch_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandoverBatch" ADD CONSTRAINT "HandoverBatch_supervisor_user_id_fkey" FOREIGN KEY ("supervisor_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandoverExpense" ADD CONSTRAINT "HandoverExpense_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandoverExpense" ADD CONSTRAINT "HandoverExpense_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "HandoverBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandoverExpense" ADD CONSTRAINT "HandoverExpense_receipt_file_id_fkey" FOREIGN KEY ("receipt_file_id") REFERENCES "FileObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletBalance" ADD CONSTRAINT "WalletBalance_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletBalance" ADD CONSTRAINT "WalletBalance_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

