# MCP-Prompts: Unified Orchestration Implementation TODO

**Goal**: Integrate Claude Orchestrator v3, subagent patterns from VoltAgent, and scaffolding capabilities from mcp-project-orchestrator into mcp-prompts as a single, unified system.

**Status**: Planning Phase  
**Last Updated**: 2025-01-09  
**Owner**: sparesparrow

---

## Phase 0: Preparation & Research

### 0.1 Study source repositories
- [ ] **Clone and review mcp-project-orchestrator**
  - URL: https://github.com/sparesparrow/mcp-project-orchestrator
  - Focus on:
    - `src/` directory structure (ports & adapters pattern)
    - `templates/` folder (what templates exist for projects/components)
    - `project_orchestration.json` schema and usage
    - Integration plan: https://github.com/sparesparrow/mcp-project-orchestrator/blob/main/integration_plan.md
  - Copy/reuse:
    - Hexagonal architecture code generation patterns
    - Project template system
    - Config merging logic

- [ ] **Study VoltAgent awesome-claude-code-subagents**
  - URL: https://github.com/VoltAgent/awesome-claude-code-subagents
  - Focus on:
    - Subagent categorization (dev roles, infra roles, quality roles, meta roles)
    - Prompt templates for each subagent type
    - Tool specifications and capabilities
    - How subagents are meant to compose and coordinate
  - Copy/reuse:
    - Subagent categories: `embedded-systems`, `iot-engineer`, `devops-engineer`, `code-reviewer`, `documentation-engineer`, `mcp-developer`, `multi-agent-coordinator`, etc.
    - Prompt fragments and specialized instructions
    - Role descriptions and capabilities

- [ ] **Review Claude Agent SDK documentation**
  - URL: https://code.claude.com/docs/en/cli-reference
  - Key sections:
    - Subagent spawning syntax
    - Tool definitions and MCP integration
    - Model selection and token budgeting
    - Context compaction strategies
  - Reference: https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk

### 0.2 Audit current mcp-prompts codebase
- [ ] Map existing storage adapters (DynamoDB, PostgreSQL, file, memory)
- [ ] Review current REST API structure
- [ ] Identify where new subagent registry endpoints will live
- [ ] Check existing MCP tool definitions
- [ ] Review current TypeScript/Node patterns and linting rules

### 0.3 Design unified data model
- [ ] Create unified JSON schema for:
  - Subagent definitions (combining VoltAgent + your v3 design)
  - Main agent templates (per project type)
  - Project orchestration metadata
  - Prompt templates and fragments
- [ ] Define how these relate to existing Prompt entity
- [ ] Plan backward compatibility

---

## Phase 1: Data Model & Storage Extensions

### 1.1 Extend Prompt model to support "Subagent Registry"
- [ ] Add new Prompt type: `"type": "subagent_registry"`
- [ ] Schema fields:
  ```json
  {
    "id": "subagent_registry",
    "type": "subagent_registry",
    "name": "VoltAgent-style Subagent",
    "category": "dev/backend-developer|infra/devops-engineer|quality/code-reviewer|meta/multi-agent-coordinator",
    "tags": ["embedded", "iot", "typescript", "python"],
    "description": "What this subagent does",
    "model": "claude-opus|claude-sonnet|claude-haiku",
    "system_prompt": "Full system prompt for Claude",
    "tools": ["tool1", "tool2"],
    "mcp_servers": ["github", "filesystem"],
    "version": "1.0.0",
    "author": "sparesparrow|voltAgent|contributor",
    "source_url": "https://github.com/...",
    "compatible_with": ["multiplatform_iot", "python_backend"],
    "variables": [{"name": "...", "type": "..."}]
  }
  ```

- [ ] Add new Prompt type: `"type": "main_agent_template"`
- [ ] Schema fields:
  ```json
  {
    "id": "main_agent_cpp_backend",
    "type": "main_agent_template",
    "name": "C++ Backend Main Agent",
    "project_types": ["cpp_backend"],
    "model": "claude-opus",
    "system_prompt": "You are an expert C++ architect...",
    "default_subagents": ["explorer", "analyzer", "reviewer", "solid_analyzer"],
    "mcp_servers": ["github", "filesystem"],
    "custom_variables": [...],
    "version": "3.0.0"
  }
  ```

