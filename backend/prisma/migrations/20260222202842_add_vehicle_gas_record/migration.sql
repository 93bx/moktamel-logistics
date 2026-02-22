-- CreateTable
CREATE TABLE "VehicleGasRecord" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "gas_quantity_liters" DECIMAL(12,2) NOT NULL,
    "gas_cost" DECIMAL(12,2) NOT NULL,
    "payment_method_code" TEXT NOT NULL,
    "invoice_file_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_user_id" UUID,

    CONSTRAINT "VehicleGasRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VehicleGasRecord_company_id_vehicle_id_idx" ON "VehicleGasRecord"("company_id", "vehicle_id");

-- AddForeignKey
ALTER TABLE "VehicleGasRecord" ADD CONSTRAINT "VehicleGasRecord_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleGasRecord" ADD CONSTRAINT "VehicleGasRecord_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
