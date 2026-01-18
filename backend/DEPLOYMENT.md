# Deployment Guide

This guide ensures safe deployments with database schema validation.

## Pre-Deployment Validation

Before every deployment, the system automatically validates:

1. ✅ All migrations are applied
2. ✅ Database schema matches Prisma schema
3. ✅ Critical tables and columns exist
4. ✅ Prisma client can query all tables

## Quick Deployment

### Option 1: Use the Deployment Script (Recommended)

```bash
cd backend
./scripts/deploy.sh
```

This script:
- Pulls latest code
- Installs dependencies
- Validates schema
- Applies migrations
- Builds the application
- Restarts the service

### Option 2: Manual Deployment

```bash
cd backend

# 1. Pull latest code
git pull origin master

# 2. Install dependencies
npm install

# 3. Run pre-deployment checks
./scripts/pre-deploy-check.sh

# 4. Apply migrations
npx prisma migrate deploy

# 5. Validate schema
npm run validate-schema

# 6. Build
npm run build

# 7. Restart service
pm2 restart backend
```

## Validation Scripts

### Schema Validation

```bash
npm run validate-schema
```

This checks:
- Migration status
- Critical table columns exist
- Prisma queries work
- Required indexes exist

### Pre-Deployment Check

```bash
./scripts/pre-deploy-check.sh
```

Runs all validation before building.

## Health Check Endpoint

After deployment, check database health:

```bash
curl https://your-api.com/api/health/db
```

Returns:
- Database connection status
- Latest migration applied
- Schema validation status
- Missing columns (if any)

## Troubleshooting

### Schema Validation Fails

If validation fails:

1. Check migration status:
   ```bash
   npx prisma migrate status
   ```

2. Apply pending migrations:
   ```bash
   npx prisma migrate deploy
   ```

3. If migrations are stuck, check `_prisma_migrations` table:
   ```sql
   SELECT * FROM _prisma_migrations ORDER BY finished_at DESC;
   ```

4. Manually fix missing columns (see migration files for SQL)

### Migration Errors

If a migration fails:

1. Check the error message
2. Fix the migration file (make it idempotent with `IF NOT EXISTS`)
3. Mark migration as rolled back:
   ```sql
   DELETE FROM _prisma_migrations WHERE migration_name = 'migration_name';
   ```
4. Re-run: `npx prisma migrate deploy`

## Best Practices

1. **Always use `migrate deploy` in production** (not `migrate dev`)
2. **Test migrations on staging first**
3. **Never manually edit production database**
4. **Run validation before every deployment**
5. **Monitor health endpoint after deployment**

## Automatic Validation

The build process automatically runs schema validation:

- `npm run build` → runs `validate-schema` first
- `npm run start:prod` → runs `validate-schema` first

This ensures the schema is always valid before the app starts.