- [ ] Add new Prompt type: `"type": "project_orchestration_template"`
- [ ] Schema fields (based on mcp-project-orchestrator):
  ```json
  {
    "id": "template_mcp_server",
    "type": "project_orchestration_template",
    "name": "MCP Server Template",
    "description": "For new MCP servers (hexagonal architecture)",
    "base_structure": {...},
    "devcontainer_template": "...",
    "github_actions_templates": [...],
    "aws_terraform_template": "...",
    "docker_templates": [...],
    "variables": [...]
  }
  ```

### 1.2 Create storage/adapter methods for new types
- [ ] In `src/domain/`:
  - Create `Subagent` entity
  - Create `MainAgentTemplate` entity
  - Create `ProjectOrchestrationTemplate` entity
  - Define their repositories/ports

- [ ] In `src/adapters/` for each storage backend (postgres, dynamodb, file):
  - Add methods:
    - `getSubagentsByCategory(category)`
    - `getSubagentsByTags(tags)`
    - `listMainAgentTemplates()`
    - `getMainAgentTemplateByProjectType(type)`
    - `listProjectOrchestrationTemplates()`
    - `getProjectOrchestrationTemplate(id)`
  - Ensure all return fully-formed JSON suitable for Claude's `agents` parameter or shell script generation

### 1.3 Add database migrations
- [ ] PostgreSQL migrations:
  - Create `subagent_registry` table
  - Create `main_agent_templates` table
  - Create `project_orchestration_templates` table
  - Add indexes on `category`, `tags`, `project_type`

- [ ] DynamoDB schema updates (if using):
  - Add global secondary index on `type#category` for subagent queries
  - Add TTL for experimental/draft subagents

- [ ] File storage:
  - Add `data/subagents.json`, `data/main-agents.json`, `data/project-templates.json`

---

## Phase 2: REST API & MCP Tools

### 2.1 Add REST endpoints for subagent registry
- [ ] `GET /v1/subagents` - List all subagents with filtering
  - Query params: `?category=dev&tags=iot&model=sonnet`
  - Returns: Array of subagent definitions

- [ ] `GET /v1/subagents/{id}` - Get single subagent

- [ ] `POST /v1/subagents` - Create new subagent (admin-only)

- [ ] `PUT /v1/subagents/{id}` - Update subagent (admin-only)

- [ ] `GET /v1/main-agents` - List main agent templates
  - Query params: `?project_type=multiplatform_iot`

- [ ] `GET /v1/main-agents/{id}` - Get main agent template

- [ ] `POST /v1/project-orchestrate` - Generate project structure
  - Body: `{"template_id": "...", "variables": {...}, "include_components": [...]}`
  - Returns: JSON with generated files + instructions

- [ ] `GET /v1/project-templates` - List orchestration templates

- [ ] `GET /v1/orchestration-plan` - Plan agent orchestration
  - Query: `?project_path=~/mia&mode=analyze`
  - Returns: JSON with which subagents to spawn, MCP servers to use, expected time/cost

### 2.2 Add MCP tools
- [ ] In `src/mcp/tools/`:
  - `list_subagents(category?: string, tags?: string[])` → List available subagents
  - `get_subagent(id: string)` → Fetch subagent definition
  - `get_main_agent_template(project_type: string)` → Fetch main agent for project type
  - `list_project_templates()` → List available project templates
  - `generate_project_structure(template_id, variables)` → Scaffold new project
  - `apply_prompt_template(template_id, variables)` → Render template with variables
  - `create_subagent_for_role(role, domain, project_context)` → Dynamically create a specialized subagent prompt

- [ ] Register tools in MCP server `/mcp` endpoint

---

## Phase 3: Curate & Port Subagent Definitions

### 3.1 Import VoltAgent categories into mcp-prompts
Reference: https://github.com/VoltAgent/awesome-claude-code-subagents

Create Prompt entries (type: `subagent_registry`) for each VoltAgent subagent adapted to your needs:

#### Dev & Language Specialists
- [ ] `dev/backend-developer` (base analyzer template, adaptable per language)
- [ ] `dev/typescript-pro` (for Node/Web components)
- [ ] `dev/python-pro` (for Python services)
- [ ] `dev/cpp-specialist` (for C++ embedded/server work)
- [ ] `dev/kotlin-specialist` (for Android)
- [ ] `dev/react-specialist` (for frontend)
- [ ] `dev/mcp-developer` (MCP server/tool design, new category)

#### Infrastructure & DevOps
- [ ] `infra/devops-engineer`
- [ ] `infra/kubernetes-specialist`
- [ ] `infra/terraform-engineer`
- [ ] `infra/aws-architect`
- [ ] `infra/docker-specialist`
- [ ] `infra/ci-cd-engineer`

