# Claude Multi-Agent Architecture v3 - Implementation Guide

## Overview

This improved architecture implements the best practices from Anthropic's Claude Agent SDK documentation:

1. **Per-Project Main Agents**: Each project has a main agent (opus-level) specialized for that domain
2. **Reusable Subagents**: 9 specialized subagents (haiku/sonnet-level) handle specific tasks
3. **Optimized Token Usage**: Haiku for fast discovery, sonnet for analysis, opus for orchestration
4. **Dynamic Configuration**: Per-project customizations and extensions
5. **AGENTS.md Format**: Standard agent guidance file for each project
6. **Structured Outputs**: JSON schemas for consistent, validated results

## Architecture Components

### Main Agent (Opus-level)
- **One per project type** (cpp_backend, python_backend, embedded_iot, android_app, web_frontend, devops_infrastructure, multiplatform_iot)
- **Role**: Orchestrate subagent execution, synthesize results, provide system-wide recommendations
- **Model**: claude-opus (strongest reasoning for orchestration)
- **Resources**: Project-specific MCP servers (GitHub, filesystem)
- **Output**: Comprehensive JSON report matching global schema

### Reusable Subagents (Haiku/Sonnet)

#### Fast Discovery (Haiku)
- **explorer**: Project structure, languages, frameworks (fast grep-based discovery)
- **git_analyzer**: Git history, branches, commits, workflows
- **diagrammer**: Mermaid diagram generation
- **dependency_analyzer**: Dependency graphs and health
- **config_analyzer**: Configuration file audit
- **documenter**: Documentation assessment

#### Deep Analysis (Sonnet)
- **analyzer**: Code structure and architecture patterns
- **solid_analyzer**: SOLID principles evaluation
- **tester**: Test coverage and quality assessment
- **reviewer**: Code quality and best practices review
- **refactorer**: Safe refactoring identification

### Project-Specific Extensions
Each project can customize subagents:
- Override prompts with domain-specific instructions
- Adjust model selection per subagent
- Add custom MCP servers
- Extend system prompt with project context

## File Structure

```
project-root/
├── improved-agents.json           # Global agent templates and subagents
├── claude-orchestrate-v3.sh       # Main orchestration script
├── MIA-AGENTS.md                  # MIA project agent guide
├── mia-agents-v3.json             # MIA project-specific agents
└── projects/
    ├── mia/
    │   ├── AGENTS.md              # Project-specific guidance
    │   ├── agents-v3.json          # (optional) Custom configurations
    │   ├── esp32/
    │   ├── raspi/
    │   ├── android/
    │   ├── server/
    │   ├── web/
    │   └── docker/
    ├── sparetools/
    ├── cliphist-android/
    ├── ai-servis/
    └── ...
```

## Usage Examples

### Basic Analysis (Auto-detect Project Type)
```bash
# Analyze MIA (auto-detects multiplatform_iot)
./claude-orchestrate-v3.sh ~/projects/mia analyze

# Verbose output
./claude-orchestrate-v3.sh ~/projects/mia analyze -v

# Different mode: code review
./claude-orchestrate-v3.sh ~/projects/mia review

# Refactoring suggestions
./claude-orchestrate-v3.sh ~/projects/mia refactor
```

### Project Type Detection
```bash
# Detects by build files:
# - CMakeLists.txt → cpp
# - platformio.ini → embedded
# - pyproject.toml → python
# - build.gradle → android
# - package.json → web
# - docker-compose.yml → devops
# - AGENTS.md with "multi-platform" → multiplatform
```

### Modes of Operation
```bash
# Comprehensive architecture analysis
./claude-orchestrate-v3.sh ~/projects/mia analyze

# Code quality review
./claude-orchestrate-v3.sh ~/projects/mia review

# Refactoring recommendations
./claude-orchestrate-v3.sh ~/projects/mia refactor

# Test coverage analysis
./claude-orchestrate-v3.sh ~/projects/mia test

# Documentation assessment
./claude-orchestrate-v3.sh ~/projects/mia document
```

