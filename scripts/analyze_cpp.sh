#!/bin/bash
# analyze_cpp.sh - C++ static analysis with cppcheck + LEARNING LOOP
#
# Usage: analyze_cpp.sh <target> <focus> <project_root>
#   target: File or directory to analyze
#   focus: security|performance|memory|general
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

# Detect project type for context
PROJECT_TYPE=$(basename "$(realpath "$PROJECT_ROOT")")
IS_EMBEDDED=false
if [[ "$TARGET" == *"esp32"* ]] || [[ "$PWD" == *"esp32"* ]] || [[ "$PROJECT_TYPE" == *"esp32"* ]]; then
    IS_EMBEDDED=true
    PROJECT_TYPE="embedded-esp32"
fi

# Determine project nature from directory structure
if [ -f "platformio.ini" ]; then
    if grep -q "esp32" platformio.ini 2>/dev/null; then
        PROJECT_TYPE="embedded-esp32"
        IS_EMBEDDED=true
    else
        PROJECT_TYPE="embedded"
        IS_EMBEDDED=true
    fi
fi

# ═══════════════════════════════════════════════════════════
# LEARNING STEP 1: QUERY EXISTING KNOWLEDGE
# ═══════════════════════════════════════════════════════════

echo "🔍 Checking for accumulated knowledge..." >&2

# Get script directory to find mcp_query.sh
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MCP_QUERY="${SCRIPT_DIR}/mcp_query.sh"

# Try to find learned configuration
LEARNED_CONFIG=""
CONFIG_PROMPT_ID=""
USE_LEARNED=false

if [ -f "$MCP_QUERY" ]; then
    # Search for relevant prompts by category
    SEARCH_TERMS="cppcheck ${FOCUS} ${PROJECT_TYPE}"
    KNOWLEDGE=$("$MCP_QUERY" search "$SEARCH_TERMS" "tool-config" 2>/dev/null || echo '{"prompts": []}')
    
    # Check if we got valid results
    PROMPT_COUNT=$(echo "$KNOWLEDGE" | jq -r '.prompts | length // 0' 2>/dev/null || echo "0")
    
    if [ "$PROMPT_COUNT" -gt 0 ]; then
        echo "✓ Found $PROMPT_COUNT relevant knowledge item(s)" >&2
        
        # Get the most relevant prompt (first one)
        CONFIG_PROMPT_ID=$(echo "$KNOWLEDGE" | jq -r '.prompts[0].id // .prompts[0].name // empty' 2>/dev/null)
        
        if [ -n "$CONFIG_PROMPT_ID" ] && [ "$CONFIG_PROMPT_ID" != "null" ]; then
            # Fetch the full prompt
            PROMPT_DATA=$("$MCP_QUERY" get "$CONFIG_PROMPT_ID" 2>/dev/null || echo '{}')
            
            # Extract configuration from prompt template/content
            # The prompt template might be JSON with cppcheck_flags
            LEARNED_CONFIG=$(echo "$PROMPT_DATA" | jq -r '.prompt.template // .prompt.content // "{}"' 2>/dev/null || echo "{}")
            
            # Try to parse as JSON and extract flags
            if echo "$LEARNED_CONFIG" | jq -e '.cppcheck_flags' >/dev/null 2>&1; then
                LEARNED_FLAGS=$(echo "$LEARNED_CONFIG" | jq -r '.cppcheck_flags[] // empty' 2>/dev/null)
                if [ -n "$LEARNED_FLAGS" ]; then
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
# EXECUTION: Configure and run cppcheck
# ═══════════════════════════════════════════════════════════

# Base cppcheck options
CPPCHECK_OPTS=(
    "--quiet"
    "--template={file}:{line}:{column}: {severity}: {id}: {message}"
    "--inline-suppr"
    "--suppress=missingIncludeSystem"
)

# Apply learned configuration or use defaults
if [ "$USE_LEARNED" = "true" ] && [ -n "$LEARNED_FLAGS" ]; then
    # Use learned flags
    while IFS= read -r flag; do
        [ -n "$flag" ] && CPPCHECK_OPTS+=("$flag")
    done <<< "$LEARNED_FLAGS"
else
    # Use default configuration based on focus
    case "$FOCUS" in
        security)
            CPPCHECK_OPTS+=("--enable=warning,style,performance,portability")
            ;;
        performance)
            CPPCHECK_OPTS+=("--enable=performance,warning")
            ;;
        memory)
            CPPCHECK_OPTS+=("--enable=warning,performance,portability")
            ;;
        general|*)
            CPPCHECK_OPTS+=("--enable=all")
            ;;
    esac
    
    # Configure for embedded vs desktop
    if [ "$IS_EMBEDDED" = "true" ]; then
        CPPCHECK_OPTS+=(
            "--std=c++11"
            "--platform=unix32"
        )
    else
        CPPCHECK_OPTS+=(
            "--std=c++17"
        )
    fi
fi

# Add include directories if they exist
for INC_DIR in "include" "src" "lib"; do
    if [ -d "$INC_DIR" ]; then
        CPPCHECK_OPTS+=("-I$INC_DIR")
    fi
