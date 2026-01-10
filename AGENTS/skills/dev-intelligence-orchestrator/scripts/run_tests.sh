#!/bin/bash
# run_tests.sh - Execute tests with appropriate framework + LEARNING LOOP
#
# Usage: run_tests.sh <project_root> <test_path> <coverage>
#   project_root: Project root directory
#   test_path: Optional specific test file/directory
#   coverage: true|false (default: false)
#
# Returns JSON with test results
#
# LEARNING BEHAVIOR:
#   1. Before execution: Query mcp-prompts for learned test configurations
#   2. During execution: Use learned config if available
#   3. After execution: Capture successful test patterns

set -euo pipefail

PROJECT_ROOT="${1:-.}"
TEST_PATH="${2:-}"
COVERAGE="${3:-false}"

cd "$PROJECT_ROOT"

# Detect test framework based on files
detect_framework() {
    if [ -f "platformio.ini" ] && [ -d "test" ]; then
        echo "platformio"
    elif find . -name "test_*.py" -o -name "*_test.py" 2>/dev/null | grep -q .; then
        echo "pytest"
    elif find . -name "*_test.cpp" -o -name "*Test.cpp" 2>/dev/null | grep -q .; then
        echo "gtest"
    elif [ -f "build.gradle" ] || [ -f "build.gradle.kts" ]; then
        echo "gradle"
    else
        echo "unknown"
    fi
}

FRAMEWORK=$(detect_framework)
PROJECT_TYPE=$(basename "$(realpath "$PROJECT_ROOT")")

echo "Detected test framework: $FRAMEWORK" >&2

# ═══════════════════════════════════════════════════════════
# LEARNING STEP 1: QUERY EXISTING KNOWLEDGE
# ═══════════════════════════════════════════════════════════

echo "🔍 Checking for accumulated knowledge..." >&2

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MCP_QUERY="${SCRIPT_DIR}/mcp_query.sh"

LEARNED_CONFIG=""
CONFIG_PROMPT_ID=""
USE_LEARNED=false

if [ -f "$MCP_QUERY" ]; then
    SEARCH_TERMS="${FRAMEWORK} test ${PROJECT_TYPE}"
    KNOWLEDGE=$("$MCP_QUERY" search "$SEARCH_TERMS" "tool-config" 2>/dev/null || echo '{"prompts": []}')
    
    PROMPT_COUNT=$(echo "$KNOWLEDGE" | jq -r '.prompts | length // 0' 2>/dev/null || echo "0")
    
    if [ "$PROMPT_COUNT" -gt 0 ]; then
        echo "✓ Found $PROMPT_COUNT relevant knowledge item(s)" >&2
        
        CONFIG_PROMPT_ID=$(echo "$KNOWLEDGE" | jq -r '.prompts[0].id // .prompts[0].name // empty' 2>/dev/null)
        
        if [ -n "$CONFIG_PROMPT_ID" ] && [ "$CONFIG_PROMPT_ID" != "null" ]; then
            PROMPT_DATA=$("$MCP_QUERY" get "$CONFIG_PROMPT_ID" 2>/dev/null || echo '{}')
            LEARNED_CONFIG=$(echo "$PROMPT_DATA" | jq -r '.prompt.template // .prompt.content // "{}"' 2>/dev/null || echo "{}")
            
            if echo "$LEARNED_CONFIG" | jq -e '.test_opts' >/dev/null 2>&1; then
                LEARNED_OPTS=$(echo "$LEARNED_CONFIG" | jq -r '.test_opts[] // empty' 2>/dev/null)
                if [ -n "$LEARNED_OPTS" ]; then
                    USE_LEARNED=true
                    echo "✓ Using learned configuration from: $CONFIG_PROMPT_ID" >&2
                fi
            fi
        fi
    else
        echo "ℹ No accumulated knowledge yet, using defaults (will capture learnings)" >&2
    fi
else
    echo "⚠ mcp_query.sh not found, using defaults (no learning)" >&2
fi

# ═══════════════════════════════════════════════════════════
# EXECUTION: Run tests with framework-specific logic
# ═══════════════════════════════════════════════════════════

