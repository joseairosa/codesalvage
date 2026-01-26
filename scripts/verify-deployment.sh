#!/bin/bash

#
# Deployment Verification Script
# Tests Railway staging deployment to ensure everything works correctly
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# Functions
print_header() {
  echo ""
  echo -e "${BLUE}========================================${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}========================================${NC}"
  echo ""
}

print_success() {
  echo -e "${GREEN}✓${NC} $1"
  ((PASSED++))
}

print_error() {
  echo -e "${RED}✗${NC} $1"
  ((FAILED++))
}

print_warning() {
  echo -e "${YELLOW}⚠${NC} $1"
  ((WARNINGS++))
}

print_info() {
  echo -e "${BLUE}ℹ${NC} $1"
}

# Check if URL is provided
if [ -z "$1" ]; then
  echo -e "${RED}Error: Railway deployment URL required${NC}"
  echo "Usage: ./scripts/verify-deployment.sh https://your-app.railway.app"
  exit 1
fi

DEPLOYMENT_URL="$1"

print_header "ProjectFinish Deployment Verification"
print_info "Testing deployment at: $DEPLOYMENT_URL"
print_info "Started at: $(date)"

# Test 1: Homepage loads
print_header "Test 1: Homepage Accessibility"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$DEPLOYMENT_URL" --max-time 10)
if [ "$HTTP_STATUS" = "200" ]; then
  print_success "Homepage returns 200 OK"
else
  print_error "Homepage returned status $HTTP_STATUS (expected 200)"
fi

# Test 2: Check for critical keywords in homepage
print_header "Test 2: Homepage Content"
HOMEPAGE_CONTENT=$(curl -s "$DEPLOYMENT_URL" --max-time 10)

if echo "$HOMEPAGE_CONTENT" | grep -q "ProjectFinish"; then
  print_success "Homepage contains 'ProjectFinish' branding"
else
  print_error "Homepage missing 'ProjectFinish' branding"
fi

if echo "$HOMEPAGE_CONTENT" | grep -q "Turn Your"; then
  print_success "Homepage contains hero section"
else
  print_error "Homepage missing hero section"
fi

if echo "$HOMEPAGE_CONTENT" | grep -q "Get Started"; then
  print_success "Homepage contains 'Get Started' CTA"
else
  print_warning "Homepage missing 'Get Started' CTA"
fi

# Test 3: Sign-in page loads
print_header "Test 3: Sign-in Page"
SIGNIN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$DEPLOYMENT_URL/auth/signin" --max-time 10)
if [ "$SIGNIN_STATUS" = "200" ]; then
  print_success "Sign-in page returns 200 OK"
else
  print_error "Sign-in page returned status $SIGNIN_STATUS (expected 200)"
fi

SIGNIN_CONTENT=$(curl -s "$DEPLOYMENT_URL/auth/signin" --max-time 10)
if echo "$SIGNIN_CONTENT" | grep -q "Sign in with GitHub"; then
  print_success "Sign-in page contains GitHub OAuth button"
else
  print_error "Sign-in page missing GitHub OAuth button"
fi

# Test 4: Protected route redirects to sign-in
print_header "Test 4: Protected Routes"
DASHBOARD_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$DEPLOYMENT_URL/dashboard" --max-time 10 -L)
if [ "$DASHBOARD_STATUS" = "200" ]; then
  # Check if it's the sign-in page (redirected)
  DASHBOARD_CONTENT=$(curl -s "$DEPLOYMENT_URL/dashboard" --max-time 10 -L)
  if echo "$DASHBOARD_CONTENT" | grep -q "Sign in with GitHub"; then
    print_success "Dashboard redirects to sign-in when unauthenticated"
  else
    print_warning "Dashboard accessible without authentication (check auth middleware)"
  fi
else
  print_warning "Dashboard returned status $DASHBOARD_STATUS"
fi

# Test 5: API routes exist
print_header "Test 5: API Routes"
AUTH_API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$DEPLOYMENT_URL/api/auth/providers" --max-time 10)
if [ "$AUTH_API_STATUS" = "200" ]; then
  print_success "Auth API endpoint accessible"
else
  print_error "Auth API endpoint returned status $AUTH_API_STATUS"
fi

# Test 6: Static assets load
print_header "Test 6: Static Assets"
# Check if favicon loads
FAVICON_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$DEPLOYMENT_URL/favicon.ico" --max-time 10)
if [ "$FAVICON_STATUS" = "200" ] || [ "$FAVICON_STATUS" = "304" ]; then
  print_success "Favicon loads correctly"
else
  print_warning "Favicon returned status $FAVICON_STATUS"
fi

# Test 7: Check for JavaScript errors in HTML
print_header "Test 7: No Critical Errors in HTML"
if echo "$HOMEPAGE_CONTENT" | grep -qi "error\|exception\|500"; then
  print_warning "Possible errors detected in HTML source"
else
  print_success "No obvious errors in HTML source"
fi

# Test 8: Security headers
print_header "Test 8: Security Headers"
HEADERS=$(curl -s -I "$DEPLOYMENT_URL" --max-time 10)

if echo "$HEADERS" | grep -qi "x-frame-options"; then
  print_success "X-Frame-Options header present"
else
  print_warning "X-Frame-Options header missing"
fi

if echo "$HEADERS" | grep -qi "x-content-type-options"; then
  print_success "X-Content-Type-Options header present"
else
  print_warning "X-Content-Type-Options header missing"
fi

# Test 9: Response time
print_header "Test 9: Performance"
START_TIME=$(date +%s%N)
curl -s -o /dev/null "$DEPLOYMENT_URL" --max-time 10
END_TIME=$(date +%s%N)
RESPONSE_TIME=$(( (END_TIME - START_TIME) / 1000000 ))

if [ "$RESPONSE_TIME" -lt 1000 ]; then
  print_success "Homepage response time: ${RESPONSE_TIME}ms (excellent)"
elif [ "$RESPONSE_TIME" -lt 2000 ]; then
  print_success "Homepage response time: ${RESPONSE_TIME}ms (good)"
elif [ "$RESPONSE_TIME" -lt 3000 ]; then
  print_warning "Homepage response time: ${RESPONSE_TIME}ms (acceptable)"
else
  print_warning "Homepage response time: ${RESPONSE_TIME}ms (slow - consider optimization)"
fi

# Test 10: SSL/TLS
print_header "Test 10: SSL/TLS Certificate"
if [[ "$DEPLOYMENT_URL" == https://* ]]; then
  SSL_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$DEPLOYMENT_URL" --max-time 10)
  if [ "$SSL_STATUS" = "200" ]; then
    print_success "HTTPS connection successful"
  else
    print_error "HTTPS connection failed (status: $SSL_STATUS)"
  fi
else
  print_warning "Deployment URL is HTTP (should be HTTPS in production)"
fi

# Summary
print_header "Verification Summary"
echo ""
echo -e "${GREEN}Passed:   $PASSED${NC}"
echo -e "${YELLOW}Warnings: $WARNINGS${NC}"
echo -e "${RED}Failed:   $FAILED${NC}"
echo ""

if [ "$FAILED" -eq 0 ]; then
  if [ "$WARNINGS" -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed! Deployment is healthy.${NC}"
    exit 0
  else
    echo -e "${YELLOW}⚠ Deployment is functional but has warnings. Review above.${NC}"
    exit 0
  fi
else
  echo -e "${RED}✗ Deployment has failures. Please investigate above errors.${NC}"
  exit 1
fi