#### Quality & Security
- [ ] `quality/code-reviewer`
- [ ] `quality/security-auditor`
- [ ] `quality/performance-engineer`
- [ ] `quality/qa-expert`
- [ ] `quality/penetration-tester` (optional, advanced)

#### DX & Documentation
- [ ] `dx/documentation-engineer`
- [ ] `dx/dx-optimizer`
- [ ] `dx/git-workflow-manager`
- [ ] `dx/tooling-engineer`

#### Specialized IoT/Hardware
- [ ] `iot/embedded-systems` (ESP32, Arduino, FreeRTOS)
- [ ] `iot/iot-engineer` (system-level IoT orchestration)
- [ ] `iot/sensor-integration` (data pipelines, protocols)
- [ ] `iot/edge-computing` (local processing, Pi as gateway)

#### Meta & Orchestration
- [ ] `meta/multi-agent-coordinator` (inspire main orchestrator logic)
- [ ] `meta/workflow-orchestrator` (task planning)
- [ ] `meta/context-manager` (manage context across agents)
- [ ] `meta/project-architect` (overall design decisions)

### 3.2 For each subagent category, create Prompt entries
Template structure:
```bash
# For each subagent above:
1. Create file: src/data/subagents/{category}/{name}.json
2. Include:
   - Full system prompt (copy from VoltAgent or adapt)
   - Tool list (tools it's allowed to use)
   - MCP servers (GitHub, filesystem, etc.)
   - Model selection (opus/sonnet/haiku with reasoning)
   - Tags and compatibility
   - Link to source (VoltAgent repo)
3. Add to data model and register in endpoints
```

Example file structure:
```
src/data/subagents/
├── dev/
│   ├── backend-developer.json
│   ├── typescript-pro.json
│   ├── python-pro.json
│   ├── cpp-specialist.json
│   ├── kotlin-specialist.json
│   ├── react-specialist.json
│   └── mcp-developer.json
├── infra/
│   ├── devops-engineer.json
│   ├── terraform-engineer.json
│   └── aws-architect.json
├── quality/
│   ├── code-reviewer.json
│   ├── security-auditor.json
│   └── performance-engineer.json
├── iot/
│   ├── embedded-systems.json
│   ├── iot-engineer.json
│   └── edge-computing.json
└── meta/
    ├── multi-agent-coordinator.json
    └── project-architect.json
```

### 3.3 Sources to extract from
- [ ] **VoltAgent awesome-claude-code-subagents**:
  - GitHub: https://github.com/VoltAgent/awesome-claude-code-subagents
  - Extract: Prompt templates, tool lists, role descriptions
  - Adapt: Add MCP-specific and IoT-specific context

- [ ] **Anthropic Engineering post**:
  - Reference: https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk
  - Extract: Best practices for tool design, feedback loops, context management
  - Adapt: Email agent example → generalize for mcp-prompts/mcp-project-orchestrator use cases

- [ ] **Claude Code documentation**:
  - https://code.claude.com/docs/en/skills
  - https://code.claude.com/docs/en/hooks-guide
  - Extract: How tools are invoked, error handling, tool composition

---

## Phase 4: Main Agent Templates

### 4.1 Create main agent templates per project type
Create Prompt entries (type: `main_agent_template`) for each project type from your v3 design:

- [ ] `main_agent_cpp_backend.json`
  - Model: claude-opus
  - System prompt: (from improved-agents.json)
  - Default subagents: explorer, analyzer, solid_analyzer, reviewer, tester, dependency_analyzer
  - MCP servers: github, filesystem
  - Source: Your v3 design

- [ ] `main_agent_python_backend.json`
  - Model: claude-opus
  - System prompt: (adapted for Python/FastAPI)
  - Default subagents: explorer, analyzer, solid_analyzer, reviewer, tester, dependency_analyzer
  - Add custom variable: `framework` (FastAPI, Flask, Django)

- [ ] `main_agent_embedded_iot.json`
  - Model: claude-opus
  - System prompt: ESP32/Arduino/PlatformIO focus
  - Default subagents: explorer, analyzer, tester, config_analyzer, git_analyzer
  - Add custom: FreeRTOS, power management, communication protocols

- [ ] `main_agent_android_app.json`
  - Model: claude-opus
  - System prompt: Kotlin/Android Architecture Components
  - Default subagents: explorer, analyzer, reviewer, tester
  - Add custom: BLE, Room database, MVVM patterns

