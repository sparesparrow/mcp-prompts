# Comprehensive TODO: Implement Agent Orchestration in mcp-prompts

**Project**: Integrate Claude multi-agent architecture (v3) into mcp-prompts repository  
**Scope**: No submodules—copy, adapt, integrate only what's needed  
**Timeline**: 6-8 weeks (6 phases)  
**Owner**: sparesparrow

---

## PHASE 0: RESEARCH & PLANNING (Week 1)
*Get familiar with patterns, finalize architecture decisions*

### P0.1: Study Reference Repositories
- [ ] Clone mcp-project-orchestrator (reference only)
  ```bash
  git clone https://github.com/sparesparrow/mcp-project-orchestrator /tmp/mcp-ref
  ```
  **Action**: Study these files:
  - `src/domain/entities/Project.ts`, `Component.ts`, `Template.ts`
  - `src/domain/use-cases/GenerateProject.ts`, `ApplyTemplate.ts`
  - `src/adapters/secondary/storage/*.ts` (multi-backend pattern)
  - `templates/` folder (all template structures)
  - `project_orchestration.json` (schema design)
  
- [ ] Clone VoltAgent awesome-claude-code-subagents (reference only)
  ```bash
  git clone https://github.com/VoltAgent/awesome-claude-code-subagents /tmp/voltAgent
  ```
  **Action**: Catalog all subagent files:
  - `subagents/dev/*.md` (8-10 files) → Note system prompts, tools, capabilities
  - `subagents/infra/*.md` (5-7 files)
  - `subagents/quality/*.md` (4-6 files)
  - `subagents/meta/*.md` (2-3 files)
  - Create mapping spreadsheet: `subagent_id | source_url | prompt_summary | required_tools | model_level`

- [ ] Read Claude SDK documentation sections
  - [ ] https://code.claude.com/docs/en/cli-reference → Search for `--agents`, `--model`, `--system-prompt`
  - [ ] https://code.claude.com/docs/en/mcp → How agents use MCP tools
  - [ ] https://code.claude.com/docs/en/skills → Custom skill creation (for MCP tool creation)
  - [ ] https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk → Email agent example (adapt for orchestrator)
  **Document**: Extract key learnings into `RESEARCH.md` (how Claude agents are invoked, tool registration, etc.)

### P0.2: Analyze Your Existing Work
- [ ] Review `improved-agents.json` structure
  - [ ] List all main agent templates (cpp_backend, python_backend, multiplatform_iot, etc.)
  - [ ] List all subagent references
  - [ ] Document which model each agent uses (opus/sonnet/haiku)
  - [ ] Create: `EXISTING-AGENTS-INVENTORY.md`

- [ ] Review `mia-agents-v3.json`
  - [ ] Identify MIA-specific customizations
  - [ ] List custom subagents for MIA
  - [ ] Document MIA project type detection rules
  - [ ] Create: `MIA-SPECIFIC-CUSTOMIZATIONS.md`

- [ ] Review `MIA-AGENTS.md`
  - [ ] Extract sections: Project Overview, Components, Build, Testing, Conventions, Security, Performance
  - [ ] Create template version (generalize for all projects): `AGENTS.md.template`

- [ ] Review `claude-orchestrate-v3.sh` script
  - [ ] Map shell logic to functions:
     ```
     - detect_project_type()        → Translate to TypeScript function
     - load_agents_config()         → Translate to repository pattern
     - spawn_subagents()            → Translate to subagent orchestration service
     - coordinate_results()         → Translate to synthesis service
     - generate_output()            → Translate to report generation
     ```
  - [ ] Document: `ORCHESTRATE-V3-FUNCTION-MAPPING.md`

### P0.3: Finalize Architecture & Schema Decisions
- [ ] Team review: Extended Prompt schema
  - [ ] Decision: Include `subagent_type`, `main_agent_template`, `project_orchestration_template` as prompt types?
  - [ ] Decision: Separate tables (Subagent, MainAgent, ProjectTemplate) vs. single Prompt table with discriminator?
  - [ ] Decision: Where to store agent execution history (for feedback loops)?
  - [ ] Document: `ARCHITECTURE-DECISIONS.md`

- [ ] Finalize unified Prompt schema
  - [ ] Update `src/domain/entities/Prompt.ts` with all new fields
  - [ ] Create migration script for existing prompts
  - [ ] Document: `SCHEMA-CHANGES.md`

- [ ] Plan integration points
  - [ ] Where does orchestrate-v4.sh live? (`scripts/claude-orchestrate-v4.sh`)
  - [ ] New API endpoints needed? (`/v1/subagents`, `/v1/main-agents`, `/v1/orchestrate`)
  - [ ] MCP tools needed? (discovery, execution, reporting)
  - [ ] Database migrations required?
  - [ ] Document: `INTEGRATION-POINTS.md`

