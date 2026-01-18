/*
  Warnings:

  - You are about to drop the column `full_name` on the `RecruitmentCandidate` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[employee_code]` on the table `EmploymentRecord` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `full_name_ar` to the `RecruitmentCandidate` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OperatingPlatform" ADD VALUE 'NONE';
ALTER TYPE "OperatingPlatform" ADD VALUE 'KEETA';

-- AlterTable
ALTER TABLE "CashTransaction" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "DailyOperation" ADD COLUMN     "approved_at" TIMESTAMP(3),
ADD COLUMN     "approved_by_user_id" UUID,
ADD COLUMN     "cash_received" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "difference_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "is_draft" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "loan_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "loan_reason" TEXT;

-- AlterTable
ALTER TABLE "EmploymentRecord" ADD COLUMN     "assigned_platform" "OperatingPlatform",
ADD COLUMN     "avatar_file_id" UUID,
ADD COLUMN     "contract_file_id" UUID,
ADD COLUMN     "contract_no" TEXT,
ADD COLUMN     "date_of_birth" TIMESTAMP(3),
ADD COLUMN     "employee_code" TEXT,
ADD COLUMN     "full_name_ar" TEXT,
ADD COLUMN     "full_name_en" TEXT,
ADD COLUMN     "iqama_file_id" UUID,
ADD COLUMN     "job_type" TEXT,
ADD COLUMN     "license_expiry_at" TIMESTAMP(3),
ADD COLUMN     "license_file_id" UUID,
ADD COLUMN     "nationality" TEXT,
ADD COLUMN     "passport_file_id" UUID,
ADD COLUMN     "passport_no" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "platform_user_no" TEXT,
ADD COLUMN     "promissory_note_file_id" UUID;

-- AlterTable
ALTER TABLE "HandoverBatch" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "HandoverExpense" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "RecruitmentCandidate" DROP COLUMN "full_name",
ADD COLUMN     "avatar_file_id" UUID,
ADD COLUMN     "full_name_ar" TEXT NOT NULL,
ADD COLUMN     "full_name_en" TEXT;

-- AlterTable
ALTER TABLE "WalletBalance" ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "type_code" TEXT NOT NULL,
    "license_plate" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "vin" TEXT NOT NULL,
    "gps_tracker_id" TEXT,
    "current_odometer" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status_code" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "current_driver_id" UUID,
    "assigned_at" TIMESTAMP(3),
    "idle_since" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "purchase_date" TIMESTAMP(3),
    "purchase_price" DECIMAL(14,2),
    "purchase_condition" TEXT NOT NULL DEFAULT 'NEW',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_user_id" UUID,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleDocument" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "type_code" TEXT NOT NULL,
    "number" TEXT,
    "expiry_date" TIMESTAMP(3) NOT NULL,
    "file_id" UUID,
    "issuer" TEXT,

    CONSTRAINT "VehicleDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleMaintenance" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "workshop_type_code" TEXT NOT NULL,
    "workshop_name" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "cost" DECIMAL(12,2),
    "invoice_number" TEXT,
    "invoice_file_id" UUID,

    CONSTRAINT "VehicleMaintenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleAssignment" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassigned_at" TIMESTAMP(3),
    "start_odometer" DOUBLE PRECISION NOT NULL,
    "end_odometer" DOUBLE PRECISION,

    CONSTRAINT "VehicleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_vin_key" ON "Vehicle"("vin");

-- CreateIndex
CREATE INDEX "Vehicle_company_id_status_code_idx" ON "Vehicle"("company_id", "status_code");

-- CreateIndex
CREATE INDEX "VehicleDocument_company_id_vehicle_id_idx" ON "VehicleDocument"("company_id", "vehicle_id");

-- CreateIndex
CREATE INDEX "VehicleMaintenance_company_id_vehicle_id_idx" ON "VehicleMaintenance"("company_id", "vehicle_id");

-- CreateIndex
CREATE INDEX "VehicleAssignment_company_id_vehicle_id_idx" ON "VehicleAssignment"("company_id", "vehicle_id");

-- CreateIndex
CREATE INDEX "VehicleAssignment_company_id_employee_id_idx" ON "VehicleAssignment"("company_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "EmploymentRecord_employee_code_key" ON "EmploymentRecord"("employee_code");

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_current_driver_id_fkey" FOREIGN KEY ("current_driver_id") REFERENCES "EmploymentRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleDocument" ADD CONSTRAINT "VehicleDocument_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleDocument" ADD CONSTRAINT "VehicleDocument_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleMaintenance" ADD CONSTRAINT "VehicleMaintenance_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleMaintenance" ADD CONSTRAINT "VehicleMaintenance_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleAssignment" ADD CONSTRAINT "VehicleAssignment_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleAssignment" ADD CONSTRAINT "VehicleAssignment_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleAssignment" ADD CONSTRAINT "VehicleAssignment_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "EmploymentRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create unique index on user_id (enforces one company per user)
-- Note: The index might not exist from init migration, so we create it directly
CREATE UNIQUE INDEX IF NOT EXISTS "CompanyMembership_user_id_key" 
ON "CompanyMembership"("user_id");
