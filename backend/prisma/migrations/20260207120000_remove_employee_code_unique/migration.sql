-- DropIndex: employee_code uniqueness is per-company only (enforced by app logic)
DROP INDEX IF EXISTS "EmploymentRecord_employee_code_key";
