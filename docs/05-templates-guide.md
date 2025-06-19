# Templates Guide

Best practices for creating, applying, and exporting templates.

## Variable Syntax

You can use variables in your prompt templates using double curly braces:

```text
Hello, {{name}}! Today is {{date}}.
```

## Extracting Variables Programmatically

The server can extract variables from prompt content and require them at runtime. Example:

```json
{
  "name": "Greeting Template",
  "content": "Hello, {{name}}! Today is {{date}}.",
  "isTemplate": true,
  "variables": ["name", "date"]
}
```

## Applying a Template

Suppose you have a template as above. To apply it:

```json
{
  "templateId": "greeting-template",
  "variables": { "name": "Alice", "date": "2024-06-19" }
}
```

Result:

```
Hello, Alice! Today is 2024-06-19.
```

## Advanced: Multi-Step Workflow Example

You can chain prompts by referencing outputs as variables in subsequent steps. Example:

1. **Step 1: Generate summary**
   ```json
   {
     "id": "summarize",
     "content": "Summarize the following text: {{input}}",
     "isTemplate": true,
     "variables": ["input"]
   }
   ```
2. **Step 2: Generate questions**
   ```json
   {
     "id": "questions",
     "content": "Based on this summary: {{summary}}, generate 3 questions.",
     "isTemplate": true,
     "variables": ["summary"]
   }
   ```

**Workflow:**
- Apply `summarize` with your input text.
- Take the output, use as `summary` variable for `questions`.

## Embedding Resources via MCP URIs

You can reference external resources in your prompt content:

```text
Use the following context: [resource](mcp://resource-id)
```

## Exporting to Multiple Formats

Prompts and templates can be exported as:
- MDC (Cursor Rules)
- PGAI (Postgres/JSON)
- Plain text

See the CLI or API for export commands.

---

> For more advanced workflow and chaining, see the [examples/](../examples/) directory and integration guides. 