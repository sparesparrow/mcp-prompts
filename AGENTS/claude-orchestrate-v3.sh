#!/usr/bin/env bash
# claude-orchestrate.sh v3 - Advanced Multi-Agent Architecture Analysis
# Based on Claude Agent SDK best practices
# Uses: main agent per project, reusable subagents, optimized token usage

set -euo pipefail

# Paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMPROVED_AGENTS="${IMPROVED_AGENTS:-${SCRIPT_DIR}/improved-agents.json}"
PROJECT_AGENTS="${PROJECT_AGENTS:-${SCRIPT_DIR}/PROJECT-agents-v3.json}"

# Parse arguments
PROJECT_PATH="${1:-.}"
MODE="${2:-analyze}"  # analyze, review, refactor, test, document
VERBOSE="${VERBOSE:-false}"
DRY_RUN="${DRY_RUN:-false}"

# Detect project
detect_project_type() {
    local path="$1"
    
    if [[ -f "$path/CMakeLists.txt" ]]; then echo "cpp"
    elif [[ -f "$path/platformio.ini" ]]; then echo "embedded"
    elif [[ -f "$path/pyproject.toml" ]] || [[ -f "$path/setup.py" ]]; then echo "python"
    elif [[ -f "$path/build.gradle" ]]; then echo "android"
    elif [[ -f "$path/package.json" ]]; then echo "web"
    elif [[ -f "$path/docker-compose.yml" ]]; then echo "devops"
    elif [[ -f "$path/AGENTS.md" ]] && grep -q "multi-platform\|IoT" "$path/AGENTS.md" 2>/dev/null; then echo "multiplatform"
    else echo "generic"
    fi
}

# Load JSON
load_json() {
    local file="$1"
    if [[ ! -f "$file" ]]; then
        echo "Error: File not found: $file" >&2
        return 1
    fi
    cat "$file"
}

# Get main agent config for project
get_main_agent_config() {
    local project_type="$1"
    local improved_agents="$2"
    
    jq --arg type "$project_type" '.main_agent_templates[$type]' "$improved_agents"
}

# Build agent spawn commands
build_subagent_spawns() {
    local agents_json="$1"
    local subagents_list="$2"
    
    # For each subagent, build command to spawn it
    # This would be passed to Claude as instruction for spawning subagents
    echo "{\"subagents_to_spawn\": $(echo "$subagents_list" | jq -R 'split(",")')}"
}

