#!/bin/bash
# mcp_query.sh - Query mcp-prompts HTTP API for learning integration
#
# Usage: mcp_query.sh <operation> [args...]
#   operation: list|get|create|update|search|health
#   list: mcp_query.sh list [category] [limit]
#   get: mcp_query.sh get <prompt_id> [version]
#   create: mcp_query.sh create <json_data>
#   update: mcp_query.sh update <prompt_id> <json_data>
#   search: mcp_query.sh search <query> [category]
#
# Returns: JSON from mcp-prompts or empty if unavailable
# Exit code: 0 on success, 1 on error, 2 if server unavailable

set -euo pipefail

MCP_PROMPTS_URL="${MCP_PROMPTS_URL:-http://localhost:3000}"
OPERATION="${1:-list}"

# Check if mcp-prompts server is available
check_health() {
    if ! curl -s --max-time 2 "${MCP_PROMPTS_URL}/health" >/dev/null 2>&1; then
        echo '{"available": false, "reason": "mcp-prompts server not running"}' >&2
        return 2
    fi
    return 0
}

# List prompts
list_prompts() {
    local category="${1:-}"
    local limit="${2:-50}"
    
    local url="${MCP_PROMPTS_URL}/v1/prompts?limit=${limit}"
    [ -n "$category" ] && url="${url}&category=${category}"
    
    curl -s --max-time 5 "$url" || echo '{"prompts": [], "total": 0}'
}

# Get specific prompt
get_prompt() {
    local prompt_id="${1:-}"
    local version="${2:-}"
    
    if [ -z "$prompt_id" ]; then
        echo '{"error": "Prompt ID required"}' >&2
        return 1
    fi
    
    local url="${MCP_PROMPTS_URL}/v1/prompts/${prompt_id}"
    [ -n "$version" ] && url="${url}?version=${version}"
    
    curl -s --max-time 5 "$url" || echo '{"error": "Failed to fetch prompt"}'
}

# Search prompts
search_prompts() {
    local query="${1:-}"
    local category="${2:-}"
    
    if [ -z "$query" ]; then
        echo '{"error": "Search query required"}' >&2
        return 1
    fi
    
    local url="${MCP_PROMPTS_URL}/v1/prompts/search?q=$(echo "$query" | sed 's/ /%20/g')"
    [ -n "$category" ] && url="${url}&category=${category}"
    
    curl -s --max-time 5 "$url" || echo '{"prompts": [], "total": 0}'
}

# Create prompt
create_prompt() {
    local json_data="${1:-}"
    
    if [ -z "$json_data" ]; then
        echo '{"error": "JSON data required"}' >&2
        return 1
    fi
    
    # If json_data is a file path, read it; otherwise use as-is
    if [ -f "$json_data" ]; then
        json_data=$(cat "$json_data")
    fi
    
    curl -s --max-time 5 \
        -X POST \
        -H "Content-Type: application/json" \
        -d "$json_data" \
        "${MCP_PROMPTS_URL}/v1/prompts" || echo '{"error": "Failed to create prompt"}'
}

# Update prompt
update_prompt() {
    local prompt_id="${1:-}"
    local json_data="${2:-}"
    
    if [ -z "$prompt_id" ] || [ -z "$json_data" ]; then
        echo '{"error": "Prompt ID and JSON data required"}' >&2
        return 1
    fi
    
    # If json_data is a file path, read it; otherwise use as-is
    if [ -f "$json_data" ]; then
        json_data=$(cat "$json_data")
    fi
    
    curl -s --max-time 5 \
        -X PUT \
        -H "Content-Type: application/json" \
        -d "$json_data" \
        "${MCP_PROMPTS_URL}/v1/prompts/${prompt_id}" || echo '{"error": "Failed to update prompt"}'
}

# Apply template variables
apply_template() {
    local prompt_id="${1:-}"
    local json_data="${2:-}"
    
    if [ -z "$prompt_id" ] || [ -z "$json_data" ]; then
        echo '{"error": "Prompt ID and JSON data required"}' >&2
        return 1
    fi
    
    # If json_data is a file path, read it; otherwise use as-is
    if [ -f "$json_data" ]; then
        json_data=$(cat "$json_data")
    fi
    
    curl -s --max-time 5 \
        -X POST \
        -H "Content-Type: application/json" \
        -d "$json_data" \
        "${MCP_PROMPTS_URL}/v1/prompts/${prompt_id}/apply" || echo '{"error": "Failed to apply template"}'
}

# Main execution
case "$OPERATION" in
    health)
        check_health
        ;;
    list)
        check_health || exit $?
        list_prompts "${2:-}" "${3:-50}"
        ;;
    get)
        check_health || exit $?
        get_prompt "${2:-}" "${3:-}"
        ;;
    search)
        check_health || exit $?
        search_prompts "${2:-}" "${3:-}"
        ;;
    create)
        check_health || exit $?
        create_prompt "${2:-}"
        ;;
    update)
        check_health || exit $?
        update_prompt "${2:-}" "${3:-}"
        ;;
    apply)
        check_health || exit $?
        apply_template "${2:-}" "${3:-}"
        ;;
    *)
        echo "Usage: mcp_query.sh <operation> [args...]" >&2
        echo "Operations: health|list|get|search|create|update|apply" >&2
        exit 1
        ;;
esac
