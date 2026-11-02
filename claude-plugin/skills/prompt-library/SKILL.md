---
name: prompt-library
description: Find, fill and save reusable prompt templates from the mcp-prompts library. Use when the user asks for a saved prompt or template, wants a prompt reused or filled in ("use my review prompt", "fill the commit template"), asks what prompts they have, or wants a prompt they wrote here saved for later.
---

# Prompt library

The mcp-prompts server holds a library of prompts. Some are templates with `{{placeholders}}` that the server fills for you. Use it to reuse a prompt the user already has, not to write one from scratch when a saved one fits.

## Tools

The server's tools are `list_prompts`, `get_prompt`, `apply_template`, `add_prompt`, `update_prompt`, `delete_prompt` and `get_stats`.

## Workflow

1. **Find the prompt.** Call `list_prompts` with `search` (a word from the name or description) or `tags`. If several match, show the names and ask which one. Don't guess between them.
2. **Read it.** Call `get_prompt` with the id when you need the full text or its variables.
3. **Fill a template.** If `isTemplate` is true, call `apply_template` with the id and a `variables` object. Ask the user for any required variable they haven't given. Take the variable names from the prompt's `variables` list. Return the filled text, or use it in the task, as the user asked.
4. **Use a plain prompt as it is.** If `isTemplate` is false, return the content or follow it, as the prompt says.

## Saving a prompt

Only save when the user asks, and show them the name, tags and content first.

- **Durable saves go to a file.** Write a JSON file into the user's prompts folder: `$MCP_PROMPTS_DIR` if it is set, otherwise the `prompts/` folder of this plugin. The server loads that folder when it starts, so the prompt is there next time. Use the schema below. Name the file after the id.
- **`add_prompt` is for this session only.** It keeps the prompt in memory, and it is lost when the server restarts. Use it only to try a prompt out, and say so when you do.
- To change a saved prompt, edit its file and tell the user to restart the server. `update_prompt` changes the in-memory copy only.

### Prompt file schema

```json
{
  "id": "kebab-case-id",
  "name": "Human readable name",
  "description": "One sentence on what it is for.",
  "content": "The prompt text. Use {{variable_name}} for each placeholder.",
  "isTemplate": true,
  "tags": ["short", "lowercase", "tags"],
  "variables": [
    { "name": "variable_name", "description": "What to put here", "required": true, "type": "string" }
  ]
}
```

Rules that keep prompts working:
- `id` must be unique across the folder, and the file name should match it.
- Every `{{name}}` in `content` should appear in `variables`, and the reverse. Otherwise the user won't be asked for the value.
- `isTemplate` is `true` only when `content` has placeholders.
- `type` is `string`, `number` or `boolean`.

## Checking the library

Call `get_stats` for counts and the tags in use. If a prompt isn't found, say so and list what does exist, rather than writing a new one under the same name.
