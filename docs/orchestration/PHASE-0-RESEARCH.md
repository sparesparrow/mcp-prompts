# Phase 0: Research & Planning - Complete Documentation

**Status**: In Progress  
**Started**: 2025-01-09  
**Owner**: sparesparrow

---

## P0.1: Reference Repository Analysis

### VoltAgent awesome-claude-code-subagents

**Location**: `/home/sparrow/projects/mcp/awesome-claude-code-subagents`

#### Repository Structure
```
categories/
├── 01-core-development/     - 11 subagents (backend, frontend, API, mobile, etc.)
├── 02-language-specialists/ - 28 subagents (TypeScript, Python, Go, Rust, etc.)
├── 03-infrastructure/       - 14 subagents (DevOps, K8s, Cloud, etc.)
├── 04-quality-security/     - 12 subagents (QA, Security, Review, etc.)
├── 05-data-ai/              - 12 subagents (ML, Data, LLM, etc.)
├── 06-developer-experience/ - 12 subagents (CLI, Docs, DX, MCP, etc.)
├── 07-specialized-domains/  - 12 subagents (IoT, Embedded, Game, etc.)
├── 08-business-product/     - 11 subagents (PM, BA, UX, etc.)
├── 09-meta-orchestration/   - 9 subagents (Coordinator, Context, etc.)
└── 10-research-analysis/    - 6 subagents (Research, Search, Trends, etc.)
```

#### Subagent File Format
Each `.md` file follows YAML frontmatter + Markdown content:
```yaml
---
name: subagent-name
description: When this agent should be invoked
tools: Read, Write, Edit, Bash, Glob, Grep
---

[System prompt content]
[Checklists and guidelines]
[Communication protocols]
[Development workflow]
```

#### Key Subagents Identified for Priority Import
- **Core Development**: backend-developer, frontend-developer, fullstack-developer
- **Language**: typescript-pro, python-pro, cpp-pro, rust-engineer, golang-pro
- **Infrastructure**: devops-engineer, kubernetes-specialist, cloud-architect, terraform-engineer
- **Quality**: code-reviewer, security-auditor, qa-expert, performance-engineer
- **DX**: documentation-engineer, mcp-developer, refactoring-specialist
- **Specialized**: embedded-systems, iot-engineer, blockchain-developer
- **Meta**: multi-agent-coordinator, workflow-orchestrator, context-manager

### mcp-project-orchestrator

**Location**: `/home/sparrow/projects/mcp/ai-mcp-monorepo/packages/mcp-project-orchestrator`

#### Integration Status
All phases completed:
- ✅ Core module, prompt manager, mermaid integration
- ✅ Template, prompt template, resource integration
- ✅ Server integration, CLI integration
- ✅ Documentation and cleanup

#### Key Patterns to Adopt
1. **Hexagonal Architecture**: Ports & adapters pattern for storage abstraction
2. **Template System**: Variable substitution with Jinja2-like patterns
3. **Project Orchestration**: JSON-based orchestration configuration
4. **Config Merging**: Multi-source configuration with priority

---

## P0.2: Existing Work Analysis

### improved-agents.json Analysis

**Global Subagents (11 defined)**:
| Subagent | Model | Purpose |
|----------|-------|---------|
| explorer | haiku | Project structure discovery |
| analyzer | sonnet | Deep code analysis |
| diagrammer | haiku | Mermaid diagram generation |
| solid_analyzer | sonnet | SOLID principles evaluation |
| git_analyzer | haiku | Git history analysis |
| tester | haiku | Test suite analysis |
| documenter | haiku | Documentation assessment |
| reviewer | sonnet | Code review |
| refactorer | sonnet | Refactoring execution |
| dependency_analyzer | haiku | Dependency graph analysis |
| config_analyzer | haiku | Configuration audit |

**Main Agent Templates (7 defined)**:
| Template | Languages | Frameworks |
|----------|-----------|------------|
| cpp_backend | C++ | CMake |
| python_backend | Python | FastAPI, Flask, Django |
| embedded_iot | C++, C | PlatformIO, Arduino |
| android_app | Kotlin, Java | Android Jetpack |
| web_frontend | JavaScript, TypeScript | React, Vue, Angular |
| devops_infrastructure | YAML, HCL | Docker, K8s, Terraform |
| multiplatform_iot | C++, Python, Kotlin, JS | Multi-framework |

### MIA-Specific Customizations
- Pi as gateway/relay/aggregator
- ESP32 as sensor hub
- Android for mobile control
- Backend for cloud coordination
- Web dashboard for visualization
- Docker infrastructure for services

---

## P0.3: Architecture Decisions

### Decision 1: Unified vs. Separate Tables

**Decision**: Use UNIFIED Prompt table with discriminator field

**Rationale**:
- Maintains backward compatibility with existing prompts
- Single API surface for all prompt types
- Flexible querying across types
- Simplified storage adapter implementation

**Implementation**:
```typescript
interface Prompt {
  // Existing fields
  id: string;
  name: string;
  description: string;
  template: string;
  category: string;
  tags: string[];
  // ...

  // NEW: Discriminator for prompt types
  promptType?: 'standard' | 'subagent_registry' | 'main_agent_template' | 'project_orchestration_template';
  
  // Agent-specific fields (optional based on promptType)
  agentConfig?: AgentConfig;
}

interface AgentConfig {
  model?: 'claude-opus' | 'claude-sonnet' | 'claude-haiku';
  systemPrompt?: string;
  tools?: string[];
  mcpServers?: string[];
  subagents?: string[];
  compatibleWith?: string[];
  sourceUrl?: string;
  executionStats?: ExecutionStats;
}
```

