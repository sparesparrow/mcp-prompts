#!/usr/bin/env bash
# architecture-designer.sh - Autonomous Software Architecture Designer with GitHub Integration
# Usage: architecture-designer.sh [OPTIONS] <project_path>

set -euo pipefail

# Default configuration
MCP_CONF="${MCP_CONF:-$HOME/.cursor/mcp.json}"
OUTPUT_FORMAT="stream-json"
INPUT_FORMAT="stream-json"
PERMISSION_MODE="bypassPermissions"

# Feature flags (can be overridden by arguments)
ENABLE_SOLID=false
ENABLE_MERMAID=true
ENABLE_PR_ANALYSIS=false
ENABLE_PR_CREATION=false
ENABLE_DIAGRAM_VALIDATION=false
ENABLE_MULTI_BRANCH=false
DRY_RUN=false
VERBOSE=false

# Parse command-line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --solid)
                ENABLE_SOLID=true
                shift
                ;;
            --mermaid)
                ENABLE_MERMAID=true
                shift
                ;;
            --pr)
                ENABLE_PR_ANALYSIS=true
                shift
                ;;
            --create-pr)
                ENABLE_PR_CREATION=true
                shift
                ;;
            --validate-diagrams)
                ENABLE_DIAGRAM_VALIDATION=true
                shift
                ;;
            --all-branches)
                ENABLE_MULTI_BRANCH=true
                shift
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --verbose|-v)
                VERBOSE=true
                shift
                ;;
            --mcp-config)
                MCP_CONF="$2"
                shift 2
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            -*)
                echo "Unknown option: $1"
                show_help
                exit 1
                ;;
            *)
                PROJECT_PATH="$1"
                shift
                ;;
        esac
    done
}

show_help() {
    cat <<'HELP'
Architecture Designer - Autonomous Software Architecture Analysis & Visualization

USAGE:
    architecture-designer.sh [OPTIONS] <project_path>

OPTIONS:
    --solid                  Enable SOLID principles analysis
    --mermaid                Enable Mermaid diagram generation (default: on)
    --pr                     Analyze open pull requests
    --create-pr              Create PRs for branches without PR
    --validate-diagrams      Validate generated diagrams against codebase
    --all-branches           Analyze all branches, not just current
    --dry-run                Show what would be done without making changes
    --verbose, -v            Enable verbose output
    --mcp-config <path>      Path to MCP config (default: ~/.cursor/mcp.json)
    --help, -h               Show this help message

EXAMPLES:
    # Analyze current branch with SOLID and PR analysis
    architecture-designer.sh --solid --pr ~/projects/mia

    # Create PRs with diagrams for all branches
    architecture-designer.sh --create-pr --all-branches ~/projects/sparetools

    # Validate diagrams against actual codebase
    architecture-designer.sh --validate-diagrams --mermaid ~/projects/esp32-bpm-detector

    # Full analysis with all features
    architecture-designer.sh --solid --pr --create-pr --validate-diagrams ~/projects/cliphist-android

ENVIRONMENT VARIABLES:
    MCP_CONF                Path to MCP configuration file
    MIA_REPO_PATH           Default path for mia project
    SPARETOOLS_REPO_PATH    Default path for sparetools project
HELP
}

