-- AlterTable
ALTER TABLE "RecruitmentCandidate" ADD COLUMN     "responsible_office" TEXT,
ADD COLUMN     "visa_sent_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "RecruitmentCandidate_company_id_visa_sent_at_idx" ON "RecruitmentCandidate"("company_id", "visa_sent_at");