case "$FRAMEWORK" in
    pytest)
        echo "🔧 Running pytest..." >&2
        
        PYTEST_OPTS=("-v" "--tb=short")
        
        # Apply learned options if available
        if [ "$USE_LEARNED" = "true" ] && [ -n "$LEARNED_OPTS" ]; then
            while IFS= read -r opt; do
                [ -n "$opt" ] && PYTEST_OPTS+=("$opt")
            done <<< "$LEARNED_OPTS"
        fi
        
        if [ "$COVERAGE" = "true" ]; then
            PYTEST_OPTS+=("--cov=src" "--cov=." "--cov-report=json" "--cov-report=term")
        fi
        
        if [ -n "$TEST_PATH" ]; then
            PYTEST_OPTS+=("$TEST_PATH")
        fi
        
        # Run pytest and capture output
        PYTEST_OUTPUT=$(pytest "${PYTEST_OPTS[@]}" 2>&1 || true)
        PYTEST_EXIT=$?
        
        # Parse pytest output
        RESULT=$(python3 - <<'EOF' "$PYTEST_OUTPUT" "$PYTEST_EXIT" "$COVERAGE"
import sys
import json
import re
import os

output = sys.argv[1]
exit_code = int(sys.argv[2])
coverage = sys.argv[3] == "true"

# Parse test results
passed = 0
failed = 0
skipped = 0
errors = 0
total_time = 0.0

# Extract summary line
summary_pattern = r'=+ (\d+) failed.*?(\d+) passed.*?in ([\d.]+)s'
summary_match = re.search(summary_pattern, output)

if summary_match:
    failed = int(summary_match.group(1))
    passed = int(summary_match.group(2))
    total_time = float(summary_match.group(3))
else:
    # Try alternative patterns
    passed_match = re.search(r'(\d+) passed', output)
    failed_match = re.search(r'(\d+) failed', output)
    skipped_match = re.search(r'(\d+) skipped', output)
    time_match = re.search(r'in ([\d.]+)s', output)
    
    if passed_match:
        passed = int(passed_match.group(1))
    if failed_match:
        failed = int(failed_match.group(1))
    if skipped_match:
        skipped = int(skipped_match.group(1))
    if time_match:
        total_time = float(time_match.group(1))

# Extract failed test details
failed_tests = []
failed_pattern = r'FAILED ([\w/.]+::\w+) - (.+?)(?:\n|$)'
for match in re.finditer(failed_pattern, output):
    test_name = match.group(1)
    error_msg = match.group(2)
    failed_tests.append({
        "test": test_name,
        "error": error_msg
    })

# Load coverage data if available
coverage_data = None
if coverage and os.path.exists("coverage.json"):
    try:
        with open("coverage.json") as f:
            cov = json.load(f)
            coverage_data = {
                "total_statements": cov.get("totals", {}).get("num_statements", 0),
                "covered_statements": cov.get("totals", {}).get("covered_lines", 0),
                "coverage_percent": cov.get("totals", {}).get("percent_covered", 0.0)
            }
    except:
        pass

result = {
    "framework": "pytest",
    "summary": {
        "passed": passed,
        "failed": failed,
        "skipped": skipped,
        "errors": errors,
        "total": passed + failed + skipped
    },
    "execution_time": total_time,
    "failed_tests": failed_tests,
    "coverage": coverage_data,
    "success": exit_code == 0,
    "raw_output": output
}

print(json.dumps(result, indent=2))
EOF
)
        ;;
        
    platformio)
        echo "🔧 Running PlatformIO tests..." >&2
        
        PIO_OUTPUT=$(pio test 2>&1 || true)
        PIO_EXIT=$?
        
        RESULT=$(python3 - <<'EOF' "$PIO_OUTPUT" "$PIO_EXIT"
import sys
import json
import re

output = sys.argv[1]
exit_code = int(sys.argv[2])

# Parse PlatformIO test output
# Format: test/test_* [PASSED]
passed = len(re.findall(r'\[PASSED\]', output))
failed = len(re.findall(r'\[FAILED\]', output))
ignored = len(re.findall(r'\[IGNORED\]', output))

result = {
    "framework": "platformio",
    "summary": {
        "passed": passed,
        "failed": failed,
        "skipped": ignored,
        "total": passed + failed + ignored
    },
    "success": exit_code == 0 and failed == 0,
    "raw_output": output
}

print(json.dumps(result, indent=2))
EOF
)
        ;;
        
    *)
        echo '{"error": "No supported test framework detected"}' >&2
        exit 1
        ;;