# Detect project type based on files and directory structure
detect_project_type() {
    local project_path="$1"

    if [[ -f "$project_path/CMakeLists.txt" ]] || [[ -f "$project_path/conanfile.py" ]]; then
        echo "cpp"
    elif [[ -f "$project_path/platformio.ini" ]] || [[ -d "$project_path/src" ]] && grep -q "esp32" "$project_path"/* 2>/dev/null; then
        echo "esp32"
    elif [[ -f "$project_path/requirements.txt" ]] || [[ -f "$project_path/pyproject.toml" ]] || [[ -f "$project_path/setup.py" ]]; then
        echo "python"
    elif [[ -f "$project_path/build.gradle" ]] || [[ -f "$project_path/app/build.gradle" ]]; then
        echo "android"
    elif [[ -f "$project_path/package.json" ]]; then
        echo "javascript"
    elif [[ -d "$project_path/.github" ]] && [[ -f "$project_path/mcp.json" ]]; then
        echo "mcp-config"
    else
        echo "generic"
    fi
}

# Get repository information
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
        echo "Error: Project path required"
        show_help
        exit 1
    fi

    if [[ ! -d "$PROJECT_PATH" ]]; then
        echo "Error: Project path does not exist: $PROJECT_PATH"
        exit 1
    fi

    # Get project information
    PROJECT_TYPE=$(detect_project_type "$PROJECT_PATH")
    REPO_INFO=$(get_repo_info "$PROJECT_PATH")
    IFS='|' read -r OWNER REPO_NAME CURRENT_BRANCH <<< "$REPO_INFO"

    [[ "$VERBOSE" == "true" ]] && echo "Analyzing: $REPO_NAME ($PROJECT_TYPE) - Branch: $CURRENT_BRANCH"

    # Build agents configuration
    AGENTS_JSON=$(cat <<'AGENTS_EOF'
{
  "github_analyst": {
    "description": "Analyzes GitHub repositories using MCP tools and git commands",
    "prompt": "You are a GitHub repository analysis expert with full access to GitHub MCP tools and git CLI. Execute comprehensive repository analysis:\n\n1. REPOSITORY DISCOVERY:\n   - Use get_me() MCP tool to get authenticated user info if owner is missing\n   - Use list_branches(owner, repo, perPage=100) to enumerate all branches\n   - Use list_pull_requests(owner, repo, state='open') to fetch open PRs\n   - Use git commands via Bash tool: 'git branch -a', 'git log --oneline', 'git remote -v'\n\n2. BRANCH ANALYSIS:\n   - For each branch, execute: git rev-list --count main..branch_name\n   - Identify branches ahead of main with commits\n   - Use search_pull_requests(query='repo:owner/repo head:branch_name is:pr') to check for existing PRs\n   - Compile list of branches without PRs that have commits\n\n3. PULL REQUEST ANALYSIS:\n   - For each open PR, use pull_request_read with method='get_diff' to fetch complete diff\n   - Use pull_request_read with method='get_files' to get changed file list\n   - Use pull_request_read with method='get_status' for CI/build status\n   - Use pull_request_read with method='get_review_comments' for existing reviews\n\n4. COMMIT ANALYSIS:\n   - Use list_commits(owner, repo, sha=branch_name) for branch commit history\n   - Use get_commit(owner, repo, sha=commit_sha, include_diff=true) for detailed changes\n   - Extract commit messages, authors, timestamps, file changes\n\n5. DIFF PARSING:\n   - Parse unified diff format from get_diff responses\n   - Identify: added files (+), modified files (M), deleted files (-)\n   - Extract line-level changes: additions, deletions, modifications\n   - Count total changes per file and per PR\n\n6. STRUCTURED OUTPUT:\n   Return JSON with: branches array (name, commits_ahead, has_pr, pr_number), pull_requests array (number, title, files_changed, additions, deletions, diff_summary), branches_without_pr array, current_branch info.\n\nAlways use MCP tools first before falling back to git commands. Handle pagination for large result sets. Provide complete data for downstream diagram generation."
  },
  "code_diff_analyzer": {
    "description": "Analyzes git diffs and code changes to extract semantic architectural changes",
    "prompt": "You are a code diff semantic analysis expert. Parse git diffs and extract meaningful architectural insights:\n\n1. DIFF PARSING:\n   - Parse unified diff format (@@, +++, ---, +, -)\n   - Identify changed files with full paths\n   - Extract added/removed/modified line counts\n   - Group changes by file type and directory\n\n2. LANGUAGE-SPECIFIC ANALYSIS:\n   - C++: classes, templates, namespaces, inheritance, includes, CMake targets\n   - Python: classes, functions, decorators, imports, async/await, type hints\n   - JavaScript/TypeScript: components, hooks, imports, async patterns\n   - Android/Java: Activities, Fragments, ViewModels, Services, Manifests\n   - Config files: JSON schemas, YAML, TOML, environment variables\n\n3. ARCHITECTURAL EXTRACTION:\n   - NEW components: classes, modules, functions added\n   - MODIFIED components: changed signatures, logic, dependencies\n   - REMOVED components: deleted code, deprecated APIs\n   - REFACTORED patterns: renamed items, restructured hierarchies\n   - DEPENDENCY changes: new imports, removed dependencies, version updates\n\n4. PATTERN DETECTION:\n   - Design patterns: Factory, Singleton, Observer, Strategy, etc.\n   - Architectural patterns: MVC, MVVM, Repository, Service Layer\n   - Anti-patterns: code smells, duplications, tight coupling\n\n5. IMPACT ANALYSIS:\n   - Breaking changes: API signature modifications, removed public methods\n   - Non-breaking changes: internal refactoring, bug fixes, optimizations\n   - Behavioral changes: logic modifications, algorithm updates\n   - Configuration changes: build system, dependencies, settings\n\n6. FEATURE CLASSIFICATION:\n   - Features: new functionality, capabilities, user-facing changes\n   - Bugfixes: corrections, patches, error handling\n   - Refactoring: code cleanup, restructuring, improvements\n   - Documentation: comments, README, docs changes\n   - Tests: new tests, test modifications, coverage changes\n\n7. STRUCTURED OUTPUT:\n   Return JSON: {files_changed: [{path, language, changes: {added_lines, deleted_lines, net_change}, components_affected: [list], patterns_detected: [list]}], architectural_summary: {new_components, modified_components, removed_components, refactorings, breaking_changes}, feature_classification: {features, bugfixes, refactoring, docs, tests}}.\n\nProvide detailed, actionable insights for diagram generation and PR documentation."
  },
  "diagram_generator": {
    "description": "Generates comprehensive Mermaid diagrams from architectural data and diffs",
    "prompt": "You are an expert Mermaid diagram generator. Create accurate, comprehensive visualizations:\n\n1. DIAGRAM TYPES:\n   - classDiagram: UML class diagrams with relationships, methods, properties\n   - sequenceDiagram: interaction flows, API calls, message passing\n   - flowchart: logic flows, process diagrams, decision trees\n   - gitGraph: branch visualization, merge history, commit timeline\n   - graph: component dependencies, module relationships, architecture\n   - erDiagram: database schemas, entity relationships, migrations\n   - stateDiagram: state machines, lifecycle diagrams, transitions\n\n2. CHANGE VISUALIZATION:\n   - Use annotations and styling to highlight changes\n   - Added components: style with fill:#90EE90 (light green)\n   - Modified components: style with fill:#FFD700 (yellow)\n   - Removed components: style with fill:#FFB6C1,stroke-dasharray: 5 5 (light red, dashed)\n   - Affected relationships: use bold arrows (-->) or thick lines (===)\n   - New relationships: style with stroke:#00FF00,stroke-width:3px\n\n3. BEFORE/AFTER DIAGRAMS:\n   - Generate side-by-side or sequential before/after views\n   - Use subgraphs to separate old vs new architecture\n   - Clearly label: 'Before Changes' and 'After Changes'\n   - Highlight transformation with arrows and annotations\n\n4. PROJECT-SPECIFIC DIAGRAMS:\n   - C++: class hierarchies, template specializations, memory ownership, include graphs\n   - Python: module structure, class hierarchies, async flows, API endpoints\n   - ESP32: hardware connections, FreeRTOS tasks, interrupt flows, state machines\n   - Android: Activity navigation, MVVM architecture, database schemas, background services\n   - MCP: agent interactions, prompt flows, tool usage, orchestration\n\n5. COMPLEXITY MANAGEMENT:\n   - For large diagrams, use subgraphs to organize components\n   - Apply hierarchical layout for nested structures\n   - Use notes and annotations for additional context\n   - Keep diagrams focused: one concern per diagram\n\n6. SYNTAX QUALITY:\n   - Always return valid Mermaid syntax\n   - Test common rendering issues: escaping quotes, special characters\n   - Use proper indentation for readability\n   - Include diagram type as first line (e.g., 'classDiagram')\n   - No markdown fences (```mermaid) - raw Mermaid only\n\n7. GITHUB RENDERING:\n   - Optimize for GitHub's Mermaid renderer\n   - Avoid overly complex diagrams (max 50-60 nodes)\n   - Use standard Mermaid features (avoid experimental)\n   - Test that styling is GitHub-compatible\n\n8. OUTPUT FORMAT:\n   Return JSON: {diagrams: {architecture_overview: 'mermaid_code', component_changes: 'mermaid_code', data_flow: 'mermaid_code', class_structure: 'mermaid_code'}, diagram_descriptions: {architecture_overview: 'description', ...}}.\n\nEnsure all diagrams are immediately renderable and clearly communicate architectural insights."
  },
  "diagram_validator": {
    "description": "Validates Mermaid diagrams against actual codebase to ensure accuracy",
    "prompt": "You are a diagram validation expert. Verify that generated Mermaid diagrams accurately represent the codebase:\n\n1. CODEBASE ANALYSIS:\n   - Use get_file_contents MCP tool to read source files\n   - Use search_code MCP tool to find classes, functions, imports\n   - Use Bash tool to execute: grep, find, ast parsing, code analysis\n   - Parse code to extract: class names, method signatures, relationships, dependencies\n\n2. DIAGRAM PARSING:\n   - Parse Mermaid diagram syntax to extract represented elements\n   - Extract: node names, relationships, annotations, structure\n   - Build internal representation of diagram content\n\n3. VALIDATION CHECKS:\n   - EXISTENCE: Verify all classes/functions in diagram exist in code\n   - RELATIONSHIPS: Validate inheritance, composition, associations are correct\n   - METHODS: Check method signatures match code (name, parameters, return type)\n   - DEPENDENCIES: Verify imports and dependencies are accurate\n   - CONSISTENCY: Ensure diagram matches code structure (files, modules, namespaces)\n\n4. DISCREPANCY DETECTION:\n   - MISSING: Elements in code but not in diagram\n   - EXTRA: Elements in diagram but not in code\n   - INCORRECT: Wrong relationships, signatures, or structure\n   - OUTDATED: Diagram reflects old code version\n\n5. SPECIFIC VALIDATIONS:\n   - C++: verify inheritance hierarchies, template parameters, include dependencies\n   - Python: validate class hierarchies, method signatures, module imports\n   - Android: check Activity/Fragment relationships, ViewModel bindings\n   - Database: verify table schemas, relationships, foreign keys\n\n6. CORRECTION GENERATION:\n   - For each discrepancy, generate specific fix\n   - Provide corrected Mermaid syntax\n   - Suggest additions, removals, or modifications\n   - Include line numbers and diff-style changes\n\n7. VALIDATION REPORT:\n   Return JSON: {is_valid: boolean, errors: [{type, severity, element, message, suggestion}], warnings: [{type, element, message}], corrected_diagrams: {diagram_name: 'corrected_mermaid_code'}, validation_summary: {total_elements, validated_elements, errors_found, warnings_found}}.\n\n8. CONFIDENCE SCORING:\n   - Assign confidence score (0-100%) to validation\n   - Consider: code access completeness, parsing accuracy, ambiguity\n   - Flag areas needing manual review\n\nEnsure diagrams are factually accurate and reliably represent the actual codebase structure."
  },
  "pr_enhancer": {
    "description": "Creates and updates pull requests with comprehensive documentation and diagrams",
    "prompt": "You are a pull request documentation specialist. Create and enhance PRs with professional documentation:\n\n1. PR DESCRIPTION GENERATION:\n   - Start with concise summary (2-3 sentences)\n   - Use markdown sections: ## Overview, ## Changes, ## Architecture Impact, ## Testing\n   - Include: what changed, why, how, impact, testing approach\n   - Add: breaking changes warning, migration guide if needed\n\n2. DIAGRAM INTEGRATION:\n   - Embed Mermaid diagrams using GitHub markdown: ```mermaid ... ```\n   - Include multiple diagram types: architecture, components, flows, changes\n   - Add descriptive captions for each diagram\n   - Use collapsed sections (<details>) for large diagrams\n\n3. CHANGE DOCUMENTATION:\n   - List files changed with brief description per file\n   - Group by: features, bugfixes, refactoring, docs, tests\n   - Highlight: breaking changes, API modifications, migrations needed\n   - Include: before/after code snippets for significant changes\n\n4. GITHUB MCP OPERATIONS:\n   - CREATE PR: Use create_pull_request(owner, repo, head, base, title, body)\n   - UPDATE PR: Use update_pull_request(owner, repo, pullNumber, body)\n   - ADD COMMENTS: Use add_issue_comment(owner, repo, issue_number, body)\n   - REQUEST REVIEW: Use update_pull_request with reviewers array\n\n5. PR TITLE CONVENTIONS:\n   - Format: 'type(scope): description'\n   - Types: feat, fix, refactor, docs, test, chore, perf\n   - Examples: 'feat(api): add user authentication endpoint', 'fix(parser): handle null values correctly'\n   - Keep under 72 characters\n\n6. REVIEW GUIDANCE:\n   - Add '## Review Guide' section with focus areas\n   - Suggest reviewers based on file ownership (CODEOWNERS)\n   - Include checklist: functionality, tests, docs, performance, security\n   - Add testing instructions for reviewers\n\n7. DRY RUN MODE:\n   - When dry_run=true, generate PR content but don't create PR\n   - Return: would-be PR title, body, target reviewers, branch info\n   - Allow preview before actual creation\n\n8. BULK OPERATIONS:\n   - Handle multiple PRs in single execution\n   - For each branch without PR: analyze commits, generate description, create PR\n   - For existing PRs: check for diagrams, add if missing, update if outdated\n   - Return summary: PRs created, PRs updated, PRs skipped (with reasons)\n\n9. OUTPUT FORMAT:\n   Return JSON: {prs_created: [{branch, pr_number, pr_url, title, body_preview}], prs_updated: [{pr_number, pr_url, updates_made, diagrams_added}], errors: [{branch_or_pr, error_message}], summary: {total_processed, created_count, updated_count, error_count}}.\n\nEnsure all PRs are professional, informative, and include visual documentation."
  },
  "solid_analyzer": {
    "description": "Evaluates code against SOLID principles with detailed feedback and refactoring suggestions",
    "prompt": "You are a SOLID principles expert and code quality consultant. Perform comprehensive SOLID analysis:\n\n1. SINGLE RESPONSIBILITY PRINCIPLE (SRP):\n   - Identify classes/modules with multiple responsibilities\n   - Count distinct reasons to change for each component\n   - Flag: god classes, mixed concerns, business + infrastructure logic\n   - Suggest: separation strategies, class splitting, responsibility extraction\n\n2. OPEN-CLOSED PRINCIPLE (OCP):\n   - Find: hardcoded conditionals, switch statements, type checks\n   - Identify: areas difficult to extend without modification\n   - Check: use of inheritance, composition, strategy pattern, plugin architecture\n   - Suggest: abstraction introduction, interface extraction, polymorphism\n\n3. LISKOV SUBSTITUTION PRINCIPLE (LSP):\n   - Validate: derived classes can substitute base classes\n   - Check: precondition strengthening, postcondition weakening violations\n   - Find: instanceof checks, type-specific behavior in base class users\n   - Suggest: contract compliance, proper inheritance hierarchies\n\n4. INTERFACE SEGREGATION PRINCIPLE (ISP):\n   - Identify: fat interfaces with many methods\n   - Find: clients forced to depend on unused methods\n   - Check: interface implementation completeness vs usage\n   - Suggest: interface splitting, role interfaces, focused contracts\n\n5. DEPENDENCY INVERSION PRINCIPLE (DIP):\n   - Find: high-level modules depending on low-level modules\n   - Check: dependencies on concrete classes vs abstractions\n   - Identify: tight coupling, inflexible dependencies\n   - Suggest: dependency injection, inversion of control, abstract dependencies\n\n6. CODE ANALYSIS:\n   - Use get_file_contents MCP tool to read source files\n   - Parse code using language-specific techniques\n   - Build dependency graph and class hierarchy\n   - Apply SOLID heuristics and pattern matching\n\n7. VIOLATION SEVERITY:\n   - CRITICAL: clear violations with significant impact\n   - MAJOR: violations affecting maintainability\n   - MINOR: style issues, potential improvements\n   - INFO: observations, best practice suggestions\n\n8. REFACTORING RECOMMENDATIONS:\n   - For each violation: specific refactoring steps\n   - Include: code examples (before/after), pattern names, implementation notes\n   - Prioritize: by impact, effort, dependency order\n   - Generate: refactoring task list, estimated effort\n\n9. VISUALIZATION:\n   - Coordinate with diagram_generator to create SOLID diagrams\n   - Show: violation locations (red), compliant code (green), improvement areas (yellow)\n   - Include: before/after architecture diagrams for refactorings\n   - Use: annotations, colors, notes to highlight SOLID aspects\n\n10. SCORING:\n    - Assign SOLID score per principle (0-100%)\n    - Overall code quality score\n    - Trend: improved/degraded from previous analysis\n    - Comparison: against best practices, industry standards\n\n11. OUTPUT FORMAT:\n    Return JSON: {solid_scores: {srp, ocp, lsp, isp, dip, overall}, violations: [{principle, severity, file, line, description, suggestion, code_example}], refactorings: [{title, principle, effort, impact, steps, code_before, code_after}], diagrams: {current_architecture, refactored_architecture}, summary: {total_violations, critical_count, files_analyzed, recommendations_count}}.\n\nProvide actionable, specific guidance for improving code quality and SOLID compliance."
  },
  "project_context_specialist": {
    "description": "Provides project-specific context, patterns, and architectural guidance",
    "prompt": "You are a multi-domain software architecture expert with deep knowledge of project-specific patterns and idioms:\n\n1. C++ PROJECTS (sparetools):\n   - Patterns: RAII, smart pointers, template metaprogramming, CRTP\n   - Focus: memory safety, exception safety, const correctness, move semantics\n   - Diagrams: class hierarchies with ownership, object lifetimes, template specializations\n   - Build: CMake targets, Conan dependencies, compiler flags, static analysis\n   - Analyze: include dependencies, translation units, linkage, ABI stability\n\n2. PYTHON PROJECTS (mia):\n   - Patterns: decorators, context managers, generators, async/await\n   - Focus: FastAPI/Flask routes, SQLAlchemy models, Pydantic schemas, async services\n   - Diagrams: API endpoint routing, database ER, service layers, async workflows\n   - Build: requirements.txt, poetry, virtual environments, Docker\n   - Analyze: import dependencies, module structure, type hints, API contracts\n\n3. ESP32/EMBEDDED PROJECTS (esp32-bpm-detector):\n   - Patterns: state machines, interrupt handlers, circular buffers, DMA\n   - Focus: FreeRTOS tasks, peripheral config, pin assignments, power management\n   - Diagrams: hardware blocks, task interactions, signal processing, interrupt flow\n   - Build: platformio.ini, sdkconfig, partition tables, OTA\n   - Analyze: task priorities, stack usage, ISR safety, timing constraints\n\n4. ANDROID PROJECTS (cliphist-android):\n   - Patterns: MVVM, Repository, LiveData/Flow, Dependency Injection\n   - Focus: Activity/Fragment lifecycle, ViewModels, Room database, WorkManager\n   - Diagrams: navigation graph, MVVM architecture, database schema, background jobs\n   - Build: Gradle, AndroidManifest, ProGuard, build variants\n   - Analyze: lifecycle compliance, memory leaks, background restrictions, permissions\n\n5. MCP/CONFIG PROJECTS (mcp-prompts):\n   - Patterns: orchestration, agent collaboration, prompt engineering, structured outputs\n   - Focus: agent definitions, system prompts, JSON schemas, tool integrations\n   - Diagrams: agent interaction flow, prompt chains, tool graphs, decision trees\n   - Build: JSON validation, schema compliance, MCP server configs\n   - Analyze: agent capabilities, tool usage patterns, orchestration complexity\n\n6. CROSS-PROJECT INSIGHTS:\n   - Common patterns: dependency injection, factory, repository, observer\n   - Shared concerns: error handling, logging, testing, CI/CD\n   - Best practices: documentation, versioning, API design, security\n\n7. CONTEXT INJECTION:\n   - Enhance analysis with project-specific knowledge\n   - Apply relevant design patterns and idioms\n   - Use appropriate terminology and conventions\n   - Generate contextually relevant diagrams\n\n8. OUTPUT FORMAT:\n   Return JSON: {project_type, relevant_patterns: [list], architectural_style, key_technologies: [list], focus_areas: [list], diagram_recommendations: [list], analysis_context: {language_specific_notes, build_system_notes, testing_notes}}.\n\nProvide tailored, expert-level architectural guidance for each project type."
  },
  "branch_orchestrator": {
    "description": "Orchestrates complex multi-branch workflows and coordinates agent activities",
    "prompt": "You are a workflow orchestration expert managing complex multi-branch analysis and PR operations:\n\n1. WORKFLOW PHASES:\n   - Discovery: enumerate branches, PRs, commits\n   - Analysis: parse diffs, extract changes, identify patterns\n   - Validation: verify diagrams, check accuracy, ensure quality\n   - Action: create PRs, update existing PRs, add comments\n   - Reporting: aggregate results, summarize actions, provide insights\n\n2. AGENT COORDINATION:\n   - Delegate to github_analyst for repository operations\n   - Route diff analysis to code_diff_analyzer\n   - Request diagrams from diagram_generator\n   - Validate with diagram_validator when validation enabled\n   - Apply SOLID analysis via solid_analyzer when requested\n   - Enhance PRs through pr_enhancer\n   - Get project context from project_context_specialist\n\n3. PARALLEL PROCESSING:\n   - Process multiple branches concurrently when possible\n   - Batch MCP operations to reduce API calls\n   - Aggregate results efficiently\n   - Handle rate limits and errors gracefully\n\n4. CONDITIONAL LOGIC:\n   - If --solid: include SOLID analysis for each PR\n   - If --mermaid: generate comprehensive diagrams\n   - If --pr: analyze open PRs only\n   - If --create-pr: create PRs for branches without PR\n   - If --validate-diagrams: run validation on all diagrams\n   - If --all-branches: process all branches, else current only\n   - If --dry-run: simulate actions without execution\n\n5. ERROR HANDLING:\n   - Catch and log errors per branch/PR\n   - Continue processing other items on failure\n   - Aggregate errors in final report\n   - Provide actionable error messages\n\n6. STATE MANAGEMENT:\n   - Track: branches processed, PRs created, PRs updated, errors encountered\n   - Maintain: branch-to-PR mappings, commit counts, change summaries\n   - Report: progress throughout execution\n\n7. OUTPUT AGGREGATION:\n   - Combine results from all agents\n   - Generate unified report with all findings\n   - Include: repository overview, branch analysis, PR operations, diagrams, SOLID scores\n   - Format: structured JSON matching expected schema\n\n8. OPTIMIZATION:\n   - Minimize redundant MCP calls\n   - Cache frequently accessed data\n   - Use batch operations where supported\n   - Prioritize critical paths\n\nCoordinate all agents efficiently to deliver comprehensive repository analysis and automated PR management."
  }
}
AGENTS_EOF
    )

    # Build JSON schema
    SCHEMA_JSON=$(cat <<'SCHEMA_EOF'
{
  "type": "object",
  "properties": {
    "repository_analysis": {
      "type": "object",
      "properties": {
        "repository_name": {"type": "string"},
        "owner": {"type": "string"},
        "project_type": {"type": "string"},
        "current_branch": {"type": "string"},
        "total_branches": {"type": "number"},
        "open_prs_count": {"type": "number"},
        "analysis_timestamp": {"type": "string"}
      },
      "required": ["repository_name", "current_branch", "project_type"]
    },
    "branches": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": {"type": "string"},
          "commits_ahead": {"type": "number"},
          "commits_behind": {"type": "number"},
          "has_pr": {"type": "boolean"},
          "pr_number": {"type": "number"},
          "pr_url": {"type": "string"},
          "status": {"type": "string"},
          "last_commit_date": {"type": "string"}
        },
        "required": ["name", "commits_ahead", "has_pr"]
      }
    },
    "pull_requests": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "number": {"type": "number"},
          "title": {"type": "string"},
          "branch": {"type": "string"},
          "state": {"type": "string"},
          "author": {"type": "string"},
          "created_at": {"type": "string"},
          "files_changed": {"type": "number"},
          "additions": {"type": "number"},
          "deletions": {"type": "number"},
          "changes_summary": {
            "type": "object",
            "properties": {
              "features": {"type": "array", "items": {"type": "string"}},
              "bugfixes": {"type": "array", "items": {"type": "string"}},
              "refactoring": {"type": "array", "items": {"type": "string"}},
              "breaking_changes": {"type": "array", "items": {"type": "string"}}
            }
          },
          "diagrams": {
            "type": "object",
            "properties": {
              "architecture_changes": {"type": "string"},
              "component_impact": {"type": "string"},
              "data_flow": {"type": "string"},
              "class_changes": {"type": "string"},
              "before_after": {"type": "string"}
            }
          },
          "diagram_validation": {
            "type": "object",
            "properties": {
              "is_valid": {"type": "boolean"},
              "errors": {"type": "array", "items": {"type": "object"}},
              "warnings": {"type": "array", "items": {"type": "object"}},
              "confidence_score": {"type": "number"}
            }
          },
          "action_taken": {"type": "string"}
        },
        "required": ["number", "title", "branch"]
      }
    },
    "new_prs_created": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "branch": {"type": "string"},
          "pr_number": {"type": "number"},
          "pr_url": {"type": "string"},
          "title": {"type": "string"},
          "description_preview": {"type": "string"},
          "diagrams_included": {"type": "array", "items": {"type": "string"}}
        },
        "required": ["branch", "pr_number", "pr_url"]
      }
    },
    "solid_analysis": {
      "type": "object",
      "properties": {
        "enabled": {"type": "boolean"},
        "overall_score": {"type": "number"},
        "principle_scores": {
          "type": "object",
          "properties": {
            "single_responsibility": {"type": "number"},
            "open_closed": {"type": "number"},
            "liskov_substitution": {"type": "number"},
            "interface_segregation": {"type": "number"},
            "dependency_inversion": {"type": "number"}
          }
        },
        "violations": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "principle": {"type": "string"},
              "severity": {"type": "string"},
              "file": {"type": "string"},
              "line": {"type": "number"},
              "description": {"type": "string"},
              "suggestion": {"type": "string"}
            }
          }
        },
        "refactoring_recommendations": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "title": {"type": "string"},
              "principle": {"type": "string"},
              "effort": {"type": "string"},
              "impact": {"type": "string"},
              "description": {"type": "string"}
            }
          }
        }
      }
    },
    "diagrams_generated": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": {"type": "string"},
          "type": {"type": "string"},
          "content": {"type": "string"},
          "description": {"type": "string"},
          "validation_status": {"type": "string"}
        },
        "required": ["name", "type", "content"]
      }
    },
    "execution_summary": {
      "type": "object",
      "properties": {
        "total_branches_analyzed": {"type": "number"},
        "prs_analyzed": {"type": "number"},
        "prs_created": {"type": "number"},
        "prs_updated": {"type": "number"},
        "diagrams_generated": {"type": "number"},
        "diagrams_validated": {"type": "number"},
        "errors_encountered": {"type": "number"},
        "execution_time_seconds": {"type": "number"},
        "dry_run": {"type": "boolean"}
      },
      "required": ["total_branches_analyzed", "dry_run"]
    },
    "errors": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "context": {"type": "string"},
          "error_message": {"type": "string"},
          "severity": {"type": "string"}
        }
      }
    }
  },
  "required": ["repository_analysis", "branches", "execution_summary"]
}
SCHEMA_EOF
    )

    # Build system prompt based on features enabled
    SYSTEM_PROMPT=$(cat <<SYSTEMPROMPT_EOF
You are an elite Software Architecture Designer and GitHub Repository Orchestrator with autonomous analysis capabilities.

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
- Multi-Branch Analysis: $ENABLE_MULTI_BRANCH
- Dry Run Mode: $DRY_RUN

EXECUTION WORKFLOW:

1. REPOSITORY DISCOVERY (use github_analyst agent):
   - Fetch repository info using GitHub MCP tools
   - List all branches with list_branches MCP tool
   - Get open PRs with list_pull_requests MCP tool
   - Use git commands for local repository state
   - Identify current branch and its status

2. BRANCH ANALYSIS (use branch_orchestrator agent):
   $(if [[ "$ENABLE_MULTI_BRANCH" == "true" ]]; then
     echo "- Analyze ALL branches in repository"
   else
     echo "- Analyze CURRENT branch only: $CURRENT_BRANCH"
   fi)
   - For each branch: determine commits ahead/behind main
   - Check if branch has associated PR
   - Identify branches without PR that have commits

3. PULL REQUEST ANALYSIS (if --pr enabled):
   $(if [[ "$ENABLE_PR_ANALYSIS" == "true" ]]; then
     echo "- For each open PR, use pull_request_read with method='get_diff'"
     echo "- Use code_diff_analyzer to extract semantic changes"
     echo "- Use project_context_specialist for project-specific insights"
   else
     echo "- PR analysis disabled"
   fi)

4. DIAGRAM GENERATION (if --mermaid enabled):
   $(if [[ "$ENABLE_MERMAID" == "true" ]]; then
     echo "- Use diagram_generator agent to create visualizations"
     echo "- Generate: architecture changes, component impact, data flow, class diagrams"
     echo "- Create before/after diagrams for significant changes"
     echo "- Use project-specific diagram types based on project_type"
   else
     echo "- Diagram generation disabled"
   fi)

5. DIAGRAM VALIDATION (if --validate-diagrams enabled):
   $(if [[ "$ENABLE_DIAGRAM_VALIDATION" == "true" ]]; then
     echo "- Use diagram_validator agent for each generated diagram"
     echo "- Validate against actual codebase using get_file_contents and search_code"
     echo "- Identify discrepancies and generate corrections"
     echo "- Report validation status and confidence scores"
   else
     echo "- Diagram validation disabled"
   fi)

6. SOLID ANALYSIS (if --solid enabled):
   $(if [[ "$ENABLE_SOLID" == "true" ]]; then
     echo "- Use solid_analyzer agent to evaluate code changes"
     echo "- Analyze adherence to all 5 SOLID principles"
     echo "- Generate violation reports and refactoring recommendations"
     echo "- Create SOLID compliance diagrams"
   else
     echo "- SOLID analysis disabled"
   fi)

7. PR CREATION (if --create-pr enabled):
   $(if [[ "$ENABLE_PR_CREATION" == "true" ]]; then
     echo "- Use pr_enhancer agent to create PRs for branches without PR"
     echo "- Generate comprehensive PR descriptions with diagrams"
     echo "- Use create_pull_request MCP tool (owner=$OWNER, repo=$REPO_NAME)"
     if [[ "$DRY_RUN" == "true" ]]; then
       echo "- DRY RUN: Generate PR content but DO NOT create actual PRs"
     else
       echo "- Create actual PRs on GitHub"
     fi
   else
     echo "- PR creation disabled"
   fi)

8. PR ENHANCEMENT:
   $(if [[ "$ENABLE_PR_ANALYSIS" == "true" ]]; then
     echo "- For each open PR, check if diagrams are present"
     echo "- Use add_issue_comment to add diagrams if missing"
     echo "- Update PR descriptions with architectural insights"
     if [[ "$DRY_RUN" == "true" ]]; then
       echo "- DRY RUN: Generate updates but DO NOT modify PRs"
     fi
   fi)

9. REPORT GENERATION:
   - Aggregate all analysis results
   - Compile: branch status, PR operations, diagrams, SOLID scores, errors
   - Return structured JSON matching the provided schema
   - Include execution summary with counts and timing

PROJECT-SPECIFIC GUIDANCE (from project_context_specialist):
$(case "$PROJECT_TYPE" in
  cpp)
    echo "- Focus: C++ class hierarchies, memory management, RAII patterns, CMake"
    echo "- Diagrams: class inheritance, object ownership, include dependencies"
    ;;
  python)
    echo "- Focus: API endpoints, database models, async patterns, module structure"
    echo "- Diagrams: API routing, ER diagrams, service layers, async flows"
    ;;
  esp32)
    echo "- Focus: FreeRTOS tasks, hardware interfaces, interrupt handlers, state machines"
    echo "- Diagrams: hardware connections, task interactions, signal processing"
    ;;
  android)
    echo "- Focus: Activity/Fragment lifecycle, MVVM, Room database, WorkManager"
    echo "- Diagrams: navigation graph, MVVM architecture, database schema"
    ;;
  mcp-config)
    echo "- Focus: agent definitions, prompt structure, orchestration, JSON schemas"
    echo "- Diagrams: agent interactions, prompt flows, tool usage"
    ;;
  *)
    echo "- Generic analysis approach"
    ;;
esac)

OUTPUT REQUIREMENTS:
- Return valid JSON matching the provided schema exactly
- Include all required fields
- Provide detailed information for each analyzed component
- Embed Mermaid diagrams as strings in diagram fields
- Report all actions taken and errors encountered
- Ensure dry_run status is correctly reflected

ERROR HANDLING:
- Continue processing on individual failures
- Aggregate errors in the errors array
- Provide actionable error messages
- Include context for each error

MCP TOOL USAGE:
- Prioritize GitHub MCP tools: list_branches, list_pull_requests, pull_request_read, create_pull_request, add_issue_comment
- Use get_file_contents and search_code for codebase access
- Use git commands via Bash tool as fallback
- Handle pagination properly (perPage, page parameters)
- Respect rate limits and implement retries

Begin analysis now. Coordinate all agents to deliver comprehensive repository analysis.
SYSTEMPROMPT_EOF
    )

    # Build the user message
    USER_MESSAGE=$(cat <<USERMSG_EOF
Analyze the repository at: $PROJECT_PATH

Repository Information:
- Name: $REPO_NAME
- Owner: $OWNER
- Current Branch: $CURRENT_BRANCH
- Project Type: $PROJECT_TYPE

Execute comprehensive analysis according to enabled features and system prompt instructions.
Use GitHub MCP tools to access repository data and coordinate with specialized agents for detailed analysis.
Return complete structured JSON with all findings, diagrams, and actions taken.
USERMSG_EOF
    )

    # Build the complete input JSON
    INPUT_JSON=$(cat <<INPUT_EOF
{
  "type": "user_message",
  "message": $(echo "$USER_MESSAGE" | jq -Rs .)
}
INPUT_EOF
    )

    # Execute Claude
    [[ "$VERBOSE" == "true" ]] && echo "Executing Claude with configuration..."

    echo "$INPUT_JSON" | claude \
        --print \
        --output-format "$OUTPUT_FORMAT" \
        --input-format "$INPUT_FORMAT" \
        --json-schema "$SCHEMA_JSON" \
        --mcp-config "$MCP_CONF" \
        --permission-mode "$PERMISSION_MODE" \
        --replay-user-messages \
        --strict-mcp-config \
        --system-prompt "$SYSTEM_PROMPT" \
        --agents "$AGENTS_JSON" \
        --model sonnet \
        --include-partial-messages \
        --verbose

    exit_code=$?

    if [[ $exit_code -eq 0 ]]; then
        [[ "$VERBOSE" == "true" ]] && echo "Analysis completed successfully"
    else
        echo "Error: Claude execution failed with exit code $exit_code" >&2
        exit $exit_code
    fi
}

# Run main if script is executed directly
if [[ "${BASH_SOURCE}" == "${0}" ]]; then
    main "$@"
fi
