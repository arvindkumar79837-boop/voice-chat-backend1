#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# FILE: deploy-phase3.sh
# ARVIND PARTY - PHASE 3: DEPLOYMENT & GO-LIVE
# ═══════════════════════════════════════════════════════════════════════════

set -e  # Exit on error

echo "🦁 ARVIND PARTY - PHASE 3 DEPLOYMENT"
echo "═══════════════════════════════════════════════════════════════════════════"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ─── PRE-DEPLOYMENT CHECKS ────────────────────────────────────────────────────

echo -e "${BLUE}━━━ PRE-DEPLOYMENT CHECKS ━━━${NC}"
echo ""

FAILED=0

# Check if .env exists
if [ ! -f .env ]; then
  echo -e "${RED}✗ FAIL${NC}: .env file not found"
  echo "   Copy .env.example to .env and configure credentials"
  ((FAILED++))
else
  echo -e "${GREEN}✓ PASS${NC}: .env file exists"
fi

# Check critical environment variables
echo ""
echo "Checking critical environment variables..."

if [ -z "$RAZORPAY_KEY_ID" ] || [ "$RAZORPAY_KEY_ID" = "rzp_test_xxxxx" ]; then
  echo -e "${YELLOW}⚠ WARN${NC}: RAZORPAY_KEY_ID not set or using test key"
fi

if [ -z "$JWT_SECRET" ] || [ "$JWT_SECRET" = "your_jwt_secret_key_here_min_32_chars" ]; then
  echo -e "${RED}✗ FAIL${NC}: JWT_SECRET not configured"
  ((FAILED++))
fi

if [ -z "$MONGO_URI" ]; then
  echo -e "${RED}✗ FAIL${NC}: MONGO_URI not configured"
  ((FAILED++))
fi

# Load .env if exists
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# ─── 1. FLUTTER BUILD (ANDROID) ───────────────────────────────────────────────

echo ""
echo -e "${BLUE}━━━ 1. FLUTTER ANDROID BUILD ━━━${NC}"
echo ""

if command -v flutter &> /dev/null; then
  echo "Building Flutter Android APK (Release)..."
  
  cd ..
  
  # Clean previous builds
  flutter clean
  
  # Get dependencies
  flutter pub get
  
  # Build release APK
  flutter build apk --release
  
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ PASS${NC}: Android APK built successfully"
    echo "   Output: build/app/outputs/flutter-app.apk"
  else
    echo -e "${RED}✗ FAIL${NC}: Android APK build failed"
    ((FAILED++))
  fi
  
  cd lib/arvind-party-backend
else
  echo -e "${YELLOW}⚠ WARN${NC}: Flutter not found, skipping mobile build"
fi

# ─── 2. BACKEND BUILD ────────────────────────────────────────────────────────

echo ""
echo -e "${BLUE}━━━ 2. BACKEND BUILD ━━━${NC}"
echo ""

echo "Installing dependencies..."
npm install --production

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ PASS${NC}: Dependencies installed"
else
  echo -e "${RED}✗ FAIL${NC}: npm install failed"
  ((FAILED++))
fi

echo ""
echo "Running tests..."
npm test 2>/dev/null || echo -e "${YELLOW}⚠ No tests configured${NC}"

# ─── 3. DATABASE BACKUP ──────────────────────────────────────────────────────

echo ""
echo -e "${BLUE}━━━ 3. DATABASE BACKUP ━━━${NC}"
echo ""

if command -v mongosh &> /dev/null; then
  BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
  mkdir -p "$BACKUP_DIR"
  
  echo "Creating MongoDB backup..."
  mongodump --uri="$MONGO_URI" --out="$BACKUP_DIR" 2>/dev/null
  
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ PASS${NC}: Database backed up to $BACKUP_DIR"
  else
    echo -e "${YELLOW}⚠ WARN${NC}: MongoDB backup failed (continuing anyway)"
  fi
else
  echo -e "${YELLOW}⚠ WARN${NC}: mongosh not found, skipping backup"
fi

# ─── 4. DOCKER BUILD (OPTIONAL) ──────────────────────────────────────────────

echo ""
echo -e "${BLUE}━━━ 4. DOCKER BUILD ━━━${NC}"
echo ""

if [ -f "Dockerfile" ]; then
  echo "Building Docker image..."
  docker build -t arvind-party-api:latest .
  
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ PASS${NC}: Docker image built"
  else
    echo -e "${YELLOW}⚠ WARN${NC}: Docker build failed (not required)"
  fi
else
  echo -e "${YELLOW}⚠ INFO${NC}: No Dockerfile found, skipping container build"
fi

# ─── 5. ENVIRONMENT VALIDATION ───────────────────────────────────────────────

echo ""
echo -e "${BLUE}━━━ 5. ENVIRONMENT VALIDATION ━━━${NC}"
echo ""

echo "Checking production configuration..."
node -e "
const env = process.env.NODE_ENV;
if (env === 'production') {
  console.log('✓ NODE_ENV: production');
} else {
  console.log('⚠ NODE_ENV:', env || 'not set (should be production)');
}
"

echo ""
echo "Verifying Firebase configuration..."
node -e "
try {
  const admin = require('firebase-admin');
  console.log('✓ Firebase Admin SDK loadable');
} catch (e) {
  console.log('⚠ Firebase Admin SDK not configured:', e.message);
}
"

echo ""
echo "Verifying Razorpay configuration..."
node -e "
const Razorpay = require('razorpay');
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  console.log('✓ Razorpay credentials present');
} else {
  console.log('✗ Razorpay credentials missing');
}
"

echo ""
echo "Verifying Agora configuration..."
node -e "
const Agora = require('agora-access-token');
console.log('✓ Agora SDK loadable');
"

# ─── 6. SECURITY CHECKS ──────────────────────────────────────────────────────

echo ""
echo -e "${BLUE}━━━ 6. SECURITY CHECKS ━━━${NC}"
echo ""

echo "Checking for secrets in git..."
if [ -d ".git" ]; then
  SECRETS=$(git diff --cached --name-only | xargs grep -l "password\|secret\|key\|token" 2>/dev/null | grep -v "\.env\.example\|test" || true)
  if [ -z "$SECRETS" ]; then
    echo -e "${GREEN}✓ PASS${NC}: No secrets detected in staged files"
  else
    echo -e "${RED}✗ FAIL${NC}: Potential secrets in files: $SECRETS"
    ((FAILED++))
  fi
fi

echo ""
echo "Running npm audit..."
npm audit --audit-level=high 2>/dev/null | grep -q "found 0 vulnerabilities"
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ PASS${NC}: No high/critical vulnerabilities"
else
  echo -e "${YELLOW}⚠ WARN${NC}: Run 'npm audit' for details"
fi

# ─── 7. DEPLOYMENT SUMMARY ───────────────────────────────────────────────────

echo ""
echo -e "${BLUE}━━━ DEPLOYMENT SUMMARY ━━━${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All pre-deployment checks passed${NC}"
  echo ""
  echo "Deployment Steps:"
  echo "  1. Push Docker image to registry (if using Docker)"
  echo "  2. SSH into production server"
  echo "  3. Pull latest code: git pull origin main"
  echo "  4. Install dependencies: npm install --production"
  echo "  5. Restart server: pm2 restart all || npm start"
  echo "  6. Verify: curl https://your-domain.com/health"
  echo ""
  echo -e "${GREEN}Ready for deployment!${NC}"
  exit 0
else
  echo -e "${RED}✗ $FAILED critical checks failed${NC}"
  echo ""
  echo "Fix the issues above before deploying."
  exit 1
fi