esac

# ═══════════════════════════════════════════════════════════
# LEARNING STEP 2: CAPTURE IF USEFUL
# ═══════════════════════════════════════════════════════════

# Extract metrics
PASSED=$(echo "$RESULT" | jq -r '.summary.passed // 0')
FAILED=$(echo "$RESULT" | jq -r '.summary.failed // 0')
TOTAL=$(echo "$RESULT" | jq -r '.summary.total // 0')
SUCCESS=$(echo "$RESULT" | jq -r '.success // false')

# Capture if tests passed or provided useful information
USEFUL=false
if [ "$SUCCESS" = "true" ] && [ "$TOTAL" -gt 0 ]; then
    USEFUL=true
elif [ "$FAILED" -gt 0 ] && [ "$TOTAL" -gt 0 ]; then
    # Failed tests are also useful - they show what needs fixing
    USEFUL=true
fi

if [ "$USEFUL" = "true" ] && [ -f "$MCP_QUERY" ]; then
    if [ "$USE_LEARNED" = "true" ] && [ -n "$CONFIG_PROMPT_ID" ]; then
        echo "✓ Validating learned configuration..." >&2
        
        UPDATED_CONFIG=$(echo "$LEARNED_CONFIG" | jq --argjson passed "$PASSED" --argjson failed "$FAILED" --argjson total "$TOTAL" '
            .success_count = ((.success_count // 0) + 1) |
            .last_used = now |
            .last_passed = $passed |
            .last_failed = $failed |
            .last_total = $total |
            .confidence = (if .success_count > 3 then "high" elif .success_count > 1 then "medium" else "low" end)
        ')
        
        UPDATE_DATA=$(cat <<UPDATE_EOF
{
  "template": $(echo "$UPDATED_CONFIG" | jq -c .),
  "metadata": {
    "success_count": $(echo "$UPDATED_CONFIG" | jq -r '.success_count'),
    "last_used": "$(date -Iseconds)",
    "confidence": $(echo "$UPDATED_CONFIG" | jq -r '.confidence')
  }
}
UPDATE_EOF
)
        
        "$MCP_QUERY" update "$CONFIG_PROMPT_ID" "$UPDATE_DATA" >/dev/null 2>&1 || true
    else
        echo "💡 Capturing successful test configuration..." >&2
        
        PROMPT_NAME="test-config-${FRAMEWORK}-${PROJECT_TYPE}-$(date +%Y%m%d-%H%M%S)"
        
        # Build test options array
        TEST_OPTS_ARRAY="[]"
        case "$FRAMEWORK" in
            pytest)
                TEST_OPTS_ARRAY=$(printf '%s\n' "${PYTEST_OPTS[@]}" | jq -R . | jq -s .)
                ;;
        esac
        
        CONFIG_JSON=$(cat <<CONFIG_EOF
{
  "framework": "$FRAMEWORK",
  "project_type": "$PROJECT_TYPE",
  "test_opts": $TEST_OPTS_ARRAY,
  "coverage": $COVERAGE,
  "test_results": {
    "passed": $PASSED,
    "failed": $FAILED,
    "total": $TOTAL,
    "success": $SUCCESS
  },
  "success_metrics": {
    "execution_time": "$(date -Iseconds)",
    "validation_date": "$(date -Iseconds)"
  },
  "success_count": 1,
  "confidence": "low"
}
CONFIG_EOF
)
        
        PROMPT_DATA=$(cat <<PROMPT_EOF
{
  "name": "$PROMPT_NAME",
  "description": "Successful test configuration for $FRAMEWORK in $PROJECT_TYPE",
  "template": $(echo "$CONFIG_JSON" | jq -c .),
  "category": "tool-config",
  "tags": ["test", "$FRAMEWORK", "$PROJECT_TYPE", "validated"],
  "metadata": {
    "created": "$(date -Iseconds)",
    "validation": "test_execution",
    "confidence": "low",
    "framework": "$FRAMEWORK",
    "project_type": "$PROJECT_TYPE"
  }
}
PROMPT_EOF
)
        
        "$MCP_QUERY" create "$PROMPT_DATA" >/dev/null 2>&1 && echo "✓ Configuration captured for future use" >&2 || echo "⚠ Failed to capture configuration" >&2
    fi
fi

# Output results
echo "$RESULT"
