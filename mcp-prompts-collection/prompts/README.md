# MCP Prompts Collection

This directory contains a collection of prompt templates that can be used with the MCP Prompts server. These prompts are designed to showcase advanced template capabilities and integration with multiple MCP servers.

## Prompt Categories

### Development Assistance

- **Development System Prompt** (`development-system-prompt.json`): A template for creating system prompts for development assistance
- **Development Workflow** (`development-workflow.json`): A guide for establishing development workflows and best practices
- **Code Review Assistant** (`code-review-assistant.json`): A template for conducting thorough code reviews

### Project Analysis and Planning

- **Project Analysis Assistant** (`project-analysis-assistant.json`): A template for analyzing project structure and architecture
- **Monorepo Migration Guide** (`monorepo-migration-guide.json`): Guidance for migrating projects to a monorepo structure
- **Data Analysis Template** (`data-analysis-template.json`): Framework for analyzing data and generating insights

### Infrastructure and DevOps

- **Docker Containerization Guide** (`docker-containerization-guide.json`): Instructions for containerizing applications
- **Docker Compose Prompt Combiner** (`docker-compose-prompt-combiner.json`): Complex template for generating Docker Compose configurations

### MCP Integration and Resources

- **MCP Integration Assistant** (`mcp-integration-assistant.json`): Comprehensive template for coordinating multiple MCP servers
- **MCP Resources Explorer** (`mcp-resources-explorer.json`): Template for discovering and utilizing resources across MCP servers
- **Repository Explorer** (`repository-explorer.json`): Template for exploring and analyzing code repositories
- **Database Query Assistant** (`database-query-assistant.json`): Helper for constructing and optimizing database queries
- **Multi-Resource Context** (`multi-resource-context.json`): Template for working with multiple resources in a unified context
- **MCP Server Integration Guide** (`mcp-server-integration-template.json`): A detailed template for planning, configuring, and integrating multiple MCP servers into a cohesive ecosystem
- **Advanced Multi-Server Integration Template** (`advanced-multi-server-template.json`): A comprehensive template that coordinates multiple MCP servers for complex tasks requiring diverse capabilities

## Using MCP Integration Prompts

The MCP Integration prompts are designed to work with multiple MCP servers simultaneously. To use these prompts effectively:

1. Ensure you have the necessary MCP servers configured in your environment
2. Use the appropriate template variables to customize the prompt for your specific use case
3. Follow the prompt's structured approach for integrating multiple MCP servers

### Example: Using the MCP Integration Assistant

```json
{
  "task_description": "Analyze a GitHub repository to identify potential security vulnerabilities",
  "required_skills": "security analysis, code review, vulnerability assessment",
  "task_type": "security audit",
  "additional_servers": "brave-search: Search for latest security advisories related to technologies used",
  "additional_guidelines": "Focus on authentication, authorization, data validation, and secure data handling"
}
```

This would generate a comprehensive prompt that guides Claude through using:

- GitHub MCP server to analyze repository code
- Memory MCP server to retain findings
- Prompt Manager to apply specialized security review templates
- Sequential Thinking to break down the analysis
- Brave Search to find current security advisories

### Example: Using the MCP Resources Explorer

```json
{
  "resource_context": "A microservices application with services across multiple repositories, shared libraries, and a distributed database",
  "exploration_task": "Map service dependencies and data flows to identify potential bottlenecks",
  "task_type": "performance analysis",
  "additional_resource_servers": "brave-search: Research best practices for microservice architecture",
  "custom_guidelines": "Pay special attention to cross-service transaction patterns and database access"
}
```

## Template Variables and Substitution

Most prompts in this collection use template variables, indicated by `{{variable_name}}` in the content. When applying a template, provide values for all required variables.

### Variable Types

- **Simple text variables**: Replace with a single value (e.g., `{{project_name}}`)
- **Multiline text variables**: Can span multiple lines (e.g., `{{technical_context}}`)
- **List variables**: Can be expanded into a list (e.g., `{{required_skills}}`)
- **Code variables**: For code snippets (e.g., `{{code_example}}`)

## Creating Custom Prompts

You can create your own prompt templates by following these steps:

1. Create a new JSON file in this directory
2. Use the standard prompt structure (see below)
3. Define variables using the `{{variable_name}}` syntax
4. Set `isTemplate` to `true`
5. List all variables in the `variables` array

### Standard Prompt Structure

```json
{
  "id": "unique-prompt-id",
  "name": "Human-Readable Prompt Name",
  "description": "Brief description of the prompt's purpose",
  "content": "The actual prompt content with {{variables}}",
  "isTemplate": true,
  "variables": ["list", "of", "variable", "names"],
  "tags": ["relevant", "tags"],
  "createdAt": "2025-03-15T12:00:00.000Z",
  "updatedAt": "2025-03-15T12:00:00.000Z",
  "version": 1,
  "metadata": {
    "additional": "metadata",
    "as": "needed"
  }
}
```

## Advanced MCP Integration Techniques

When creating prompts that integrate with multiple MCP servers, consider these techniques:

### 1. Resource URI References

Use the `@server-name:resource-path` syntax to reference resources across MCP servers:

```
@filesystem:/path/to/config.json
@github:owner/repo/src/main.js
@postgres:database/schema/table
```

### 2. Sequential Processing

Break down complex tasks into sequential steps, with each step leveraging appropriate MCP servers:

1. Discovery phase: Use `resources/list` to identify available resources
2. Analysis phase: Use specialized MCP servers to analyze specific resources
3. Integration phase: Combine insights from multiple sources
4. Action phase: Implement changes or recommendations

### 3. Context Preservation

Use the memory MCP server to retain important context between sessions:

