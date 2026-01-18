-- Enforce One Company Per User Migration
-- This migration ensures each user can only belong to one company

-- Step 1: Cleanup existing data - Remove duplicate memberships
-- For users with multiple memberships, keep only the oldest active one per user
-- If no active membership exists, keep the oldest one regardless of status
WITH ranked_memberships AS (
  SELECT 
    id,
    user_id,
    company_id,
    status,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY user_id 
      ORDER BY 
        CASE WHEN status = 'ACTIVE' THEN 0 ELSE 1 END,
        created_at ASC
    ) as rn
  FROM "CompanyMembership"
)
DELETE FROM "CompanyMembership"
WHERE id IN (
  SELECT id FROM ranked_memberships WHERE rn > 1
);

-- Step 2: Add unique constraint on user_id to enforce one company per user
ALTER TABLE "CompanyMembership"
ADD CONSTRAINT "CompanyMembership_user_id_unique" UNIQUE ("user_id");

-- Step 3: Verify no orphaned users (users without membership)
-- This is a check query - if it returns rows, those users need to be handled
-- In a production system, you may want to create memberships for orphaned users
-- or delete them, depending on your business logic
-- SELECT u.id, u.email FROM "User" u
-- LEFT JOIN "CompanyMembership" cm ON u.id = cm.user_id
-- WHERE cm.id IS NULL;