- [ ] `main_agent_web_frontend.json`
  - Model: claude-opus
  - System prompt: React/Vue/Angular
  - Default subagents: explorer, analyzer, reviewer, tester, diagrammer
  - Add custom variable: `framework` (React, Vue, Angular)

- [ ] `main_agent_devops_infrastructure.json`
  - Model: claude-opus
  - System prompt: Docker/Kubernetes/Terraform
  - Default subagents: explorer, config_analyzer, git_analyzer, diagrammer
  - Add custom: Cloud provider, IaC tool

- [ ] `main_agent_multiplatform_iot.json` (MIA-specific)
  - Model: claude-opus
  - System prompt: (from your mia-agents-v3.json, enhanced)
  - Default subagents: explorer, analyzer, diagrammer, solid_analyzer, git_analyzer, tester, reviewer
  - Custom subagents:
    - `mia_backend_analyzer` (FastAPI + IoT API patterns)
    - `mia_embedded_coordinator` (ESP32 ↔ Pi communication)
    - `mia_mobile_integration` (Android ↔ Backend)
    - `mia_infrastructure` (Docker orchestration)
  - MCP servers: github, filesystem, mcp-project-orchestrator (when available)

### 4.2 Store main agents in mcp-prompts
- [ ] Create `src/data/main-agents/` directory
- [ ] Add one JSON file per main agent template
- [ ] Register in storage adapters and API endpoints
- [ ] Ensure templates are queryable by project_type

---

## Phase 5: Project Orchestration Integration

### 5.1 Integrate mcp-project-orchestrator capabilities
**Reference**: https://github.com/sparesparrow/mcp-project-orchestrator

Instead of embedding all of mcp-project-orchestrator, create a **lightweight adapter**:

- [ ] **Create `project_orchestration_templates` Prompt type**
  - Stores templates for: MCP server, Python backend, C++ app, Node.js service, IoT firmware, etc.
  - Each template includes:
    - Base directory structure
    - devcontainer.json template
    - GitHub Actions workflow templates
    - AWS/Terraform templates
    - Docker templates
    - Configuration file templates (package.json, pyproject.toml, CMakeLists.txt, etc.)

- [ ] **Create REST endpoint `/v1/project-orchestrate`**
  - Input:
    ```json
    {
      "template_id": "mcp_server",
      "project_name": "my-mcp-server",
      "description": "My new MCP server",
      "variables": {
        "author": "sparesparrow",
        "license": "MIT",
        "storage_backend": "postgres"
      },
      "include_components": ["devcontainer", "github_actions", "docker"]
    }
    ```
  - Output:
    ```json
    {
      "files": [
        {
          "path": "src/index.ts",
          "content": "...",
          "template_used": "mcp_server/src/index.ts"
        }
      ],
      "instructions": "To complete setup...",
      "next_steps": [...]
    }
    ```

- [ ] **Do NOT embed mcp-project-orchestrator code**
  - Instead: Hardcode templates (JSON/YAML snippets) directly in Prompt entries
  - Rationale: Simpler, no submodules, all in one repo, easier to customize

- [ ] **Copy templates from mcp-project-orchestrator repo**
  - URL: https://github.com/sparesparrow/mcp-project-orchestrator/tree/main/templates
  - Copy/adapt:
    - `templates/hexagonal-architecture/` → for MCP servers
    - `templates/aws-cdk/` → for AWS infrastructure
    - `templates/devcontainer/` → for dev environments
    - `templates/github-actions/` → for CI/CD
    - `templates/docker/` → for containerization
  - Store as JSON Prompt entries with template_id mapping

### 5.2 Create project template Prompt entries
- [ ] `project_template_mcp_server.json`
  - Includes: hexagonal architecture, MCP tool definitions, storage adapter pattern, devcontainer, GitHub Actions, Docker

- [ ] `project_template_python_backend.json`
  - Includes: FastAPI structure, SQLAlchemy models, async patterns, testing, devcontainer, Docker

- [ ] `project_template_cpp_backend.json`
  - Includes: CMake build, conan deps, modern C++, testing, devcontainer

- [ ] `project_template_embedded_firmware.json`
  - Includes: PlatformIO, FreeRTOS, sensor libraries, serial communication, build config

- [ ] `project_template_android_app.json`
  - Includes: Gradle, Jetpack, Room database, Hilt DI, testing

- [ ] `project_template_web_frontend.json`
  - Includes: Vite/Webpack, React/Vue structure, testing, linting, build config

