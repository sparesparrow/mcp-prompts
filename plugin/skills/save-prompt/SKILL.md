---
name: save-prompt
description: Save a prompt or template permanently as a JSON file in your own mcp-prompts folder. Use when the user wants to keep, save, store or capture a prompt or template for later sessions.
---

# Save a prompt

Your prompts folder (set in `/config` for the mcp-prompts plugin): `${user_config.prompts_dir}`

If the folder above is empty, stop and tell the user to set "Your prompts folder" in `/config`. Do not use the
`add_prompt` tool instead: it keeps a prompt only until the server restarts, under a random id.

1. **Build the prompt** as one JSON object:
   - `id`: kebab-case, short and descriptive. Call `get_prompt` with it first. If a prompt with that id exists,
     choose another id, unless the user wants their version to replace it (the file in their folder wins).
   - `name`, and `description` in one sentence.
   - `content`: the prompt text. Mark each value to fill in later as `{{name}}`.
   - `isTemplate`: `true` when the content has placeholders. `variables` then lists each placeholder name.
   - `tags`: the topic, plus the default tags (`${user_config.default_tags}`) when they apply.
   - `metadata.language`: `cs` or `en` when the text is in one language.
2. **Show** the JSON and the path `<folder>/<id>.json`, and write the file with the user's agreement. Never
   overwrite an existing file without asking. Never put secrets, tokens or personal data in a prompt.
3. **Load it.** The server reads the folder when it starts, so tell the user to reconnect it in `/mcp`. Until then
   the new prompt is not listed.