### P0.4: Create Project Structure Plan
- [ ] Document new directory structure for mcp-prompts:
  ```
  mcp-prompts/
  ├── src/
  │   ├── data/
  │   │   ├── subagents/              (NEW)
  │   │   │   ├── dev/
  │   │   │   ├── infra/
  │   │   │   ├── quality/
  │   │   │   ├── iot/
  │   │   │   ├── dx/
  │   │   │   └── meta/
  │   │   ├── main-agents/            (NEW)
  │   │   │   ├── cpp_backend.json
  │   │   │   ├── python_backend.json
  │   │   │   ├── multiplatform_iot.json
  │   │   │   └── ...
  │   │   └── project-templates/      (NEW)
  │   │       ├── mcp-server.json
  │   │       ├── backend-api.json
  │   │       ├── iot-firmware.json
  │   │       └── ...
  │   ├── domain/
  │   │   └── entities/
  │   │       ├── Subagent.ts         (NEW)
  │   │       ├── MainAgentTemplate.ts (NEW)
  │   │       ├── ProjectOrchestrationTemplate.ts (NEW)
  │   │       ├── AgentExecutionRecord.ts (NEW - for feedback loops)
  │   │       └── Prompt.ts           (EXTEND)
  │   ├── adapters/
  │   │   ├── primary/
  │   │   │   └── http/
  │   │   │       ├── routes/
  │   │   │       │   ├── prompts.ts  (EXTEND)
  │   │   │       │   ├── subagents.ts (NEW)
  │   │   │       │   ├── main-agents.ts (NEW)
  │   │   │       │   └── orchestrate.ts (NEW)
  │   │   │       └── controllers/
  │   │   │           ├── SubagentController.ts (NEW)
  │   │   │           ├── MainAgentController.ts (NEW)
  │   │   │           └── OrchestrateController.ts (NEW)
  │   │   └── secondary/
  │   │       └── storage/
  │   │           ├── postgres.ts     (EXTEND with new methods)
  │   │           ├── dynamodb.ts     (EXTEND)
  │   │           └── file.ts         (EXTEND)
  │   ├── application/
  │   │   └── services/
  │   │       ├── SubagentService.ts  (NEW)
  │   │       ├── MainAgentService.ts (NEW)
  │   │       ├── OrchestrateService.ts (NEW)
  │   │       └── ProjectScaffoldService.ts (NEW)
  │   └── infrastructure/
  │       ├── config/
  │       │   └── agents.ts           (NEW)
  │       └── mcp-tools/              (NEW - for custom MCP tools)
  │           ├── agentDiscovery.ts
  │           ├── agentExecution.ts
  │           └── reportGeneration.ts
  ├── scripts/
  │   ├── claude-orchestrate-v4.sh    (NEW - evolved from v3)
  │   └── import-subagents.ts         (NEW - bulk import from VoltAgent)
  ├── tests/
  │   ├── api/
  │   │   ├── subagents.test.ts       (NEW)
  │   │   ├── main-agents.test.ts     (NEW)
  │   │   └── orchestrate.test.ts     (NEW)
  │   ├── integration/
  │   │   └── orchestration.test.ts   (NEW)
  │   └── fixtures/
  │       ├── subagent-fixtures.ts    (NEW)
  │       ├── main-agent-fixtures.ts  (NEW)
  │       └── project-fixtures.ts     (NEW)
  ├── data/
  │   └── migrations/
  │       ├── 001_add_subagent_tables.sql (NEW)
  │       ├── 002_extend_prompts_schema.sql (NEW)
  │       └── 003_add_execution_history.sql (NEW)
  └── docs/
      ├── AGENTS-ARCHITECTURE.md      (NEW - design overview)
      ├── SUBAGENT-REGISTRY.md        (NEW - API reference)
      ├── ORCHESTRATION-GUIDE.md      (NEW - how to use)
      └── IMPLEMENTATION-GUIDE.md     (NEW - internals)
  ```
  **Action**: Create empty directory structure (no files yet)

### P0.5: Create Risk Assessment & Mitigation
- [ ] Document risks:
  - Data migration for 1000+ existing prompts?
  - Schema changes breaking existing API clients?
  - Performance impact of new discovery endpoints?
  - Model selection (opus for main agents = expensive)?
  - Agent feedback loop complexity?
  **Document**: `RISK-ASSESSMENT.md` with mitigation strategies

### P0.6: Deliverables
- [ ] Create `docs/PHASE-0-COMPLETE.md`:
  - Summary of all research findings
  - Finalized schema decisions
  - Directory structure approved
  - Risk mitigation plan
  - Timeline for Phase 1

**Estimated time**: 5-7 days (part-time)

---

## PHASE 1: SCHEMA & STORAGE LAYER (Week 2)
*Extend database to store agents and templates*

### P1.1: Extend Prompt Entity & Storage
- [ ] Update TypeScript entity `src/domain/entities/Prompt.ts`
  **Add fields**:
  ```typescript
  interface Prompt {
    id: string;
    // ... existing fields ...
    
    // NEW: Agent-specific fields
    agentType?: 'subagent_registry' | 'main_agent_template' | 'project_orchestration_template';
    category?: string;         // 'dev', 'infra', 'quality', 'iot', 'dx', 'meta'
    model?: 'claude-opus' | 'claude-sonnet' | 'claude-haiku';
    systemPrompt?: string;     // Full system prompt for agent
    tools?: string[];          // Tool names/MCP server names
    mcpServers?: string[];     // MCP servers available to agent
    variables?: PromptVariable[];  // Input variables
    compatibleWith?: string[]; // Project types (e.g., ['python_backend', 'iot_firmware'])
    sourceUrl?: string;        // Source repo URL
    feedbackRequired?: boolean; // Does agent need evaluation?
    executionCount?: number;   // Telemetry
    successRate?: number;      // Telemetry (0-100)
    averageTokens?: number;    // Telemetry
    costEstimate?: number;     // Estimated cost per execution
    lastExecutedAt?: Date;     // Telemetry
  }
  
  interface PromptVariable {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'enum';
    description: string;
    required: boolean;
    defaultValue?: string | number | boolean;
    enumValues?: string[]; // If type === 'enum'
  }
  ```
  **Files to update**:
  - `src/domain/entities/Prompt.ts`
  - `src/adapters/secondary/storage/postgres.ts` (add methods)
  - `src/adapters/secondary/storage/dynamodb.ts` (add methods)
  - `src/adapters/secondary/storage/file.ts` (add methods)

- [ ] Create new entities
  - [ ] `src/domain/entities/Subagent.ts`
    ```typescript
    interface Subagent {
      id: string;
      name: string;
      description: string;
      category: 'dev' | 'infra' | 'quality' | 'iot' | 'dx' | 'meta';
      model: 'claude-sonnet' | 'claude-haiku';
      systemPrompt: string;
      tools: string[];
      mcpServers: string[];
      tags: string[];
      sourceUrl: string;
      promptEntryId: string; // FK to Prompt
      version: string;
    }
    ```
  
  - [ ] `src/domain/entities/MainAgentTemplate.ts`
    ```typescript
    interface MainAgentTemplate {
      id: string;
      name: string;
      projectType: 'cpp_backend' | 'python_backend' | 'multiplatform_iot' | 'android_app' | 'web_frontend' | 'devops_infrastructure' | 'mcp_server';
      description: string;
      model: 'claude-opus';
      systemPrompt: string;
      focusAreas: string[];
      subagentIds: string[]; // References to Subagent.id
      mcpServers: string[];
      customizations?: Record<string, any>; // Project-specific overrides
      promptEntryId: string; // FK to Prompt
      version: string;
    }
    ```
  
  - [ ] `src/domain/entities/ProjectOrchestrationTemplate.ts`
    ```typescript
    interface ProjectOrchestrationTemplate {
      id: string;
      name: string;
      description: string;
      baseStructure: {
        directories: string[];
        files: Array<{name: string, template: string}>;
      };
      components: Array<{
        name: string;
        path: string;
        template: string;
        language?: string;
      }>;
      templates: Record<string, string>; // File name → template content
      variables: PromptVariable[];
      mainAgentTemplateId: string; // Links to MainAgentTemplate
      promptEntryId: string; // FK to Prompt
      version: string;
    }
    ```
  
  - [ ] `src/domain/entities/AgentExecutionRecord.ts`
    ```typescript
    interface AgentExecutionRecord {
      id: string;
      agentId: string;     // Subagent or MainAgent ID
      agentType: 'subagent' | 'main_agent';
      projectId?: string;  // If part of orchestration
      executionStartedAt: Date;
      executionCompletedAt?: Date;
      status: 'pending' | 'executing' | 'succeeded' | 'failed' | 'timeout';
      inputTokens: number;
      outputTokens: number;
      estimatedCost: number;
      resultSummary?: string;
      errorMessage?: string;
      feedback?: {
        rating: 1 | 2 | 3 | 4 | 5;
        comments?: string;
        suggestedImprovements?: string[];
      };
    }
    ```