### 5.3 Create MCP tool for scaffolding
- [ ] `generate_project_structure(template_id, variables)` MCP tool
  - Fetches template from storage
  - Renders variables (using handlebars or simple string replacement)
  - Returns list of files with content
  - Main agent can use this to create new projects/components

---

## Phase 6: Orchestrator Integration

### 6.1 Create "orchestrator" REST endpoint
- [ ] `POST /v1/orchestrate` - Master orchestration endpoint
  - Input:
    ```json
    {
      "project_path": "~/projects/mia",
      "mode": "analyze|review|refactor|test|document",
      "verbose": true
    }
    ```
  - Workflow:
    1. Auto-detect project type
    2. Fetch main agent template for that type
    3. Fetch subagent definitions (default set)
    4. Build orchestration plan (discovery phase, analysis phase, synthesis phase)
    5. Return JSON with:
       - Main agent config (model, system_prompt, subagents)
       - Subagent configs (model, system_prompt, tools per subagent)
       - Estimated time/cost
       - MCP servers to enable
       - Phase plan (what runs when, parallel vs sequential)

- [ ] `GET /v1/orchestration-plan` - Preview without running
  - Same input as POST
  - Returns plan only (no execution)

### 6.2 Create claude-orchestrate-v4.sh script
This replaces your v3 script, now fetching everything from mcp-prompts:

- [ ] Script flow:
  ```bash
  1. Parse arguments (project_path, mode)
  2. Call POST /v1/orchestrate (or GET /v1/orchestration-plan with ?dry_run=true)
  3. Extract:
     - Main agent config (system_prompt, subagents, MCP servers)
     - Subagent list
  4. Build JSON agent definitions for claude CLI
  5. Execute: claude <main_agent> with agents config
  ```

- [ ] Features:
  - Auto-detects project type (same logic as before, but can also call mcp-prompts endpoint)
  - Fetches all config from mcp-prompts (no local config files needed, but can fall back)
  - Builds `agents.json` dynamically from mcp-prompts response
  - Passes to `claude` CLI with --agents and --system-prompt flags
  - Outputs JSON report

- [ ] Location: `scripts/claude-orchestrate-v4.sh` in mcp-prompts repo

### 6.3 Add CI/CD integration
- [ ] GitHub Actions workflow: `.github/workflows/auto-analyze.yml`
  - Triggers on: PR, push to main, manual dispatch
  - Runs: `claude-orchestrate-v4.sh . analyze`
  - Posts results as PR comment or GitHub issue

---

## Phase 7: AGENTS.md Standardization

### 7.1 Create AGENTS.md template Prompt entries
- [ ] `agents_md_template_mcp_server.json`
  - Contains markdown template for MCP servers
  - Sections: Project Overview, Components, Build, Testing, Config, etc.
  - Source: Your existing MIA-AGENTS.md as base

- [ ] `agents_md_template_backend.json`
  - For Python/FastAPI backends

- [ ] `agents_md_template_iot_multiplatform.json`
  - For multi-platform IoT (MIA-style)
  - Includes critical data flows, inter-device communication

- [ ] For each archetype: one template Prompt

### 7.2 Create "documentation-engineer" subagent
- [ ] Subagent definition: `dx/documentation-engineer.json`
  - System prompt: "You are a documentation expert. You create clear, agent-friendly AGENTS.md files for projects."
  - Tools: Read, Edit, (optionally push to GitHub via MCP)
  - Model: claude-sonnet
  - Primary use: Generate/update AGENTS.md for projects using templates from mcp-prompts

- [ ] REST endpoint: `POST /v1/generate-agents-md`
  - Input: `{project_path, project_type, architecture_info}`
  - Output: Generated AGENTS.md content
  - Uses: documentation-engineer subagent + AGENTS.md templates

### 7.3 Standardize docs for your own repos
- [ ] Add AGENTS.md to mcp-prompts itself
  - Describe: REST API, MCP tools, subagent registry, main agents, project templates
  - How to: Use subagent registry, request orchestration, extend with custom subagents

- [ ] Add AGENTS.md to mcp-project-orchestrator (if not already there)
  - Describe: Project template system, hexagonal architecture, how to add new templates

- [ ] Add AGENTS.md to claude-orchestrate repo (if separate)

---

## Phase 8: Testing & Validation

