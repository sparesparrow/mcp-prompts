# @sparesparrow/mcp-prompts-catalog

[![npm version](https://badge.fury.io/js/%40sparesparrow%2Fmcp-prompts-catalog.svg)](https://badge.fury.io/js/%40sparesparrow%2Fmcp-prompts-catalog)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](http://www.typescriptlang.org/)

A curated collection of prompts and templates for the MCP (Model Context Protocol) ecosystem.

## Overview

This package provides a comprehensive catalog of ready-to-use prompts covering various domains including development, documentation, database optimization, and MCP server setup. All prompts are type-safe and validated against the MCP Prompts contracts.

## Features

- **🎯 Curated Prompts**: Hand-crafted prompts for common use cases
- **🔧 Template Support**: Variable substitution with validation
- **📝 Rich Metadata**: Comprehensive tagging and categorization
- **🚀 MCP Ready**: Fully compatible with MCP protocol
- **📦 TypeScript**: Full type safety with IntelliSense support
- **🔍 Searchable**: Easy filtering by category, tags, and content

## Installation

```bash
npm install @sparesparrow/mcp-prompts-catalog
# or
pnpm add @sparesparrow/mcp-prompts-catalog
# or
yarn add @sparesparrow/mcp-prompts-catalog
```

## Usage

### Basic Usage

```typescript
import catalog from '@sparesparrow/mcp-prompts-catalog';

// Get all available categories
const categories = catalog.getCategories();
console.log(categories); // ['Development', 'Documentation', 'Database', 'MCP Integration']

// List prompts in a category
const devPrompts = catalog.listPrompts('Development');
console.log(devPrompts); // ['Code Review Assistant', ...]

// Load a specific prompt
const codeReview = catalog.loadPrompt('Code Review Assistant');
console.log(codeReview?.content);
```

### Advanced Usage

```typescript
import { catalog, type PromptsCatalog } from '@sparesparrow/mcp-prompts-catalog';
import type { Prompt } from '@sparesparrow/mcp-prompts-contracts';

// Get all prompts
const allPrompts: Prompt[] = catalog.getAllPrompts();

// Find prompts by criteria
const templates = allPrompts.filter(p => p.isTemplate);
const sqlPrompts = allPrompts.filter(p => 
  p.tags?.includes('sql') || p.category === 'Database'
);
```

### Template Variables

Many prompts support template variables for customization:

```typescript
const sqlOptimizer = catalog.loadPrompt('SQL Query Optimizer');
if (sqlOptimizer?.isTemplate && sqlOptimizer.variables) {
  console.log('Required variables:', sqlOptimizer.variables);
  
  // Example usage with template engine:
  const variables = {
    query: 'SELECT * FROM users WHERE active = 1',
    database_type: 'postgresql',
    table_size: '1M rows'
  };
  // Apply variables using your template engine...
}
```

## Available Prompts

### Development Category

#### Code Review Assistant
Comprehensive code analysis covering security, performance, and best practices.
- **Variables**: `language`, `code`
- **Tags**: `code-review`, `security`, `performance`, `best-practices`

### Documentation Category

#### API Documentation Generator  
Creates comprehensive API documentation with OpenAPI 3.0 format.
- **Variables**: `method`, `endpoint`, `parameters`
- **Tags**: `api`, `documentation`, `openapi`, `swagger`

### Database Category

#### SQL Query Optimizer
Optimizes SQL queries for better performance with detailed analysis.
- **Variables**: `query`, `database_type`, `table_size`, `performance_issues`
- **Tags**: `sql`, `optimization`, `database`, `performance`

### MCP Integration Category

#### MCP Server Configuration Assistant
Complete setup guide for MCP servers with code examples.
- **Variables**: `server_type`, `language`, `features`
- **Tags**: `mcp`, `server`, `setup`, `configuration`

## API Reference

### Catalog Interface

```typescript
interface PromptsCatalog {
  getCategories(): string[];
  listPrompts(category?: string): string[];
  loadPrompt(name: string, category?: string): Prompt | null;
  getAllPrompts(): Prompt[];
}
```

### Methods

- **`getCategories()`**: Returns all available categories
- **`listPrompts(category?)`**: Lists prompt names, optionally filtered by category
- **`loadPrompt(name, category?)`**: Loads a specific prompt by name and optional category
- **`getAllPrompts()`**: Returns all prompts as an array

## Integration with MCP Servers

This catalog is designed to work seamlessly with MCP servers:

```typescript
// MCP Server integration example
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import catalog from '@sparesparrow/mcp-prompts-catalog';

const server = new McpServer({ name: 'prompt-catalog', version: '1.0.0' });

// Register catalog prompts as MCP resources
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const prompts = catalog.getAllPrompts();
  return {
    resources: prompts.map(prompt => ({
      uri: `prompt://${prompt.id}`,
      name: prompt.name,
      description: prompt.description,
      mimeType: 'text/plain'
    }))
  };
});
```

## Validation and Quality

All prompts in this catalog are:
- ✅ Validated against the contracts schema
- ✅ Tested for template variable consistency  
- ✅ Reviewed for clarity and effectiveness
- ✅ Tagged and categorized appropriately

## Contributing

We welcome contributions of new prompts! Please ensure:

1. Follow the established prompt format
2. Include appropriate variables and metadata
3. Add comprehensive tags and categories
4. Test template functionality
5. Update documentation

See our [Contributing Guide](../../CONTRIBUTING.md) for detailed instructions.

## Version Compatibility

| Catalog Version | Contracts Version | Description |
|----------------|------------------|-------------|
| 1.x.x          | ^0.1.0           | Initial release with core prompts |

## License

MIT License - see [LICENSE](../../LICENSE) file for details.

## Related Packages

- [`@sparesparrow/mcp-prompts-contracts`](../mcp-prompts-contracts) - Type definitions and schemas
- [`@sparesparrow/mcp-prompts-core`](../core) - Core business logic
- [`@sparesparrow/mcp-prompts-adapters-*`](../adapters-file) - Storage adapters