### P1.2: Database Migrations
- [ ] Create PostgreSQL migrations in `data/migrations/`:
  
  - [ ] `001_add_agent_columns_to_prompts.sql`
    ```sql
    ALTER TABLE prompts ADD COLUMN agent_type VARCHAR(50);
    ALTER TABLE prompts ADD COLUMN category VARCHAR(50);
    ALTER TABLE prompts ADD COLUMN model VARCHAR(50);
    ALTER TABLE prompts ADD COLUMN system_prompt TEXT;
    ALTER TABLE prompts ADD COLUMN tools TEXT[]; -- jsonb would be better
    ALTER TABLE prompts ADD COLUMN mcp_servers TEXT[];
    ALTER TABLE prompts ADD COLUMN variables JSONB;
    ALTER TABLE prompts ADD COLUMN compatible_with TEXT[];
    ALTER TABLE prompts ADD COLUMN source_url VARCHAR(500);
    ALTER TABLE prompts ADD COLUMN feedback_required BOOLEAN DEFAULT FALSE;
    ALTER TABLE prompts ADD COLUMN execution_count INTEGER DEFAULT 0;
    ALTER TABLE prompts ADD COLUMN success_rate NUMERIC(5,2);
    ALTER TABLE prompts ADD COLUMN average_tokens INTEGER;
    ALTER TABLE prompts ADD COLUMN cost_estimate NUMERIC(10,4);
    ALTER TABLE prompts ADD COLUMN last_executed_at TIMESTAMP;
    
    CREATE INDEX idx_prompts_agent_type ON prompts(agent_type);
    CREATE INDEX idx_prompts_category ON prompts(category);
    CREATE INDEX idx_prompts_model ON prompts(model);
    ```
  
  - [ ] `002_create_subagents_table.sql`
    ```sql
    CREATE TABLE subagents (
      id UUID PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      category VARCHAR(50) NOT NULL,
      model VARCHAR(50) NOT NULL,
      system_prompt TEXT NOT NULL,
      tools JSONB,
      mcp_servers JSONB,
      tags TEXT[],
      source_url VARCHAR(500),
      prompt_entry_id UUID REFERENCES prompts(id) ON DELETE SET NULL,
      version VARCHAR(20),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(id)
    );
    CREATE INDEX idx_subagents_category ON subagents(category);
    CREATE INDEX idx_subagents_model ON subagents(model);
    ```
  
  - [ ] `003_create_main_agents_table.sql`
    ```sql
    CREATE TABLE main_agents (
      id UUID PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      project_type VARCHAR(100) NOT NULL,
      description TEXT,
      model VARCHAR(50) DEFAULT 'claude-opus',
      system_prompt TEXT NOT NULL,
      focus_areas JSONB,
      subagent_ids UUID[],
      mcp_servers JSONB,
      customizations JSONB,
      prompt_entry_id UUID REFERENCES prompts(id) ON DELETE SET NULL,
      version VARCHAR(20),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(project_type)
    );
    CREATE INDEX idx_main_agents_project_type ON main_agents(project_type);
    ```
  
  - [ ] `004_create_project_orchestration_templates.sql`
    ```sql
    CREATE TABLE project_orchestration_templates (
      id UUID PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      base_structure JSONB,
      components JSONB,
      templates JSONB,
      variables JSONB,
      main_agent_template_id UUID REFERENCES main_agents(id),
      prompt_entry_id UUID REFERENCES prompts(id) ON DELETE SET NULL,
      version VARCHAR(20),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    ```
  
  - [ ] `005_create_agent_execution_records.sql`
    ```sql
    CREATE TABLE agent_execution_records (
      id UUID PRIMARY KEY,
      agent_id VARCHAR(255) NOT NULL,
      agent_type VARCHAR(50) NOT NULL,
      project_id VARCHAR(255),
      execution_started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      execution_completed_at TIMESTAMP,
      status VARCHAR(50) DEFAULT 'pending',
      input_tokens INTEGER,
      output_tokens INTEGER,
      estimated_cost NUMERIC(10,4),
      result_summary TEXT,
      error_message TEXT,
      feedback JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX idx_execution_records_agent_id ON agent_execution_records(agent_id);
    CREATE INDEX idx_execution_records_status ON agent_execution_records(status);
    CREATE INDEX idx_execution_records_project_id ON agent_execution_records(project_id);
    ```

- [ ] Create DynamoDB equivalents in migration format
  - Use JSON representation of DynamoDB attribute definitions
  - Link: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/SQLtoNoSQL.Create.html

### P1.3: Storage Adapter Methods
- [ ] Extend `src/adapters/secondary/storage/postgres.ts`:
  ```typescript
  // NEW METHODS
  async findSubagentsByCategory(category: string): Promise<Subagent[]>;
  async findSubagentById(id: string): Promise<Subagent | null>;
  async createSubagent(subagent: Subagent): Promise<void>;
  async updateSubagent(subagent: Subagent): Promise<void>;
  async deleteSubagent(id: string): Promise<void>;
  
  async findMainAgentByProjectType(projectType: string): Promise<MainAgentTemplate | null>;
  async createMainAgent(agent: MainAgentTemplate): Promise<void>;
  async updateMainAgent(agent: MainAgentTemplate): Promise<void>;
  
  async findProjectTemplate(id: string): Promise<ProjectOrchestrationTemplate | null>;
  async createProjectTemplate(template: ProjectOrchestrationTemplate): Promise<void>;
  
  async recordAgentExecution(record: AgentExecutionRecord): Promise<void>;
  async findExecutionRecords(agentId: string, limit?: number): Promise<AgentExecutionRecord[]>;
  async recordAgentFeedback(recordId: string, feedback: any): Promise<void>;
  ```

- [ ] Extend `src/adapters/secondary/storage/dynamodb.ts` (same methods)

- [ ] Extend `src/adapters/secondary/storage/file.ts` (same methods, for local development)

