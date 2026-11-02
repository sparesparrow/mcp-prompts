---
name: find-prompt
description: Find prompts and templates in the mcp-prompts library by tag, search text or language. Use when the user asks for a prompt, brief, template, checklist or methodology, or names a prompt id.
---

# Find a prompt

Your settings for the mcp-prompts plugin (change them in `/config`):

- Default tags: `${user_config.default_tags}`
- Preferred language: `${user_config.language}`

The tools below belong to the plugin's `prompts` server.

1. **Choose tags.** Use the tags or topic the user names. If they name none, use the default tags above,
   comma-separated; if that is empty too, search by text only.
2. **Search.** Call `list_prompts` with `tags` (a prompt matches if it has any of them) and, if the user gave words,
   `search` (matched against the name and content). If tags find nothing, try again with `search` alone.
3. **Prefer the language.** If the preferred language is not `any` and the results hold the same prompt in more than
   one language (same topic, different `language` field), keep the one in the preferred language. Prompts without a
   `language` always stay.
4. **Show** at most ten results: id, name, description, whether it is a template, and its language. Fetch full
   content only if the user asks or one result is a clear match.
5. To fill and use one, continue with `/mcp-prompts:use-prompt <id>`.

If the `prompts` tools are missing, the server did not start: check `/mcp`. With the `github` registry the usual
cause is a missing or expired token (npm reports 401). Setting the registry to `npm` in `/config` installs the
same package without a token.
