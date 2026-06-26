#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# FILE: test-phase3.sh
# ARVIND PARTY - PHASE 3: TESTING, DEPLOYMENT & GO-LIVE
# ═══════════════════════════════════════════════════════════════════════════

set -e  # Exit on error

echo "🦁 ARVIND PARTY - PHASE 3 TESTING SUITE"
echo "═══════════════════════════════════════════════════════════════════════════"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0
WARNINGS=0

# ─── HELPER FUNCTIONS ────────────────────────────────────────────────────────

check() {
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ PASS${NC}: $1"
    ((PASSED++))
  else
    echo -e "${RED}✗ FAIL${NC}: $1"
    ((FAILED++))
  fi
}

warn() {
  echo -e "${YELLOW}⚠ WARN${NC}: $1"
  ((WARNINGS++))
}

section() {
  echo ""
  echo -e "${BLUE}━━━ $1 ━━━${NC}"
  echo ""
}

# ─── 3.4: DATABASE & PERSISTENCE TESTING ─────────────────────────────────────

section "3.4: Database & Persistence Testing"

echo "Checking MongoDB connection..."
if command -v mongosh &> /dev/null; then
  mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1
  check "MongoDB is running"
else
  warn "mongosh not found, skipping DB connection test"
fi

echo ""
echo "Checking MongoDB indexes..."
if [ -f "src/models/User.js" ]; then
  grep -q "index: true" src/models/User.js
  check "User model has indexes"
fi

echo "Checking Redis connection..."
if command -v redis-cli &> /dev/null; then
  redis-cli ping > /dev/null 2>&1
  check "Redis is running"
else
  warn "redis-cli not found, skipping Redis test"
fi

# ─── 3.5: SECURITY TESTING ────────────────────────────────────────────────────

section "3.5: Security Testing"

echo "Verifying JWT implementation..."
grep -q "jsonwebtoken" package.json && check "jsonwebtoken in dependencies" || fail "jsonwebtoken not found"
grep -q "bcrypt" package.json && check "bcrypt in dependencies" || fail "bcrypt not found"

echo "Checking rate limiting configuration..."
grep -q "express-rate-limit" src/app.js
check "Rate limiting configured in app.js"

echo "Checking CORS configuration..."
grep -q "corsConfig" src/app.js
check "CORS configuration loaded"

echo "Checking security headers (Helmet)..."
grep -q "helmet" src/app.js
check "Helmet security headers enabled"

echo "Checking helpful vulnerability packages..."
npm audit --audit-level=high > /dev/null 2>&1
check "No high/critical npm vulnerabilities"

echo ""
echo "Checking password hashing (if applicable)..."
grep -rq "bcrypt" src/ --include="*.js"
check "Bcrypt usage detected"

# ─── 3.6: PERFORMANCE & LOAD TESTING ─────────────────────────────────────────

section "3.6: Performance & Load Testing"

echo "Checking database query optimization..."
grep -q "lean()" src/models/User.js || grep -q "select" src/controllers/authController.js
check "Database queries use lean() or select() for optimization"

echo "Checking pagination implementation..."
grep -q "skip\|limit" src/controllers/walletController.js
check "Pagination implemented in wallet endpoints"

echo "Checking for N+1 query prevention..."
grep -q "populate" src/controllers/roomController.js || grep -q "aggregate" src/controllers/rankingController.js
check "Aggregation/population used to prevent N+1 queries"

echo "Checking caching strategy (Redis)..."
grep -q "Redis\|redis\|REDIS" src/app.js || grep -q "REDIS" .env
check "Redis caching configured"

# ─── 3.1: FIREBASE CREDENTIAL INTEGRATION ────────────────────────────────────

section "3.1: Firebase Credential Integration"

echo "Checking Firebase Admin SDK..."
if [ -f "src/config/firebase-admin.js" ]; then
  grep -q "firebase-admin" src/config/firebase-admin.js
  check "Firebase Admin SDK configured"

  grep -q "verifyIdToken" src/config/firebase-admin.js
  check "ID token verification function exists"
fi

echo "Checking Firebase service account path..."
grep -q "FIREBASE_SERVICE_ACCOUNT_PATH\|FIREBASE_PROJECT_ID" .env
check "Firebase env vars in .env"

echo ""
echo "Flutter Firebase dependencies:"
grep -E "firebase_core|firebase_auth|firebase_messaging" pubspec.yaml
check "Firebase core, auth, and messaging in pubspec.yaml"

