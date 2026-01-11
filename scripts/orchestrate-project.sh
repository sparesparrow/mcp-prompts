#!/usr/bin/env bash
# orchestrate-project.sh - Simple project orchestration using mcp-prompts directly
# Uses prompts from data/prompts/ and calls claude CLI directly

set -euo pipefail

# Paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROMPTS_DIR="$SCRIPT_DIR/../data/prompts"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging
log() { echo -e "${BLUE}[orchestrate]${NC} $1" >&2; }
success() { echo -e "${GREEN}✓${NC} $1" >&2; }
error() { echo -e "${RED}✗${NC} $1" >&2; }
warn() { echo -e "${YELLOW}⚠${NC} $1" >&2; }

# Detect project type based on files and structure
# Ported from orchestrate.service.ts lines 95-290
detect_project_type() {
    local path="$1"

    if [[ ! -d "$path" ]]; then
        error "Project path does not exist: $path"
        exit 1
    fi

    cd "$path" || exit 1

    local has_embedded=false
    local has_android=false
    local has_python=false
    local has_web=false
    local platform_count=0

    # Check for embedded/IoT
    if [[ -f "platformio.ini" ]] || [[ -f "CMakeLists.txt" ]]; then
        has_embedded=true
        ((platform_count++))
    fi

    # Check for Android
    if [[ -f "build.gradle" ]] || [[ -f "app/build.gradle" ]] || [[ -f "AndroidManifest.xml" ]]; then
        has_android=true
        ((platform_count++))
    fi

    # Check for Python
    if [[ -f "pyproject.toml" ]] || [[ -f "requirements.txt" ]] || [[ -f "setup.py" ]]; then
        has_python=true
        ((platform_count++))
    fi

    # Check for Web/JS
    if [[ -f "package.json" ]]; then
        has_web=true
        ((platform_count++))
    fi

    # Determine project type
    if [[ $platform_count -ge 3 ]]; then
        echo "multiplatform_iot"
    elif [[ $platform_count -eq 2 ]] && { $has_embedded || $has_android; }; then
        echo "multiplatform_iot"
    elif $has_python; then
        echo "python_backend"
    elif [[ -f "platformio.ini" ]]; then
        echo "embedded_iot"
    elif [[ -f "CMakeLists.txt" ]] || [[ -f "conanfile.py" ]]; then
        echo "cpp_backend"
    elif $has_android; then
        echo "android_app"
    elif $has_web; then
        # Check if it's frontend or backend
        if [[ -f "package.json" ]]; then
            if grep -q "react\|vue\|angular" package.json 2>/dev/null; then
                echo "web_frontend"
            elif grep -q "express\|fastify\|koa" package.json 2>/dev/null; then
                echo "web_backend"
            else
                echo "web_frontend"
            fi
        fi
    elif [[ -f "Dockerfile" ]] || [[ -f "docker-compose.yml" ]]; then
        echo "devops_infrastructure"
    else
        echo "generic"
    fi
}

# Load main agent template for project type
load_main_agent() {
    local project_type="$1"
    local agent_file="$PROMPTS_DIR/main-agents/main_agent_${project_type}.json"

    if [[ ! -f "$agent_file" ]]; then
        error "No main agent found for project type: $project_type"
        error "Tried: $agent_file"
        exit 1
    fi

    cat "$agent_file"
}

# Build subagents JSON from main agent configuration
build_subagents_json() {
    local main_agent="$1"
    local subagent_ids

    # Extract subagent IDs from main agent config
    readarray -t subagent_ids < <(echo "$main_agent" | jq -r '.agentConfig.subagents[]? // empty')

    if [[ ${#subagent_ids[@]} -eq 0 ]]; then
        warn "No subagents defined for this agent"
        echo "{}"
        return
    fi

    local agents_json="{"
    local first=true

    for id in "${subagent_ids[@]}"; do
        local subagent_file="$PROMPTS_DIR/subagents/${id}.json"

        if [[ -f "$subagent_file" ]]; then
            local desc=$(jq -r '.description? // ""' "$subagent_file")
            local prompt=$(jq -r '.content? // ""' "$subagent_file")

            if [[ -n "$prompt" ]]; then
                if [[ "$first" == "false" ]]; then
                    agents_json+=","
                fi
                agents_json+="\"$id\":{\"description\":$(echo "$desc" | jq -Rs .),\"prompt\":$(echo "$prompt" | jq -Rs .)}"
                first=false
            fi
        else
            warn "Subagent file not found: $subagent_file"
        fi
    done

    agents_json+="}"
    echo "$agents_json"
}

# Show help
show_help() {
    cat <<'HELP'
orchestrate-project.sh - Simple Project Orchestration

USAGE:
    orchestrate-project.sh [OPTIONS] <project_path> [mode]

ARGUMENTS:
    project_path    Path to project directory (default: current directory)
    mode            analyze|review|refactor|test|document (default: analyze)

OPTIONS:
    --verbose, -v   Show verbose output
    --help, -h      Show this help message

EXAMPLES:
    # Analyze current directory
    orchestrate-project.sh . analyze

    # Review MIA project
    orchestrate-project.sh ~/projects/embedded/mia review

    # Analyze ESP32 project with verbose output
    orchestrate-project.sh -v ~/projects/esp32-bpm-detector analyze

HELP
}

# Main execution
main() {
    local project_path=""
    local mode="analyze"
    local verbose=false

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -v|--verbose)
                verbose=true
                shift
                ;;
            -*)
                error "Unknown option: $1"
                show_help
                exit 1
                ;;
            *)
                # First positional arg is project_path
                if [[ -z "$project_path" ]]; then
                    project_path="$1"
                else
                    # Second positional arg is mode
                    mode="$1"
                fi
                shift
                ;;
        esac
    done

    # Use current directory if not specified
    if [[ -z "$project_path" ]]; then
        project_path="."
    fi

    # Resolve absolute path
    project_path=$(cd "$project_path" && pwd)

    log "Analyzing project: $project_path"
    log "Mode: $mode"
    echo ""

    # Detect project type
    log "Detecting project type..."
    local project_type
    project_type=$(detect_project_type "$project_path")
    success "Detected: $project_type"
    echo ""

    # Load main agent
    log "Loading main agent template..."
    local main_agent
    main_agent=$(load_main_agent "$project_type")

    if [[ "$verbose" == "true" ]]; then
        log "Main agent: $(echo "$main_agent" | jq -r '.name')"
    fi

    # Extract configuration
    local model
    local system_prompt
    model=$(echo "$main_agent" | jq -r '.agentConfig.model? // "sonnet"')
    system_prompt=$(echo "$main_agent" | jq -r '.content')

    success "Loaded agent (model: $model)"
    echo ""

    # Build subagents
    log "Loading subagents..."
    local agents_json
    agents_json=$(build_subagents_json "$main_agent")

    local subagent_count
    subagent_count=$(echo "$agents_json" | jq 'keys | length')
    success "Loaded $subagent_count subagents"

    if [[ "$verbose" == "true" ]]; then
        log "Subagents: $(echo "$agents_json" | jq -r 'keys | join(", ")')"
    fi
    echo ""

    # Build user message
    local user_msg="Analyze project at $project_path. Mode: $mode. Project type: $project_type. Use the available subagents to perform comprehensive analysis. Return structured results."

    # Execute with claude CLI
    log "Executing claude orchestration..."
    echo ""

    echo "{\"type\":\"user_message\",\"message\":$(echo "$user_msg" | jq -Rs .)}" | \
    claude \
        --print \
        --model "$model" \
        --system-prompt "$system_prompt" \
        --agents "$agents_json" \
        --mcp-config ~/.cursor/mcp.json \
        --output-format stream-json \
        --input-format stream-json \
        --permission-mode bypassPermissions \
        --verbose

    local exit_code=$?

    echo ""
    if [[ $exit_code -eq 0 ]]; then
        success "Orchestration completed"
    else
        error "Orchestration failed with exit code $exit_code"
        exit $exit_code
    fi
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
