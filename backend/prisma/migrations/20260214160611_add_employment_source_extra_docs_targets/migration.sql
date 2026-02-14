-- AlterTable
ALTER TABLE "EmploymentRecord" ADD COLUMN     "employment_source" TEXT,
ADD COLUMN     "monthly_orders_target" INTEGER,
ADD COLUMN     "monthly_target_amount" DECIMAL(14,2),
ALTER COLUMN "status_code" SET DEFAULT 'EMPLOYMENT_STATUS_UNDER_PROCEDURE';

-- CreateTable
CREATE TABLE "EmploymentDocument" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "employment_record_id" UUID NOT NULL,
    "document_name" TEXT NOT NULL,
    "expiry_at" TIMESTAMP(3),
    "file_id" UUID,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_user_id" UUID,

    CONSTRAINT "EmploymentDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmploymentDocument_company_id_employment_record_id_idx" ON "EmploymentDocument"("company_id", "employment_record_id");

-- CreateIndex
CREATE INDEX "EmploymentDocument_employment_record_id_idx" ON "EmploymentDocument"("employment_record_id");

-- AddForeignKey
ALTER TABLE "EmploymentDocument" ADD CONSTRAINT "EmploymentDocument_employment_record_id_fkey" FOREIGN KEY ("employment_record_id") REFERENCES "EmploymentRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmploymentDocument" ADD CONSTRAINT "EmploymentDocument_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
