#!/bin/bash
# analyze_python.sh - Python static analysis with pylint + LEARNING LOOP
#
# Usage: analyze_python.sh <target> <focus> <project_root>
#   target: File or directory to analyze
#   focus: security|performance|style|general
#   project_root: Project root directory (optional, defaults to current)
#
# Returns JSON with findings
#
# LEARNING BEHAVIOR:
#   1. Before analysis: Query mcp-prompts for learned configurations
#   2. During analysis: Use learned config if available, fallback to defaults
#   3. After analysis: Capture successful configurations for future use

set -euo pipefail

TARGET="${1:-}"
FOCUS="${2:-general}"
PROJECT_ROOT="${3:-.}"

if [ -z "$TARGET" ]; then
    echo '{"error": "Target file or directory required"}' >&2
    exit 1
fi

# Change to project root
cd "$PROJECT_ROOT"

# Detect project type
PROJECT_TYPE=$(basename "$(realpath "$PROJECT_ROOT")")

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
    SEARCH_TERMS="pylint ${FOCUS} ${PROJECT_TYPE}"
    KNOWLEDGE=$("$MCP_QUERY" search "$SEARCH_TERMS" "tool-config" 2>/dev/null || echo '{"prompts": []}')
    
    PROMPT_COUNT=$(echo "$KNOWLEDGE" | jq -r '.prompts | length // 0' 2>/dev/null || echo "0")
    
    if [ "$PROMPT_COUNT" -gt 0 ]; then
        echo "✓ Found $PROMPT_COUNT relevant knowledge item(s)" >&2
        
        CONFIG_PROMPT_ID=$(echo "$KNOWLEDGE" | jq -r '.prompts[0].id // .prompts[0].name // empty' 2>/dev/null)
        
        if [ -n "$CONFIG_PROMPT_ID" ] && [ "$CONFIG_PROMPT_ID" != "null" ]; then
            PROMPT_DATA=$("$MCP_QUERY" get "$CONFIG_PROMPT_ID" 2>/dev/null || echo '{}')
            LEARNED_CONFIG=$(echo "$PROMPT_DATA" | jq -r '.prompt.template // .prompt.content // "{}"' 2>/dev/null || echo "{}")
            
            if echo "$LEARNED_CONFIG" | jq -e '.pylint_opts' >/dev/null 2>&1; then
                LEARNED_OPTS=$(echo "$LEARNED_CONFIG" | jq -r '.pylint_opts[] // empty' 2>/dev/null)
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
# EXECUTION: Configure and run pylint
# ═══════════════════════════════════════════════════════════

# Base pylint options
PYLINT_OPTS=(
    "--output-format=json"
    "--reports=n"
)

# Apply learned configuration or use defaults
if [ "$USE_LEARNED" = "true" ] && [ -n "$LEARNED_OPTS" ]; then
    while IFS= read -r opt; do
        [ -n "$opt" ] && PYLINT_OPTS+=("$opt")
    done <<< "$LEARNED_OPTS"
else
    # Use default configuration based on focus
    case "$FOCUS" in
        security)
            PYLINT_OPTS+=(
                "--enable=E,W"
                "--disable=C,R,I"
            )
            ;;
        performance)
            PYLINT_OPTS+=(
                "--enable=W,E"
                "--disable=C,R"
            )
            ;;
        style)
            PYLINT_OPTS+=(
                "--enable=C"
                "--disable=R"
            )
            ;;
        general|*)
            PYLINT_OPTS+=(
                "--disable=C0103,C0114,C0115,C0116,R0913,R0914,R0915"
            )
            ;;
    esac
fi

# Check for project-specific pylintrc
if [ -f ".pylintrc" ]; then
    PYLINT_OPTS+=("--rcfile=.pylintrc")
fi

# Run pylint and capture output
echo "🔧 Running pylint on $TARGET with focus: $FOCUS..." >&2

OUTPUT=$(pylint "${PYLINT_OPTS[@]}" "$TARGET" 2>&1 || true)
EXIT_CODE=$?

# ═══════════════════════════════════════════════════════════
# PARSE RESULTS
# ═══════════════════════════════════════════════════════════

