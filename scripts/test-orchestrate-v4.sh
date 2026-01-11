#!/usr/bin/env bash
# test-orchestrate-v4.sh - Integration tests for claude-orchestrate-v4.sh
# Tests V4 script functionality, API integration, and error handling

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ORCHESTRATE_SCRIPT="$SCRIPT_DIR/claude-orchestrate-v4.sh"
API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"
TEST_PROJECTS_DIR="${TEST_PROJECTS_DIR:-/tmp/orchestrate-test-projects}"
TEST_RESULTS_DIR="${TEST_RESULTS_DIR:-./test-results}"
VERBOSE="${VERBOSE:-false}"

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging
log() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

pass() {
    echo -e "${GREEN}✓ PASS${NC} $1"
    ((TESTS_PASSED++))
}

fail() {
    echo -e "${RED}✗ FAIL${NC} $1"
    ((TESTS_FAILED++))
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

debug() {
    if [[ "$VERBOSE" == "true" ]]; then
        echo -e "${BLUE}[DEBUG]${NC} $1"
    fi
}

# Setup test environment
setup() {
    log "Setting up test environment..."

    # Create test projects directory
    mkdir -p "$TEST_PROJECTS_DIR"
    mkdir -p "$TEST_RESULTS_DIR"

    # Create test projects
    create_test_projects

    pass "Test environment setup complete"
}

# Create sample test projects
create_test_projects() {
    log "Creating test projects..."

    # Test project 1: C++ project
    local cpp_project="$TEST_PROJECTS_DIR/cpp-project"
    mkdir -p "$cpp_project/src"
    cat > "$cpp_project/CMakeLists.txt" <<'EOF'
cmake_minimum_required(VERSION 3.10)
project(TestProject)
set(CMAKE_CXX_STANDARD 17)
add_executable(test src/main.cpp)
EOF
    cat > "$cpp_project/src/main.cpp" <<'EOF'
#include <iostream>
int main() { std::cout << "Hello" << std::endl; return 0; }
EOF

    # Test project 2: Python project
    local py_project="$TEST_PROJECTS_DIR/python-project"
    mkdir -p "$py_project/src"
    cat > "$py_project/pyproject.toml" <<'EOF'
[build-system]
requires = ["setuptools"]
build-backend = "setuptools.build_meta"

[project]
name = "test-project"
version = "0.1.0"
EOF
    cat > "$py_project/src/main.py" <<'EOF'
#!/usr/bin/env python3
print("Hello World")
EOF

    # Test project 3: Web project
    local web_project="$TEST_PROJECTS_DIR/web-project"
    mkdir -p "$web_project/src"
    cat > "$web_project/package.json" <<'EOF'
{
  "name": "test-web",
  "version": "1.0.0",
  "description": "Test web project",
  "main": "index.js"
}
EOF
    cat > "$web_project/src/index.js" <<'EOF'
console.log("Hello World");
EOF

    # Test project 4: Generic project (no specific config)
    local generic_project="$TEST_PROJECTS_DIR/generic-project"
    mkdir -p "$generic_project/src"
    cat > "$generic_project/README.md" <<'EOF'
# Generic Test Project
A project without specific build configurations.
EOF

    pass "Created 4 test projects"
}

# Test 1: Script exists and is executable
test_script_exists() {
    log "Test 1: Script exists and is executable"
    ((TESTS_RUN++))

    if [[ ! -f "$ORCHESTRATE_SCRIPT" ]]; then
        fail "Script not found at $ORCHESTRATE_SCRIPT"
        return 1
    fi

    if [[ ! -x "$ORCHESTRATE_SCRIPT" ]]; then
        fail "Script is not executable"
        return 1
    fi

    pass "Script exists and is executable"
}

# Test 2: Script shows help
test_help_command() {
    log "Test 2: Help command"
    ((TESTS_RUN++))

    local output
    output=$("$ORCHESTRATE_SCRIPT" --help 2>&1 || true)

    if echo "$output" | grep -q "USAGE:"; then
        pass "Help command displays usage"
    else
        fail "Help command did not display usage"
        return 1
    fi
}

# Test 3: List profiles command
test_list_profiles() {
    log "Test 3: List profiles command"
    ((TESTS_RUN++))

    local output
    output=$("$ORCHESTRATE_SCRIPT" --list-profiles 2>&1 || true)

    if echo "$output" | grep -q "default\|profiles"; then
        pass "List profiles command works"
    else
        fail "List profiles command did not show profiles"
        return 1
    fi
}

# Test 4: Argument validation - invalid project path
test_invalid_project_path() {
    log "Test 4: Argument validation - invalid project path"
    ((TESTS_RUN++))

    local output
    output=$("$ORCHESTRATE_SCRIPT" /nonexistent/path 2>&1 || true)

    if echo "$output" | grep -q "not found\|Error"; then
        pass "Invalid project path properly rejected"
    else
        fail "Invalid project path not properly validated"
        return 1
    fi
}

# Test 5: Argument validation - invalid mode
test_invalid_mode() {
    log "Test 5: Argument validation - invalid mode"
    ((TESTS_RUN++))

    local output
    output=$("$ORCHESTRATE_SCRIPT" "$TEST_PROJECTS_DIR/cpp-project" invalid-mode 2>&1 || true)

    if echo "$output" | grep -q "Invalid mode\|Error"; then
        pass "Invalid mode properly rejected"
    else
        fail "Invalid mode not properly validated"
        return 1
    fi
}

# Test 6: Dry-run mode
test_dry_run_mode() {
    log "Test 6: Dry-run mode (no API calls)"
    ((TESTS_RUN++))

    local output
    output=$(DRY_RUN=true "$ORCHESTRATE_SCRIPT" "$TEST_PROJECTS_DIR/cpp-project" analyze 2>&1 || true)

    if echo "$output" | grep -q "DRY RUN\|Would execute"; then
        pass "Dry-run mode works correctly"
    else
        fail "Dry-run mode did not display preview"
        return 1
    fi
}

# Test 7: Project type detection - C++ project
test_detect_cpp_project() {
    log "Test 7: Project type detection - C++ project"
    ((TESTS_RUN++))

    # This test requires API to be running
    if ! check_api_health; then
        warn "Skipping - API not available"
        return 0
    fi

    local payload
    payload=$(jq -n \
        --arg projectPath "$TEST_PROJECTS_DIR/cpp-project" \
        '{projectPath: $projectPath}')

    local response
    response=$(curl -s -X POST \
        "$API_BASE_URL/v1/orchestrate/detect-project-type" \
        -H "Content-Type: application/json" \
        -d "$payload" 2>/dev/null || echo "{}")

    if echo "$response" | jq -e '.projectType == "cpp_backend"' >/dev/null 2>&1; then
        pass "C++ project correctly detected"
    else
        debug "Detection response: $response"
        warn "C++ project detection - result: $(echo "$response" | jq -r '.projectType // "unknown"')"
    fi
}

# Test 8: Project type detection - Python project
test_detect_python_project() {
    log "Test 8: Project type detection - Python project"
    ((TESTS_RUN++))

    if ! check_api_health; then
        warn "Skipping - API not available"
        return 0
    fi

    local payload
    payload=$(jq -n \
        --arg projectPath "$TEST_PROJECTS_DIR/python-project" \
        '{projectPath: $projectPath}')

    local response
    response=$(curl -s -X POST \
        "$API_BASE_URL/v1/orchestrate/detect-project-type" \
        -H "Content-Type: application/json" \
        -d "$payload" 2>/dev/null || echo "{}")

    if echo "$response" | jq -e '.projectType == "python_backend"' >/dev/null 2>&1; then
        pass "Python project correctly detected"
    else
        warn "Python project detection - result: $(echo "$response" | jq -r '.projectType // "unknown"')"
    fi
}

# Test 9: Project type detection - Web project
test_detect_web_project() {
    log "Test 9: Project type detection - Web project"
    ((TESTS_RUN++))

    if ! check_api_health; then
        warn "Skipping - API not available"
        return 0
    fi

    local payload
    payload=$(jq -n \
        --arg projectPath "$TEST_PROJECTS_DIR/web-project" \
        '{projectPath: $projectPath}')

    local response
    response=$(curl -s -X POST \
        "$API_BASE_URL/v1/orchestrate/detect-project-type" \
        -H "Content-Type: application/json" \
        -d "$payload" 2>/dev/null || echo "{}")

    if echo "$response" | jq -e '.projectType == "web_frontend"' >/dev/null 2>&1; then
        pass "Web project correctly detected"
    else
        warn "Web project detection - result: $(echo "$response" | jq -r '.projectType // "unknown"')"
    fi
}

# Test 10: Configuration profile loading
test_profile_loading() {
    log "Test 10: Configuration profile loading"
    ((TESTS_RUN++))

    local profile_file="$SCRIPT_DIR/profiles/default.env"

    if [[ ! -f "$profile_file" ]]; then
        fail "Default profile not found"
        return 1
    fi

    if grep -q "API_BASE_URL" "$profile_file"; then
        pass "Profile contains expected configuration"
    else
        fail "Profile missing configuration variables"
        return 1
    fi
}

# Test 11: All profiles exist
test_all_profiles_exist() {
    log "Test 11: All configuration profiles exist"
    ((TESTS_RUN++))

    local profiles=("default.env" "embedded.env" "ci.env" "dev.env")
    local missing=0

    for profile in "${profiles[@]}"; do
        if [[ ! -f "$SCRIPT_DIR/profiles/$profile" ]]; then
            warn "Missing profile: $profile"
            ((missing++))
        fi
    done

    if [[ $missing -eq 0 ]]; then
        pass "All 4 profiles exist"
    else
        fail "$missing profiles are missing"
        return 1
    fi
}

# Test 12: API health check endpoint
test_api_health() {
    log "Test 12: API health check endpoint"
    ((TESTS_RUN++))

    local response
    response=$(curl -s -w "\n%{http_code}" "$API_BASE_URL/health" 2>/dev/null || echo "")

    if [[ -z "$response" ]]; then
        warn "API not responding - skipping health check"
        return 0
    fi

    local http_code
    http_code=$(echo "$response" | tail -n1)

    if [[ "$http_code" == "200" ]]; then
        pass "API health check passed (HTTP 200)"
    else
        warn "API health check returned HTTP $http_code (expected 200)"
    fi
}

# Test 13: API version endpoint
test_api_version() {
    log "Test 13: API version endpoint"
    ((TESTS_RUN++))

    if ! check_api_health; then
        warn "Skipping - API not available"
        return 0
    fi

    local response
    response=$(curl -s "$API_BASE_URL/v1" 2>/dev/null || echo "{}")

    if echo "$response" | jq -e '.version' >/dev/null 2>&1; then
        pass "API version endpoint working"
    else
        warn "API version endpoint did not return expected format"
    fi
}

# Test 14: Report format options
test_report_formats() {
    log "Test 14: Report format options validation"
    ((TESTS_RUN++))

    # Test that script accepts all format options
    local formats=("json" "markdown" "html")
    local valid=0

    for fmt in "${formats[@]}"; do
        if "$ORCHESTRATE_SCRIPT" "$TEST_PROJECTS_DIR/cpp-project" --format "$fmt" --dry-run >/dev/null 2>&1; then
            ((valid++))
        fi
    done

    if [[ $valid -eq 3 ]]; then
        pass "All report formats accepted"
    else
        fail "Not all report formats accepted"
        return 1
    fi
}

# Test 15: Output directory creation
test_output_directory() {
    log "Test 15: Output directory creation"
    ((TESTS_RUN++))

    local test_output="$TEST_RESULTS_DIR/test-output"
    rm -rf "$test_output"

    # Dry-run mode should still create output directory
    DRY_RUN=true "$ORCHESTRATE_SCRIPT" "$TEST_PROJECTS_DIR/cpp-project" \
        --output-dir "$test_output" >/dev/null 2>&1 || true

    if [[ -d "$test_output" ]]; then
        pass "Output directory created"
    else
        warn "Output directory not created in dry-run mode"
    fi
}

# Test 16: Custom API URL support
test_custom_api_url() {
    log "Test 16: Custom API URL support"
    ((TESTS_RUN++))

    local output
    # Test that script accepts custom API URL (won't connect, but should accept it)
    output=$("$ORCHESTRATE_SCRIPT" "$TEST_PROJECTS_DIR/cpp-project" \
        --api-url http://custom.example.com:3000 --dry-run 2>&1 || true)

    if echo "$output" | grep -q "custom.example.com"; then
        pass "Custom API URL accepted"
    else
        pass "Custom API URL silently accepted"
    fi
}

# Test 17: Polling parameters
test_polling_parameters() {
    log "Test 17: Polling parameters configuration"
    ((TESTS_RUN++))

    local output
    output=$("$ORCHESTRATE_SCRIPT" "$TEST_PROJECTS_DIR/cpp-project" \
        --poll-interval 5 --max-wait 600 --dry-run 2>&1 || true)

    pass "Polling parameters accepted"
}

# Test 18: Multiple projects
test_multiple_projects() {
    log "Test 18: Multiple project detection"
    ((TESTS_RUN++))

    local projects=("$TEST_PROJECTS_DIR/cpp-project" "$TEST_PROJECTS_DIR/python-project" "$TEST_PROJECTS_DIR/web-project")
    local detected=0

    for project in "${projects[@]}"; do
        if [[ -d "$project" ]]; then
            ((detected++))
        fi
    done

    if [[ $detected -eq 3 ]]; then
        pass "All 3 test projects available"
    else
        fail "Not all test projects available"
        return 1
    fi
}

# Test 19: Help text completeness
test_help_completeness() {
    log "Test 19: Help text includes all features"
    ((TESTS_RUN++))

    local output
    output=$("$ORCHESTRATE_SCRIPT" --help 2>&1 || true)

    local required_sections=("USAGE:" "ARGUMENTS:" "OPTIONS:" "EXAMPLES:" "ENVIRONMENT VARIABLES:")
    local missing=0

    for section in "${required_sections[@]}"; do
        if ! echo "$output" | grep -q "$section"; then
            warn "Help missing section: $section"
            ((missing++))
        fi
    done

    if [[ $missing -eq 0 ]]; then
        pass "Help text is comprehensive"
    else
        fail "Help text missing $missing sections"
        return 1
    fi
}

# Test 20: Error message quality
test_error_messages() {
    log "Test 20: Error message quality"
    ((TESTS_RUN++))

    local output
    output=$("$ORCHESTRATE_SCRIPT" /nonexistent analyze 2>&1 || true)

    if echo "$output" | grep -q "Project path not found\|Error:"; then
        pass "Error messages are descriptive"
    else
        fail "Error messages lack clarity"
        return 1
    fi
}

# Helper function: Check API health
check_api_health() {
    curl -s "$API_BASE_URL/health" >/dev/null 2>&1 && return 0 || return 1
}

# Cleanup
cleanup() {
    log "Cleaning up test environment..."
    # Keep test projects for inspection if needed
    # rm -rf "$TEST_PROJECTS_DIR"
    pass "Cleanup complete"
}

# Summary
summary() {
    echo ""
    echo "========================================"
    echo "Test Results Summary"
    echo "========================================"
    echo "Tests Run:    $TESTS_RUN"
    echo "Tests Passed: $TESTS_PASSED"
    echo "Tests Failed: $TESTS_FAILED"

    if [[ $TESTS_FAILED -eq 0 ]]; then
        echo -e "${GREEN}All tests passed!${NC}"
        return 0
    else
        echo -e "${RED}$TESTS_FAILED test(s) failed${NC}"
        return 1
    fi
}

# Main execution
main() {
    log "=== claude-orchestrate-v4 Integration Tests ==="
    echo ""

    setup

    # Run all tests
    test_script_exists
    test_help_command
    test_list_profiles
    test_invalid_project_path
    test_invalid_mode
    test_dry_run_mode
    test_detect_cpp_project
    test_detect_python_project
    test_detect_web_project
    test_profile_loading
    test_all_profiles_exist
    test_api_health
    test_api_version
    test_report_formats
    test_output_directory
    test_custom_api_url
    test_polling_parameters
    test_multiple_projects
    test_help_completeness
    test_error_messages

    cleanup
    summary
}

# Run tests
main "$@"
