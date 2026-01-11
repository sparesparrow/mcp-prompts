#!/usr/bin/env bash
# claude-orchestrate.sh v4 - API-First Orchestration
# Uses mcp-prompts REST API for project analysis and orchestration
# Replaces hardcoded configs with dynamic API calls

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"
POLL_INTERVAL="${POLL_INTERVAL:-2}"  # seconds
MAX_WAIT_TIME="${MAX_WAIT_TIME:-300}" # 5 minutes
REPORT_FORMAT="${REPORT_FORMAT:-markdown}"

# Parse arguments
PROJECT_PATH="${1:-.}"
MODE="${2:-analyze}"  # analyze, review, refactor, test, document
DRY_RUN="${DRY_RUN:-false}"
VERBOSE="${VERBOSE:-false}"
WAIT_FOR_COMPLETION="${WAIT_FOR_COMPLETION:-true}"
OUTPUT_DIR="${OUTPUT_DIR:-./orchestration-reports}"
PROFILE="${PROFILE:-default}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${BLUE}[orchestrate]${NC} $1"
}

success() {
    echo -e "${GREEN}✓${NC} $1"
}

error() {
    echo -e "${RED}✗${NC} $1" >&2
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

debug() {
    if [[ "$VERBOSE" == "true" ]]; then
        echo -e "${BLUE}[DEBUG]${NC} $1"
    fi
}

# Validate arguments
validate_args() {
    if [[ ! -d "$PROJECT_PATH" ]]; then
        error "Project path not found: $PROJECT_PATH"
        exit 1
    fi

    local valid_modes=("analyze" "review" "refactor" "test" "document")
    if [[ ! " ${valid_modes[@]} " =~ " ${MODE} " ]]; then
        error "Invalid mode: $MODE. Must be one of: ${valid_modes[*]}"
        exit 1
    fi

    PROJECT_PATH="$(cd "$PROJECT_PATH" && pwd)"
}

# Check API connectivity
check_api() {
    debug "Checking API connectivity to $API_BASE_URL"

    local response
    response=$(curl -s -w "\n%{http_code}" "$API_BASE_URL/health" 2>/dev/null || echo "")

    if [[ -z "$response" ]]; then
        error "API server not reachable at $API_BASE_URL"
        error "Start the server with: PROMPTS_DIR=./data/prompts npx tsx src/http/server-with-agents.ts"
        exit 1
    fi

    local http_code
    http_code=$(echo "$response" | tail -n1)

    if [[ "$http_code" != "200" ]]; then
        error "API health check failed with status $http_code"
        exit 1
    fi

    success "API connectivity verified"
}

# Detect project type via API
detect_project_type() {
    local project_path="$1"

    debug "Detecting project type for: $project_path"

    local payload
    payload=$(jq -n \
        --arg projectPath "$project_path" \
        '{projectPath: $projectPath}')

    local response
    response=$(curl -s -X POST \
        "$API_BASE_URL/v1/orchestrate/detect-project-type" \
        -H "Content-Type: application/json" \
        -d "$payload")

    if echo "$response" | jq empty 2>/dev/null; then
        echo "$response"
    else
        error "Failed to detect project type: $response"
        exit 1
    fi
}

# Start orchestration via API
start_orchestration() {
    local project_path="$1"
    local mode="$2"

    debug "Starting orchestration: project=$project_path mode=$mode"

    local payload
    payload=$(jq -n \
        --arg projectPath "$project_path" \
        --arg mode "$mode" \
        '{projectPath: $projectPath, mode: $mode}')

    local response
    response=$(curl -s -X POST \
        "$API_BASE_URL/v1/orchestrate" \
        -H "Content-Type: application/json" \
        -d "$payload")

    if echo "$response" | jq empty 2>/dev/null; then
        echo "$response"
    else
        error "Failed to start orchestration: $response"
        exit 1
    fi
}

# Get execution status via API
get_execution_status() {
    local execution_id="$1"

    debug "Checking execution status: $execution_id"

    local response
    response=$(curl -s "$API_BASE_URL/v1/orchestrate/$execution_id")

    if echo "$response" | jq empty 2>/dev/null; then
        echo "$response"
    else
        error "Failed to get execution status: $response"
        return 1
    fi
}

# Get report with format selection
get_report() {
    local execution_id="$1"
    local format="$2"

    debug "Retrieving report: format=$format"

    local response
    response=$(curl -s "$API_BASE_URL/v1/orchestrate/$execution_id/report?format=$format")

    if [[ "$format" == "json" ]]; then
        if echo "$response" | jq empty 2>/dev/null; then
            echo "$response"
        else
            error "Failed to get JSON report: $response"
            return 1
        fi
    else
        # For markdown/html, just return the raw response
        echo "$response"
    fi
}

# Poll for completion with timeout
wait_for_completion() {
    local execution_id="$1"
    local timeout="$2"

    log "Waiting for orchestration to complete (timeout: ${timeout}s)..."

    local elapsed=0
    local start_time=$(date +%s)

    while [[ $elapsed -lt $timeout ]]; do
        local status
        status=$(get_execution_status "$execution_id" 2>/dev/null || echo '{}')

        local state
        state=$(echo "$status" | jq -r '.status // "unknown"' 2>/dev/null || echo "unknown")

        case "$state" in
            completed)
                success "Orchestration completed"
                return 0
                ;;
            failed)
                local error_msg
                error_msg=$(echo "$status" | jq -r '.error // "Unknown error"' 2>/dev/null || echo "Unknown error")
                error "Orchestration failed: $error_msg"
                return 1
                ;;
            executing|queued)
                debug "Status: $state - elapsed: ${elapsed}s"
                sleep "$POLL_INTERVAL"
                elapsed=$(($(date +%s) - start_time))
                ;;
            *)
                warn "Unknown status: $state"
                sleep "$POLL_INTERVAL"
                elapsed=$(($(date +%s) - start_time))
                ;;
        esac
    done

    error "Orchestration timed out after ${timeout}s"
    return 1
}