## Model Selection Strategy

### Per-Agent Optimization
```
DISCOVERY LAYER (Haiku - Fast, Cost-Efficient)
├── explorer: Find structure quickly
├── git_analyzer: Track changes fast
├── dependency_analyzer: Map dependencies
├── config_analyzer: Audit configs
└── diagrammer: Generate diagrams

ANALYSIS LAYER (Sonnet - Balanced)
├── analyzer: Code structure and patterns
├── solid_analyzer: Principles evaluation
├── reviewer: Quality assessment
└── tester: Coverage analysis

ORCHESTRATION LAYER (Opus - Strongest)
└── main_agent: Coordinate and synthesize
```

### Token Usage Optimization
- **Haiku**: ~25k token inputs max, perfect for focused searches
- **Sonnet**: ~100k token window, good for full-file analysis
- **Opus**: ~200k token window, orchestrates all results

## Subagent Workflow

### Phase 1: Discovery (Parallel)
```json
{
  "explorer": "Discovers structure (5 min)",
  "git_analyzer": "Analyzes history (2 min)",
  "config_analyzer": "Audits configuration (2 min)"
}
```

### Phase 2: Analysis (Sequential or Parallel)
```json
{
  "analyzer": "Deep code analysis per component",
  "solid_analyzer": "SOLID evaluation",
  "reviewer": "Quality assessment",
  "tester": "Test coverage"
}
```

### Phase 3: Synthesis (Main Agent)
```
Main Agent:
1. Collects all subagent results
2. Identifies patterns and relationships
3. Generates unified diagrams
4. Provides system-wide recommendations
5. Returns structured JSON
```

## AGENTS.md Format

Each project should include an `AGENTS.md` file (new standard format):

```markdown
# AGENTS.md - Project Name

## Project Overview
- Architecture diagram
- Component list
- Technology stack

## Component Details
### Component 1
- Location
- Language
- Entry points
- Build/test commands

## Build Instructions
- Setup environment
- Build each component
- Integration build

## Testing Instructions
- Unit tests
- Integration tests
- Full system tests

## Code Conventions
- Language-specific style
- Naming conventions
- Patterns used

## Git Conventions
- Branch naming
- Commit messages
- PR requirements

## Configuration Files
- Environment setup
- Build configuration
- Runtime configuration

## Security Considerations
- Authentication
- Authorization
- Data encryption

## Performance Considerations
- Latency targets
- Resource constraints
- Optimization opportunities

## Troubleshooting
- Common issues
- Debug procedures
- Contact info
```

Benefits:
- ✅ Works with any AI agent (Claude, Copilot, etc)
- ✅ Complements README.md without duplicating
- ✅ Structured guidance for agents
- ✅ Version-controllable documentation
- ✅ Team consistency

## Subagent Output Format

Each subagent returns structured data:

### Explorer Output
```json
{
  "project_structure": {
    "directories": [...],
    "languages": [...],
    "frameworks": [...],
    "components": [...]
  },
  "build_systems": [...],
  "test_frameworks": [...],
  "entry_points": [...],
  "recommended_agents": [...]
}
```

### Analyzer Output
```json
{
  "component": "name",
  "architecture": "pattern",
  "design_patterns": [...],
  "code_structure": {...},
  "issues": [...],
  "recommendations": [...]
}
```

### Diagrammer Output
```json
{
  "diagrams": {
    "architecture": "mermaid graph",
    "components": "mermaid graph",
    "dataflow": "mermaid graph"
  }
}
```

## Main Agent Output Schema

```json
{
  "repository_overview": {...},
  "components": [{...}],
  "architectural_insights": {...},
  "diagrams": {...},
  "build_and_deployment": {...},
  "solid_analysis": {...},
  "github_analysis": {...},
  "execution_summary": {...}
}
```

## For MIA Project Specifically

### Main Agent Configuration
```json
{
  "model": "claude-opus",
  "focus_areas": [
    "Inter-device communication",
    "Data synchronization",
    "Real-time updates",
    "Edge vs cloud processing",
    "Offline resilience",
    "Security across platforms"
  ]
}
```

