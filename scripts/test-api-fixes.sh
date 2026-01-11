#!/usr/bin/env bash
# Test script to verify API fixes for orchestrate endpoints

set -euo pipefail

API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"
TEST_PROJECT="${1:-.}"

echo "Testing API fixes for orchestrate endpoints..."
echo "API Base URL: $API_BASE_URL"
echo ""

# Test 1: Check health endpoint
echo "Test 1: Health check"
if curl -s "$API_BASE_URL/health" | jq -e '.status == "healthy"' >/dev/null 2>&1; then
    echo "✓ Health check passed"
else
    echo "✗ Health check failed - API may not be running"
    exit 1
fi
echo ""

# Test 2: Detect project type
echo "Test 2: Project type detection"
DETECTION_RESPONSE=$(curl -s -X POST "$API_BASE_URL/v1/orchestrate/detect-project-type" \
    -H "Content-Type: application/json" \
    -d "{\"projectPath\": \"$TEST_PROJECT\"}")

if echo "$DETECTION_RESPONSE" | jq -e '.projectType' >/dev/null 2>&1; then
    PROJECT_TYPE=$(echo "$DETECTION_RESPONSE" | jq -r '.projectType')
    echo "✓ Project type detected: $PROJECT_TYPE"
else
    echo "✗ Project type detection failed"
    echo "Response: $DETECTION_RESPONSE"
    exit 1
fi
echo ""

# Test 3: Start orchestration and verify response fields
echo "Test 3: Start orchestration - verify response includes error and endTime fields"
ORCHESTRATION_RESPONSE=$(curl -s -X POST "$API_BASE_URL/v1/orchestrate" \
    -H "Content-Type: application/json" \
    -d "{\"projectPath\": \"$TEST_PROJECT\", \"mode\": \"analyze\"}")

echo "Response fields check:"
if echo "$ORCHESTRATION_RESPONSE" | jq -e '.executionId' >/dev/null 2>&1; then
    echo "  ✓ executionId present"
else
    echo "  ✗ executionId missing"
    exit 1
fi

if echo "$ORCHESTRATION_RESPONSE" | jq -e '.status' >/dev/null 2>&1; then
    STATUS=$(echo "$ORCHESTRATION_RESPONSE" | jq -r '.status')
    echo "  ✓ status present: $STATUS"
else
    echo "  ✗ status missing"
    exit 1
fi

if echo "$ORCHESTRATION_RESPONSE" | jq -e '.endTime' >/dev/null 2>&1; then
    END_TIME=$(echo "$ORCHESTRATION_RESPONSE" | jq -r '.endTime // "null"')
    echo "  ✓ endTime present: $END_TIME"
else
    echo "  ✗ endTime missing (FIX VERIFICATION FAILED)"
    exit 1
fi

if echo "$ORCHESTRATION_RESPONSE" | jq -e 'has("error")' >/dev/null 2>&1; then
    ERROR=$(echo "$ORCHESTRATION_RESPONSE" | jq -r '.error // "null"')
    echo "  ✓ error field present: $ERROR"
else
    echo "  ✗ error field missing (FIX VERIFICATION FAILED)"
    exit 1
fi

EXECUTION_ID=$(echo "$ORCHESTRATION_RESPONSE" | jq -r '.executionId')
echo ""

# Test 4: Get execution status and verify error field
echo "Test 4: Get execution status - verify error field is included"
STATUS_RESPONSE=$(curl -s "$API_BASE_URL/v1/orchestrate/$EXECUTION_ID")

echo "Status response fields check:"
if echo "$STATUS_RESPONSE" | jq -e '.status' >/dev/null 2>&1; then
    STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.status')
    echo "  ✓ status present: $STATUS"
else
    echo "  ✗ status missing"
    exit 1
fi

if echo "$STATUS_RESPONSE" | jq -e 'has("error")' >/dev/null 2>&1; then
    ERROR=$(echo "$STATUS_RESPONSE" | jq -r '.error // "null"')
    echo "  ✓ error field present: $ERROR"
else
    echo "  ✗ error field missing (FIX VERIFICATION FAILED)"
    exit 1
fi

if echo "$STATUS_RESPONSE" | jq -e '.endTime' >/dev/null 2>&1; then
    END_TIME=$(echo "$STATUS_RESPONSE" | jq -r '.endTime // "null"')
    echo "  ✓ endTime present: $END_TIME"
else
    echo "  ✗ endTime missing"
    exit 1
fi

echo ""
echo "========================================"
echo "✓ All API fixes verified successfully!"
echo "========================================"
echo ""
echo "Summary:"
echo "  - POST /v1/orchestrate includes: error, endTime"
echo "  - GET /v1/orchestrate/:id includes: error"
echo "  - All required fields present in responses"


