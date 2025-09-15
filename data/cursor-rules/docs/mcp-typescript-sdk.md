# MCP Rules Structure Plan

## Core Server Rules

1. `mcp-server-core.rules`
```yaml
description: Core rules for MCP server implementation and lifecycle management
globs: ["src/**/server/**/*.{ts,js,tsx,jsx}"]
```
Purpose: Define fundamental server implementation requirements, initialization, and lifecycle management

2. `mcp-server-capabilities.rules`
```yaml
description: Guidelines for implementing MCP server capabilities and feature flags
globs: ["src/**/capabilities/**/*.{ts,js,tsx,jsx}"]
```
Purpose: Rules for implementing and managing server capabilities like resources, tools, and prompts

## Resource Rules

3. `mcp-resources.rules`
```yaml
description: Implementation guidelines for MCP resources and resource templates
globs: ["src/**/resources/**/*.{ts,js,tsx,jsx}"]
```
Purpose: Define resource implementation patterns, URI handling, and content management

4. `mcp-resource-templates.rules`
```yaml
description: Rules for implementing dynamic resource templates and URI patterns
globs: ["src/**/resources/templates/**/*.{ts,js,tsx,jsx}"]
```
Purpose: Specific rules for template-based dynamic resources

## Tool Rules

5. `mcp-tools.rules`
```yaml
description: Guidelines for implementing MCP tools and tool handlers
globs: ["src/**/tools/**/*.{ts,js,tsx,jsx}"]
```
Purpose: Define tool implementation patterns, argument validation, and execution flow

6. `mcp-tools-advanced.rules`
```yaml
description: Advanced patterns for MCP tools including progress reporting and cancellation
globs: ["src/**/tools/advanced/**/*.{ts,js,tsx,jsx}"]
```
Purpose: Cover advanced tool features like progress tracking and cancellation

## Transport Rules

7. `mcp-transport-core.rules`
```yaml
description: Core rules for implementing MCP transports
globs: ["src/**/transport/**/*.{ts,js,tsx,jsx}"]
```
Purpose: Define basic transport implementation requirements

8. `mcp-transport-stdio.rules`
```yaml
description: Implementation rules for stdio-based MCP transports
globs: ["src/**/transport/stdio/**/*.{ts,js,tsx,jsx}"]
```
Purpose: Specific rules for stdio transport implementation

9. `mcp-transport-sse.rules`
```yaml
description: Implementation rules for SSE-based MCP transports
globs: ["src/**/transport/sse/**/*.{ts,js,tsx,jsx}"]
```
Purpose: Specific rules for SSE transport implementation

## Client Rules

10. `mcp-client-core.rules`
```yaml
description: Core rules for implementing MCP clients
globs: ["src/**/client/**/*.{ts,js,tsx,jsx}"]
```
Purpose: Define client implementation patterns and requirements

11. `mcp-client-capabilities.rules`
```yaml
description: Guidelines for implementing client capabilities and feature detection
globs: ["src/**/client/capabilities/**/*.{ts,js,tsx,jsx}"]
```
Purpose: Rules for implementing client-side capabilities

## Security Rules

12. `mcp-security.rules`
```yaml
description: Security requirements and best practices for MCP implementations
globs: ["src/**/*.{ts,js,tsx,jsx}"]
```
Purpose: Cross-cutting security concerns and requirements

## Testing Rules

13. `mcp-testing.rules`
```yaml
description: Testing requirements and patterns for MCP components
globs: ["test/**/*.{ts,js,tsx,jsx}"]
```
Purpose: Define testing requirements and patterns

14. `mcp-integration-testing.rules`
```yaml
description: Integration testing patterns for MCP implementations
globs: ["test/integration/**/*.{ts,js,tsx,jsx}"]
```
Purpose: Specific rules for integration testing

## Project Structure Rules

15. `mcp-project-structure.rules`
```yaml
description: Project structure and organization requirements for MCP implementations
globs: ["**/*.{ts,js,tsx,jsx}"]
```
Purpose: Define project layout and organization requirements

## Development Process Rules

16. `mcp-development-process.rules`
```yaml
description: Development workflow and process requirements for MCP implementations
globs: ["**/*"]
```
Purpose: Define development workflow requirements

## Implementation Order

1. Start with core structural rules:
   - Project structure
   - Server core
   - Client core

2. Move to core protocol features:
   - Resources
   - Tools
   - Transport core

3. Add capability implementations:
   - Server capabilities
   - Client capabilities
   - Resource templates
   - Advanced tools

4. Add transport specifics:
   - stdio transport
   - SSE transport

5. Add cross-cutting concerns:
   - Security
   - Testing
   - Development process

This structure allows for:
- Clear separation of concerns
- Granular rule application based on file paths
- Progressive implementation of features
- Easy maintenance and updates
- Clear documentation organization

Each rule file will follow a consistent structure:
1. Header with metadata (description and globs)
2. Purpose and scope
3. Core requirements
4. Implementation patterns
5. Examples
6. Common pitfalls
7. Testing requirements