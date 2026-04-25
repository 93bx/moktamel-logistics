-- Add work schedule fields to employment and daily operation models.
ALTER TABLE "EmploymentRecord"
ADD COLUMN "day_work_hours" DECIMAL(5,2) NOT NULL DEFAULT 8,
ADD COLUMN "work_days" JSONB NOT NULL DEFAULT '["SATURDAY","SUNDAY","MONDAY","TUESDAY","WEDNESDAY","THURSDAY"]';

ALTER TABLE "DailyOperation"
ADD COLUMN "work_hours" DECIMAL(5,2);
