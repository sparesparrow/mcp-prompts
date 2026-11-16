---
name: use-prompt
description: Fill an mcp-prompts template with values and use the result, or use a plain prompt as it is. Use when the user wants to apply, run or fill a prompt or template by id or by name.
argument-hint: "[prompt id]"
---

# Use a prompt

The tools below belong to the mcp-prompts plugin's `prompts` server.

1. **Find the id.** Use the id the user gave (`$ARGUMENTS`). Without one, find it first as `/mcp-prompts:find-prompt`
   does.
2. **Fetch it.** Call `get_prompt` with the id. The result is JSON: `isTemplate` says whether it has placeholders,
   and `variables` names every value it needs.
3. **A plain prompt** (`isTemplate` false): its `content` is the text. Skip to step 6.
4. **A template:** collect a value for every variable. Take values the user already stated in the conversation;
   ask for the rest in one question. Never invent a value for a required variable.
5. **Fill it.** Call `apply_template` with the id and every variable. Check the result: if it still contains `{{`,
   a value was left out. Do not use it; ask for the missing value and apply again.
6. **Use it** for what the user asked: as the brief for the task in hand, or shown as text if they only wanted
   the text.