### P1.4: Repository Pattern (Abstraction Layer)
- [ ] Create `src/domain/repositories/`:
  - [ ] `SubagentRepository.ts`
  - [ ] `MainAgentRepository.ts`
  - [ ] `ProjectTemplateRepository.ts`
  - [ ] `ExecutionRecordRepository.ts`
  - [ ] `PromptRepository.ts` (extend existing)

- [ ] Each repository interface (e.g.):
  ```typescript
  interface SubagentRepository {
    findAll(): Promise<Subagent[]>;
    findById(id: string): Promise<Subagent | null>;
    findByCategory(category: string): Promise<Subagent[]>;
    findByTag(tag: string): Promise<Subagent[]>;
    save(subagent: Subagent): Promise<void>;
    delete(id: string): Promise<void>;
  }
  ```

### P1.5: Deliverables
- [ ] All migrations applied to test database
- [ ] All storage methods implemented (postgres/dynamodb/file)
- [ ] Repository pattern abstractions tested
- [ ] Rollback scripts prepared
- [ ] Document: `PHASE-1-COMPLETE.md` with schema diagrams

**Estimated time**: 4-5 days

---

## PHASE 2: API LAYER & ENDPOINTS (Week 3)
*Expose subagent discovery and configuration via REST*

### P2.1: REST Endpoints for Subagent Discovery
- [ ] Create `src/adapters/primary/http/controllers/SubagentController.ts`
  - [ ] GET `/v1/subagents` → List all subagents (with filters)
  - [ ] GET `/v1/subagents/:id` → Get specific subagent
  - [ ] GET `/v1/subagents?category=dev&tags=backend` → Filtered search
  - [ ] POST `/v1/subagents` → Create subagent (admin only)
  - [ ] PUT `/v1/subagents/:id` → Update subagent
  - [ ] DELETE `/v1/subagents/:id` → Delete subagent
  - [ ] GET `/v1/subagents/categories` → List available categories
  - [ ] GET `/v1/subagents/:id/execution-history` → Execution telemetry

- [ ] Create `src/adapters/primary/http/routes/subagents.ts`
  - Import and wire controller methods

### P2.2: REST Endpoints for Main Agents
- [ ] Create `src/adapters/primary/http/controllers/MainAgentController.ts`
  - [ ] GET `/v1/main-agents` → List all main agents
  - [ ] GET `/v1/main-agents/:projectType` → Get main agent for project type
  - [ ] GET `/v1/main-agents?project-type=python_backend` → Query by type
  - [ ] POST `/v1/main-agents` → Create main agent template
  - [ ] PUT `/v1/main-agents/:id` → Update main agent
  - [ ] DELETE `/v1/main-agents/:id` → Delete main agent
  - [ ] GET `/v1/main-agents/:projectType/subagents` → List subagents for project type
  - [ ] POST `/v1/main-agents/:projectType/execution-preview` → Dry-run configuration

- [ ] Create `src/adapters/primary/http/routes/main-agents.ts`

### P2.3: REST Endpoints for Project Orchestration
- [ ] Create `src/adapters/primary/http/controllers/OrchestrateController.ts`
  - [ ] GET `/v1/project-templates` → List all project templates
  - [ ] GET `/v1/project-templates/:id` → Get specific template
  - [ ] POST `/v1/orchestrate/validate-project` → Validate project structure
    - Input: `{ project_path: string }`
    - Output: `{ project_type: string, confidence: number, components: [] }`
  
  - [ ] POST `/v1/orchestrate/analyze-project` → Trigger full analysis
    - Input: `{ project_path: string, mode: 'analyze'|'review'|'refactor'|'test'|'document' }`
    - Output: `{ execution_id: string, status: 'queued' }`
    - Returns URL: `/v1/orchestrate/executions/:execution_id`
  
  - [ ] GET `/v1/orchestrate/executions/:execution_id` → Get execution result
    - Returns: Full JSON report from orchestrator
  
  - [ ] POST `/v1/orchestrate/executions/:execution_id/feedback` → Submit feedback
    - Input: `{ rating: 1-5, comments: string, improvements: [] }`
  
  - [ ] POST `/v1/orchestrate/scaffold-project` → Generate new project structure
    - Input: `{ project_type: string, template_id: string, variables: {...} }`
    - Output: `{ project_id: string, scaffolding_url: string }`

- [ ] Create `src/adapters/primary/http/routes/orchestrate.ts`

### P2.4: Update Prompt Endpoints
- [ ] Extend `src/adapters/primary/http/routes/prompts.ts`
  - [ ] GET `/v1/prompts?type=subagent_registry` → Filter by agent type
  - [ ] GET `/v1/prompts?category=dev` → Filter by category
  - [ ] GET `/v1/prompts?compatible-with=python_backend` → Find prompts for project type

### P2.5: OpenAPI/Swagger Documentation
- [ ] Create OpenAPI spec `src/infrastructure/openapi/openapi.yaml`
  - Document all new endpoints
  - Include request/response schemas
  - Include examples

- [ ] Generate Swagger UI on `GET /api-docs`

### P2.6: Error Handling & Validation
- [ ] Create validation schemas using `zod` or similar
  ```typescript
  // src/adapters/primary/http/validation/
  const CreateSubagentSchema = z.object({
    name: z.string(),
    category: z.enum(['dev', 'infra', 'quality', 'iot', 'dx', 'meta']),
    model: z.enum(['claude-sonnet', 'claude-haiku']),
    systemPrompt: z.string(),
    tools: z.array(z.string()),
    // ...
  });
  ```

- [ ] Create error response types
  ```typescript
  interface ErrorResponse {
    code: string;
    message: string;
    details?: Record<string, any>;
  }
  ```

### P2.7: Deliverables
- [ ] All REST endpoints implemented
- [ ] OpenAPI spec complete
- [ ] Postman collection exported
- [ ] Validation schemas applied
- [ ] Tests for all endpoints (see Phase 4)
- [ ] Document: `API-REFERENCE.md`

**Estimated time**: 5-6 days

---

## PHASE 3: DATA MIGRATION & IMPORT (Week 4)
*Populate database with subagents and templates*

### P3.1: Extract Subagents from VoltAgent
- [ ] Create script `scripts/import-subagents.ts`
  **Logic**:
  1. Read all `.md` files from `/tmp/awesome-claude-code-subagents/subagents/`
  2. Parse each file:
     - Extract title → `name`
     - Extract category from path → `category`
     - Extract system prompt (content after first `##`)
     - Extract Tools section → `tools` array
     - Extract Model recommendation (default sonnet/haiku)
     - Extract tags from metadata
  3. Generate `id` (slugified from name, e.g., `dev/backend-developer`)
  4. Create Subagent entity
  5. Save to database via SubagentRepository