echo ""
if [ ! -f "firebase-service-account.json" ] && [ -z "$FIREBASE_PROJECT_ID" ]; then
  warn "Firebase service account not configured (required for production)"
else
  check "Firebase credentials configured"
fi

# ─── 3.2: RAZORPAY CREDENTIAL INTEGRATION ────────────────────────────────────

section "3.2: Razorpay Credential Integration"

echo "Checking Razorpay SDK..."
grep -q "razorpay" package.json
check "Razorpay SDK in dependencies"

echo "Checking environment variables..."
grep -q "RAZORPAY_KEY_ID\|RAZORPAY_KEY_SECRET" .env
check "Razorpay env vars in .env"

echo "Checking webhook handler..."
grep -q "handlePaymentWebhook\|PAYMENT_WEBHOOK" src/controllers/walletController.js
check "Webhook handler implemented"

echo "Checking signature verification..."
grep -q "crypto.createHmac.*sha256" src/controllers/walletController.js
check "Signature verification implemented"

if [ -z "$RAZORPAY_KEY_ID" ] || [ "$RAZORPAY_KEY_ID" = "" ]; then
  warn "RAZORPAY_KEY_ID not set in environment"
fi

# ─── 3.3: AGORA CREDENTIAL INTEGRATION ───────────────────────────────────────

section "3.3: Agora Credential Integration"

echo "Checking Agora SDK..."
grep -q "agora-access-token" package.json
check "Agora access token SDK in dependencies"

echo "Checking token generation service..."
[ -f "src/services/agoraService.js" ]
check "Agora service exists"

grep -q "generateToken\|generateRtmToken" src/services/agoraService.js
check "Token generation methods implemented"

echo "Checking Agora controller..."
[ -f "src/controllers/agoraController.js" ]
check "Agora controller exists"

echo "Checking Agora routes..."
grep -q "/api/room.*agora" src/app.js || grep -q "agoraRoutes" src/app.js
check "Agora routes mounted"

if [ -z "$AGORA_APP_ID" ]; then
  warn "AGORA_APP_ID not set in environment"
fi

# ─── FLUTTER BUILD TESTS ─────────────────────────────────────────────────────

section "Flutter Build Tests"

if command -v flutter &> /dev/null; then
  echo "Flutter version:"
  flutter --version | head -1
  check "Flutter is installed"

  echo ""
  echo "Checking Flutter dependencies..."
  flutter pub get > /dev/null 2>&1
  check "flutter pub get succeeded"

  echo ""
  echo "Running Flutter analyzer..."
  flutter analyze > /dev/null 2>&1
  check "Flutter analyzer passed (no issues)"

  echo ""
  echo "Checking Android setup..."
  [ -f "android/app/google-services.json" ]
  check "google-services.json exists"

  echo ""
  echo "Checking iOS setup..."
  [ -f "ios/Runner/GoogleService-Info.plist" ]
  check "GoogleService-Info.plist exists"

  echo ""
  echo "Running Flutter tests..."
  flutter test > /dev/null 2>&1
  check "Flutter tests passed"

else
  warn "Flutter not found, skipping Flutter tests"
fi

# ─── BACKEND ROUTE VERIFICATION ──────────────────────────────────────────────

section "Backend Route Verification"

echo "Checking wallet routes..."
grep -q "createRazorpayOrder\|verifyPayment" src/controllers/walletController.js
check "Wallet payment endpoints exist"

echo "Checking auth routes..."
[ -f "src/routes/auth.routes.js" ]
check "Auth routes file exists"

echo "Checking Socket.IO setup..."
grep -q "socket.io\|socket_io" package.json
check "Socket.IO in dependencies"

# ─── SUMMARY ─────────────────────────────────────────────────────────────────

section "TEST SUMMARY"

TOTAL=$((PASSED + FAILED))
echo ""
echo "Total Tests: $TOTAL"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo -e "Warnings: ${YELLOW}$WARNINGS${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}🎉 ALL TESTS PASSED!${NC}"
  echo ""
  echo "Next Steps:"
  echo "1. Configure missing credentials (Firebase, Razorpay, Agora)"
  echo "2. Run full integration tests"
  echo "3. Execute deployment: ./deploy.sh"
  exit 0
else
  echo -e "${RED}❌ Some tests failed. Please fix the issues above.${NC}"
  echo ""
  echo "Failed tests need to be resolved before deployment."
  exit 1
fi