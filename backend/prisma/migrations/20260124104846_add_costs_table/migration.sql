-- CreateTable
CREATE TABLE "Cost" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type_code" TEXT NOT NULL,
    "amount_input" DECIMAL(14,2) NOT NULL,
    "vat_included" BOOLEAN NOT NULL DEFAULT false,
    "vat_rate" DECIMAL(5,4) NOT NULL,
    "vat_amount" DECIMAL(14,2) NOT NULL,
    "net_amount" DECIMAL(14,2) NOT NULL,
    "recurrence_code" TEXT NOT NULL,
    "one_time_date" TIMESTAMP(3),
    "notes" TEXT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_user_id" UUID,

    CONSTRAINT "Cost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Cost_company_id_idx" ON "Cost"("company_id");

-- CreateIndex
CREATE INDEX "Cost_company_id_recurrence_code_idx" ON "Cost"("company_id", "recurrence_code");

-- CreateIndex
CREATE INDEX "Cost_company_id_type_code_idx" ON "Cost"("company_id", "type_code");

-- CreateIndex
CREATE INDEX "Cost_company_id_is_deleted_idx" ON "Cost"("company_id", "is_deleted");

-- AddForeignKey
ALTER TABLE "Cost" ADD CONSTRAINT "Cost_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