# Save report to file
save_report() {
    local execution_id="$1"
    local format="$2"
    local output_dir="$3"

    mkdir -p "$output_dir"

    local filename="orchestration-${execution_id}.${format}"
    if [[ "$format" == "json" ]]; then
        filename="orchestration-${execution_id}.json"
    fi

    local filepath="$output_dir/$filename"

    log "Saving report to: $filepath"

    local report
    if ! report=$(get_report "$execution_id" "$format"); then
        error "Failed to retrieve report"
        return 1
    fi

    echo "$report" > "$filepath"
    success "Report saved"

    echo "$filepath"
}

# Display summary
display_summary() {
    local execution_id="$1"
    local project_type="$2"
    local mode="$3"
    local status_response="$4"

    echo ""
    log "=== Orchestration Summary ==="
    echo "  Execution ID: $execution_id"
    echo "  Project Type: $project_type"
    echo "  Mode: $mode"
    echo "  Status: $(echo "$status_response" | jq -r '.status' 2>/dev/null || echo 'unknown')"
    echo "  Phases: $(echo "$status_response" | jq -r '.phaseCount' 2>/dev/null || echo '0')"
    echo "  Recommendations: $(echo "$status_response" | jq -r '.recommendations' 2>/dev/null || echo '0')"

    local start_time end_time
    start_time=$(echo "$status_response" | jq -r '.startTime // ""' 2>/dev/null)
    end_time=$(echo "$status_response" | jq -r '.endTime // ""' 2>/dev/null)

    if [[ -n "$start_time" ]]; then
        echo "  Started: $start_time"
    fi
    if [[ -n "$end_time" ]]; then
        echo "  Completed: $end_time"
    fi

    echo ""
}

# Load configuration profile
load_profile() {
    local profile="$1"
    local profile_file="$SCRIPT_DIR/profiles/$profile.env"

    if [[ -f "$profile_file" ]]; then
        debug "Loading profile: $profile"
        # shellcheck disable=SC1090
        source "$profile_file"
    elif [[ "$profile" != "default" ]]; then
        warn "Profile not found: $profile_file (using defaults)"
    fi
}

# List available profiles
list_profiles() {
    if [[ -d "$SCRIPT_DIR/profiles" ]]; then
        echo "Available profiles:"
        find "$SCRIPT_DIR/profiles" -name "*.env" -exec basename {} .env \;
    else
        echo "No profiles directory found"
    fi
}

