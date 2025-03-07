# Using Categories in MCP Prompts Server

This guide explains how to use the category-based organization feature in the MCP Prompts Server.

## Categories

Categories provide a way to organize prompts by their purpose or domain, making it easier to find and manage related prompts. The MCP Prompts Server supports categorization as part of its simplified architecture.

### Common Categories

Suggested categories include:

- `development` - For programming, coding, and debugging prompts
- `project-orchestration` - For project planning and management prompts
- `analysis` - For data analysis and research prompts
- `content` - For content creation and translation prompts
- `planning` - For strategic planning and decision-making prompts
- `productivity` - For workflow optimization prompts
- `ai` - For AI and model-related prompts

### Adding Categories to Prompts

When adding or updating a prompt, you can specify a category:

```json
{
  "prompt": {
    "name": "Code Review Template",
    "description": "A template for requesting code reviews",
    "content": "Please review the following code...",
    "isTemplate": true,
    "tags": ["code", "review"],
    "category": "development"
  }
}
```

### Filtering Prompts by Category

You can filter prompts by category when listing them:

```json
{
  "category": "development"
}
```

Example using an MCP tool call:

```
I need to see all development prompts.

use_mcp_tool({
  server_name: "mcp-prompts",
  tool_name: "list_prompts",
  arguments: {
    category: "development"
  }
});
```

### Combining Filters

Categories can be combined with other filters such as tags and template status:

```json
{
  "category": "development",
  "tags": ["code", "review"],
  "isTemplate": true
}
```

Example:

```
Show me all template prompts in the development category with the "code" tag.

use_mcp_tool({
  server_name: "mcp-prompts",
  tool_name: "list_prompts",
  arguments: {
    category: "development",
    tags: ["code"],
    isTemplate: true
  }
});
```

### Organization Best Practices

1. **Consistent Categories**: Use consistent category names across prompts
2. **Avoid Too Many Categories**: Limit to a reasonable number of categories (7-10 is often sufficient)
3. **Hierarchical Thinking**: Consider categories as the top level of organization, with tags providing more specific classification
4. **Clear Naming**: Use clear, descriptive category names
5. **Documentation**: Document your category system for team members

### Using Categories with Tags

Categories and tags work well together:

- Categories provide broad organization (e.g., "development")
- Tags provide more specific classification (e.g., "python", "frontend", "debugging")

This dual approach allows for flexible and powerful organization of your prompts. 