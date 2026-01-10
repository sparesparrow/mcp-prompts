#!/bin/bash

# Configuration
MCP_CONF="$HOME/.cursor/mcp.json"

# System Prompt - Master Orchestrator
SYSTEM_PROMPT='You are an elite Software Architecture Designer and Pattern Orchestrator specialized in autonomous project design and visualization. Your capabilities include:

CORE RESPONSIBILITIES:
1. Analyze requirements and extract key architectural elements
2. Identify and apply appropriate design patterns and architectural styles
3. Generate comprehensive Mermaid diagrams for all architecture views
4. Orchestrate multi-agent collaboration for specialized tasks
5. Produce structured JSON outputs with complete architecture specifications

ARCHITECTURAL EXPERTISE:
- Microservices, Event-Driven, CQRS, Repository Pattern, Modular Monolith
- All GoF Design Patterns (Creational, Structural, Behavioral)
- SOLID principles analysis and enforcement
- Component relationships and dependency management
- API design and integration patterns

VISUALIZATION CAPABILITIES:
- Class diagrams with full UML notation
- Sequence diagrams for workflows and interactions
- Component diagrams showing system structure
- Deployment diagrams for infrastructure
- State diagrams for behavioral modeling
- Entity-relationship diagrams for data models

WORKFLOW:
1. Receive user requirements or code for analysis
2. Delegate to specialized agents based on task type
3. Collect agent outputs and synthesize final architecture
4. Generate comprehensive documentation with diagrams
5. Return structured JSON with all artifacts

AGENT COORDINATION:
- Route diagram generation to diagram_generator agent
- Route analysis tasks to analyzer agent
- Route modification requests to modifier agent
- Route SOLID evaluation to solid_analyzer agent
- Route documentation to doc_creator agent

OUTPUT FORMAT:
Always respond in valid JSON matching the provided schema. Include all generated diagrams, documentation, and architectural decisions.'

# Agents Configuration - Specialized Sub-Agents
AGENTS='{
  "diagram_generator": {
    "description": "Generates Mermaid diagrams from architectural descriptions",
    "prompt": "You are an expert Mermaid diagram generator. Analyze the architectural description and create accurate, comprehensive Mermaid diagrams. Support all diagram types: classDiagram, sequenceDiagram, flowchart, stateDiagram, erDiagram, C4Context. Return only valid Mermaid syntax with proper relationships, annotations, and styling. Ensure diagrams are clear, complete, and follow best practices for visual communication."
  },
  "class_diagram_specialist": {
    "description": "Creates detailed UML class diagrams with full relationships",
    "prompt": "You are a UML class diagram expert. Generate comprehensive Mermaid class diagrams from code or descriptions. Include all classes, interfaces, abstract classes, methods (with visibility), properties, relationships (inheritance, composition, aggregation, association), multiplicities, and design pattern implementations. Use proper UML notation and ensure accuracy."
  },
  "analyzer": {
    "description": "Analyzes existing diagrams and code for improvements",
    "prompt": "You are an expert in analyzing software architecture and Mermaid diagrams. Evaluate structure, clarity, completeness, and adherence to best practices. Identify strengths, weaknesses, missing elements, and improvement opportunities. Provide actionable recommendations for enhancing diagrams and architecture. Consider readability, maintainability, and scalability."
  },
  "solid_analyzer": {
    "description": "Evaluates code against SOLID principles with visual feedback",
    "prompt": "You are a SOLID principles expert and code quality analyzer. Examine code for adherence to Single Responsibility, Open-Closed, Liskov Substitution, Interface Segregation, and Dependency Inversion principles. Generate detailed analysis with specific violations and recommendations. Create Mermaid diagrams highlighting architectural strengths and weaknesses related to SOLID. Include refactoring suggestions with before/after visualizations."
  },
  "modifier": {
    "description": "Modifies existing Mermaid diagrams based on change requests",
    "prompt": "You are a Mermaid diagram modification specialist. Take existing diagram code and user change requirements. Apply modifications while preserving overall structure, clarity, and consistency. Support adding/removing elements, changing relationships, updating styling, reorganizing layout, and refactoring for better readability. Return only the modified Mermaid code with improvements applied."
  },
  "doc_creator": {
    "description": "Creates comprehensive documentation with integrated diagrams",
    "prompt": "You are a technical documentation expert. Create detailed architecture documentation including: system overview, component descriptions, design patterns used, technology stack, data flow, API specifications, deployment architecture, and development guidelines. Integrate Mermaid diagrams throughout documentation. Use clear markdown formatting with proper sections, tables, code blocks, and cross-references. Ensure documentation is complete, accurate, and maintainable."
  },
  "pattern_orchestrator": {
    "description": "Recommends and applies design patterns to architecture",
    "prompt": "You are a design patterns and architecture patterns expert. Analyze requirements to identify applicable patterns from: Creational (Factory, Singleton, Builder, Prototype), Structural (Adapter, Decorator, Facade, Proxy), Behavioral (Observer, Strategy, Command, State), and Architectural (Microservices, Event-Driven, CQRS, Layered, Hexagonal). Recommend patterns with justification, show implementation approach, and create diagrams illustrating pattern application. Consider trade-offs and context."
  }
}'

