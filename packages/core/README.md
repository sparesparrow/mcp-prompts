# @sparesparrow/mcp-prompts-core

Core domain logic for the MCP Prompts Server, implementing clean hexagonal architecture with TypeScript.

## 🏗️ Architecture

This package follows the **Hexagonal Architecture** (Ports & Adapters) pattern:

```
┌─────────────────────────────────────────────────────────────┐
│                    Core Domain Layer                        │
├─────────────────────────────────────────────────────────────┤
│  Entities          │  Value Objects     │  Use Cases       │
│  • Prompt         │  • PromptId        │  • addPrompt     │
│  • Template       │  • Tag             │  • getPrompt     │
│  • Category       │  • TemplateVariable│  • listPrompts   │
│  • User           │                     │  • updatePrompt  │
│                    │                     │  • deletePrompt  │
│                    │                     │  • applyTemplate │
│                    │                     │  • validatePrompt│
│                    │                     │  • searchPrompts │
│                    │                     │  • getPromptStats│
├─────────────────────────────────────────────────────────────┤
│                    Ports (Interfaces)                       │
│  • IPromptRepository    │  • ITemplatingEngine             │
│  • IPromptApplication   │  • IEventPublisher               │
│  • ISecurityValidator   │                                   │
└─────────────────────────────────────────────────────────────┘
```

## 📦 Package Structure

```
src/
├── entities/           # Domain entities
│   ├── Prompt.ts      # Prompt entity with validation
│   ├── TemplateVariable.ts # Template variable entity
│   ├── PromptSequence.ts   # Workflow sequence entity
│   ├── Category.ts    # Category entity
│   └── User.ts        # User entity
├── value-objects/      # Immutable value objects
│   ├── PromptId.ts    # UUID v7 prompt identifier
│   ├── Tag.ts         # Validated tag with regex
│   └── TemplateVariable.ts # Template variable value object
├── ports/             # Interface definitions
│   ├── IPromptRepository.ts    # Storage interface
│   ├── IPromptApplication.ts   # Application interface
│   ├── ITemplatingEngine.ts    # Template engine interface
│   ├── IEventPublisher.ts      # Event publishing interface
│   └── ISecurityValidator.ts   # Security validation interface
├── use-cases/         # Business logic
│   ├── addPrompt.ts   # Add new prompt
│   ├── getPromptById.ts # Get prompt by ID
│   ├── listPrompts.ts # List prompts with filtering
│   ├── updatePrompt.ts # Update existing prompt
│   ├── deletePrompt.ts # Delete prompt
│   ├── applyTemplate.ts # Apply template variables
│   ├── validatePrompt.ts # Validate prompt
│   ├── searchPrompts.ts # Search prompts
│   └── getPromptStats.ts # Get prompt statistics
├── schemas.ts         # Zod validation schemas
├── errors.ts          # Custom error classes
├── config.ts          # Configuration management
├── utils.ts           # Utility functions
├── types/             # Type definitions
└── index.ts           # Main export file
```

## 🚀 Quick Start

```typescript
import { 
  Prompt, 
  PromptId, 
  Tag, 
  TemplateVariable,
  validatePrompt,
  addPrompt 
} from '@sparesparrow/mcp-prompts-core';

// Create a new prompt
const prompt: Prompt = {
  id: PromptId.generate().toString(),
  name: 'Code Review Assistant',
  content: 'Please review this code: {{code}}',
  isTemplate: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  version: 1,
  description: 'AI assistant for code review',
  category: 'development',
  tags: [Tag.sanitize('code-review').toString()],
  variables: [TemplateVariable.create('code', 'Code to review').toObject()]
};

// Validate the prompt
await validatePrompt(prompt);
```

## 🔧 Core Features

### Entities
- **Prompt**: Core prompt entity with versioning support
- **TemplateVariable**: Template variable with validation
- **PromptSequence**: Workflow sequence for complex operations
- **Category**: Prompt categorization system
- **User**: User management and authentication

### Value Objects
- **PromptId**: UUID v7 identifier with validation
- **Tag**: Regex-validated tags for categorization
- **TemplateVariable**: Immutable template variable representation

### Use Cases
- **Prompt Management**: CRUD operations for prompts
- **Template System**: Variable substitution and validation
- **Search & Filtering**: Advanced prompt discovery
- **Statistics**: System analytics and reporting
- **Validation**: Comprehensive prompt validation

### Ports
- **IPromptRepository**: Storage abstraction
- **IPromptApplication**: Application service interface
- **ITemplatingEngine**: Template processing interface
- **IEventPublisher**: Event system interface
- **ISecurityValidator**: Security validation interface

## 📋 Requirements

- Node.js >= 20.0.0
- TypeScript >= 5.8.0
- Zod for schema validation

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Type checking
npm run typecheck
```

## 🔗 Dependencies

- `@sparesparrow/mcp-prompts-contracts`: Shared type definitions
- `@sparesparrow/mcp-prompts-catalog`: Prompt catalog
- `zod`: Schema validation

## 📚 API Reference

### Prompt Entity

```typescript
interface Prompt {
  id: string;
  name: string;
  content: string;
  isTemplate: boolean;
  createdAt: string;
  updatedAt: string;
  version: number;
  description?: string;
  category?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
  variables?: (string | TemplateVariable)[];
}
```

### PromptId Value Object

```typescript
class PromptId {
  static generate(): PromptId;
  static fromString(value: string): PromptId;
  static fromName(name: string): PromptId;
  static isValid(value: string): boolean;
  toString(): string;
  equals(other: PromptId): boolean;
}
```

### Validation Functions

```typescript
// Validate prompt
await validatePrompt(prompt: Prompt): Promise<boolean>;

// Validate prompt content for security
validatePromptContent(content: string): boolean;

// Validate template variables
validateTemplateVariables(content: string, variables: TemplateVariable[]): boolean;
```

## 🏷️ Versioning

This package follows [Semantic Versioning](https://semver.org/):
- **Major**: Breaking changes in public API
- **Minor**: New features, backward compatible
- **Patch**: Bug fixes, backward compatible

## 📄 License

MIT License - see [LICENSE](../../LICENSE) for details.

## 🤝 Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for contribution guidelines.

## 🔗 Related Packages

- `@sparesparrow/mcp-prompts-adapters-file`: File storage adapter
- `@sparesparrow/mcp-prompts-adapters-postgres`: PostgreSQL adapter
- `@sparesparrow/mcp-prompts-adapters-memory`: In-memory adapter
- `@sparesparrow/mcp-prompts-adapters-mcp`: MCP protocol adapter