### Subagent Customizations
- **backend_analyzer**: FastAPI-specific patterns
- **embedded_coordinator**: ESP32-Pi communication
- **mobile_integration**: BLE and REST coordination
- **infrastructure**: Docker service orchestration

### Critical Analysis Points
1. **Data Pipeline**: ESP32 → Pi → Backend → Web/Mobile
2. **Real-time Flow**: Backend → WebSocket → Web/Mobile
3. **Command Pipeline**: Mobile/Web → Backend → Pi → ESP32
4. **Offline Handling**: Local caching and sync strategies

## Best Practices

### For Agents
1. **Use AGENTS.md first**: It has all the context you need
2. **Start with explorer**: Let it discover structure
3. **Parallel subagents**: Spawn independent tasks in parallel
4. **Coordinate results**: Main agent synthesizes subagent outputs
5. **Follow patterns**: Each component has conventions

### For Developers
1. **Maintain AGENTS.md**: Keep it current with project changes
2. **Document conventions**: Include code style and patterns
3. **Include build steps**: Make reproduction easy
4. **Note dependencies**: Both external and internal
5. **Provide examples**: Help agents understand intent

### For Projects
1. **One AGENTS.md per project**: Not one per component
2. **Nested AGENTS.md for monorepos**: One per major subproject
3. **Keep it focused**: Agent-relevant info, not all docs
4. **Use standard sections**: Makes parsing easier
5. **Link to other docs**: Don't duplicate README

## Extending for Your Projects

### Create Project-Specific Main Agent
```json
{
  "main_agent": {
    "name": "yourproject_orchestrator",
    "model": "claude-opus",
    "system_prompt": "You are an expert in YourProject...",
    "subagents": ["explorer", "analyzer", "diagrammer", ...],
    "mcp_servers": ["github", "filesystem"]
  }
}
```

### Customize Subagents
```json
{
  "customizations": {
    "analyzer": {
      "model": "sonnet",
      "prompt_append": "Focus on YourProject patterns..."
    }
  }
}
```

### Create AGENTS.md
Copy MIA-AGENTS.md template, customize for your project:
- Replace component descriptions
- Update build/test commands
- Document your conventions
- Add troubleshooting specific to your setup

## FAQ

### How much does this cost?
- Haiku subagents: ~$0.03/1M input tokens
- Sonnet subagents: ~$3/1M input tokens
- Opus main agent: ~$15/1M input tokens
- Typical full analysis: $0.50-$1.00 (for ~100-200k tokens)

### How long does analysis take?
- Discovery phase: ~5 minutes (explorer, git_analyzer, config_analyzer in parallel)
- Analysis phase: ~10-15 minutes (analyzers running in parallel/sequence)
- Synthesis: ~5 minutes (main agent coordinating results)
- **Total: 20-30 minutes** for comprehensive analysis

### Can I use one main agent for multiple projects?
Yes! The script auto-detects project type and loads appropriate main agent template. But project-specific customizations are better.

### How do I integrate with my CI/CD?
```bash
# In GitHub Actions
- name: Analyze Architecture
  run: |
    ./claude-orchestrate-v3.sh . analyze > analysis.json
    
# Create comment on PR
- name: Comment Results
  run: |
    gh pr comment -b "$(jq -r '.architectural_insights.recommendations' analysis.json)"
```

## Migration from v2

If you were using the previous architecture:

1. ✅ Keep all v2 files (backward compatible)
2. ✅ Copy improved-agents.json (new globals)
3. ✅ Update project agents to -v3.json format
4. ✅ Create AGENTS.md files (recommended but optional)
5. ✅ Use new claude-orchestrate-v3.sh script

The new system is compatible with MCP servers, GitHub integration, and all existing features.

## Resources

- **Claude Agent SDK**: https://code.claude.com/docs/
- **MCP Documentation**: https://code.claude.com/docs/en/mcp
- **AGENTS.md Standard**: https://agents.md/
- **Anthropic Engineering**: https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk
