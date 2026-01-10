#!/usr/bin/env bash
# architecture-designer.sh v2 - Dynamic Agent-Based Architecture Analysis
# Uses: global-agents.json, local project agents.json (optional), agent explorer

set -euo pipefail

# Configuration paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GLOBAL_AGENTS_FILE="${GLOBAL_AGENTS_FILE:-${SCRIPT_DIR}/global-agents.json}"
GLOBAL_SCHEMA_FILE="${GLOBAL_SCHEMA_FILE:-${SCRIPT_DIR}/global-schema.json}"
MCP_CONF="${MCP_CONF:-$HOME/.cursor/mcp.json}"

# Feature flags
ENABLE_SOLID=false
ENABLE_MERMAID=true
ENABLE_PR_ANALYSIS=false
ENABLE_PR_CREATION=false
ENABLE_DIAGRAM_VALIDATION=false
ENABLE_MULTI_BRANCH=false
DRY_RUN=false
VERBOSE=false

# Parse arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --solid) ENABLE_SOLID=true; shift ;;
            --mermaid) ENABLE_MERMAID=true; shift ;;
            --pr) ENABLE_PR_ANALYSIS=true; shift ;;
            --create-pr) ENABLE_PR_CREATION=true; shift ;;
            --validate-diagrams) ENABLE_DIAGRAM_VALIDATION=true; shift ;;
            --all-branches) ENABLE_MULTI_BRANCH=true; shift ;;
            --dry-run) DRY_RUN=true; shift ;;
            -v|--verbose) VERBOSE=true; shift ;;
            --global-agents) GLOBAL_AGENTS_FILE="$2"; shift 2 ;;
            --global-schema) GLOBAL_SCHEMA_FILE="$2"; shift 2 ;;
            --mcp-config) MCP_CONF="$2"; shift 2 ;;
            -h|--help) show_help; exit 0 ;;
            -*) echo "Unknown option: $1"; show_help; exit 1 ;;
            *) PROJECT_PATH="$1"; shift ;;
        esac
    done
}

show_help() {
    cat <<'HELP'
Architecture Designer v2 - Dynamic Agent-Based Analysis

USAGE:
    architecture-designer.sh [OPTIONS] <project_path>

OPTIONS:
    --solid                  Enable SOLID principles analysis
    --mermaid                Enable Mermaid diagram generation (default: on)
    --pr                     Analyze open pull requests
    --create-pr              Create PRs for branches without PR
    --validate-diagrams      Validate generated diagrams against codebase
    --all-branches           Analyze all branches
    --dry-run                Simulate without making changes
    -v, --verbose            Enable verbose output
    --global-agents <path>   Path to global agents.json
    --global-schema <path>   Path to global schema.json
    --mcp-config <path>      Path to MCP config
    -h, --help               Show this help

EXAMPLES:
    architecture-designer.sh -v --solid --pr ~/projects/mia
    architecture-designer.sh --create-pr --all-branches ~/projects/sparetools
HELP
}

# Load JSON from file
load_json_file() {
    local file="$1"
    if [[ ! -f "$file" ]]; then
        echo "Error: File not found: $file" >&2
        exit 1
    fi
    cat "$file"
}

# Detect project type
detect_project_type() {
    local project_path="$1"
    
    if [[ -f "$project_path/CMakeLists.txt" ]]; then echo "cpp"
    elif [[ -f "$project_path/platformio.ini" ]]; then echo "esp32"
    elif [[ -f "$project_path/pyproject.toml" ]] || [[ -f "$project_path/setup.py" ]]; then echo "python"
    elif [[ -f "$project_path/build.gradle" ]]; then echo "android"
    elif [[ -f "$project_path/package.json" ]]; then echo "javascript"
    else echo "generic"
    fi
}

# Get repository info
get_repo_info() {
    local project_path="$1"
    cd "$project_path" || exit 1
    
    local repo_name=$(basename "$(git rev-parse --show-toplevel 2>/dev/null || echo "$project_path")")
    local current_branch=$(git branch --show-current 2>/dev/null || echo "main")
    local remote_url=$(git remote get-url origin 2>/dev/null || echo "")
    local owner=""
    
    if [[ "$remote_url" =~ github.com[:/]([^/]+)/([^/.]+) ]]; then
        owner="${BASH_REMATCH[1]}"
        repo_name="${BASH_REMATCH[2]}"
    fi
    
    echo "$owner|$repo_name|$current_branch"
}

