# Using the MCP Prompts Server

This guide provides examples of how to use the MCP Prompts server with Claude Desktop.

## Accessing Prompts

### Listing Available Prompts

To see what prompts are available:

```
I need to see what prompts are available in the MCP Prompts server.

use_mcp_tool({
  server_name: "mcp-prompts",
  tool_name: "list_prompts",
  arguments: {}
});
```

To filter by tags:

```
Show me all development-related prompts.

use_mcp_tool({
  server_name: "mcp-prompts",
  tool_name: "list_prompts",
  arguments: {
    tags: ["development"]
  }
});
```

You can also filter by category, template status, or use search:

```
Show me all template prompts in the development category containing "workflow".

use_mcp_tool({
  server_name: "mcp-prompts",
  tool_name: "list_prompts",
  arguments: {
    isTemplate: true,
    category: "development",
    search: "workflow"
  }
});
```

### Getting a Specific Prompt

To retrieve a specific prompt by ID:

```
I need the development workflow prompt.

use_mcp_tool({
  server_name: "mcp-prompts",
  tool_name: "get_prompt",
  arguments: {
    id: "development-workflow"
  }
});
```

### Using a Template Prompt

To apply variables to a template prompt:

```
I need a development system prompt for my React project.

use_mcp_tool({
  server_name: "mcp-prompts",
  tool_name: "apply_template",
  arguments: {
    id: "development-system-prompt",
    variables: {
      "project_type": "web frontend",
      "language": "JavaScript/React",
      "project_name": "TaskManager",
      "project_goal": "create a task management application with drag-and-drop functionality",
      "technical_context": "Using React 18, TypeScript, and Material UI"
    }
  }
});
```

### Using MCP Prompts Protocol

Claude Desktop will automatically detect prompts from the server. Type "/" in the input box to see available prompts.

## Managing Prompts

### Adding a New Prompt

To add a new prompt:

```
I want to add a new prompt to the MCP Prompts server.

use_mcp_tool({
  server_name: "mcp-prompts",
  tool_name: "add_prompt",
  arguments: {
    prompt: {
      name: "Bug Report Template",
      description: "Template for submitting bug reports",
      content: "## Bug Report\n\n### Description\n{{description}}\n\n### Steps to Reproduce\n{{steps}}\n\n### Expected Behavior\n{{expected}}\n\n### Actual Behavior\n{{actual}}\n\n### Environment\n{{environment}}",
      isTemplate: true,
      tags: ["bug", "template", "documentation"],
      category: "development"
    }
  }
});
```

### Updating an Existing Prompt

To update an existing prompt:

```
I need to update the development workflow prompt.

use_mcp_tool({
  server_name: "mcp-prompts",
  tool_name: "update_prompt",
  arguments: {
    id: "development-workflow",
    prompt: {
      content: "Updated workflow content here...",
      tags: ["development", "workflow", "python", "updated"]
    }
  }
});
```

### Deleting a Prompt

To delete a prompt:

```
I want to delete the outdated prompt.

use_mcp_tool({
  server_name: "mcp-prompts",
  tool_name: "delete_prompt",
  arguments: {
    id: "outdated-prompt"
  }
});
```

## Using Prompts in Your Workflow

### Development Workflow Example

When starting work on a new feature:

1. Request the development system prompt template
2. Fill in the template with your project details
3. Use the resulting system prompt to guide Claude's assistance

### Code Review Example

When reviewing code:

1. Request the code review template
2. Provide the code to be reviewed
3. Claude will provide a structured review

## Tips for Effective Prompt Management

1. **Use Consistent Naming**: Name prompts clearly and consistently for easy discovery
2. **Tag Effectively**: Use tags to organize prompts by purpose, project, or context
3. **Templatize Reusable Prompts**: Create templates for frequently used prompts with variables
4. **Update Regularly**: Keep your prompts up-to-date as your needs change
5. **Share with Team**: Share effective prompts with your team for consistent interactions
6. **Use Categories**: Organize prompts into categories for better organization
7. **Leverage Search**: Use the search functionality to find prompts quickly