-- AlterTable
ALTER TABLE "RecruitmentCandidate" ADD COLUMN     "passport_expiry_at" TIMESTAMP(3),
ADD COLUMN     "responsible_office_number" VARCHAR(10);

-- CreateIndex
CREATE INDEX "RecruitmentCandidate_company_id_passport_expiry_at_idx" ON "RecruitmentCandidate"("company_id", "passport_expiry_at");
