# Quick Reference: Key Files to Extract & Adapt

## From: mcp-project-orchestrator
**Repository**: https://github.com/sparesparrow/mcp-project-orchestrator

### Files to Study & Copy
```
mcp-project-orchestrator/
├── src/
│   ├── domain/
│   │   ├── entities/          ← Project, Component, Template entities
│   │   └── use-cases/         ← Generation logic (COPY pattern for scaffolding)
│   ├── adapters/
│   │   ├── primary/           ← HTTP API patterns
│   │   └── secondary/         ← Storage pattern (ports & adapters)
│   └── infrastructure/        ← Config merging, file I/O
├── templates/                 ← ALL PROJECT TEMPLATES (COPY THIS ENTIRE FOLDER)
│   ├── hexagonal-architecture/
│   ├── aws-cdk/
│   ├── devcontainer/
│   ├── github-actions/
│   └── docker/
├── project_orchestration.json ← Schema (UNDERSTAND & ADAPT)
└── integration_plan.md        ← Integration strategy (REFERENCE)
```

### What to Copy
1. **Entity patterns**:
   - `Project` entity with properties, validation
   - `Component` entity 
   - `Template` entity with variables/placeholders
   - Adapt: Make these `Subagent`, `MainAgentTemplate`, `ProjectOrchestrationTemplate`

2. **Template system**:
   - How templates are loaded, stored, merged
   - Variable substitution (copy handlebars/mustache approach)
   - Folder structure conventions
   - **ACTION**: Copy `/templates` folder content → Convert to JSON Prompt entries

3. **Use case logic**:
   - `GenerateProject` use case
   - `ApplyTemplate` use case
   - Adapt: Create `GenerateSubagent`, `ApplyPromptTemplate`, `ScaffoldProject` use cases

4. **Storage adapters**:
   - How templates are persisted
   - Multi-backend support pattern
   - Adapt: Add new methods for subagent/template queries

### Schema & Config to Study
- **`project_orchestration.json`** structure:
  ```json
  {
    "project_type": "mcp_server|python_backend|cpp_app|iot_firmware",
    "templates": ["hexagonal-architecture", "aws-cdk"],
    "components": [...],
    "variables": {...}
  }
  ```
  - Adapt this for your `project_orchestration_template` Prompt type

---

## From: VoltAgent/awesome-claude-code-subagents
**Repository**: https://github.com/VoltAgent/awesome-claude-code-subagents

### Files to Study & Copy
```
awesome-claude-code-subagents/
├── README.md                           ← Categories list (STUDY)
├── subagents/
│   ├── dev/                            ← Developer roles
│   │   ├── backend-developer.md        ← Prompt template (COPY & ADAPT)
│   │   ├── typescript-pro.md
│   │   └── ...
│   ├── infra/                          ← Infrastructure roles
│   │   ├── devops-engineer.md
│   │   └── ...
│   ├── quality/                        ← Quality & testing
│   │   ├── code-reviewer.md
│   │   └── ...
│   └── meta/                           ← Orchestration roles
│       └── multi-agent-coordinator.md
└── examples/                           ← Usage examples (REFERENCE)
    └── subagent-definitions.json
```

### What to Copy
1. **Subagent categories** (read README.md):
   - `dev/*` → dev/backend-developer, dev/typescript-pro, dev/python-pro, etc.
   - `infra/*` → infra/devops-engineer, infra/kubernetes-specialist, etc.
   - `quality/*` → quality/code-reviewer, quality/security-auditor, etc.
   - `meta/*` → meta/multi-agent-coordinator, meta/workflow-orchestrator, etc.

2. **Prompt templates**:
   - Each `.md` file contains a full system prompt for that subagent role
   - **ACTION**: Extract prompt text from each `.md` file
   - **ACTION**: Create JSON Prompt entry for each category:
     ```json
     {
       "id": "dev/backend-developer",
       "type": "subagent_registry",
       "category": "dev",
       "name": "Backend Developer",
       "model": "claude-sonnet",
       "system_prompt": "<extracted from .md>",
       "tools": [...],
       "tags": ["backend", "api", "database"],
       "source_url": "https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/subagents/dev/backend-developer.md"
     }
     ```

3. **Tool specifications**:
   - Tools each subagent should have access to (in `.md` files)
   - **ACTION**: Extract and standardize as JSON arrays

4. **Examples**:
   - How subagents are composed, called, coordinated
   - Use as reference for your main orchestrator logic

### Subagents to Prioritize (Minimum Set)
```
✅ dev/backend-developer      (Core analyzer pattern)
✅ dev/typescript-pro         (For mcp-prompts web UI)
✅ dev/python-pro            (For Python services)
✅ dev/mcp-developer         (NEW - Add this for MCP-specific work)
✅ infra/devops-engineer     (Core infrastructure)
✅ quality/code-reviewer     (Core quality)
✅ dx/documentation-engineer (For AGENTS.md generation)
✅ iot/iot-engineer          (For IoT/embedded work)
✅ meta/multi-agent-coordinator (Reference for orchestrator)
```

---

## From: Your Existing Work

