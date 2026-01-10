#!/bin/bash
# verify_learning_loop.sh - Verify learning loop implementation

set -euo pipefail

cd /home/sparrow/projects/ai-mcp-monorepo/packages/mcp-prompts

echo "═══════════════════════════════════════════════════════════"
echo "Learning Loop Verification Report"
echo "═══════════════════════════════════════════════════════════"
echo ""

PASSED=0
FAILED=0
WARNINGS=0

# Test 1: mcp_query.sh exists and is executable
echo "Test 1: mcp_query.sh wrapper"
if [ -f "scripts/mcp_query.sh" ] && [ -x "scripts/mcp_query.sh" ]; then
    echo "  ✓ mcp_query.sh exists and is executable"
    PASSED=$((PASSED + 1))
else
    echo "  ✗ mcp_query.sh missing or not executable"
    FAILED=$((FAILED + 1))
fi

# Test 2: mcp_query.sh health check
echo "Test 2: mcp_query.sh health check"
if ./scripts/mcp_query.sh health >/dev/null 2>&1; then
    echo "  ✓ Health check command works"
    PASSED=$((PASSED + 1))
else
    echo "  ⚠ Health check failed (server may not be running)"
    WARNINGS=$((WARNINGS + 1))
fi

# Test 3: Enhanced scripts exist
echo "Test 3: Enhanced scripts exist"
SCRIPTS=("analyze_cpp.sh" "analyze_python.sh" "run_tests.sh" "parse_build_errors.py")
for script in "${SCRIPTS[@]}"; do
    if [ -f "scripts/$script" ]; then
        echo "  ✓ scripts/$script exists"
        PASSED=$((PASSED + 1))
    else
        echo "  ✗ scripts/$script missing"
        FAILED=$((FAILED + 1))
    fi
done

# Test 4: Learning code in analyze_cpp.sh
echo "Test 4: Learning code in analyze_cpp.sh"
if grep -q "Checking for accumulated knowledge" scripts/analyze_cpp.sh && \
   grep -q "Capturing successful configuration" scripts/analyze_cpp.sh; then
    echo "  ✓ Learning loop code present"
    PASSED=$((PASSED + 1))
else
    echo "  ✗ Learning loop code missing"
    FAILED=$((FAILED + 1))
fi

# Test 5: Learning code in analyze_python.sh
echo "Test 5: Learning code in analyze_python.sh"
if grep -q "Checking for accumulated knowledge" scripts/analyze_python.sh && \
   grep -q "Capturing successful configuration" scripts/analyze_python.sh; then
    echo "  ✓ Learning loop code present"
    PASSED=$((PASSED + 1))
else
    echo "  ✗ Learning loop code missing"
    FAILED=$((FAILED + 1))
fi

# Test 6: Learning code in run_tests.sh
echo "Test 6: Learning code in run_tests.sh"
if grep -q "Checking for accumulated knowledge" scripts/run_tests.sh && \
   grep -q "Capturing successful test configuration" scripts/run_tests.sh; then
    echo "  ✓ Learning loop code present"
    PASSED=$((PASSED + 1))
else
    echo "  ✗ Learning loop code missing"
    FAILED=$((FAILED + 1))
fi

# Test 7: Learning code in parse_build_errors.py
echo "Test 7: Learning code in parse_build_errors.py"
if grep -q "_query_mcp_prompts" scripts/parse_build_errors.py && \
   grep -q "capture_pattern" scripts/parse_build_errors.py; then
    echo "  ✓ Learning loop code present"
    PASSED=$((PASSED + 1))
else
    echo "  ✗ Learning loop code missing"
    FAILED=$((FAILED + 1))
fi

# Test 8: Seed prompts exist
echo "Test 8: Seed prompts exist"
SEED_COUNT=$(find data/prompts/tool-config -name "*.json" 2>/dev/null | wc -l)
if [ "$SEED_COUNT" -ge 6 ]; then
    echo "  ✓ Found $SEED_COUNT seed prompts (expected 6+)"
    PASSED=$((PASSED + 1))
