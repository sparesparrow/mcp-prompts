# Cursor Rules Repository

A comprehensive collection of Cursor IDE rules for developing AI-powered applications with a focus on agentic workflows, TypeScript development, and cognitive architectures.

## Structure

The rules are organized in a hierarchical structure with clear categorization:

```
.cursor/rules/
├── core/                    # Core foundational rules
│   ├── base-agentic.mdc    # Agentic workflow patterns
│   └── base-devops.mdc     # AI-driven DevOps standards
│
├── framework/              # Framework-specific rules
│   ├── typescript.mdc      # TypeScript standards
│   └── mcp-typescript.mdc  # MCP-specific standards
│
├── domain/                 # Domain-specific rules
│   ├── composer-agent.mdc           # Composer agent standards
│   ├── composer-agent-instructions.mdc  # Agent instruction standards
│   ├── cognitive-architecture.mdc   # Cognitive architecture standards
│   ├── crewai-agent.mdc            # CrewAI agent standards
│   ├── solid-analyzer.mdc          # SOLID analysis standards
│   ├── mermaid-generator.mdc       # Mermaid generation standards
│   └── monitor-agents.mdc          # Monitoring agent standards
│
├── security/              # Security rules
│   └── security.mdc       # Universal security standards
│
└── patterns/              # Advanced patterns
    └── top5-inspirations.mdc  # Advanced workflow patterns
```

## Rule Categories

1. **Core Rules** (`core/`)
   - `base-agentic.mdc`: Foundational patterns for agentic workflows
   - `base-devops.mdc`: AI-driven DevOps pipeline standards

2. **Framework Rules** (`framework/`)
   - `typescript.mdc`: TypeScript development standards
   - `mcp-typescript.mdc`: MCP-specific TypeScript standards

3. **Domain Rules** (`domain/`)
   - `composer-agent.mdc`: AI composer agent standards
   - `composer-agent-instructions.mdc`: Agent instruction standards
   - `cognitive-architecture.mdc`: Cognitive architecture standards
   - `crewai-agent.mdc`: Standards for CrewAI agent development
   - `solid-analyzer.mdc`: Standards for SOLID principle analysis
   - `mermaid-generator.mdc`: Standards for Mermaid diagram generation
   - `monitor-agents.mdc`: Standards for monitoring agent development

4. **Security Rules** (`security/`)
   - `security.mdc`: Universal security standards

5. **Advanced Patterns** (`patterns/`)
   - `top5-inspirations.mdc`: Advanced workflow patterns and best practices

## Usage

1. **Installation**
   - Clone this repository into your project's root directory
   - Ensure the `.cursor/rules` directory structure is maintained

2. **Rule Application**
   - Rules are automatically applied based on file patterns (globs)
   - Rules in higher-level directories (e.g., security/) take precedence
   - Each rule file (.mdc) contains metadata for scope and priority

3. **Development Workflow**
   - Follow the patterns and examples in each rule file
   - Use the provided validation rules for code quality
   - Implement security considerations as specified

## Contributing

1. **Adding New Rules**
   - Place rules in appropriate category directory
   - Use .mdc extension for rule files
   - Include proper metadata (description, globs, priority)
   - Provide clear examples and anti-patterns

2. **Modifying Rules**
   - Maintain backward compatibility
   - Update dependencies appropriately
   - Document changes in commit messages

## File Format

Each .mdc file follows this structure:
```markdown
---
description: Brief description of the rule's purpose
globs: ["pattern/to/match/*.{ts,js}"]
priority: numeric_priority
dependencies: ["other.mdc"]
---

# Rule Title

## Core Principles
...

## Code Standards
...

## Validation Rules
...
```

## Project Integration

The rules in this repository are designed to support various project types:

1. **AI Agent Development**
   - Composer agents with CrewAI integration
   - Cognitive architectures and workflows
   - Monitoring and observability agents

2. **Code Analysis Tools**
   - SOLID principle analyzers
   - Pattern recognition systems
   - Code improvement generators

3. **Documentation Tools**
   - Mermaid diagram generators
   - Documentation automation
   - Visual representation tools

4. **DevOps Integration**
   - CI/CD pipeline automation
   - Security scanning and validation
   - Deployment automation

## License

This project is licensed under the MIT License - see the LICENSE file for details.