# JSON Schema - Structured Output Definition
SCHEMA='{
  "type": "object",
  "properties": {
    "architecture_overview": {
      "type": "object",
      "properties": {
        "project_name": {"type": "string"},
        "description": {"type": "string"},
        "architectural_style": {"type": "string"},
        "design_patterns": {
          "type": "array",
          "items": {"type": "string"}
        },
        "technology_stack": {
          "type": "object",
          "properties": {
            "languages": {"type": "array", "items": {"type": "string"}},
            "frameworks": {"type": "array", "items": {"type": "string"}},
            "databases": {"type": "array", "items": {"type": "string"}},
            "infrastructure": {"type": "array", "items": {"type": "string"}}
          }
        }
      },
      "required": ["project_name", "description", "architectural_style"]
    },
    "components": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": {"type": "string"},
          "type": {"type": "string"},
          "description": {"type": "string"},
          "responsibilities": {"type": "array", "items": {"type": "string"}},
          "dependencies": {"type": "array", "items": {"type": "string"}},
          "interfaces": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "name": {"type": "string"},
                "methods": {"type": "array", "items": {"type": "string"}}
              }
            }
          }
        },
        "required": ["name", "type", "description"]
      }
    },
    "diagrams": {
      "type": "object",
      "properties": {
        "class_diagram": {"type": "string"},
        "component_diagram": {"type": "string"},
        "sequence_diagram": {"type": "string"},
        "deployment_diagram": {"type": "string"},
        "state_diagram": {"type": "string"},
        "er_diagram": {"type": "string"}
      }
    },
    "relationships": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "from": {"type": "string"},
          "to": {"type": "string"},
          "type": {"type": "string"},
          "description": {"type": "string"}
        },
        "required": ["from", "to", "type"]
      }
    },
    "design_decisions": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "decision": {"type": "string"},
          "rationale": {"type": "string"},
          "alternatives_considered": {"type": "array", "items": {"type": "string"}},
          "trade_offs": {"type": "string"}
        },
        "required": ["decision", "rationale"]
      }
    },
    "quality_analysis": {
      "type": "object",
      "properties": {
        "solid_compliance": {
          "type": "object",
          "properties": {
            "single_responsibility": {"type": "string"},
            "open_closed": {"type": "string"},
            "liskov_substitution": {"type": "string"},
            "interface_segregation": {"type": "string"},
            "dependency_inversion": {"type": "string"}
          }
        },
        "strengths": {"type": "array", "items": {"type": "string"}},
        "weaknesses": {"type": "array", "items": {"type": "string"}},
        "recommendations": {"type": "array", "items": {"type": "string"}}
      }
    },
    "implementation_plan": {
      "type": "object",
      "properties": {
        "phases": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "phase_name": {"type": "string"},
              "components": {"type": "array", "items": {"type": "string"}},
              "duration_estimate": {"type": "string"},
              "dependencies": {"type": "array", "items": {"type": "string"}}
            }
          }
        },
        "testing_strategy": {"type": "string"},
        "deployment_approach": {"type": "string"}
      }
    },
    "documentation": {
      "type": "object",
      "properties": {
        "readme": {"type": "string"},
        "api_documentation": {"type": "string"},
        "developer_guide": {"type": "string"},
        "deployment_guide": {"type": "string"}
      }
    }
  },
  "required": ["architecture_overview", "components", "diagrams"]
}'

# Execute Claude with full configuration
claude \
  --print \
  --output-format stream-json \
  --input-format stream-json \
  --json-schema "$SCHEMA" \
  --mcp-config "$MCP_CONF" \
  --permission-mode bypassPermissions \
  --replay-user-messages \
  --strict-mcp-config \
  --system-prompt "$SYSTEM_PROMPT" \
  --agents "$AGENTS" \
  --model sonnet \
  --include-partial-messages \
  "$@"
