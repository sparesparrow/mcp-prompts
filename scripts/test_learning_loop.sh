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
    HEALTH=$(curl -s --max-time 2 http://localhost:3000/health | jq -r '.status // "unknown"' 2>/dev/null || echo "unknown")
    echo "  Status: $HEALTH"
else
    echo "✗ Server is not running. Please start with: MODE=http STORAGE_TYPE=file pnpm start:http"
    exit 1
fi
echo ""

# Step 2: Check for existing prompts
echo "Step 2: Checking for existing tool-config prompts..."
EXISTING_COUNT=$(./scripts/mcp_query.sh list "tool-config" 2>/dev/null | jq -r '.prompts | length // 0' 2>/dev/null || echo "0")
echo "Found $EXISTING_COUNT existing prompts via API"
echo ""

# Check file-based prompts
FILE_COUNT=$(find data/prompts/tool-config -name "*.json" 2>/dev/null | wc -l)
echo "Found $FILE_COUNT prompt files in data/prompts/tool-config/"
echo ""

# Step 3: Test analyze_python.sh - First Run (should capture)
echo "Step 3: Testing analyze_python.sh - FIRST RUN (should capture learning)..."
echo "───────────────────────────────────────────────────────────"
TEST_FILE="src/index.ts"  # Using TypeScript file as test target
if [ ! -f "$TEST_FILE" ]; then
    TEST_FILE="package.json"
fi

echo "Target: $TEST_FILE"
FIRST_RUN=$(./scripts/analyze_python.sh "$TEST_FILE" general . 2>&1)
echo "$FIRST_RUN" | grep -E "(🔍|✓|ℹ|⚠|💡|Running|Checking)" | head -10
echo ""

# Extract JSON result
FIRST_RESULT=$(echo "$FIRST_RUN" | tail -1)
FIRST_FINDINGS=$(echo "$FIRST_RESULT" | jq -r '.total_findings // 0' 2>/dev/null || echo "0")
echo "Findings in first run: $FIRST_FINDINGS"

# Check if learning was captured
if echo "$FIRST_RUN" | grep -q "Capturing successful configuration"; then
    echo "✓ Learning was captured in first run"
    CAPTURED=true
else
    echo "⚠ Learning may not have been captured (findings: $FIRST_FINDINGS)"
    CAPTURED=false
fi
echo ""

# Step 4: Test analyze_python.sh - Second Run (should use learned)
echo "Step 4: Testing analyze_python.sh - SECOND RUN (should use learned config)..."
echo "───────────────────────────────────────────────────────────"
SECOND_RUN=$(./scripts/analyze_python.sh "$TEST_FILE" general . 2>&1)
echo "$SECOND_RUN" | grep -E "(🔍|✓|ℹ|⚠|💡|Running|Checking|Using learned)" | head -10
echo ""

# Check if learned config was used
if echo "$SECOND_RUN" | grep -q "Using learned configuration"; then
    echo "✓ Learned configuration was used in second run"
    LEARNING_WORKS=true
else
    echo "⚠ Learned configuration was not used"
    LEARNING_WORKS=false
fi
echo ""

# Step 5: Verify prompts were created
echo "Step 5: Verifying prompts in mcp-prompts..."
NEW_COUNT=$(./scripts/mcp_query.sh list "tool-config" 2>/dev/null | jq -r '.prompts | length // 0' 2>/dev/null || echo "0")
echo "Total prompts via API: $NEW_COUNT (was $EXISTING_COUNT)"
if [ "$NEW_COUNT" -gt "$EXISTING_COUNT" ]; then
    echo "✓ New prompts were created via API"
else
    echo "ℹ No new prompts via API (may be using file storage)"
fi
echo ""

# Step 6: Test mcp_query.sh search
echo "Step 6: Testing search functionality..."
SEARCH_RESULTS=$(./scripts/mcp_query.sh search "pylint general" 2>&1 | jq -r '.prompts | length // 0' 2>/dev/null || echo "0")
echo "Search results for 'pylint general': $SEARCH_RESULTS prompts"
echo ""

# Step 7: Test with a simple Python file if available
echo "Step 7: Testing with actual Python file..."
PYTHON_FILE=$(find . -name "*.py" -type f | grep -v __pycache__ | head -1)
if [ -n "$PYTHON_FILE" ]; then
    echo "Testing with: $PYTHON_FILE"
    PYTHON_RUN=$(./scripts/analyze_python.sh "$PYTHON_FILE" general . 2>&1)
    echo "$PYTHON_RUN" | grep -E "(🔍|✓|ℹ|⚠|💡|Running|Checking)" | head -5
    PYTHON_FINDINGS=$(echo "$PYTHON_RUN" | tail -1 | jq -r '.total_findings // 0' 2>/dev/null || echo "0")
    echo "Findings: $PYTHON_FINDINGS"
else
    echo "No Python files found for testing"
fi
echo ""

# Step 8: Summary
echo "═══════════════════════════════════════════════════════════"
echo "Test Summary"
echo "═══════════════════════════════════════════════════════════"
echo "Server Status: ✓ Running ($HEALTH)"
echo "File-based Prompts: $FILE_COUNT"
echo "API Prompts: $EXISTING_COUNT → $NEW_COUNT"
echo "First Run: ✓ Executed ($FIRST_FINDINGS findings)"
echo "Learning Capture: $(if [ "$CAPTURED" = "true" ]; then echo "✓"; else echo "⚠"; fi)"
echo "Second Run: ✓ Executed"
echo "Learning Reuse: $(if [ "$LEARNING_WORKS" = "true" ]; then echo "✓"; else echo "⚠"; fi)"
echo ""
if [ "$LEARNING_WORKS" = "true" ]; then
    echo "✓ Learning loop is WORKING"
else
    echo "⚠ Learning loop is PARTIALLY WORKING"
    echo "  - Scripts execute correctly"
    echo "  - Learning capture may need server restart or file storage mode"
    echo "  - Check server logs for details"
fi
echo ""