### Decision 2: Storage Location for Execution History

**Decision**: Separate table for execution records

**Rationale**:
- Keeps prompt definitions immutable
- Enables analytics without modifying prompts
- Better query performance for telemetry

### Decision 3: API Versioning

**Decision**: Use `/v1/` prefix for all new orchestration endpoints

**New Endpoints**:
- `GET /v1/subagents` - List subagents with filtering
- `GET /v1/subagents/:id` - Get single subagent
- `GET /v1/main-agents` - List main agent templates
- `GET /v1/main-agents/:id` - Get main agent by project type
- `POST /v1/orchestrate` - Execute orchestration

---

## P0.4: Unified Prompt Schema

### Extended Prompt Entity
```typescript
export class Prompt {
  // Existing fields
  id: string;
  name: string;
  description: string;
  template: string;
  category: string;
  tags: string[];
  variables: PromptVariable[];
  version: string;
  createdAt: Date;
  updatedAt: Date;
  isLatest: boolean;
  metadata: Record<string, any>;
  accessLevel: string;
  authorId?: string;

  // NEW: Agent orchestration fields
  promptType: PromptType;
  model?: ClaudeModel;
  systemPrompt?: string;
  tools?: string[];
  mcpServers?: string[];
  subagents?: string[];
  compatibleWith?: string[];
  sourceUrl?: string;
  executionCount?: number;
  successRate?: number;
  lastExecutedAt?: Date;
}

// Enums
type PromptType = 'standard' | 'subagent_registry' | 'main_agent_template' | 'project_orchestration_template';
type ClaudeModel = 'claude-opus' | 'claude-sonnet' | 'claude-haiku';

// Variable definition
interface PromptVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'enum';
  description: string;
  required: boolean;
  defaultValue?: any;
  enumValues?: string[];
}
```

---

## P0.5: Directory Structure Plan

```
mcp-prompts/
├── src/
│   ├── data/                         ← NEW: Static data files
│   │   ├── subagents/
│   │   │   ├── dev/                  - Development subagents
│   │   │   ├── infra/                - Infrastructure subagents
│   │   │   ├── quality/              - Quality & security subagents
│   │   │   ├── iot/                  - IoT/Embedded subagents
│   │   │   ├── dx/                   - Developer experience subagents
│   │   │   └── meta/                 - Meta/orchestration subagents
│   │   ├── main-agents/              - Main agent templates
│   │   └── project-templates/        - Project scaffolding templates
│   ├── core/
│   │   ├── entities/
│   │   │   ├── prompt.entity.ts      ← EXTEND with agent fields
│   │   │   ├── subagent.entity.ts    ← NEW
│   │   │   └── execution.entity.ts   ← NEW
│   │   └── services/
│   │       ├── subagent.service.ts   ← NEW
│   │       ├── orchestrate.service.ts← NEW
│   │       └── scaffold.service.ts   ← NEW
│   ├── adapters/
│   │   ├── http/
│   │   │   ├── routes/
│   │   │   │   ├── subagents.ts      ← NEW
│   │   │   │   ├── main-agents.ts    ← NEW
│   │   │   │   └── orchestrate.ts    ← NEW
│   │   └── storage/                  ← EXTEND all adapters
│   └── mcp/
│       └── tools/
│           ├── subagent-discovery.ts ← NEW
│           └── orchestration.ts      ← NEW
├── scripts/
│   ├── import-subagents.ts           ← NEW: Bulk import from VoltAgent
│   └── claude-orchestrate-v4.sh      ← NEW: Evolved orchestrator
├── docs/
│   └── orchestration/
│       ├── PHASE-0-RESEARCH.md       ← This file
│       ├── ARCHITECTURE-DECISIONS.md
│       ├── API-REFERENCE.md
│       └── ONBOARDING-GUIDE.md
└── data/
    └── migrations/
        └── 001_add_agent_fields.sql  ← Database migration
```

---

## P0.6: Risk Assessment

### Risk 1: Schema Migration Impact
**Risk Level**: Medium  
**Impact**: Existing prompts may need migration  
**Mitigation**: 
- New fields are optional
- Backward compatible with defaults
- Migration script for existing data

### Risk 2: API Breaking Changes
**Risk Level**: Low  
**Impact**: Existing API clients unaffected  
**Mitigation**:
- New endpoints use `/v1/` prefix
- Existing endpoints unchanged
- Deprecation notices for future changes

### Risk 3: Cost of Opus Model Usage
**Risk Level**: Medium  
**Impact**: High-cost main agent executions  
**Mitigation**:
- Default to Sonnet for most operations
- Use Haiku for discovery/simple tasks
- Cost estimation before execution

### Risk 4: Complexity of Multi-Agent Coordination
**Risk Level**: High  
**Impact**: Difficult debugging and testing  
**Mitigation**:
- Incremental implementation (Phase 1-6)
- Comprehensive logging
- Dry-run mode for testing

---

## Next Steps

### Week 1 Deliverables
1. ✅ Study reference repositories
2. ✅ Document architecture decisions
3. ⏳ Extract VoltAgent subagents to JSON
4. ⏳ Create import script
5. ⏳ Extend Prompt entity schema

### Week 2 Preview (Phase 1)
- Database migrations
- Storage adapter extensions
- API endpoint stubs
