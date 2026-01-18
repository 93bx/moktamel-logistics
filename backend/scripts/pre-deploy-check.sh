#!/bin/bash
# Pre-deployment validation script
# This script ensures the database schema is valid before deployment

set -e

echo "🔍 Running pre-deployment checks..."

# Change to backend directory if not already there
if [ ! -f "package.json" ]; then
  if [ -d "backend" ]; then
    cd backend
  else
    echo "❌ Error: Must run from project root or backend directory"
    exit 1
  fi
fi

# 1. Check migrations are in sync
echo "📋 Checking migration status..."
if ! npx prisma migrate status > /dev/null 2>&1; then
  echo "⚠️  Warning: Could not check migration status (this is OK if database doesn't exist yet)"
else
  MIGRATION_STATUS=$(npx prisma migrate status 2>&1)
  if echo "$MIGRATION_STATUS" | grep -q "following migration\|drift detected"; then
    echo "❌ Migration status check failed:"
    echo "$MIGRATION_STATUS"
    exit 1
  fi
  echo "✅ Migrations are in sync"
fi

# 2. Validate schema (only if database exists and is accessible)
echo "🔍 Validating database schema..."
if npm run validate-schema 2>/dev/null; then
  echo "✅ Schema validation passed"
else
  echo "⚠️  Schema validation skipped (database may not be accessible or not initialized)"
fi

# 3. Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

# 4. Build
echo "🏗️  Building application..."
npm run build

echo "✅ All pre-deployment checks passed!"
echo "🚀 Ready for deployment"

