-- CreateTable
CREATE TABLE "Asset" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "vehicle_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_user_id" UUID,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetAssignment" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "employment_record_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "receive_date" TIMESTAMP(3) NOT NULL,
    "status_code" TEXT NOT NULL DEFAULT 'ASSIGNED',
    "condition_code" TEXT NOT NULL DEFAULT 'GOOD',
    "recovered_at" TIMESTAMP(3),
    "asset_record" TEXT,
    "asset_image_file_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_user_id" UUID,

    CONSTRAINT "AssetAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetLossReport" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "asset_assignment_id" UUID NOT NULL,
    "type_code" TEXT NOT NULL,
    "asset_value" DECIMAL(12,2) NOT NULL,
    "action_code" TEXT NOT NULL,
    "installment_count" INTEGER,
    "approval_status_code" TEXT,
    "approver_user_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_user_id" UUID,

    CONSTRAINT "AssetLossReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetDeduction" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "asset_loss_report_id" UUID NOT NULL,
    "employment_record_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "installment_number" INTEGER,
    "total_installments" INTEGER,
    "deducted_at" TIMESTAMP(3),
    "status_code" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_user_id" UUID,

    CONSTRAINT "AssetDeduction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "requestor_user_id" UUID NOT NULL,
    "approver_user_id" UUID,
    "status_code" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_user_id" UUID,

    CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Asset_company_id_idx" ON "Asset"("company_id");

-- CreateIndex
CREATE INDEX "Asset_company_id_type_idx" ON "Asset"("company_id", "type");

-- CreateIndex
CREATE INDEX "AssetAssignment_company_id_employment_record_id_idx" ON "AssetAssignment"("company_id", "employment_record_id");

-- CreateIndex
CREATE INDEX "AssetAssignment_company_id_status_code_idx" ON "AssetAssignment"("company_id", "status_code");

-- CreateIndex
CREATE INDEX "AssetAssignment_company_id_receive_date_idx" ON "AssetAssignment"("company_id", "receive_date");

-- CreateIndex
CREATE INDEX "AssetLossReport_company_id_created_at_idx" ON "AssetLossReport"("company_id", "created_at");

-- CreateIndex
CREATE INDEX "AssetLossReport_company_id_approval_status_code_idx" ON "AssetLossReport"("company_id", "approval_status_code");

-- CreateIndex
CREATE INDEX "AssetDeduction_company_id_employment_record_id_idx" ON "AssetDeduction"("company_id", "employment_record_id");

-- CreateIndex
CREATE INDEX "AssetDeduction_company_id_status_code_idx" ON "AssetDeduction"("company_id", "status_code");

-- CreateIndex
CREATE INDEX "AssetDeduction_company_id_deducted_at_idx" ON "AssetDeduction"("company_id", "deducted_at");

-- CreateIndex
CREATE INDEX "ApprovalRequest_company_id_entity_type_entity_id_idx" ON "ApprovalRequest"("company_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "ApprovalRequest_company_id_status_code_idx" ON "ApprovalRequest"("company_id", "status_code");

-- CreateIndex
CREATE INDEX "ApprovalRequest_approver_user_id_status_code_idx" ON "ApprovalRequest"("approver_user_id", "status_code");

-- AddForeignKey
ALTER TABLE "AssetAssignment" ADD CONSTRAINT "AssetAssignment_employment_record_id_fkey" FOREIGN KEY ("employment_record_id") REFERENCES "EmploymentRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetAssignment" ADD CONSTRAINT "AssetAssignment_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetLossReport" ADD CONSTRAINT "AssetLossReport_asset_assignment_id_fkey" FOREIGN KEY ("asset_assignment_id") REFERENCES "AssetAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetDeduction" ADD CONSTRAINT "AssetDeduction_asset_loss_report_id_fkey" FOREIGN KEY ("asset_loss_report_id") REFERENCES "AssetLossReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetDeduction" ADD CONSTRAINT "AssetDeduction_employment_record_id_fkey" FOREIGN KEY ("employment_record_id") REFERENCES "EmploymentRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