```
// Store an insight
use_mcp_tool({
  server_name: "memory",
  tool_name: "store",
  arguments: {
    key: "security_findings",
    value: {
      findings: ["finding1", "finding2"],
      severity: "high"
    }
  }
});

// Retrieve the insight later
use_mcp_tool({
  server_name: "memory",
  tool_name: "retrieve",
  arguments: {
    key: "security_findings"
  }
});
```

## Contributing New Prompts

When adding new prompts to this collection:

1. Follow the standard prompt structure
2. Include comprehensive documentation in the prompt description
3. Use meaningful tags for categorization
4. Specify all variables and provide examples in metadata
5. Test the prompt with different variable values

## Resource-Enabled Prompts

Our resource-enabled prompts leverage the MCP resources integration to provide advanced contextual capabilities. These prompts can access and utilize data from various MCP servers to provide richer, more contextual assistance.

### What are Resource-Enabled Prompts?

Resource-enabled prompts are templates that include references to external resources using the `@resource://` URI syntax. When these prompts are processed, the MCP Prompts server resolves these references by fetching data from the appropriate MCP resource servers.

### Resource URI Syntax

Resource URIs follow this pattern:

```
@resource://<server-type>/<resource-type>/<resource-identifier>
```

For example:

- `@resource://filesystem/path/to/file.txt` - References a file in the filesystem
- `@resource://github/repo/owner/repo-name` - References a GitHub repository
- `@resource://postgres/schema/database-name` - References a PostgreSQL database schema

### Using Resource-Enabled Prompts

To use a resource-enabled prompt:

1. Ensure you have the required MCP servers configured in your environment
2. Retrieve the prompt template using its ID
3. Apply variables to the template, including resource paths
4. The MCP Prompts server will process the template and resolve resource references

```javascript
// Example: Using the Project Analysis Assistant
const result = await mcpClient.applyTemplate({
  id: 'project-analysis-assistant',
  variables: {
    language: 'JavaScript',
    project_path: 'projects/my-project',
    specific_focus: 'API design patterns',
  },
});
```

### Required MCP Servers by Template

| Template                   | Required MCP Servers                    |
| -------------------------- | --------------------------------------- |
| Project Analysis Assistant | filesystem                              |
| Repository Explorer        | github                                  |
| Database Query Assistant   | postgres                                |
| Multi-Resource Context     | filesystem, github, postgres, puppeteer |

## Implementing Resources/List

The `resources/list` method is implemented to allow discovery of available resources that can be used with these prompts:

```javascript
// Example: Discovering available resources
const resources = await mcpClient.callTool({
  server_name: "prompts",
  tool_name: "resources/list",
  arguments: {}
});

// Example response
{
  "resources": [
    {
      "id": "project-files",
      "name": "Project Files",
      "description": "Local filesystem access to project files",
      "type": "filesystem",
      "uri": "resource://filesystem/projects"
    },
    {
      "id": "github-repos",
      "name": "GitHub Repositories",
      "description": "Access to GitHub repositories",
      "type": "github",
      "uri": "resource://github/repo"
    },
    // additional resources...
  ]
}
```

## Advanced Usage Patterns

### Combining Multiple Resources

The Multi-Resource Context template demonstrates how to combine multiple resource types for comprehensive context:

```javascript
const result = await mcpClient.applyTemplate({
  id: 'multi-resource-context',
  variables: {
    project_path: 'projects/my-api',
    owner: 'my-org',
    repo_name: 'api-service',
    database_name: 'api_db',
    web_url: 'https://api-docs.example.com',
    project_type: 'REST API service',
    project_name: 'Customer API',
    filesystem_focus: 'Focus on the src/controllers directory',
    github_focus: 'Look at recent pull requests related to authentication',
    database_focus: 'Examine the customer table relationships',
    web_focus: 'Compare implementation with the public API docs',
  },
});
```

### Conditional Resource Usage

Many templates use conditional logic to include resources only when needed:

```handlebars
{{#if specific_file_path}}
  Focus specifically on: @resource://github/file/{{owner}}/{{repo_name}}/{{specific_file_path}}
{{/if}}
```

This allows for flexible templates that can adapt to different usage scenarios.

## Creating Your Own Resource-Enabled Prompts

To create your own resource-enabled prompts:

1. Define a template with variables for resource paths
2. Use the `@resource://` syntax to reference external resources
3. Specify required MCP servers in the metadata
4. Use conditional blocks to handle optional resource references

Example template structure:

```json
{
  "id": "my-resource-template",
  "name": "My Resource Template",
  "description": "Template using external resources",
  "content": "Analyze the file at @resource://filesystem/{{file_path}}",
  "isTemplate": true,
  "variables": ["file_path"],
  "tags": ["resource-enabled"],
  "metadata": {
    "requires": ["filesystem"],
    "resourcePatterns": ["filesystem/{{file_path}}"]
  }
}
```

## Best Practices for Resource-Enabled Prompts

1. **Clear Resource Dependencies** - Clearly document which MCP servers are required
2. **Error Handling** - Include conditional logic for handling missing or inaccessible resources
3. **Resource Scoping** - Limit resource access to what's necessary for the prompt
4. **Performance Considerations** - Be mindful of large resource requests that might impact performance
5. **Security Awareness** - Avoid exposing sensitive data through resource paths
6. **Consistent Pattern Usage** - Follow established URI patterns for resource references
7. **Documentation** - Thoroughly document how resources are used in your templates
8. **Fallback Options** - Provide alternatives when resources aren't available

## Contributing New Templates

To contribute new templates to this collection:

1. Create a JSON file following the template format
2. Ensure your template includes appropriate metadata and tags
3. Add clear documentation about required resources
4. Test with various resource configurations
5. Update this README with information about your template