done

# Run cppcheck and capture output
echo "🔧 Running cppcheck on $TARGET with focus: $FOCUS..." >&2

OUTPUT=$(cppcheck "${CPPCHECK_OPTS[@]}" "$TARGET" 2>&1 || true)
EXIT_CODE=$?

# ═══════════════════════════════════════════════════════════
# PARSE RESULTS
# ═══════════════════════════════════════════════════════════

RESULT=$(python3 - <<'EOF' "$OUTPUT" "$TARGET" "$FOCUS" "$EXIT_CODE"
import sys
import json
import re

output = sys.argv[1]
target = sys.argv[2]
focus = sys.argv[3]
exit_code = int(sys.argv[4])

findings = []
summary = {
    "error": 0,
    "warning": 0,
    "style": 0,
    "performance": 0,
    "portability": 0,
    "information": 0
}

# Parse cppcheck output
# Format: file:line:column: severity: id: message
pattern = r'^(.+?):(\d+):(\d+):\s+(\w+):\s+(\w+):\s+(.+)$'

for line in output.split('\n'):
    line = line.strip()
    if not line:
        continue
        
    match = re.match(pattern, line)
    if match:
        file_path, line_num, column, severity, rule_id, message = match.groups()
        
        finding = {
            "file": file_path,
            "line": int(line_num),
            "column": int(column),
            "severity": severity,
            "rule": rule_id,
            "message": message,
            "tool": "cppcheck"
        }
        findings.append(finding)
        
        # Update summary
        if severity in summary:
            summary[severity] += 1

result = {
    "target": target,
    "focus": focus,
    "tool": "cppcheck",
    "findings": findings,
    "summary": summary,
    "total_findings": len(findings),
    "exit_code": exit_code
}

print(json.dumps(result, indent=2))
EOF
)

# Extract metrics for learning
FINDINGS_COUNT=$(echo "$RESULT" | jq -r '.total_findings // 0')
HIGH_SEVERITY=$(echo "$RESULT" | jq -r '[.findings[] | select(.severity == "error")] | length')
WARNING_COUNT=$(echo "$RESULT" | jq -r '.summary.warning // 0')

# ═══════════════════════════════════════════════════════════
# LEARNING STEP 2: CAPTURE IF USEFUL
# ═══════════════════════════════════════════════════════════

# Determine if this configuration was useful
# Useful = found real issues (not just noise) or validated existing config
USEFUL=false
if [ "$FINDINGS_COUNT" -gt 0 ] && [ "$HIGH_SEVERITY" -gt 0 ]; then
    # Found high-severity issues - this is useful
    USEFUL=true
elif [ "$FINDINGS_COUNT" -gt 0 ] && [ "$WARNING_COUNT" -gt 3 ]; then
    # Found multiple warnings - potentially useful
    USEFUL=true
fi

if [ "$USEFUL" = "true" ] && [ -f "$MCP_QUERY" ]; then
    if [ "$USE_LEARNED" = "true" ] && [ -n "$CONFIG_PROMPT_ID" ]; then
        # Update existing prompt with validation
        echo "✓ Validating learned configuration..." >&2
        
        # Increment success count in metadata
        UPDATED_CONFIG=$(echo "$LEARNED_CONFIG" | jq --argjson findings "$FINDINGS_COUNT" --argjson high "$HIGH_SEVERITY" '
            .success_count = ((.success_count // 0) + 1) |
            .last_used = now |
            .last_findings = $findings |
            .last_high_severity = $high |
            .confidence = (if .success_count > 3 then "high" elif .success_count > 1 then "medium" else "low" end)
        ')
        
        # Update prompt via API
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
        # Create new prompt from successful defaults
        echo "💡 Capturing successful configuration..." >&2
        
        PROMPT_NAME="cppcheck-config-${PROJECT_TYPE}-${FOCUS}-$(date +%Y%m%d-%H%M%S)"
        
        # Build configuration JSON
        CONFIG_JSON=$(cat <<CONFIG_EOF
{
  "project_type": "$PROJECT_TYPE",
  "focus": "$FOCUS",
  "is_embedded": $IS_EMBEDDED,
  "cppcheck_flags": $(printf '%s\n' "${CPPCHECK_OPTS[@]}" | jq -R . | jq -s .),
  "findings_count": $FINDINGS_COUNT,
  "high_severity_count": $HIGH_SEVERITY,
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
        
        # Create prompt
        PROMPT_DATA=$(cat <<PROMPT_EOF
{
  "name": "$PROMPT_NAME",
  "description": "Successful cppcheck configuration for $PROJECT_TYPE $FOCUS analysis",
  "template": $(echo "$CONFIG_JSON" | jq -c .),
  "category": "tool-config",
  "tags": ["cpp", "cppcheck", "$FOCUS", "$PROJECT_TYPE", "validated"],
  "metadata": {
    "created": "$(date -Iseconds)",
    "validation": "produced_findings",
    "confidence": "low",
    "tool": "cppcheck",
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