### 8.1 Add tests for new endpoints
- [ ] `tests/api/subagents.test.ts`
  - `GET /v1/subagents` returns correct list
  - Filtering by category, tags works
  - `GET /v1/subagents/{id}` returns correct subagent

- [ ] `tests/api/main-agents.test.ts`
  - `GET /v1/main-agents` returns correct list
  - `GET /v1/main-agents/{id}` returns full config

- [ ] `tests/api/orchestrate.test.ts`
  - `POST /v1/orchestrate` returns correct plan
  - Main agent config is valid Claude agents JSON
  - Subagent configs are valid

- [ ] `tests/integration/orchestration.test.ts`
  - End-to-end: Detect project type, fetch config, build agents JSON, verify structure

### 8.2 Test with real projects
- [ ] Run orchestrator on mia/ project
  - Verify: Detects multiplatform_iot
  - Verify: Loads mia_orchestrator main agent
  - Verify: Selects correct subagents
  - Verify: Generated plan is sensible

- [ ] Run orchestrator on mcp-prompts itself
  - Verify: Detects web/backend hybrid (check logic)
  - Verify: Loads appropriate main agent
  - Verify: Subagents are suitable for MCP server work

- [ ] Run orchestrator on a Python backend (ai-servis or similar)
  - Verify: Detects python_backend
  - Verify: Loads python_backend main agent
  - Verify: FastAPI-specific subagent customizations applied

### 8.3 Cost & performance validation
- [ ] Estimate token usage for full orchestration run:
  - Discovery phase (all haiku subagents in parallel): ~50k tokens
  - Analysis phase (sonnet subagents): ~100k tokens
  - Synthesis (opus main agent): ~50k tokens
  - **Total: ~200k tokens = ~$0.80 per full analysis run**

- [ ] Benchmark execution time:
  - Discovery: 5 minutes (parallel)
  - Analysis: 10 minutes (mostly parallel)
  - Synthesis: 5 minutes
  - **Total: 20 minutes target**

---

## Phase 9: Documentation & Examples

### 9.1 Create comprehensive docs
- [ ] `docs/subagent-registry.md`
  - What is a subagent?
  - How to create one
  - How to register it in mcp-prompts
  - Examples from VoltAgent

- [ ] `docs/main-agent-templates.md`
  - What is a main agent template?
  - How to create one
  - Customization options
  - Per-project-type guides

- [ ] `docs/project-orchestration.md`
  - How project scaffolding works
  - Available templates
  - How to add new templates
  - Variables and customization

- [ ] `docs/orchestrator-usage.md`
  - How to use claude-orchestrate-v4.sh
  - How to invoke via REST API
  - How to integrate with CI/CD
  - Cost and performance expectations

- [ ] `docs/agents-md-standard.md`
  - AGENTS.md format and best practices
  - Why structured agent documentation matters
  - How documentation-engineer uses templates
  - Examples per project type

### 9.2 Add examples
- [ ] `examples/orchestration-results/` folder
  - Example outputs from full analyses
  - Example agent configs generated
  - Example orchestration plans

- [ ] `examples/subagent-definitions/`
  - Example custom subagent (adapted from VoltAgent)
  - How to register it

- [ ] `examples/project-template/`
  - Example project template JSON
  - How to use it to scaffold a project

### 9.3 Update main README.md
- [ ] Add sections:
  - Unified Orchestration System (new!)
  - Subagent Registry (new!)
  - Project Orchestration (new!)
  - How to use claude-orchestrate-v4.sh (new!)
  - Integration with your projects (mia, ai-servis, etc.)

---

## Phase 10: Migration & Rollout

### 10.1 Prepare migration from scattered configs
- [ ] Consolidate all agent configs into mcp-prompts:
  - Move improved-agents.json → `/v1/main-agents` endpoint
  - Move mia-agents-v3.json → `/v1/main-agents/main_agent_multiplatform_iot`
  - Move AGENTS.md files → Document with links

- [ ] Update all project-specific AGENTS.md to reference mcp-prompts endpoints

- [ ] Create migration guide for teams using old system

### 10.2 Integrate mcp-prompts into your workflow
- [ ] Update mcp-prompts deployment to include new endpoints
  - Deploy: Docker image (include new storage adapters)
  - Deploy: AWS CDK stack (new DynamoDB tables for subagents, etc.)
  - Deploy: Database migrations

- [ ] Test against all storage backends:
  - Memory (local dev)
  - File storage (local + CI/CD)
  - PostgreSQL (staging)
  - DynamoDB + S3 (production AWS)