- [ ] Run import:
  ```bash
  npx ts-node scripts/import-subagents.ts \
    --source /tmp/awesome-claude-code-subagents/subagents \
    --output-format json \
    --dry-run
  ```

- [ ] Document mapping in `docs/IMPORTED-SUBAGENTS.md`
  - List all imported subagents
  - Source URL for each
  - Any customizations made

### P3.2: Port Main Agent Templates
- [ ] From `improved-agents.json`, extract:
  ```json
  [
    {
      "id": "main_agent_cpp_backend",
      "projectType": "cpp_backend",
      "name": "C++ Backend Orchestrator",
      "model": "claude-opus",
      "systemPrompt": "...",
      "focusAreas": [...],
      "subagentIds": [...]
    },
    // ... for python_backend, multiplatform_iot, etc.
  ]
  ```

- [ ] Create script `scripts/import-main-agents.ts`
  ```bash
  npx ts-node scripts/import-main-agents.ts \
    --source ./improved-agents.json \
    --dry-run
  ```

- [ ] Manually review and adjust:
  - Verify subagent references exist
  - Verify MCP server names are correct
  - Update system prompts with v4 references

### P3.3: Create Project Orchestration Templates
- [ ] From `mcp-project-orchestrator/templates/`, create entries:
  ```json
  [
    {
      "id": "template_mcp_server",
      "name": "MCP Server Template",
      "description": "Standard MCP server with TypeScript",
      "mainAgentTemplateId": "main_agent_mcp_server",
      "baseStructure": {
        "directories": ["src", "tests", "docs"],
        "files": ["package.json", "tsconfig.json", ".gitignore"]
      },
      "components": [
        {
          "name": "core",
          "path": "src/",
          "template": "hexagonal-architecture",
          "language": "typescript"
        }
      ],
      "templates": {
        "Dockerfile": "...",
        ".github/workflows/ci.yml": "...",
        "devcontainer.json": "..."
      },
      "variables": [
        {"name": "project_name", "type": "string", "required": true},
        {"name": "description", "type": "string", "required": true}
      ]
    }
  ]
  ```

- [ ] Create script `scripts/import-project-templates.ts`

### P3.4: Port MIA-Specific Customizations
- [ ] From `mia-agents-v3.json`:
  - Extract custom subagents (mia_backend_analyzer, mia_embedded_coordinator, etc.)
  - Create Subagent entries with `sourceUrl` pointing to your repo

- [ ] From `MIA-AGENTS.md`:
  - Convert to `ProjectOrchestrationTemplate` for multiplatform_iot type
  - Use as template generator

### P3.5: Data Validation & QA
- [ ] Verify all imported data:
  - [ ] All subagents have valid category
  - [ ] All main agents reference valid subagents
  - [ ] All project templates reference valid main agents
  - [ ] No orphaned records
  - [ ] All URLs are accessible

- [ ] Create QA report:
  ```bash
  npx ts-node scripts/validate-data.ts > QA-REPORT.md
  ```

### P3.6: Backup & Rollback
- [ ] Export pre-migration data:
  ```bash
  pg_dump mcp_prompts > backup-pre-phase3.sql
  ```

- [ ] Create rollback script (if needed):
  ```bash
  scripts/rollback-phase3.sh
  ```

### P3.7: Deliverables
- [ ] ~15-20 subagents imported from VoltAgent
- [ ] 7 main agent templates created
- [ ] 5+ project templates created
- [ ] MIA customizations integrated
- [ ] QA report showing 100% valid data
- [ ] Document: `PHASE-3-COMPLETE.md` with data statistics

**Estimated time**: 3-4 days

---

## PHASE 4: SERVICE LAYER & BUSINESS LOGIC (Week 5)
*Implement orchestration, analysis, and report generation*

### P4.1: SubagentService
- [ ] Create `src/application/services/SubagentService.ts`
  ```typescript
  class SubagentService {
    async getSubagent(id: string): Promise<Subagent>;
    async findByCategory(category: string): Promise<Subagent[]>;
    async findByTags(tags: string[]): Promise<Subagent[]>;
    async getExecutionStats(id: string): Promise<{
      executionCount: number;
      successRate: number;
      avgTokens: number;
      avgCost: number;
    }>;
    async recordExecution(
      id: string,
      tokens: { input: number; output: number },
      result: string,
      error?: string
    ): Promise<void>;
  }
  ```

### P4.2: MainAgentService
- [ ] Create `src/application/services/MainAgentService.ts`
  ```typescript
  class MainAgentService {
    async getByProjectType(projectType: string): Promise<MainAgentTemplate>;
    async getSubagentsFor(projectType: string): Promise<Subagent[]>;
    async validateSubagentConfiguration(
      projectType: string
    ): Promise<{ valid: boolean; errors: string[] }>;
    async generateSystemPrompt(
      projectType: string,
      customContext?: string
    ): Promise<string>;
  }
  ```

### P4.3: OrchestrateService (Core Logic)
- [ ] Create `src/application/services/OrchestrateService.ts`
  ```typescript
  class OrchestrateService {
    // Project detection (from v3 shell script)
    async detectProjectType(projectPath: string): Promise<{
      type: string;
      confidence: number;
      evidence: string[];
    }>;

    // Orchestration modes
    async analyzeProject(projectPath: string): Promise<AnalysisReport>;
    async reviewCode(projectPath: string): Promise<ReviewReport>;
    async identifyRefactorings(projectPath: string): Promise<RefactoringReport>;
    async assessTestCoverage(projectPath: string): Promise<TestReport>;
    async assessDocumentation(projectPath: string): Promise<DocumentationReport>;

    // Core orchestration
    async orchestrate(
      projectPath: string,
      mode: 'analyze' | 'review' | 'refactor' | 'test' | 'document',
      options?: {
        parallelSubagents?: boolean;
        timeoutSeconds?: number;
        customContext?: string;
      }
    ): Promise<{
      executionId: string;
      status: 'queued' | 'executing' | 'completed' | 'failed';
      report?: AnalysisReport;
      error?: string;
    }>;

    // Subagent phase execution
    private async executeDiscoveryPhase(projectPath: string): Promise<{
      explorer: any;
      gitAnalyzer: any;
      configAnalyzer: any;
    }>;

    private async executeAnalysisPhase(
      discoveryResults: any,
      projectPath: string
    ): Promise<{
      analyzer: any;
      solidAnalyzer: any;
      reviewer: any;
      tester: any;
    }>;

    // Synthesis (main agent coordination)
    private async synthesizeResults(
      discoveryResults: any,
      analysisResults: any
    ): Promise<AnalysisReport>;
  }
  ```

