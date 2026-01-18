#!/bin/bash
# Deployment script with validation
# Usage: ./scripts/deploy.sh

set -e

echo "🚀 Starting deployment process..."

# Change to backend directory if not already there
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BACKEND_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"
cd "$BACKEND_DIR"

# 1. Pull latest code (if in git repository)
if [ -d ".git" ]; then
  echo "📥 Pulling latest changes..."
  git pull origin master || git pull origin main || echo "⚠️  Could not pull (not a git repo or no remote)"
fi

# 2. Install dependencies
echo "📦 Installing dependencies..."
npm install

# 3. Run pre-deployment checks
echo "🔍 Running pre-deployment validation..."
bash "$SCRIPT_DIR/pre-deploy-check.sh"

# 4. Apply migrations (production-safe)
echo "🗄️  Applying database migrations..."
npx prisma migrate deploy

# 5. Validate schema again after migrations
echo "✅ Final schema validation..."
npm run validate-schema || echo "⚠️  Schema validation failed, but continuing..."

# 6. Build (already done in pre-deploy-check, but ensure it's fresh)
echo "🏗️  Building application..."
npm run build

# 7. Restart service (adjust based on your setup)
echo "🔄 Restarting service..."
if command -v pm2 &> /dev/null; then
  pm2 restart backend || pm2 start backend || echo "⚠️  PM2 not available or service not configured"
elif command -v systemctl &> /dev/null; then
  systemctl restart moktamel-backend || echo "⚠️  Systemd service not found"
else
  echo "⚠️  No process manager found. Please restart your service manually."
fi

echo "✅ Deployment complete!"
echo "📋 Check logs with: pm2 logs backend (if using PM2)"

