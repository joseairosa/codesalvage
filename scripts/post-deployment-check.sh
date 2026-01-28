#!/bin/bash

###############################################################################
# Post-Deployment Health Check Script
#
# Runs comprehensive health checks after deploying to production.
# This script should be run immediately after deployment to verify all
# critical services are operational.
#
# Usage:
#   bash scripts/post-deployment-check.sh [BASE_URL] [CRON_SECRET]
#
# Example:
#   bash scripts/post-deployment-check.sh https://codesalvage.com your-cron-secret
#
# Exit codes:
#   0 - All checks passed
#   1 - One or more checks failed
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${1:-https://codesalvage.com}"
CRON_SECRET="${2:-}"

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo -e "${YELLOW}⚠️  Warning: jq not installed. Install for better output: brew install jq${NC}"
    JQ_AVAILABLE=false
else
    JQ_AVAILABLE=true
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Post-Deployment Health Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Base URL: $BASE_URL"
echo "Time: $(date)"
echo ""

FAILED_CHECKS=0

###############################################################################
# Check 1: Basic Health Endpoint
###############################################################################
echo -e "${BLUE}[1/8]${NC} Checking basic health endpoint..."

HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/health" || echo "000")
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -1)
BODY=$(echo "$HEALTH_RESPONSE" | head -n -1)

if [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}✅ Health endpoint: OK${NC}"
    if [ "$JQ_AVAILABLE" = true ]; then
        echo "$BODY" | jq -r '.status'
    fi
else
    echo -e "${RED}❌ Health endpoint: FAILED (HTTP $HTTP_CODE)${NC}"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi
echo ""

###############################################################################
# Check 2: Detailed Health Check (requires CRON_SECRET)
###############################################################################
if [ -n "$CRON_SECRET" ]; then
    echo -e "${BLUE}[2/8]${NC} Checking detailed health endpoint..."

    DETAILED_RESPONSE=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $CRON_SECRET" "$BASE_URL/api/health?detailed=true" || echo "000")
    HTTP_CODE=$(echo "$DETAILED_RESPONSE" | tail -1)
    BODY=$(echo "$DETAILED_RESPONSE" | head -n -1)

    if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 207 ]; then
        echo -e "${GREEN}✅ Detailed health check: OK${NC}"
        if [ "$JQ_AVAILABLE" = true ]; then
            echo "$BODY" | jq -r '.checks | to_entries[] | "  \(.key): \(.value.status)"'
        fi
    else
        echo -e "${RED}❌ Detailed health check: FAILED (HTTP $HTTP_CODE)${NC}"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
    fi
else
    echo -e "${YELLOW}[2/8] Skipping detailed health check (CRON_SECRET not provided)${NC}"
fi
echo ""

###############################################################################
# Check 3: Homepage
###############################################################################
echo -e "${BLUE}[3/8]${NC} Checking homepage..."

HOMEPAGE_RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/" || echo "000")
HTTP_CODE=$(echo "$HOMEPAGE_RESPONSE" | tail -1)

if [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}✅ Homepage: OK${NC}"
else
    echo -e "${RED}❌ Homepage: FAILED (HTTP $HTTP_CODE)${NC}"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi
echo ""

###############################################################################
# Check 4: Projects API
###############################################################################
echo -e "${BLUE}[4/8]${NC} Checking projects API..."

PROJECTS_RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/projects?page=1&limit=10" || echo "000")
HTTP_CODE=$(echo "$PROJECTS_RESPONSE" | tail -1)
BODY=$(echo "$PROJECTS_RESPONSE" | head -n -1)

if [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}✅ Projects API: OK${NC}"
    if [ "$JQ_AVAILABLE" = true ]; then
        TOTAL=$(echo "$BODY" | jq -r '.total // 0')
        echo "  Total projects: $TOTAL"
    fi
else
    echo -e "${RED}❌ Projects API: FAILED (HTTP $HTTP_CODE)${NC}"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi
echo ""

###############################################################################
# Check 5: Featured Projects API
###############################################################################
echo -e "${BLUE}[5/8]${NC} Checking featured projects API..."

FEATURED_RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/featured?page=1&limit=10" || echo "000")
HTTP_CODE=$(echo "$FEATURED_RESPONSE" | tail -1)

if [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}✅ Featured API: OK${NC}"
else
    echo -e "${RED}❌ Featured API: FAILED (HTTP $HTTP_CODE)${NC}"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi
echo ""

###############################################################################
# Check 6: Subscription Pricing API
###############################################################################
echo -e "${BLUE}[6/8]${NC} Checking subscription pricing API..."

PRICING_RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/subscriptions/pricing" || echo "000")
HTTP_CODE=$(echo "$PRICING_RESPONSE" | tail -1)

if [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}✅ Subscription pricing API: OK${NC}"
else
    echo -e "${RED}❌ Subscription pricing API: FAILED (HTTP $HTTP_CODE)${NC}"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi
echo ""

###############################################################################
# Check 7: HTTPS Redirect (if checking HTTP)
###############################################################################
if [[ "$BASE_URL" == https://* ]]; then
    HTTP_URL="${BASE_URL/https:/http:}"
    echo -e "${BLUE}[7/8]${NC} Checking HTTPS redirect..."

    REDIRECT_RESPONSE=$(curl -s -I -L "$HTTP_URL" | grep -i "location:" | head -1 || echo "")

    if [[ "$REDIRECT_RESPONSE" == *"https://"* ]]; then
        echo -e "${GREEN}✅ HTTPS redirect: OK${NC}"
    else
        echo -e "${YELLOW}⚠️  HTTPS redirect: Could not verify${NC}"
    fi
else
    echo -e "${YELLOW}[7/8] Skipping HTTPS redirect check (not using HTTPS URL)${NC}"
fi
echo ""

###############################################################################
# Check 8: Response Times
###############################################################################
echo -e "${BLUE}[8/8]${NC} Checking response times..."

HOMEPAGE_TIME=$(curl -s -o /dev/null -w "%{time_total}" "$BASE_URL/" || echo "0")
API_TIME=$(curl -s -o /dev/null -w "%{time_total}" "$BASE_URL/api/projects?page=1&limit=10" || echo "0")

# Convert to milliseconds (multiply by 1000)
HOMEPAGE_MS=$(echo "$HOMEPAGE_TIME * 1000" | bc)
API_MS=$(echo "$API_TIME * 1000" | bc)

echo "  Homepage: ${HOMEPAGE_MS} ms"
echo "  API: ${API_MS} ms"

# Check if response times are acceptable
if (( $(echo "$HOMEPAGE_TIME < 3.0" | bc -l) )); then
    echo -e "${GREEN}✅ Response times: OK${NC}"
else
    echo -e "${YELLOW}⚠️  Homepage response time > 3s${NC}"
fi
echo ""

###############################################################################
# Summary
###############################################################################
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $FAILED_CHECKS -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed!${NC}"
    echo ""
    echo "🎉 Deployment successful!"
    echo ""
    echo "Next steps:"
    echo "  1. Run smoke tests: tests/SMOKE_TESTING_CHECKLIST.md"
    echo "  2. Monitor Honeybadger for errors"
    echo "  3. Check Railway logs for anomalies"
    echo "  4. Verify Stripe webhook deliveries"
    echo ""
    exit 0
else
    echo -e "${RED}❌ $FAILED_CHECKS check(s) failed!${NC}"
    echo ""
    echo "⚠️  Deployment may have issues. Investigate failed checks."
    echo ""
    echo "Troubleshooting:"
    echo "  1. Check Railway logs: railway logs"
    echo "  2. Check Honeybadger for errors"
    echo "  3. Verify environment variables are set"
    echo "  4. Check database connectivity"
    echo "  5. Check Redis connectivity"
    echo ""
    exit 1
fi