### P4.4: ProjectScaffoldService
- [ ] Create `src/application/services/ProjectScaffoldService.ts`
  ```typescript
  class ProjectScaffoldService {
    async scaffoldProject(
      templateId: string,
      variables: Record<string, any>,
      outputPath: string
    ): Promise<{
      projectId: string;
      createdFiles: string[];
      createdDirectories: string[];
    }>;

    async applyTemplate(
      templateContent: string,
      variables: Record<string, any>
    ): Promise<string>;

    async validateVariables(
      templateId: string,
      variables: Record<string, any>
    ): Promise<{ valid: boolean; errors: string[] }>;
  }
  ```

### P4.5: Report Generation Service
- [ ] Create `src/application/services/ReportGenerationService.ts`
  ```typescript
  class ReportGenerationService {
    async generateAnalysisReport(results: any): Promise<{
      json: AnalysisReport;
      markdown: string;
      html: string;
    }>;

    async generateDiagrams(results: any): Promise<{
      architecture: string; // Mermaid
      components: string;   // Mermaid
      dataflow: string;     // Mermaid
    }>;

    async formatRecommendations(
      insights: any
    ): Promise<Array<{
      priority: 'high' | 'medium' | 'low';
      category: string;
      description: string;
      actionItems: string[];
    }>>;
  }
  ```

### P4.6: Tests for Services
- [ ] Create `tests/unit/services/`:
  - [ ] `SubagentService.test.ts`
  - [ ] `MainAgentService.test.ts`
  - [ ] `OrchestrateService.test.ts`
  - [ ] `ProjectScaffoldService.test.ts`
  - [ ] `ReportGenerationService.test.ts`

- [ ] Create integration tests in `tests/integration/`:
  - [ ] Full orchestration workflow
  - [ ] Multi-phase execution (discovery → analysis → synthesis)
  - [ ] Error handling and recovery

### P4.7: Deliverables
- [ ] All services implemented
- [ ] 100+ unit tests
- [ ] Integration tests for main workflows
- [ ] Document: `SERVICE-ARCHITECTURE.md`

**Estimated time**: 6-7 days

---

## PHASE 5: ORCHESTRATOR SCRIPT V4 (Week 6)
*Evolve claude-orchestrate-v3.sh to v4 with mcp-prompts API integration*

### P5.1: Create Orchestrate V4 Script
- [ ] Create `scripts/claude-orchestrate-v4.sh`
  ```bash
  #!/bin/bash
  # Claude Orchestrator v4
  # Integrates with mcp-prompts API instead of hardcoded configs
  
  set -e
  
  PROJECT_PATH="${1:-.}"
  MODE="${2:-analyze}"
  MCP_PROMPTS_API="${MCP_PROMPTS_API:-http://localhost:3000/api}"
  
  # Phase 0: Detect project type
  detect_project_type() {
    # Call mcp-prompts API
    curl -s "$MCP_PROMPTS_API/v1/orchestrate/validate-project" \
      -X POST \
      -H "Content-Type: application/json" \
      -d "{\"project_path\": \"$PROJECT_PATH\"}" \
      | jq -r '.project_type'
  }
  
  # Phase 1: Get main agent config
  get_main_agent() {
    local project_type=$1
    curl -s "$MCP_PROMPTS_API/v1/main-agents/$project_type" | jq .
  }
  
  # Phase 2: Spawn discovery subagents
  spawn_discovery_phase() {
    local project_type=$1
    # Get subagent IDs from main agent
    # Spawn explorer, git_analyzer, config_analyzer in parallel
    # Wait for all to complete
  }
  
  # Phase 3: Spawn analysis subagents
  spawn_analysis_phase() {
    local discovery_results=$1
    # Spawn analyzer, solid_analyzer, reviewer, tester
    # Sequential or parallel based on dependencies
  }
  
  # Phase 4: Synthesize with main agent
  synthesize_results() {
    local discovery_results=$1
    local analysis_results=$2
    # Call main agent with all results
    # Generate unified report
  }
  
  # Main orchestration
  PROJECT_TYPE=$(detect_project_type)
  echo "Detected project type: $PROJECT_TYPE"
  
  MAIN_AGENT=$(get_main_agent "$PROJECT_TYPE")
  echo "Loaded main agent config"
  
  DISCOVERY=$(spawn_discovery_phase "$PROJECT_TYPE")
  ANALYSIS=$(spawn_analysis_phase "$DISCOVERY")
  RESULT=$(synthesize_results "$DISCOVERY" "$ANALYSIS")
  
  echo "$RESULT" | jq .
  ```

### P5.2: Subagent Execution Logic
- [ ] Implement subagent spawning:
  ```bash
  # For each subagent, create a request to Claude API
  spawn_subagent() {
    local subagent_id=$1
    local project_path=$2
    local context=$3
    
    # Get subagent config from mcp-prompts API
    local config=$(curl -s "$MCP_PROMPTS_API/v1/subagents/$subagent_id")
    
    # Call Claude API with subagent config
    # POST https://api.anthropic.com/v1/messages
    # With: model, system_prompt (from config), tools, etc.
  }
  ```

### P5.3: Integration with Claude API
- [ ] Use Anthropic SDK or direct HTTP
  - Decision: Use `@anthropic-ai/sdk` Node.js package
  - Create wrapper in TypeScript that orchestrates v4

- [ ] Or: Create Node.js wrapper script:
  ```typescript
  // scripts/claude-orchestrate-v4.ts
  import Anthropic from '@anthropic-ai/sdk';
  
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
  
  async function main() {
    const projectPath = process.argv[2];
    const mode = process.argv[3] || 'analyze';
    
    // 1. Detect project type
    // 2. Load main agent config from mcp-prompts
    // 3. Spawn subagents
    // 4. Synthesize results
    // 5. Output report
  }
  
  main().catch(console.error);
  ```

### P5.4: Feedback Loop Integration
- [ ] After orchestration completes:
  - Record execution in database
  - Expose feedback endpoint
  - Collect user ratings/comments
  - Track agent success rates over time

- [ ] Implement feedback webhook:
  ```typescript
  // POST /v1/orchestrate/executions/:executionId/feedback
  // Record rating, comments, improvement suggestions
  // Update agent success_rate metric
  ```

### P5.5: Dry-Run Mode
- [ ] Add `--dry-run` flag
  - Show which subagents would be spawned
  - Show estimated tokens/cost
  - Don't actually call Claude API