### Files to Reference & Integrate
```
Your Projects/
├── improved-agents.json       ← Main agent templates (PORT INTO mcp-prompts)
├── mia-agents-v3.json        ← MIA-specific config (INTEGRATE)
├── MIA-AGENTS.md             ← AGENTS.md template (GENERALIZE)
├── IMPLEMENTATION-GUIDE.md   ← Architecture doc (REFERENCE)
└── claude-orchestrate-v3.sh  ← Orchestrator script (EVOLVE TO v4)
```

### What to Port
1. **improved-agents.json**:
   - Main agent templates (cpp_backend, python_backend, multiplatform_iot, etc.)
   - Global subagents definitions
   - **ACTION**: Convert to mcp-prompts Prompt entries:
     - One entry per main agent template (type: "main_agent_template")
     - Metadata for each (model, subagents, MCP servers)

2. **mia-agents-v3.json**:
   - MIA-specific orchestrator config
   - Custom subagent prompts
   - **ACTION**: Add to main_agent_multiplatform_iot in mcp-prompts
   - **ACTION**: Extract custom subagents → Create separate Prompt entries for mia_backend_analyzer, mia_embedded_coordinator, etc.

3. **MIA-AGENTS.md**:
   - Comprehensive agent guidance
   - **ACTION**: Generalize → Create agents_md_template_iot_multiplatform.json
   - **ACTION**: Create documentation-engineer subagent that uses this template

4. **claude-orchestrate-v3.sh**:
   - Orchestration logic (project detection, agent loading, execution)
   - **ACTION**: Evolve to v4 that fetches config from mcp-prompts API
   - **ACTION**: Replace hardcoded JSON with API calls to `/v1/main-agents` and `/v1/subagents`

---

## Quick Copy-Paste Checklist

### 1. Clone Repositories (locally, reference only - no submodules)
```bash
# Study & reference only (DO NOT add as submodules)
git clone https://github.com/sparesparrow/mcp-project-orchestrator /tmp/mcp-project-orchestrator
git clone https://github.com/VoltAgent/awesome-claude-code-subagents /tmp/awesome-claude-code-subagents
```

### 2. Extract from mcp-project-orchestrator
```bash
# Copy all templates
cp -r /tmp/mcp-project-orchestrator/templates/* \
  mcp-prompts/src/data/project-templates/

# Study hexagonal architecture pattern
less /tmp/mcp-project-orchestrator/src/domain/entities/*.ts

# Study template generation logic
less /tmp/mcp-project-orchestrator/src/domain/use-cases/*.ts
```

### 3. Extract from VoltAgent
```bash
# List all subagent markdown files
find /tmp/awesome-claude-code-subagents/subagents -name "*.md" \
  | while read f; do echo "=== $(basename $f) ===" && head -20 "$f"; done

# Use these as template for creating JSON Prompt entries
```

### 4. Files to Create in mcp-prompts
```bash
# New directory structure
mcp-prompts/
├── src/
│   ├── data/
│   │   ├── subagents/
│   │   │   ├── dev/
│   │   │   ├── infra/
│   │   │   ├── quality/
│   │   │   ├── iot/
│   │   │   ├── dx/
│   │   │   └── meta/
│   │   ├── main-agents/
│   │   └── project-templates/
│   ├── domain/
│   │   └── entities/
│   │       ├── Subagent.ts       (NEW)
│   │       ├── MainAgentTemplate.ts (NEW)
│   │       └── ProjectOrchestrationTemplate.ts (NEW)
│   └── adapters/
│       ├── primary/
│       │   └── http/
│       │       ├── routes/
│       │       │   ├── subagents.ts    (NEW)
│       │       │   ├── main-agents.ts  (NEW)
│       │       │   └── orchestrate.ts  (NEW)
│       │       └── controllers/
│       └── secondary/
│           └── storage/
│               ├── postgres.ts         (UPDATE)
│               ├── dynamodb.ts         (UPDATE)
│               └── file.ts             (UPDATE)
├── scripts/
│   └── claude-orchestrate-v4.sh    (NEW - evolved from v3)
└── tests/
    ├── api/
    │   ├── subagents.test.ts       (NEW)
    │   ├── main-agents.test.ts     (NEW)
    │   └── orchestrate.test.ts     (NEW)
    └── integration/
        └── orchestration.test.ts   (NEW)
```

---

## Key Adaptation Points

### From mcp-project-orchestrator → mcp-prompts
| Concept | mcp-project-orchestrator | → | mcp-prompts |
|---------|--------------------------|---|------------|
| **Entity** | `Project`, `Component`, `Template` | → | `Subagent`, `MainAgentTemplate`, `ProjectOrchestrationTemplate` |
| **Storage** | File-based in `templates/` | → | Prompt entries (PostgreSQL/DynamoDB/File) |
| **Generation** | Hexagonal architecture scaffolding | → | Project structure + agent config scaffolding |
| **Variables** | Handlebars/mustache placeholders | → | Same system, reuse |
| **API** | REST endpoints for project generation | → | Extend with `/v1/orchestrate` endpoint |

