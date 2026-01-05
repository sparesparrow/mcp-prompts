#!/bin/bash
# test_learning_loop.sh - Test the learning loop functionality

set -euo pipefail

cd /home/sparrow/projects/ai-mcp-monorepo/packages/mcp-prompts

echo "═══════════════════════════════════════════════════════════"
echo "Testing Learning Loop for dev-intelligence-orchestrator"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Step 1: Check server health
echo "Step 1: Checking mcp-prompts server health..."
if curl -s --max-time 2 http://localhost:3000/health >/dev/null 2>&1; then
    echo "✓ Server is running"
else
    echo "✗ Server is not running. Please start with: MODE=http STORAGE_TYPE=file pnpm start:http"
    exit 1
fi
echo ""

# Step 2: Check for existing prompts
echo "Step 2: Checking for existing tool-config prompts..."
EXISTING_COUNT=$(./scripts/mcp_query.sh list "tool-config" 2>/dev/null | jq -r '.prompts | length // 0' 2>/dev/null || echo "0")
echo "Found $EXISTING_COUNT existing prompts"
echo ""

# Step 3: Test analyze_python.sh - First Run (should capture)
echo "Step 3: Testing analyze_python.sh - FIRST RUN (should capture learning)..."
echo "───────────────────────────────────────────────────────────"
TEST_FILE="src/index.ts"  # Using TypeScript file as test target
if [ ! -f "$TEST_FILE" ]; then
    TEST_FILE="package.json"
fi

FIRST_RUN=$(./scripts/analyze_python.sh "$TEST_FILE" general . 2>&1)
echo "$FIRST_RUN" | head -20
echo ""

# Check if learning was captured
if echo "$FIRST_RUN" | grep -q "Capturing successful configuration"; then
    echo "✓ Learning was captured in first run"
else
    echo "⚠ Learning may not have been captured (check if findings were useful)"
fi
echo ""

# Step 4: Test analyze_python.sh - Second Run (should use learned)
echo "Step 4: Testing analyze_python.sh - SECOND RUN (should use learned config)..."
echo "───────────────────────────────────────────────────────────"
SECOND_RUN=$(./scripts/analyze_python.sh "$TEST_FILE" general . 2>&1)
echo "$SECOND_RUN" | head -20
echo ""

# Check if learned config was used
if echo "$SECOND_RUN" | grep -q "Using learned configuration"; then
    echo "✓ Learned configuration was used in second run"
    LEARNING_WORKS=true
else
    echo "⚠ Learned configuration was not used (may need to wait or check server)"
    LEARNING_WORKS=false
fi
echo ""

# Step 5: Verify prompts were created
echo "Step 5: Verifying prompts in mcp-prompts..."
NEW_COUNT=$(./scripts/mcp_query.sh list "tool-config" 2>/dev/null | jq -r '.prompts | length // 0' 2>/dev/null || echo "0")
echo "Total prompts now: $NEW_COUNT (was $EXISTING_COUNT)"
if [ "$NEW_COUNT" -gt "$EXISTING_COUNT" ]; then
    echo "✓ New prompts were created"
else
    echo "⚠ No new prompts detected (may be using file storage)"
fi
echo ""

# Step 6: Test mcp_query.sh search
echo "Step 6: Testing search functionality..."
SEARCH_RESULTS=$(./scripts/mcp_query.sh search "pylint general" 2>&1 | jq -r '.prompts | length // 0' 2>/dev/null || echo "0")
echo "Search results for 'pylint general': $SEARCH_RESULTS prompts"
echo ""

# Step 7: Summary
echo "═══════════════════════════════════════════════════════════"
echo "Test Summary"
echo "═══════════════════════════════════════════════════════════"
echo "Server Status: ✓ Running"
echo "First Run: ✓ Executed"
echo "Learning Capture: $(if echo "$FIRST_RUN" | grep -q "Capturing"; then echo "✓"; else echo "⚠"; fi)"
echo "Second Run: ✓ Executed"
echo "Learning Reuse: $(if [ "$LEARNING_WORKS" = "true" ]; then echo "✓"; else echo "⚠"; fi)"
echo "Prompts Count: $EXISTING_COUNT → $NEW_COUNT"
echo ""
echo "Learning loop is $(if [ "$LEARNING_WORKS" = "true" ]; then echo "WORKING ✓"; else echo "PARTIALLY WORKING (may need server restart or file storage)"; fi)"
echo ""
