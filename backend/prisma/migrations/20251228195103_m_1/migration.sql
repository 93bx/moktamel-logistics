/*
  Warnings:

  - You are about to drop the column `agent_id` on the `RecruitmentCandidate` table. All the data in the column will be lost.
  - You are about to drop the column `gender_code` on the `RecruitmentCandidate` table. All the data in the column will be lost.
  - You are about to drop the column `nationality_code` on the `RecruitmentCandidate` table. All the data in the column will be lost.
  - Added the required column `nationality` to the `RecruitmentCandidate` table without a default value. This is not possible if the table is not empty.
  - Made the column `passport_no` on table `RecruitmentCandidate` required. This step will fail if there are existing NULL values in that column.
  - Made the column `responsible_office` on table `RecruitmentCandidate` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "RecruitmentCandidate" DROP CONSTRAINT "RecruitmentCandidate_agent_id_fkey";

-- AlterTable
ALTER TABLE "RecruitmentCandidate" DROP COLUMN "agent_id",
DROP COLUMN "gender_code",
DROP COLUMN "nationality_code",
ADD COLUMN     "nationality" TEXT NOT NULL,
ALTER COLUMN "passport_no" SET NOT NULL,
ALTER COLUMN "status_code" SET DEFAULT 'UNDER_PROCEDURE',
ALTER COLUMN "responsible_office" SET NOT NULL;
