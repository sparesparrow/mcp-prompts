#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repos = [
  'mcp-prompts-contracts',
  'mcp-prompts-collection', 
  'mcp-prompts-ts',
  'mcp-prompts-rs',
  'mcp-prompts-pg',
  'mcp-prompts-aidl'
];

function generateReleaseNotes() {
  const notes = `# MCP Prompts Release Notes

## Latest Releases

### Core Packages

#### @sparesparrow/mcp-prompts-contracts v1.0.0
- **Initial Release**: API contracts and schemas for MCP Prompts
- **Features**:
  - TypeScript interfaces for all MCP operations
  - Zod schemas for runtime validation
  - Shared types across all implementations

#### @sparesparrow/mcp-prompts-collection v1.0.0
- **Initial Release**: Prompt collection and catalog system
- **Features**:
  - Curated prompt templates
  - Categorization system
  - Validation and testing utilities
  - Export/import functionality

#### @sparesparrow/mcp-prompts-ts v1.0.0
- **Initial Release**: TypeScript implementation of MCP Prompts server
- **Features**:
  - Express.js HTTP server
  - SSE support for real-time updates
  - Docker containerization
  - Comprehensive test suite

### Implementation Packages

#### mcp-prompts-rs v0.1.0
- **Initial Release**: Rust implementation of MCP Prompts server
- **Features**:
  - Actix-web HTTP server
  - PostgreSQL integration with SQLx
  - High-performance prompt processing
  - Memory-efficient storage

#### @sparesparrow/mcp-prompts-pg v1.0.0
- **Initial Release**: PostgreSQL schemas and utilities
- **Features**:
  - Database migration scripts
  - pgvector integration for embeddings
  - Connection pooling
  - Backup and restore utilities

#### @sparesparrow/mcp-prompts-aidl v1.0.0
- **Initial Release**: Android implementation with AIDL
- **Features**:
  - Kotlin Android app
  - Rust native service
  - AIDL interface for inter-process communication
  - Material Design UI

## Migration Notes

### From Monorepo to Multi-Repo
- All packages have been migrated to separate repositories
- CI/CD pipelines configured for each package
- Cross-package dependencies properly managed
- Documentation updated across all repositories

### Breaking Changes
- None in this release (all packages are initial releases)

### Deprecations
- Monorepo structure is deprecated
- Use individual packages instead

## Installation

\`\`\`bash
# Core packages
npm install @sparesparrow/mcp-prompts-contracts
npm install @sparesparrow/mcp-prompts-collection
npm install @sparesparrow/mcp-prompts-ts

# Database
npm install @sparesparrow/mcp-prompts-pg

# Android
npm install @sparesparrow/mcp-prompts-aidl

# Rust (via Cargo)
cargo add mcp-prompts-rs
\`\`\`

## Quick Start

\`\`\`typescript
import { MCPPromptsServer } from '@sparesparrow/mcp-prompts-ts';
import { PromptCollection } from '@sparesparrow/mcp-prompts-collection';

const server = new MCPPromptsServer({
  port: 3000,
  collection: new PromptCollection()
});

server.start();
\`\`\`

## Compatibility

All packages are compatible with:
- Node.js 18+
- Rust 1.70+
- Java 17+
- PostgreSQL 15+
- Android API 24+

## Support

- **Documentation**: [docs/](https://github.com/sparesparrow/mcp-prompts/tree/main/docs)
- **Issues**: [GitHub Issues](https://github.com/sparesparrow/mcp-prompts/issues)
- **Discussions**: [GitHub Discussions](https://github.com/sparesparrow/mcp-prompts/discussions)

*Generated on: ${new Date().toISOString()}*
`;

  return notes;
}

// Write to file
const notesContent = generateReleaseNotes();
fs.writeFileSync(path.join(__dirname, '../docs/release-notes.md'), notesContent);
console.log('✅ Release notes generated successfully'); 