# Show help
show_help() {
    cat <<HELP
claude-orchestrate v4 - API-First Project Orchestration

USAGE:
  $0 [PROJECT_PATH] [MODE] [OPTIONS]

ARGUMENTS:
  PROJECT_PATH     Path to project (default: current directory)
  MODE             analyze|review|refactor|test|document (default: analyze)

OPTIONS:
  --api-url URL            API base URL (default: http://localhost:3000)
  --dry-run                Show what would be executed without running
  --no-wait                Don't wait for completion (returns execution ID)
  --format FORMAT          Report format: json|markdown|html (default: markdown)
  --output-dir DIR         Directory to save reports (default: ./orchestration-reports)
  --profile PROFILE        Configuration profile to load (default: default)
  --poll-interval SECS     Polling interval (default: 2)
  --max-wait SECS          Maximum wait time (default: 300)
  --verbose                Show debug information
  --help                   Show this help message
  --list-profiles          List available configuration profiles

EXAMPLES:
  # Analyze current project
  $0

  # Review with custom output directory
  $0 /path/to/project review --output-dir ./reports

  # Dry-run without waiting
  $0 /path/to/project test --dry-run --no-wait

  # Use custom API and profile
  $0 . refactor --api-url http://localhost:3000 --profile embedded

ENVIRONMENT VARIABLES:
  API_BASE_URL             API base URL
  POLL_INTERVAL            Polling interval in seconds
  MAX_WAIT_TIME            Maximum wait time in seconds
  REPORT_FORMAT            Default report format
  OUTPUT_DIR               Default output directory
  VERBOSE                  Enable verbose output
  DRY_RUN                  Enable dry-run mode
  WAIT_FOR_COMPLETION      Wait for completion (default: true)

HELP
}

# Main execution
main() {
    # Parse options
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --api-url)
                API_BASE_URL="$2"
                shift 2
                ;;
            --dry-run)
                DRY_RUN="true"
                shift
                ;;
            --no-wait)
                WAIT_FOR_COMPLETION="false"
                shift
                ;;
            --format)
                REPORT_FORMAT="$2"
                shift 2
                ;;
            --output-dir)
                OUTPUT_DIR="$2"
                shift 2
                ;;
            --profile)
                PROFILE="$2"
                shift 2
                ;;
            --poll-interval)
                POLL_INTERVAL="$2"
                shift 2
                ;;
            --max-wait)
                MAX_WAIT_TIME="$2"
                shift 2
                ;;
            --verbose)
                VERBOSE="true"
                shift
                ;;
            --list-profiles)
                list_profiles
                exit 0
                ;;
            --help)
                show_help
                exit 0
                ;;
            -*)
                error "Unknown option: $1"
                show_help
                exit 1
                ;;
            *)
                # Positional arguments
                if [[ -z "${PROJECT_PATH:-}" ]] || [[ "$PROJECT_PATH" == "." ]]; then
                    PROJECT_PATH="$1"
                elif [[ -z "${MODE:-}" ]] || [[ "$MODE" == "analyze" ]]; then
                    MODE="$1"
                fi
                shift
                ;;
        esac
    done

    # Load profile
    load_profile "$PROFILE"

    # Validate inputs
    validate_args

    # Display configuration
    log "=== Configuration ==="
    echo "  Project Path: $PROJECT_PATH"
    echo "  Mode: $MODE"
    echo "  API URL: $API_BASE_URL"
    echo "  Report Format: $REPORT_FORMAT"
    echo "  Dry Run: $DRY_RUN"
    echo ""

    # Check API availability
    if [[ "$DRY_RUN" != "true" ]]; then
        check_api
        echo ""
    fi

    # Detect project type
    log "Detecting project type..."
    local detection
    detection=$(detect_project_type "$PROJECT_PATH")
    debug "Detection result: $detection"

    local project_type confidence
    project_type=$(echo "$detection" | jq -r '.projectType')
    confidence=$(echo "$detection" | jq -r '.confidence')

    success "Project detected: $project_type (confidence: $confidence)"
    echo ""

    # Dry-run mode
    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN MODE - Would execute:"
        echo ""
        echo "  curl -X POST $API_BASE_URL/v1/orchestrate \\"
        echo "    -H 'Content-Type: application/json' \\"
        echo "    -d '{\"projectPath\": \"$PROJECT_PATH\", \"mode\": \"$MODE\"}'"
        echo ""
        log "Would wait for completion and retrieve report in $REPORT_FORMAT format"
        exit 0
    fi

    # Start orchestration
    log "Starting orchestration (mode: $MODE)..."
    local orchestration
    orchestration=$(start_orchestration "$PROJECT_PATH" "$MODE")
    debug "Orchestration response: $orchestration"

    local execution_id
    execution_id=$(echo "$orchestration" | jq -r '.executionId')

    success "Orchestration started with execution ID: $execution_id"
    echo ""

    # Handle no-wait mode
    if [[ "$WAIT_FOR_COMPLETION" != "true" ]]; then
        log "Execution started (not waiting for completion)"
        echo "$execution_id"
        exit 0
    fi

    # Wait for completion
    if ! wait_for_completion "$execution_id" "$MAX_WAIT_TIME"; then
        error "Orchestration failed"
        exit 1
    fi

    echo ""

    # Get final status
    local final_status
    final_status=$(get_execution_status "$execution_id")

    # Display summary
    display_summary "$execution_id" "$project_type" "$MODE" "$final_status"

    # Save report
    local report_path
    report_path=$(save_report "$execution_id" "$REPORT_FORMAT" "$OUTPUT_DIR")

    # Display report path
    success "Orchestration complete"
    echo "Report saved to: $report_path"
    echo ""

    # Show preview of report
    if [[ "$REPORT_FORMAT" == "markdown" ]] && [[ -f "$report_path" ]]; then
        log "Report preview (first 50 lines):"
        head -n 50 "$report_path"
        echo ""
        echo "... (truncated, see full report at: $report_path)"
    fi
}

# Run main function
main "$@"