# Main execution
main() {
    # Validation
    if [[ ! -d "$PROJECT_PATH" ]]; then
        echo "Error: Project path not found: $PROJECT_PATH" >&2
        exit 1
    fi
    
    # Detect project
    PROJECT_TYPE=$(detect_project_type "$PROJECT_PATH")
    PROJECT_NAME=$(basename "$PROJECT_PATH")
    
    [[ "$VERBOSE" == "true" ]] && echo "📊 Project: $PROJECT_NAME (type: $PROJECT_TYPE, mode: $MODE)"
    
    # Load agent configs
    IMPROVED_AGENTS_JSON=$(load_json "$IMPROVED_AGENTS") || exit 1
    
    # Check for project-specific agents
    PROJECT_AGENTS_FILE="$PROJECT_PATH/agents-v3.json"
    PROJECT_AGENTS_JSON="{}"
    if [[ -f "$PROJECT_AGENTS_FILE" ]]; then
        [[ "$VERBOSE" == "true" ]] && echo "📂 Found project-specific agents"
        PROJECT_AGENTS_JSON=$(load_json "$PROJECT_AGENTS_FILE") || exit 1
    fi
    
    # Get main agent config
    MAIN_AGENT=$(echo "$IMPROVED_AGENTS_JSON" | jq --arg type "$PROJECT_TYPE" '.main_agent_templates[$type]')
    
    if [[ "$MAIN_AGENT" == "null" ]]; then
        echo "Error: No main agent template for project type: $PROJECT_TYPE" >&2
        exit 1
    fi
    
    # Extract main agent details
    MAIN_MODEL=$(echo "$MAIN_AGENT" | jq -r '.model')
    MAIN_SYSTEM_PROMPT=$(echo "$MAIN_AGENT" | jq -r '.system_prompt')
    SUBAGENTS=$(echo "$MAIN_AGENT" | jq -r '.subagents | join(",")')
    
    [[ "$VERBOSE" == "true" ]] && echo "🤖 Main Agent: model=$MAIN_MODEL, subagents=$SUBAGENTS"
    
    # Load subagents configuration
    GLOBAL_SUBAGENTS=$(echo "$IMPROVED_AGENTS_JSON" | jq '.global_subagents')
    
    # Build subagent definitions for Claude
    SUBAGENT_DEFS=$(echo "$GLOBAL_SUBAGENTS" | jq -c 'to_entries | map({(.key): .value}) | add')
    
    # Build mode-specific instruction
    MODE_INSTRUCTION=$(get_mode_instruction "$MODE" "$PROJECT_PATH")
    
    # Build complete prompt
    COMPLETE_PROMPT=$(cat <<PROMPT
MAIN AGENT INSTRUCTIONS FOR: $PROJECT_NAME

Project Type: $PROJECT_TYPE
Mode: $MODE

SUBAGENT CONFIGURATION:
$SUBAGENT_DEFS

AVAILABLE SUBAGENTS:
$SUBAGENTS

YOUR TASK:
Analyze $PROJECT_NAME at $PROJECT_PATH using the following workflow:

1. SPAWNING SUBAGENTS:
   - Spawn 'explorer' first to discover project structure
   - Based on discovery, spawn appropriate specialized analyzers
   - Coordinate results from all subagents

2. MODE-SPECIFIC TASKS:
$MODE_INSTRUCTION

3. AGGREGATION:
   - Combine results from all subagents
   - Provide unified analysis with clear recommendations
   - Return structured JSON matching expected schema

MAIN SYSTEM PROMPT:
$MAIN_SYSTEM_PROMPT

Work efficiently, spawn subagents in parallel where possible, and coordinate their results.
PROMPT
    )
    
    # Execute via Claude
    if [[ "$DRY_RUN" == "true" ]]; then
        echo "DRY RUN - Would execute:"
        echo "claude --model $MAIN_MODEL --agents '$SUBAGENT_DEFS' <<< '$COMPLETE_PROMPT'"
    else
        echo "$COMPLETE_PROMPT" | \
        claude \
            --model "$MAIN_MODEL" \
            --agents "$SUBAGENT_DEFS" \
            --append-system-prompt "$MAIN_SYSTEM_PROMPT" \
            --print \
            --output-format json \
            --verbose="$VERBOSE"
    fi
}

# Get mode-specific instructions
get_mode_instruction() {
    local mode="$1"
    local project_path="$2"
    
    case "$mode" in
        analyze)
            cat <<'INSTR'
   1. Complete project structure analysis
   2. Component architecture mapping
   3. Design pattern identification
   4. Dependency analysis
   5. Generate comprehensive diagrams
   6. Identify technical debt
   7. Provide improvement recommendations
INSTR
            ;;
        review)
            cat <<'INSTR'
   1. Code quality review
   2. SOLID principles evaluation
   3. Design pattern assessment
   4. Security audit
   5. Performance analysis
   6. Identify issues and anti-patterns
   7. Provide specific refactoring suggestions
INSTR
            ;;
        refactor)
            cat <<'INSTR'
   1. Identify refactoring opportunities
   2. Prioritize by impact and safety
   3. Plan incremental changes
   4. Execute refactoring with tests
   5. Validate no behavior change
   6. Provide clear commit messages
   7. Document refactoring rationale
INSTR
            ;;
        test)
            cat <<'INSTR'
   1. Analyze existing test coverage
   2. Identify untested critical paths
   3. Run existing test suites
   4. Identify gaps and flaky tests
   5. Recommend high-impact test additions
   6. Assess test quality
   7. Provide testing improvements
INSTR
            ;;
        document)
            cat <<'INSTR'
   1. Assess existing documentation
   2. Identify documentation gaps
   3. Generate architecture documentation
   4. Create AGENTS.md guidance
   5. Document design decisions
   6. Provide code examples
   7. Recommend documentation improvements
INSTR
            ;;
        *)
            echo "Unknown mode: $mode" >&2
            exit 1
            ;;
    esac
}

# Run
main "$@"