RESULT=$(python3 - <<'EOF' "$OUTPUT" "$TARGET" "$FOCUS" "$EXIT_CODE"
import sys
import json

try:
    output = sys.argv[1]
    target = sys.argv[2]
    focus = sys.argv[3]
    exit_code = int(sys.argv[4])

    # Parse pylint JSON output
    try:
        findings_raw = json.loads(output)
    except json.JSONDecodeError:
        # If not valid JSON, return error
        print(json.dumps({
            "target": target,
            "focus": focus,
            "tool": "pylint",
            "error": "Failed to parse pylint output",
            "raw_output": output[:500],
            "exit_code": exit_code
        }, indent=2))
        sys.exit(0)

    # Transform to our standard format
    findings = []
    summary = {
        "error": 0,
        "warning": 0,
        "refactor": 0,
        "convention": 0,
        "information": 0
    }

    for finding in findings_raw:
        # Map pylint message types to our severity
        msg_type = finding.get("type", "")
        if msg_type == "error":
            severity = "error"
        elif msg_type == "warning":
            severity = "warning"
        elif msg_type == "refactor":
            severity = "refactor"
        elif msg_type == "convention":
            severity = "convention"
        else:
            severity = "information"

        transformed = {
            "file": finding.get("path", ""),
            "line": finding.get("line", 0),
            "column": finding.get("column", 0),
            "severity": severity,
            "rule": finding.get("message-id", ""),
            "message": finding.get("message", ""),
            "symbol": finding.get("symbol", ""),
            "tool": "pylint"
        }
        findings.append(transformed)
        
        # Update summary
        if severity in summary:
            summary[severity] += 1

    result = {
        "target": target,
        "focus": focus,
        "tool": "pylint",
        "findings": findings,
        "summary": summary,
        "total_findings": len(findings),
        "exit_code": exit_code
    }

    print(json.dumps(result, indent=2))

except Exception as e:
    print(json.dumps({
        "target": sys.argv[2] if len(sys.argv) > 2 else "",
        "error": str(e),
        "tool": "pylint",
        "exit_code": exit_code if 'exit_code' in locals() else 1
    }, indent=2))
EOF
)

# Extract metrics for learning
FINDINGS_COUNT=$(echo "$RESULT" | jq -r '.total_findings // 0')
ERROR_COUNT=$(echo "$RESULT" | jq -r '.summary.error // 0')
WARNING_COUNT=$(echo "$RESULT" | jq -r '.summary.warning // 0')

# ═══════════════════════════════════════════════════════════
# LEARNING STEP 2: CAPTURE IF USEFUL
# ═══════════════════════════════════════════════════════════

USEFUL=false
if [ "$FINDINGS_COUNT" -gt 0 ] && [ "$ERROR_COUNT" -gt 0 ]; then
    USEFUL=true
elif [ "$FINDINGS_COUNT" -gt 0 ] && [ "$WARNING_COUNT" -gt 3 ]; then
    USEFUL=true
fi

if [ "$USEFUL" = "true" ] && [ -f "$MCP_QUERY" ]; then
    if [ "$USE_LEARNED" = "true" ] && [ -n "$CONFIG_PROMPT_ID" ]; then
        echo "✓ Validating learned configuration..." >&2
        
        UPDATED_CONFIG=$(echo "$LEARNED_CONFIG" | jq --argjson findings "$FINDINGS_COUNT" --argjson errors "$ERROR_COUNT" '
            .success_count = ((.success_count // 0) + 1) |
            .last_used = now |
            .last_findings = $findings |
            .last_errors = $errors |
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
        echo "💡 Capturing successful configuration..." >&2
        
        PROMPT_NAME="pylint-config-${PROJECT_TYPE}-${FOCUS}-$(date +%Y%m%d-%H%M%S)"
        
        CONFIG_JSON=$(cat <<CONFIG_EOF
{
  "project_type": "$PROJECT_TYPE",
  "focus": "$FOCUS",
  "pylint_opts": $(printf '%s\n' "${PYLINT_OPTS[@]}" | jq -R . | jq -s .),
  "findings_count": $FINDINGS_COUNT,
  "error_count": $ERROR_COUNT,
  "warning_count": $WARNING_COUNT,
  "success_metrics": {
    "found_issues": true,
    "execution_time": "fast",
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
  "description": "Successful pylint configuration for $PROJECT_TYPE $FOCUS analysis",
  "template": $(echo "$CONFIG_JSON" | jq -c .),
  "category": "tool-config",
  "tags": ["python", "pylint", "$FOCUS", "$PROJECT_TYPE", "validated"],
  "metadata": {
    "created": "$(date -Iseconds)",
    "validation": "produced_findings",
    "confidence": "low",
    "tool": "pylint",
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