### P5.6: Verbose & Debug Modes
- [ ] Add `-v` / `--verbose` flag for detailed output
- [ ] Add `--debug` for tracing
- [ ] Output execution timeline and metrics

### P5.7: Configuration Profiles
- [ ] Support project-specific configurations:
  ```bash
  # Look for .mcp-orchestrate.json in project root
  # Or fetch from mcp-prompts API
  {
    "main_agent_customizations": {...},
    "subagent_customizations": {...},
    "skip_phases": ["documentation"],
    "parallel_execution": true,
    "timeout_seconds": 300
  }
  ```

### P5.8: Error Handling & Recovery
- [ ] Timeout handling for long-running subagents
- [ ] Partial result recovery (if some subagents fail)
- [ ] Retry logic with exponential backoff
- [ ] Clear error messages

### P5.9: Deliverables
- [ ] `scripts/claude-orchestrate-v4.sh` (bash version)
- [ ] `scripts/claude-orchestrate-v4.ts` (TypeScript/Node.js version)
- [ ] Example usage:
  ```bash
  ./claude-orchestrate-v4.sh ~/projects/mia analyze -v
  ./claude-orchestrate-v4.sh ~/projects/sparetools review --dry-run
  npx ts-node scripts/claude-orchestrate-v4.ts ~/projects/ai-servis refactor
  ```
- [ ] Document: `ORCHESTRATE-V4-USAGE.md`

**Estimated time**: 4-5 days

---

## PHASE 6: INTEGRATION, TESTING & DOCUMENTATION (Week 7-8)
*Wire everything together, comprehensive tests, launch*

### P6.1: Integration Testing
- [ ] Create end-to-end tests in `tests/integration/`:
  - [ ] Test discovery phase with explorer subagent
  - [ ] Test analysis phase with multiple subagents
  - [ ] Test synthesis with main agent
  - [ ] Test project scaffolding
  - [ ] Test feedback loop

- [ ] Use test fixtures:
  ```typescript
  // tests/fixtures/sample-projects/
  ├── python-backend/     (minimal valid project)
  ├── cpp-backend/        (minimal valid project)
  ├── mcp-server/         (minimal valid project)
  ├── multiplatform-iot/  (minimal valid MIA-like structure)
  └── invalid-project/    (for error testing)
  ```

### P6.2: Performance & Load Testing
- [ ] Benchmark subagent execution:
  - Typical tokens per subagent
  - Typical cost per analysis
  - Execution time per phase

- [ ] Create performance report:
  ```markdown
  ## Performance Metrics
  - Discovery phase: ~5 minutes (explorer, git_analyzer, config_analyzer in parallel)
  - Analysis phase: ~10-15 minutes (analyzers in sequence)
  - Synthesis: ~5 minutes (main agent coordination)
  - **Total: 20-30 minutes per full analysis**
  
  ## Cost Metrics
  - Haiku subagents: ~$0.02-0.05 per analysis
  - Sonnet subagents: ~$0.30-0.50 per analysis
  - Opus main agent: ~$0.10-0.20 per synthesis
  - **Total: ~$0.50-1.00 per full analysis**
  ```

### P6.3: Documentation
- [ ] Create comprehensive docs in `docs/`:
  
  - [ ] **`GETTING-STARTED.md`** (entry point)
    - What is this?
    - Quick example
    - Links to other docs
  
  - [ ] **`AGENTS-ARCHITECTURE.md`** (this guide, expanded)
    - Architecture overview
    - Component diagram
    - Model selection strategy
    - Subagent categories
  
  - [ ] **`API-REFERENCE.md`**
    - All REST endpoints
    - Request/response examples
    - Authentication
    - Error codes
  
  - [ ] **`SUBAGENT-REGISTRY.md`**
    - List all ~20 subagents
    - For each: name, category, description, tools, use cases
    - Search index
  
  - [ ] **`MAIN-AGENT-TEMPLATES.md`**
    - List all 7 main agent templates
    - For each: project type, focus areas, subagents used
  
  - [ ] **`ORCHESTRATION-GUIDE.md`**
    - How to use orchestrate-v4
    - Examples for each project type
    - Troubleshooting
  
  - [ ] **`AGENTS.md-STANDARD.md`**
    - Template for creating AGENTS.md in projects
    - Sections: overview, components, build, test, conventions, etc.
    - Examples from MIA
  
  - [ ] **`EXTENDING-AGENTS.md`**
    - How to create custom subagents
    - How to customize main agents for your project
    - How to add new project types
  
  - [ ] **`IMPLEMENTATION-INTERNALS.md`**
    - Service layer architecture
    - Repository pattern
    - Database schema
    - API design decisions
  
  - [ ] **`DEPLOYMENT.md`**
    - How to deploy mcp-prompts with orchestrator
    - Docker setup
    - Environment variables
    - Production considerations
  
  - [ ] **`FAQ.md`**
    - Common questions
    - Troubleshooting
    - Cost estimates
    - Performance tuning

### P6.4: README Updates
- [ ] Update main `README.md`:
  ```markdown
  # mcp-prompts
  
  ## Features
  - Centralized prompt management
  - **NEW: Claude multi-agent orchestration**
  - Project structure analysis
  - Code quality assessment
  - Automated refactoring suggestions
  
  ## Quick Start
  
  ### Analyze a project
  ```bash
  ./scripts/claude-orchestrate-v4.sh ~/projects/myapp analyze
  ```
  
  ### Scaffold a new project
  ```bash
  curl -X POST http://localhost:3000/api/v1/orchestrate/scaffold-project \
    -d '{"project_type": "python_backend", ...}'
  ```
  
  ## Documentation
  - [Getting Started](docs/GETTING-STARTED.md)
  - [API Reference](docs/API-REFERENCE.md)
  - [Architecture Guide](docs/AGENTS-ARCHITECTURE.md)
  - [Extending Agents](docs/EXTENDING-AGENTS.md)
  ```

### P6.5: Migration Guide for Existing Users
- [ ] Create `docs/MIGRATION-FROM-V3.md`:
  - What changed
  - How to update configs
  - Backward compatibility (if any)
  - Data migration path

### P6.6: Examples & Use Cases
- [ ] Create example directory `examples/`:
  - [ ] `analyze-python-backend.sh` → Analyze Python project
  - [ ] `analyze-cpp-backend.sh` → Analyze C++ project
  - [ ] `analyze-iot-multiplatform.sh` → Analyze MIA-like project
  - [ ] `scaffold-new-project.sh` → Create new project structure
  - [ ] `review-mia.sh` → Review MIA with custom context
  - [ ] `api-client-example.ts` → Node.js API client

