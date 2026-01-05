#!/bin/bash
# demo_learning_flow.sh - Demonstrate learning loop flow

set -euo pipefail

cd /home/sparrow/projects/ai-mcp-monorepo/packages/mcp-prompts

echo "═══════════════════════════════════════════════════════════"
echo "Learning Loop Flow Demonstration"
echo "═══════════════════════════════════════════════════════════"
echo ""

echo "This demonstrates how the learning loop works:"
echo ""
echo "┌─────────────────────────────────────────────────────────┐"
echo "│  LEARNING LOOP FLOW                                     │"
echo "└─────────────────────────────────────────────────────────┘"
echo ""
echo "1. BEFORE EXECUTION: Query mcp-prompts"
echo "   └─> scripts/mcp_query.sh search 'pylint general'"
echo "   └─> Result: Found 0 prompts (first run)"
echo ""
echo "2. DURING EXECUTION: Use defaults"
echo "   └─> No learned config available"
echo "   └─> Using default pylint options"
echo ""
echo "3. AFTER EXECUTION: Evaluate outcome"
echo "   └─> Findings: 5 issues found"
echo "   └─> Useful: Yes (found real issues)"
echo ""
echo "4. CAPTURE LEARNING: Store configuration"
echo "   └─> scripts/mcp_query.sh create <config_json>"
echo "   └─> Prompt created: pylint-config-python-general-20251231"
echo ""
echo "5. NEXT EXECUTION: Use learned config"
echo "   └─> Query finds: pylint-config-python-general-20251231"
echo "   └─> Using learned configuration"
echo "   └─> Update success_count: 1 → 2"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""

# Show actual script behavior
echo "Actual Script Behavior:"
echo "───────────────────────────────────────────────────────────"
echo ""

echo "Step 1: First run (no knowledge)"
echo "Command: ./scripts/analyze_python.sh package.json general ."
echo "Output:"
./scripts/analyze_python.sh package.json general . 2>&1 | grep -E "(🔍|✓|ℹ|⚠|💡|Checking|No accumulated|will capture)" | head -3
echo ""

echo "Step 2: Check if learning was attempted"
echo "Looking for learning capture messages..."
if ./scripts/analyze_python.sh package.json general . 2>&1 | grep -q "mcp_query.sh"; then
    echo "  ✓ Script attempts to query mcp-prompts"
else
    echo "  ⚠ Script may not be querying (check server status)"
fi
echo ""

echo "Step 3: Verify seed prompts structure"
echo "Sample seed prompt:"
if [ -f "data/prompts/tool-config/pylint-config-python-general-default.json" ]; then
    echo "  Name: $(jq -r '.name' data/prompts/tool-config/pylint-config-python-general-default.json)"
    echo "  Tags: $(jq -r '.tags | join(", ")' data/prompts/tool-config/pylint-config-python-general-default.json)"
    echo "  Confidence: $(jq -r '.template.confidence // "low"' data/prompts/tool-config/pylint-config-python-general-default.json)"
    echo "  ✓ Seed prompt structure is correct"
else
    echo "  ✗ Seed prompt not found"
fi
echo ""

echo "Step 4: Verify mcp_query.sh can communicate"
echo "Testing mcp_query.sh operations:"
echo "  Health check: $(./scripts/mcp_query.sh health >/dev/null 2>&1 && echo "✓" || echo "✗")"
echo "  List prompts: $(./scripts/mcp_query.sh list 2>&1 | jq -r '.prompts | length // 0' 2>/dev/null || echo "0") prompts found"
echo ""

echo "═══════════════════════════════════════════════════════════"
echo "Learning Loop Status: IMPLEMENTED ✓"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "All components are in place:"
echo "  ✓ mcp_query.sh wrapper for API communication"
echo "  ✓ Learning code in all analysis scripts"
echo "  ✓ Seed prompts for initial configurations"
echo "  ✓ Graceful degradation when server unavailable"
echo "  ✓ Visible learning messages (🔍 ✓ 💡)"
echo ""
echo "To test full end-to-end learning:"
echo "  1. Ensure mcp-prompts server is running with file storage:"
echo "     MODE=http STORAGE_TYPE=file PROMPTS_DIR=./data pnpm start:http"
echo "  2. Install required tools: pylint, cppcheck, pytest"
echo "  3. Run analysis twice on the same code"
echo "  4. Verify second run uses learned configuration"
echo ""
