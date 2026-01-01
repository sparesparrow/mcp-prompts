#!/bin/bash
# validate_learned_knowledge.sh
# Validates prompt files for required structure and completeness

PROMPTS_DIR="${1:-data/prompts}"
VALID_COUNT=0
INVALID_COUNT=0
TOTAL_COUNT=0

echo "═══════════════════════════════════════════════════════════"
echo "Knowledge Validation Report"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Find all JSON prompt files (excluding index.json)
find "$PROMPTS_DIR" -name "*.json" ! -name "index.json" -type f | while read -r prompt_file; do
    TOTAL_COUNT=$((TOTAL_COUNT + 1))
    prompt_name=$(basename "$prompt_file" .json)
    prompt_path=$(dirname "$prompt_file" | sed "s|^$PROMPTS_DIR/||")
    
    echo "Validating: $prompt_path/$prompt_name"
    
    # Test 1: Can we parse it?
    if ! jq . "$prompt_file" > /dev/null 2>&1; then
        echo "  ✗ JSON parse failed"
        INVALID_COUNT=$((INVALID_COUNT + 1))
        continue
    fi
    
    # Test 2: Does it have required fields?
    REQUIRED_FIELDS=("id" "name" "description" "content" "isTemplate" "tags" "version")
    MISSING_FIELDS=()
    
    for field in "${REQUIRED_FIELDS[@]}"; do
        if ! jq -e ".$field" "$prompt_file" > /dev/null 2>&1; then
            MISSING_FIELDS+=("$field")
        fi
    done
    
    if [ ${#MISSING_FIELDS[@]} -gt 0 ]; then
        echo "  ✗ Missing required fields: ${MISSING_FIELDS[*]}"
        INVALID_COUNT=$((INVALID_COUNT + 1))
        continue
    fi
    
    # Test 3: Is solution/problem documented?
    HAS_SOLUTION=false
    HAS_PROBLEM=false
    
    if jq -e '.content | test("## Problem|## Solution|problem|solution"; "i")' "$prompt_file" > /dev/null 2>&1; then
        HAS_SOLUTION=true
    fi
    
    if jq -e '.metadata.problem' "$prompt_file" > /dev/null 2>&1; then
        HAS_PROBLEM=true
    fi
    
    if [ "$HAS_SOLUTION" = false ] && [ "$HAS_PROBLEM" = false ]; then
        echo "  ⚠ Solution/problem not clearly documented"
    fi
    
    # Test 4: Has it been used successfully?
    SUCCESS_COUNT=$(jq -r '.metadata.success_count // 0' "$prompt_file" 2>/dev/null || echo "0")
    CONFIDENCE=$(jq -r '.metadata.confidence // "unknown"' "$prompt_file" 2>/dev/null || echo "unknown")
    
    # Test 5: Check metadata structure
    HAS_METADATA=false
    if jq -e '.metadata' "$prompt_file" > /dev/null 2>&1; then
        HAS_METADATA=true
    fi
    
    # Validation result
    if [ "$SUCCESS_COUNT" -gt 0 ]; then
        STATUS="✓"
        VALID_COUNT=$((VALID_COUNT + 1))
        echo "  $STATUS Validated ($SUCCESS_COUNT successes, confidence: $CONFIDENCE)"
    else
        STATUS="ℹ"
        echo "  $STATUS Not yet validated (experimental)"
    fi
    
    # Show metadata summary
    if [ "$HAS_METADATA" = true ]; then
        CONTEXT=$(jq -r '.metadata.context // [] | join(", ")' "$prompt_file" 2>/dev/null || echo "none")
        if [ "$CONTEXT" != "none" ] && [ "$CONTEXT" != "[]" ]; then
            echo "    Context: $CONTEXT"
        fi
    fi
done

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "Summary"
echo "═══════════════════════════════════════════════════════════"
echo "Total prompts checked: $TOTAL_COUNT"
echo "Valid prompts: $VALID_COUNT"
echo "Invalid prompts: $INVALID_COUNT"
echo ""
echo "Ready to reuse knowledge: $VALID_COUNT prompts validated"
echo "═══════════════════════════════════════════════════════════"