### From VoltAgent → mcp-prompts
| Concept | VoltAgent | → | mcp-prompts |
|---------|-----------|---|------------|
| **Structure** | Markdown `.md` files per subagent | → | JSON Prompt entries (searchable, versionable) |
| **Categories** | dev/, infra/, quality/, meta/ | → | Same categories, extended for iot/, dx/ |
| **Prompts** | Plain text system prompts | → | Stored in Prompt.system_prompt field |
| **Tools** | Listed in markdown | → | Structured as JSON arrays in Prompt.tools |
| **Reuse** | Manual copy-paste | → | Programmatic via API, MCP tools |

### From your v3 design → v4 implementation
| Component | v3 | → | v4 |
|-----------|----|----|-----|
| **Agent configs** | hardcoded in improved-agents.json | → | Stored in mcp-prompts, fetched via API |
| **Project detection** | Shell script logic | → | Same logic, but can also call mcp-prompts endpoint |
| **Subagent spawn** | Hardcoded in agents.json template | → | Dynamically built from mcp-prompts response |
| **Main agent select** | Hardcoded template per project type | → | Fetched from `/v1/main-agents/{project_type}` |

---

## URLs & Commit References to Study

### mcp-project-orchestrator
- **Integration plan**: https://github.com/sparesparrow/mcp-project-orchestrator/blob/main/integration_plan.md
- **Template system**: Look for `src/domain/use-cases/GenerateProject` and `ApplyTemplate`
- **Hexagonal pattern**: Study `src/domain/entities/` and `src/adapters/`
- **Recent commits** (copy patterns from):
  - Template loading logic
  - Variable substitution
  - File I/O abstraction

### VoltAgent/awesome-claude-code-subagents
- **Subagent categories**: https://github.com/VoltAgent/awesome-claude-code-subagents#categories
- **Each subagent file** (example): `subagents/dev/backend-developer.md` → Contains full system prompt
- **Meta subagent example**: `subagents/meta/multi-agent-coordinator.md` → Use as reference for orchestrator design

### Claude SDK Documentation
- **CLI Reference**: https://code.claude.com/docs/en/cli-reference
  - Search for: `--agents`, `--system-prompt`, `--model`, subagent syntax
- **MCP Documentation**: https://code.claude.com/docs/en/mcp
  - How to register MCP tools
- **Skills Guide**: https://code.claude.com/docs/en/skills
  - For creating custom MCP tools
- **Anthropic Engineering**: https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk
  - Section: "Creating new types of agents" → Email agent example (adapt for orchestration)
  - Section: "Verify your work" → Context for agent feedback loops

---

## Execution Order (Recommended)

1. **This week**:
   - [ ] Clone reference repos locally
   - [ ] Read mcp-project-orchestrator's integration_plan.md
   - [ ] Scan all VoltAgent subagent categories
   - [ ] Finalize unified Prompt schema with team

2. **Next week (Phase 1-2)**:
   - [ ] Extend Prompt model
   - [ ] Add storage adapter methods
   - [ ] Create REST endpoints for subagent discovery

3. **Following weeks (Phase 3-5)**:
   - [ ] Port VoltAgent subagents → JSON Prompt entries
   - [ ] Create main agent templates → JSON Prompt entries
   - [ ] Port project templates → JSON Prompt entries

4. **End of month (Phase 6+)**:
   - [ ] Evolve orchestrate script to v4
   - [ ] Integration testing
   - [ ] Documentation & launch

---

## File Formats Reference

### Prompt Entry Format (JSON)
```json
{
  "id": "subagent_category_name",
  "type": "subagent_registry|main_agent_template|project_orchestration_template",
  "name": "Human-readable name",
  "description": "What this is",
  "category": "dev|infra|quality|iot|dx|meta",
  "tags": ["tag1", "tag2"],
  "model": "claude-opus|claude-sonnet|claude-haiku",
  "system_prompt": "Full system prompt text here...",
  "tools": ["tool1", "tool2"],
  "mcp_servers": ["github", "filesystem"],
  "variables": [
    {"name": "var_name", "type": "string|number|boolean", "description": "...", "required": true}
  ],
  "version": "1.0.0",
  "author": "sparesparrow|voltAgent|...",
  "source_url": "https://github.com/...",
  "compatible_with": ["project_type1", "project_type2"],
  "created_at": "2025-01-09T00:00:00Z",
  "updated_at": "2025-01-09T00:00:00Z"
}
```

### Project Template Format (JSON)
```json
{
  "id": "template_mcp_server",
  "type": "project_orchestration_template",
  "name": "MCP Server Template",
  "description": "...",
  "base_structure": {
    "directories": ["src", "tests", "docs"],
    "files": [...]
  },
  "components": [
    {"name": "core", "path": "src/", "template": "hexagonal-architecture"}
  ],
  "templates": {
    "devcontainer.json": "...",
    "docker-compose.yml": "...",
    ".github/workflows/ci.yml": "..."
  },
  "variables": [...]
}
```

---

**Next: Start with Phase 0 tasks, complete by end of this week.** Good luck! 🚀