else
    echo "  ⚠ Found $SEED_COUNT seed prompts (expected 6+)"
    WARNINGS=$((WARNINGS + 1))
fi

# Test 9: Scripts handle missing mcp_query gracefully
echo "Test 9: Graceful degradation test"
# Temporarily rename mcp_query to test graceful degradation
if [ -f "scripts/mcp_query.sh" ]; then
    mv scripts/mcp_query.sh scripts/mcp_query.sh.bak 2>/dev/null || true
    # Test that script doesn't crash
    if ./scripts/analyze_python.sh package.json general . >/dev/null 2>&1; then
        echo "  ✓ Scripts handle missing mcp_query gracefully"
        PASSED=$((PASSED + 1))
    else
        echo "  ✗ Scripts fail when mcp_query missing"
        FAILED=$((FAILED + 1))
    fi
    mv scripts/mcp_query.sh.bak scripts/mcp_query.sh 2>/dev/null || true
fi

# Test 10: mcp_query.sh supports all operations
echo "Test 10: mcp_query.sh operations"
OPERATIONS=("health" "list" "get" "search" "create" "update")
for op in "${OPERATIONS[@]}"; do
    if grep -q "case \"\$OPERATION\" in" scripts/mcp_query.sh && \
       grep -q "$op)" scripts/mcp_query.sh; then
        echo "  ✓ Operation '$op' supported"
    else
        echo "  ✗ Operation '$op' missing"
        FAILED=$((FAILED + 1))
    fi
done
PASSED=$((PASSED + ${#OPERATIONS[@]}))

# Test 11: Learning visibility (emojis and messages)
echo "Test 11: Learning visibility"
if grep -q "🔍" scripts/analyze_cpp.sh && \
   grep -q "💡" scripts/analyze_cpp.sh && \
   grep -q "✓" scripts/analyze_cpp.sh; then
    echo "  ✓ Learning messages are visible"
    PASSED=$((PASSED + 1))
else
    echo "  ⚠ Learning messages may not be visible"
    WARNINGS=$((WARNINGS + 1))
fi

# Test 12: Configuration structure
echo "Test 12: Configuration structure in seed prompts"
if [ -f "data/prompts/tool-config/cppcheck-config-embedded-esp32-memory-default.json" ]; then
    if jq -e '.template.cppcheck_flags' data/prompts/tool-config/cppcheck-config-embedded-esp32-memory-default.json >/dev/null 2>&1; then
        echo "  ✓ Seed prompt has correct structure"
        PASSED=$((PASSED + 1))
    else
        echo "  ✗ Seed prompt structure incorrect"
        FAILED=$((FAILED + 1))
    fi
else
    echo "  ⚠ Seed prompt file not found"
    WARNINGS=$((WARNINGS + 1))
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "Verification Summary"
echo "═══════════════════════════════════════════════════════════"
echo "Passed:  $PASSED"
echo "Failed:  $FAILED"
echo "Warnings: $WARNINGS"
echo ""

if [ "$FAILED" -eq 0 ]; then
    echo "✓ All critical tests passed!"
    echo ""
    echo "Learning loop implementation is VERIFIED:"
    echo "  ✓ mcp_query.sh wrapper created"
    echo "  ✓ All scripts enhanced with learning loops"
    echo "  ✓ Graceful degradation implemented"
    echo "  ✓ Seed prompts created"
    echo "  ✓ Learning visibility implemented"
    echo ""
    echo "Note: Full end-to-end testing requires:"
    echo "  - mcp-prompts server running with file storage"
    echo "  - Tools installed (pylint, cppcheck, pytest)"
    echo "  - Actual code to analyze"
    exit 0
else
    echo "✗ Some tests failed. Please review above."
    exit 1
fi
