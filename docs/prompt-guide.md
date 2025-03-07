# MCP Prompts Guide

This guide explains how to create, manage, and use prompts with the simplified MCP Prompts server.

## Prompt Formats and Structure

The MCP Prompts server uses a simple JSON structure for prompts:

```json
{
  "id": "my-prompt-id",
  "name": "My Prompt Name",
  "description": "A description of what this prompt does",
  "content": "The actual prompt text that will be sent to the model",
  "isTemplate": false,
  "tags": ["tag1", "tag2", "tag3"],
  "category": "development",
  "createdAt": "2024-03-07T12:00:00.000Z",
  "updatedAt": "2024-03-07T12:00:00.000Z",
  "version": 1
}
```

### Key Fields

- **id**: Unique identifier for the prompt (generated automatically if not provided)
- **name**: Human-readable name
- **description**: Optional description of what the prompt does
- **content**: The actual prompt text
- **isTemplate**: Whether this is a template with variables
- **tags**: Array of strings for categorization
- **category**: Broad category for organization
- **createdAt**: Timestamp when the prompt was created
- **updatedAt**: Timestamp when the prompt was last updated
- **version**: Version number of the prompt

## Working with Templates

Templates allow you to create reusable prompts with variables that can be filled in at runtime.

### Creating Templates

To create a template, set `isTemplate` to `true` and include variables in the content using double curly braces:

```json
{
  "name": "Bug Report Template",
  "description": "Template for submitting bug reports",
  "content": "## Bug Report\n\n### Description\n{{description}}\n\n### Steps to Reproduce\n{{steps}}\n\n### Expected Behavior\n{{expected}}\n\n### Actual Behavior\n{{actual}}\n\n### Environment\n{{environment}}",
  "isTemplate": true,
  "tags": ["bug", "template", "documentation"],
  "category": "development"
}
```

### Applying Templates

To apply a template, use the `apply_template` tool with the template ID and variables:

```json
{
  "id": "bug-report-template",
  "variables": {
    "description": "The save button doesn't work when clicked",
    "steps": "1. Open the application\n2. Navigate to the settings page\n3. Make a change\n4. Click the save button",
    "expected": "The settings should be saved and a confirmation message displayed",
    "actual": "Nothing happens when the save button is clicked",
    "environment": "Windows 10, Chrome 121"
  }
}
```

## Using MCP Tools for Prompt Management

### Adding a Prompt

```
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

### Getting a Prompt

```
use_mcp_tool({
  server_name: "mcp-prompts",
  tool_name: "get_prompt",
  arguments: {
    id: "bug-report-template"
  }
});
```

### Updating a Prompt

```
use_mcp_tool({
  server_name: "mcp-prompts",
  tool_name: "update_prompt",
  arguments: {
    id: "bug-report-template",
    prompt: {
      tags: ["bug", "template", "documentation", "updated"],
      description: "Updated template for submitting bug reports"
    }
  }
});
```

### Listing Prompts

```
use_mcp_tool({
  server_name: "mcp-prompts",
  tool_name: "list_prompts",
  arguments: {
    tags: ["template"],
    category: "development",
    isTemplate: true
  }
});
```

### Applying a Template

```
use_mcp_tool({
  server_name: "mcp-prompts",
  tool_name: "apply_template",
  arguments: {
    id: "bug-report-template",
    variables: {
      "description": "The save button doesn't work",
      "steps": "1. Click save button",
      "expected": "Data should save",
      "actual": "Nothing happens",
      "environment": "Chrome on Windows"
    }
  }
});
```

### Deleting a Prompt

```
use_mcp_tool({
  server_name: "mcp-prompts",
  tool_name: "delete_prompt",
  arguments: {
    id: "bug-report-template"
  }
});
```

## Best Practices

### Naming Conventions

- Use descriptive, consistent naming
- Consider using prefixes for related prompts
- Make names clear and searchable

### Template Variables

- Use clear, descriptive variable names
- Include default values in documentation
- Group related variables

### Organization with Tags and Categories

- Use tags for fine-grained organization
- Use categories for broad organization
- Be consistent with tag and category naming

### Content Quality

- Write clear, concise prompts
- Include examples where helpful
- Consider edge cases in templates
- Update prompts regularly based on feedback

## Conclusion

This guide covers the basics of creating and managing prompts with the MCP Prompts server. By following these practices, you can build a well-organized library of prompts to enhance your interactions with Claude and other LLMs. 