### P6.7: GitHub Repository Setup
- [ ] Create GitHub discussion/issue template:
  - For sharing analysis results
  - For bug reports
  - For feature requests

- [ ] Create GitHub Actions workflow:
  ```yaml
  # .github/workflows/analyze-pr.yml
  name: Analyze PR
  on: [pull_request]
  jobs:
    analyze:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v3
        - name: Run Orchestrator Analysis
          run: ./scripts/claude-orchestrate-v4.sh . review
        - name: Comment Results
          uses: actions/github-script@v6
          with:
            script: |
              # Post analysis results as comment
  ```

### P6.8: Internal Testing (Pre-Launch)
- [ ] Test with your existing projects:
  - [ ] Test MIA analysis
  - [ ] Test sparetools analysis
  - [ ] Test ai-servis analysis
  - [ ] Test mcp-project-orchestrator analysis

- [ ] Collect & fix issues
- [ ] Fine-tune system prompts based on results

### P6.9: Deliverables
- [ ] All integration tests passing (✓ 95%+ coverage)
- [ ] Performance benchmarks documented
- [ ] Comprehensive documentation (8+ guides)
- [ ] Examples working end-to-end
- [ ] GitHub Actions workflow
- [ ] Migration guide
- [ ] Document: `PHASE-6-COMPLETE.md`
- [ ] **LAUNCH**: Tag release `v1.0.0-agent-orchestration`

**Estimated time**: 7-10 days

---

## OPTIONAL: PHASE 7 (Post-Launch)
*Advanced features for future iterations*

### P7.1: Agent Feedback Loop & Learning
- [ ] Collect execution feedback systematically
- [ ] Track agent success rates per project type
- [ ] A/B test subagent variations
- [ ] Optimize subagent selection based on feedback

### P7.2: Custom Agent Creation UI
- [ ] Web interface to create custom subagents
- [ ] Prompt builder with templates
- [ ] Tool selector
- [ ] Test runner

### P7.3: CI/CD Integration
- [ ] GitHub Actions integration (commented above)
- [ ] GitLab CI integration
- [ ] Jenkins integration
- [ ] Automated PR comments with analysis

### P7.4: Multi-Project Analysis
- [ ] Analyze entire monorepo
- [ ] Cross-project dependency analysis
- [ ] Recommend refactorings across projects

### P7.5: Agent Marketplace
- [ ] Share custom subagents
- [ ] Publish to community registry
- [ ] Version management
- [ ] Usage tracking

---

## DETAILED TASK BREAKDOWN BY ROLE

### For Backend Engineer
**Total time**: ~6 weeks (focus on P1, P2, P4)

1. **Week 1 (P0)**: Research & schema design
   - [ ] Study reference repos
   - [ ] Finalize Prompt schema
   - [ ] Plan database migrations

2. **Week 2 (P1)**: Storage layer
   - [ ] Create entities
   - [ ] Write migrations
   - [ ] Implement storage adapters
   - [ ] Create repositories

3. **Week 3 (P2)**: API layer
   - [ ] Implement all REST endpoints
   - [ ] Validation schemas
   - [ ] Error handling

4. **Week 4 (P3)**: Data migration
   - [ ] Import subagents script
   - [ ] Import main agents script
   - [ ] Import templates script
   - [ ] Data QA

5. **Week 5 (P4)**: Services
   - [ ] Implement all services
   - [ ] Service tests
   - [ ] Integration tests

6. **Week 6+ (P5, P6)**: Orchestration & launch
   - [ ] Orchestrator script v4
   - [ ] End-to-end testing
   - [ ] Documentation
   - [ ] Launch

### For Frontend/DevTools Engineer
**Total time**: ~3 weeks (focus on P2, P6)

1. **Week 1 (P0)**: Research
   - [ ] Study APIs
   - [ ] Plan UI components

2. **Week 2-3 (P2, P6)**: Build UI
   - [ ] Agent discovery interface
   - [ ] Project analyzer UI
   - [ ] Results visualization
   - [ ] Documentation site

### For QA/Testing
**Total time**: ~2 weeks (focus on P4, P6)

1. **Week 1 (P4)**: Unit tests
   - [ ] Test all services
   - [ ] Test API endpoints

2. **Week 2 (P6)**: Integration & E2E
   - [ ] Full orchestration workflows
   - [ ] Error scenarios
   - [ ] Performance testing

---

## ROLLOUT CHECKLIST

Before launching v1.0.0:

- [ ] All phases completed
- [ ] 95%+ test coverage
- [ ] All documentation reviewed
- [ ] Examples tested & working
- [ ] Performance baselines met
- [ ] No critical security issues
- [ ] Data migration validated
- [ ] Rollback plan documented
- [ ] Team trained on new features
- [ ] GitHub release created
- [ ] Blog post / announcement written
- [ ] Community informed (GitHub discussion)

---

## ESTIMATED TOTAL EFFORT

| Phase | Duration | Effort (person-days) |
|-------|----------|----------------------|
| P0: Research | 1 week | 5 PD |
| P1: Storage | 1 week | 8 PD |
| P2: API | 1 week | 10 PD |
| P3: Migration | 1 week | 4 PD |
| P4: Services | 1 week | 12 PD |
| P5: Orchestrator | 1 week | 8 PD |
| P6: Integration & Launch | 2 weeks | 15 PD |
| **Total** | **7-8 weeks** | **62 PD** |

**Breakdown for team of 2**:
- 1 backend engineer (40 PD)
- 1 fullstack/DevTools (22 PD)
- **Timeline: 6-8 weeks with concurrent work**

---

## KEY SUCCESS METRICS

After Phase 6:

1. **Functionality**:
   - ✓ Can analyze any project type correctly
   - ✓ 20+ subagents available and working
   - ✓ 7 main agent templates configured
   - ✓ Projects can be scaffolded from templates

2. **Performance**:
   - ✓ Full analysis completes in <30 minutes
   - ✓ Cost per analysis <$1.00
   - ✓ API responds <200ms for discovery
   - ✓ Can handle 10+ concurrent analyses

3. **Quality**:
   - ✓ 95%+ test coverage
   - ✓ Zero critical bugs at launch
   - ✓ Comprehensive documentation
   - ✓ All examples working

4. **Adoption**:
   - ✓ Team using it on real projects
   - ✓ Positive feedback on accuracy
   - ✓ Plans for community sharing
   - ✓ Foundation for marketplace (P7)

---

**Next Steps**: Start with Phase 0 this week. Good luck! 🚀