### 10.3 Create GitHub Actions for your repos
- [ ] Add to mia/, mcp-prompts, ai-servis:
  ```yaml
  .github/workflows/auto-analyze.yml
  - Trigger: PR, push to main
  - Run: claude-orchestrate-v4.sh . analyze
  - Post: Results as comment + artifact
  ```

- [ ] Add to mcp-project-orchestrator:
  ```yaml
  .github/workflows/validate-templates.yml
  - Trigger: PR
  - Run: Validate new project templates
  ```

### 10.4 Create onboarding guide
- [ ] `ORCHESTRATION_ONBOARDING.md`
  - Step 1: Understand the architecture (read Phase 1–9 docs)
  - Step 2: Deploy mcp-prompts with new endpoints
  - Step 3: Run orchestrator on your first project (mia)
  - Step 4: Customize for your project (add AGENTS.md, project-specific subagents)
  - Step 5: Integrate into CI/CD
  - Step 6: Create custom subagents for your domain

---

## Phase 11: Advanced Features (Post-MVP)

### 11.1 Subagent customization & fine-tuning
- [ ] Allow users to:
  - Fork existing subagents
  - Create custom variants with different prompts/tools
  - Version subagents independently
  - Rate/comment on subagents (crowdsourced feedback)

- [ ] Add `POST /v1/subagents/{id}/fork` endpoint
- [ ] Add `POST /v1/subagents/{id}/rate` endpoint

### 11.2 Agent feedback loop
- [ ] Collect metrics on subagent performance:
  - Execution time, token usage, success rate
  - User feedback (thumbs up/down)
  - Issues reported

- [ ] Display in dashboards, use for:
  - Alerting if subagent breaks (high error rate)
  - Recommendations for better subagent choices
  - A/B testing different subagent sets

### 11.3 Workflow orchestration
- [ ] Allow defining complex workflows:
  ```json
  {
    "workflow_id": "full_project_hardening",
    "steps": [
      {"step": 1, "agent": "project-architect", "task": "Design improvements"},
      {"step": 2, "agent": "code-reviewer", "task": "Review design", "depends_on": [1]},
      {"step": 3, "agents": ["refactoring-specialist", "test-engineer"], "task": "Implement & test", "depends_on": [2], "parallel": true},
      {"step": 4, "agent": "security-auditor", "task": "Audit changes", "depends_on": [3]},
      {"step": 5, "agent": "documentation-engineer", "task": "Document changes", "depends_on": [3]}
    ]
  }
  ```

- [ ] Add `POST /v1/workflows` to define and execute workflows

### 11.4 Agent marketplace / community sharing
- [ ] GitHub-based subagent sharing:
  - Create `sparesparrow/awesome-claude-agents` as curated list
  - Link to community contributions
  - Standardized metadata format for sharing

- [ ] `POST /v1/subagents/import-from-url` endpoint
  - Allow importing subagents from GitHub, etc.

---

## Phase 12: Quality Assurance & Launch

### 12.1 Security audit
- [ ] Review:
  - Input validation for all new endpoints
  - SQL injection risks (if using stored SQL templates)
  - Prompt injection risks (if user can customize prompts)
  - CORS, auth, rate limiting

- [ ] Add:
  - API key validation for orchestration endpoints
  - Audit logging for subagent creation/modification
  - Rate limiting on orchestration runs

### 12.2 Performance tuning
- [ ] Profile:
  - Database queries for subagent lookups
  - API response times
  - Token usage per orchestration mode

- [ ] Optimize:
  - Add caching for frequently-accessed subagents/templates
  - Lazy-load large templates
  - Parallel subagent fetching

### 12.3 Documentation pass
- [ ] Review all docs for:
  - Clarity, correctness, completeness
  - Examples and code samples
  - Links and references

- [ ] Create "quick start" guide

### 12.4 Launch checklist
- [ ] ✅ All tests passing
- [ ] ✅ Documentation complete
- [ ] ✅ AGENTS.md for mcp-prompts itself
- [ ] ✅ Example orchestration runs on your projects
- [ ] ✅ GitHub Actions workflows ready
- [ ] ✅ Deployment scripts tested (Docker, AWS CDK)
- [ ] ✅ Cost estimates validated
- [ ] ✅ Performance benchmarks met
- [ ] ✅ Security audit passed
- [ ] ✅ Team review + approval

---

## Reference Links & Resources

