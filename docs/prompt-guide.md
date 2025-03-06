# MCP Prompts Guide

This guide explains how to create, manage, and use prompts with the MCP Prompts server.

## Prompt Formats

The MCP Prompts server supports two formats for prompts:

### JSON Format

JSON is the native format used by the server internally:

```json
{
  "id": "my-prompt-id",
  "name": "My Prompt Name",
  "description": "A description of what this prompt does",
  "content": "The actual prompt text that will be sent to the model",
  "isTemplate": false,
  "tags": ["tag1", "tag2", "tag3"],
  "createdAt": "2024-03-05T12:00:00Z",
  "updatedAt": "2024-03-05T12:00:00Z",
  "version": 1
}
```

For templates, include a `variables` array:

```json
{
  "id": "my-template-id",
  "name": "My Template Name",
  "description": "A description of what this template does",
  "content": "This template accepts a {{variable_name}} that you can use",
  "isTemplate": true,
  "variables": ["variable_name"],
  "tags": ["template", "customizable"],
  "createdAt": "2024-03-05T12:00:00Z",
  "updatedAt": "2024-03-05T12:00:00Z",
  "version": 1
}
```

### Markdown Format

Markdown format is more human-readable:

```markdown
# My Prompt Name

A description of what this prompt does

## Tags

- tag1
- tag2
- tag3

## Content

```
The actual prompt text that will be sent to the model
```

## Metadata

- ID: my-prompt-id
- Version: 1
- Created: 2024-03-05T12:00:00Z
- Updated: 2024-03-05T12:00:00Z
```

## Creating Prompts

### Manually

1. Create a JSON or Markdown file in the `prompts` directory
2. Follow the format examples above
3. Ensure the prompt has a unique ID

### Using the API

```javascript
const result = await client.callTool('add_prompt', {
  prompt: {
    name: "My New Prompt",
    description: "A description of the prompt",
    content: "The prompt content",
    isTemplate: false,
    tags: ["tag1", "tag2"]
  }
});
```

### From Raw Prompts

Use the processing script to extract prompts from source files:

```bash
npm run prompt:process
```

## Using Templates

Templates contain placeholders in the format `{{variable_name}}` that will be replaced when the template is applied.

### Creating Templates

Define variables in your template content and include them in the `variables` array:

```json
{
  "id": "greeting-template",
  "name": "Greeting Template",
  "description": "A customizable greeting",
  "content": "Hello {{name}}, welcome to {{place}}!",
  "isTemplate": true,
  "variables": ["name", "place"],
  "tags": ["greeting", "template"],
  "createdAt": "2024-03-05T12:00:00Z",
  "updatedAt": "2024-03-05T12:00:00Z",
  "version": 1
}
```

### Applying Templates

Apply templates by providing values for the variables:

```javascript
const result = await client.callTool('apply_template', {
  id: "greeting-template",
  variables: {
    name: "John",
    place: "Paris"
  }
});
// result.content will be "Hello John, welcome to Paris!"
```

## Best Practices

1. **Use descriptive IDs and names** - Make your prompts easy to find and understand
2. **Add relevant tags** - Tags help categorize and filter prompts
3. **Keep prompts focused** - Each prompt should have a clear purpose
4. **Include examples** - In descriptions or content, show how to use the prompt
5. **Use templates for flexibility** - Templates allow for customization
6. **Version your prompts** - Increment the version when making significant changes
7. **Organize by domain** - Group related prompts together

## Advanced Usage

### Prompt Chaining

You can chain prompts by referencing other prompts in your prompt content. This is particularly useful for complex workflows:

```
{{reference:another-prompt-id}}

Now I will continue with more instructions...
```

### Conditional Content

For templates, you can include conditional sections:

```
{{#if advanced_mode}}
Here are advanced instructions...
{{else}}
Here are basic instructions...
{{/if}}
```

### Organizing Large Prompt Collections

For large collections, consider organizing prompts in subdirectories by category or function. The server will recursively scan all subdirectories in the `prompts` folder. 