# Main execution
main() {
    parse_args "$@"
    
    # Validate project path
    if [[ -z "${PROJECT_PATH:-}" ]]; then
        echo "Error: Project path required" >&2
        show_help
        exit 1
    fi
    
    if [[ ! -d "$PROJECT_PATH" ]]; then
        echo "Error: Project path does not exist: $PROJECT_PATH" >&2
        exit 1
    fi
    
    # Get project info
    PROJECT_TYPE=$(detect_project_type "$PROJECT_PATH")
    REPO_INFO=$(get_repo_info "$PROJECT_PATH")
    IFS='|' read -r OWNER REPO_NAME CURRENT_BRANCH <<< "$REPO_INFO"
    
    [[ "$VERBOSE" == "true" ]] && echo "📊 Analyzing: $REPO_NAME ($PROJECT_TYPE) - Branch: $CURRENT_BRANCH"
    
    # Load configuration files
    [[ "$VERBOSE" == "true" ]] && echo "📂 Loading configuration files..."
    
    GLOBAL_AGENTS=$(load_json_file "$GLOBAL_AGENTS_FILE")
    GLOBAL_SCHEMA=$(load_json_file "$GLOBAL_SCHEMA_FILE")
    
    # Check for local agents extension
    LOCAL_AGENTS_FILE="$PROJECT_PATH/agents.json"
    LOCAL_AGENTS="{}"
    if [[ -f "$LOCAL_AGENTS_FILE" ]]; then
        [[ "$VERBOSE" == "true" ]] && echo "📂 Found local agents.json, extending global agents..."
        LOCAL_AGENTS=$(load_json_file "$LOCAL_AGENTS_FILE")
    fi
    
    # Merge agents: local extends global
    AGENTS_JSON=$(jq -s '.[0] * .[1]' <<< "$GLOBAL_AGENTS"$'\n'"$LOCAL_AGENTS")
    
    # Build system prompt
    SYSTEM_PROMPT=$(cat <<SYSTEMPROMPT
You are an elite Software Architecture Designer with Agent Orchestration capabilities.

PROJECT CONTEXT:
- Repository: $REPO_NAME (Owner: $OWNER)
- Project Type: $PROJECT_TYPE
- Current Branch: $CURRENT_BRANCH
- Project Path: $PROJECT_PATH

ENABLED FEATURES:
- SOLID Analysis: $ENABLE_SOLID
- Mermaid Diagrams: $ENABLE_MERMAID
- PR Analysis: $ENABLE_PR_ANALYSIS
- PR Creation: $ENABLE_PR_CREATION
- Diagram Validation: $ENABLE_DIAGRAM_VALIDATION
- Multi-Branch: $ENABLE_MULTI_BRANCH
- Dry Run: $DRY_RUN

EXECUTION WORKFLOW:

1. AGENT EXPLORATION (agent_explorer):
   - Map complete project directory structure
   - Detect programming languages and frameworks
   - Identify components and modules
   - Analyze build systems and test procedures
   - Read README.md, configuration files, git history
   - Decide which specialized agents to spawn for which components

2. COMPONENT DISCOVERY:
   - For each discovered component, determine:
     * Type (backend, frontend, embedded, infrastructure, etc)
     * Language and frameworks used
     * Build system and test procedures
     * Dependencies and relationships
   - Suggest specialized agents for analysis

3. AGENT SPAWNING:
   - For each component: spawn appropriate agent with:
     * Component context and location
     * Relevant language/framework knowledge
     * Specific instructions for that component
     * Assigned model (some agents use faster models, some use stronger models)
   - Examples:
     * C++ backend → cpp_analyzer (claude-sonnet)
     * Python service → python_analyzer (claude-sonnet)
     * ESP32 firmware → embedded_analyzer (claude-sonnet)
     * Android app → android_analyzer (claude-sonnet)
     * Web frontend → web_analyzer (claude-sonnet)
     * Docker/K8s → infra_analyzer (claude-sonnet)

4. PARALLEL ANALYSIS:
   - Coordinate analysis across multiple agents
   - Each agent analyzes its assigned component
   - Collect results efficiently

5. AGGREGATION:
   - Combine results from all agents
   - Generate unified architecture report
   - Include diagrams from diagram_generator
   - Include SOLID analysis if enabled
   - Include PR analysis if enabled

6. GITHUB OPERATIONS (if --pr or --create-pr):
   - Use github_analyst to discover branches and PRs
   - Use code_diff_analyzer to analyze changes
   - Use pr_enhancer to create/update PRs with diagrams

RETURN STRUCTURED JSON:
- repository_overview: project info and architecture overview
- components: detailed analysis for each component
- architectural_insights: patterns, design decisions, relationships
- diagrams: Mermaid diagrams for different views
- solid_analysis: (if enabled) SOLID compliance scores
- github_analysis: (if enabled) branch and PR analysis
- execution_summary: what was analyzed, time, errors
SYSTEMPROMPT
    )
    
    # Build user message
    USER_MESSAGE="Analyze $REPO_NAME ($PROJECT_TYPE) at $PROJECT_PATH. Start with agent_explorer to understand the project, then spawn appropriate specialized agents for each component. Return comprehensive JSON report."
    
    # Build input JSON
    INPUT_JSON=$(jq -n \
        --arg msg "$USER_MESSAGE" \
        '{type: "user_message", message: $msg}')
    
    [[ "$VERBOSE" == "true" ]] && echo "🚀 Executing Claude with dynamic agent orchestration..."
    
    # Execute Claude
    echo "$INPUT_JSON" | claude \
        --print \
        --output-format stream-json \
        --input-format stream-json \
        --json-schema "$GLOBAL_SCHEMA" \
        --mcp-config "$MCP_CONF" \
        --permission-mode bypassPermissions \
        --replay-user-messages \
        --strict-mcp-config \
        --system-prompt "$SYSTEM_PROMPT" \
        --agents "$AGENTS_JSON" \
        --model opus \
        --include-partial-messages
    
    exit_code=$?
    
    if [[ $exit_code -eq 0 ]]; then
        [[ "$VERBOSE" == "true" ]] && echo "✅ Analysis completed successfully"
    else
        echo "❌ Error: Claude execution failed with exit code $exit_code" >&2
        exit $exit_code
    fi
}

# Execute if run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