### Official Documentation
- **Claude Agent SDK**: https://code.claude.com/docs/
- **Claude SDK CLI Reference**: https://code.claude.com/docs/en/cli-reference
- **MCP Documentation**: https://code.claude.com/docs/en/mcp
- **MCP Skills Guide**: https://code.claude.com/docs/en/skills
- **MCP Hooks Guide**: https://code.claude.com/docs/en/hooks-guide
- **Anthropic Engineering: Building Agents with Claude Agent SDK**: https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk

### Key GitHub Repositories
- **Your mcp-prompts repo**: https://github.com/sparesparrow/mcp-prompts
  - Current structure, storage adapters, API patterns
  - Copy: TypeScript patterns, storage abstraction, REST framework

- **Your mcp-project-orchestrator repo**: https://github.com/sparesparrow/mcp-project-orchestrator
  - Location: https://github.com/sparesparrow/mcp-project-orchestrator
  - Integration plan: https://github.com/sparesparrow/mcp-project-orchestrator/blob/main/integration_plan.md
  - Copy: `templates/` folder for project scaffolding JSON
  - Copy: Hexagonal architecture code generation patterns

- **VoltAgent awesome-claude-code-subagents**: https://github.com/VoltAgent/awesome-claude-code-subagents
  - Copy: Subagent category structure
  - Copy: Prompt templates for different roles
  - Copy: Tool specifications and capabilities
  - Adapt: Add your MCP-specific and IoT-specific variations

### Community & Examples
- **AGENTS.md Standard**: https://agents.md/
  - Reference for structuring agent-friendly documentation

- **PubNub: Best Practices for Claude Code Sub-agents**: https://www.pubnub.com/blog/best-practices-for-claude-code-sub-agents/
  - Reference for subagent design patterns

- **eesel AI: A Practical Guide to Subagents in Claude Code**: https://www.eesel.ai/blog/subagents-in-claude-code
  - Reference for subagent communication and coordination

### Your Existing Docs (to reference/build on)
- **MIA-AGENTS.md**: Use as template for other projects' AGENTS.md
- **IMPLEMENTATION-GUIDE.md**: Already created in previous phase, core reference
- **improved-agents.json**: Core agent definitions to port into mcp-prompts

---

## Success Criteria

### By end of Phase 12, verify:
- ✅ **Unification**: All orchestration config in mcp-prompts, no separate config files needed (fallback OK)
- ✅ **Reusability**: 20+ subagent definitions available, categorized, testable
- ✅ **Integration**: MCP tools for subagent discovery, main agent fetching, project scaffolding
- ✅ **Automation**: claude-orchestrate-v4.sh works end-to-end on mia, mcp-prompts, ai-servis
- ✅ **Cost**: Full orchestration run < $1.00, < 30 minutes execution
- ✅ **Documentation**: Comprehensive guides, examples, AGENTS.md for all key projects
- ✅ **CI/CD**: GitHub Actions workflows operational on at least 2 repos
- ✅ **Extensibility**: Simple process for adding new subagents, templates, main agents

---

## Summary: Effort Estimate

| Phase | Task | Effort | Timeline |
|-------|------|--------|----------|
| 0 | Preparation & Research | 8 hours | 1-2 days |
| 1 | Data Model Extensions | 16 hours | 3-4 days |
| 2 | REST API & MCP Tools | 24 hours | 4-5 days |
| 3 | Subagent Curation | 32 hours | 5-7 days |
| 4 | Main Agent Templates | 12 hours | 2-3 days |
| 5 | Project Orchestration | 20 hours | 3-4 days |
| 6 | Orchestrator Integration | 16 hours | 3-4 days |
| 7 | AGENTS.md Standardization | 12 hours | 2-3 days |
| 8 | Testing & Validation | 20 hours | 3-4 days |
| 9 | Documentation | 16 hours | 2-3 days |
| 10 | Migration & Rollout | 12 hours | 2-3 days |
| 11 | Advanced Features | 24 hours | Post-MVP |
| 12 | QA & Launch | 12 hours | 2-3 days |
| **Total** | | **216 hours** | **4-5 weeks** |

**Recommended sprint structure**: 2-week sprints, 2-3 items per sprint, parallel work possible on Phases 1-4.

---

## Next Steps (Now)

1. **Fork/review mcp-project-orchestrator repo** → Extract templates to understand structure
2. **Audit VoltAgent awesome-claude-code-subagents** → Make list of subagents to port
3. **Design unified Prompt schema** → Review with team, finalize by end of week
4. **Start Phase 1** → Data model extensions, begin implementation

Good luck! 🚀
