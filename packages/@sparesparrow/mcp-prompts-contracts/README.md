# @sparesparrow/mcp-prompts-contracts

[![npm version](https://badge.fury.io/js/%40sparesparrow%2Fmcp-prompts-contracts.svg)](https://badge.fury.io/js/%40sparesparrow%2Fmcp-prompts-contracts)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](http://www.typescriptlang.org/)

Shared TypeScript types and validation schemas for the MCP Prompts ecosystem.

## Overview

This package provides a unified set of TypeScript types, interfaces, and Zod validation schemas used across the MCP Prompts ecosystem. It serves as the single source of truth for data contracts between different components.

## Features

- **Type Safety**: Complete TypeScript definitions for all MCP Prompts domain entities
- **Runtime Validation**: Zod schemas for robust data validation
- **MCP Compliance**: Types aligned with Model Context Protocol specification
- **Zero Dependencies**: Only depends on `zod` for validation
- **ESM Support**: Modern ES modules with proper tree-shaking

## Installation

```bash
npm install @sparesparrow/mcp-prompts-contracts
# or
pnpm add @sparesparrow/mcp-prompts-contracts
# or
yarn add @sparesparrow/mcp-prompts-contracts
```

## Usage

### Core Types

```typescript
import type { 
  Prompt, 
  TemplateVariable, 
  ListPromptsOptions,
  ApplyTemplateResult 
} from '@sparesparrow/mcp-prompts-contracts';

// Use types for your domain objects
const myPrompt: Prompt = {
  id: 'my-prompt',
  name: 'Example Prompt',
  content: 'Hello {{name}}!',
  isTemplate: true,
  version: 1,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  variables: ['name']
};
```

### Validation Schemas

```typescript
import { promptSchemas } from '@sparesparrow/mcp-prompts-contracts';

// Validate prompt creation data
const createData = {
  name: 'My Prompt',
  content: 'Hello world!',
  isTemplate: false
};

const validatedData = promptSchemas.create.parse(createData);
```

### Configuration Types

```typescript
import type { ServerConfig, StorageAdapter } from '@sparesparrow/mcp-prompts-contracts';

const config: ServerConfig = {
  name: 'mcp-prompts-server',
  version: '1.0.0',
  transport: 'stdio',
  storage: {
    type: 'file',
    config: {
      promptsDir: './prompts'
    }
  }
};
```

## API Reference

### Core Types

- **`Prompt`**: Main prompt entity with metadata, content, and versioning
- **`TemplateVariable`**: Variable definition for template prompts
- **`PromptSequence`**: Sequence of related prompts for workflows
- **`WorkflowExecutionState`**: State management for workflow execution

### Parameter Types

- **`CreatePromptParams`**: Parameters for creating new prompts
- **`UpdatePromptParams`**: Parameters for updating existing prompts
- **`ListPromptsOptions`**: Filtering and pagination options for listing prompts
- **`ApplyTemplateParams`**: Parameters for template variable substitution

### Result Types

- **`ApplyTemplateResult`**: Result of template application with metadata
- **`ToolResponse`**: MCP tool response format

### Configuration Types

- **`ServerConfig`**: Complete server configuration interface
- **`StorageAdapter`**: Storage backend configuration options

### Validation Schemas

- **`promptSchemas`**: Complete set of Zod schemas for prompt operations
  - `create`: Validate prompt creation data
  - `update`: Validate prompt updates
  - `list`: Validate listing parameters
  - `full`: Validate complete prompt objects
- **`workflowSchema`**: Schema for workflow definitions
- **`workflowStepSchema`**: Schema for individual workflow steps

## Schema Inference

You can infer TypeScript types from Zod schemas:

```typescript
import type { CreatePromptArgs, ListPromptsArgs } from '@sparesparrow/mcp-prompts-contracts';

// These are automatically inferred from the corresponding Zod schemas
function createPrompt(args: CreatePromptArgs) {
  // Implementation
}

function listPrompts(options: ListPromptsArgs) {
  // Implementation  
}
```

## Version Compatibility

| Contracts Version | MCP SDK Version | Node Version |
|------------------|----------------|--------------|
| 0.1.x            | ^1.6.0         | >=20.0.0     |

## Development

```bash
# Install dependencies
pnpm install

# Build the package
pnpm build

# Type checking
pnpm typecheck

# Clean build artifacts
pnpm clean
```

## Contributing

Please read our [Contributing Guide](../../CONTRIBUTING.md) for details on our development process.

## License

MIT License - see [LICENSE](../../LICENSE) file for details.

## Related Packages

- [`@sparesparrow/mcp-prompts-catalog`](../mcp-prompts-catalog) - Curated prompt catalog
- [`@sparesparrow/mcp-prompts-core`](../core) - Core business logic
- [`@sparesparrow/mcp-prompts-adapters-*`](../adapters-file) - Storage adapters
