# MCP-Prompts User Guide (Claude Desktop & Cursor IDE)

## 1. Setting up MCP-Prompts server for Claude Desktop

1. **Install and run MCP-Prompts server**
   - The fastest way is using npx:
     ```bash
     npx -y @sparesparrow/mcp-prompts
     ```
   - Or use Docker:
     ```bash
     docker run -d --name mcp-prompts -p 3003:3003 sparesparrow/mcp-prompts:latest
     ```
2. **Verify the server is running**
   - Open in your browser or use curl:
     ```bash
     curl http://localhost:3003/health
     # → { "status": "ok" }
     ```
3. **Configure Claude Desktop to use your MCP server**
   - Open Claude Desktop and go to **Settings** → **Developer** → **Edit Config**.
   - This opens (or creates) `claude_desktop_config.json`.
   - Add or update the MCP server section, for example:
     ```json
     {
       "mcpServers": {
         "prompts": {
           "command": "npx",
           "args": ["-y", "@sparesparrow/mcp-prompts"]
         }
       }
     }
     ```
   - Save the file and restart Claude Desktop.
   - You should see a slider/tool icon in the chat input area. Click it to access MCP tools and prompts.

## 2. Setting up MCP-Prompts server for Cursor IDE

1. **Start the MCP-Prompts server** (see above).
2. **Open Cursor IDE settings** (Settings → AI → Prompt Management).
3. **Find the field for "Custom MCP server URL"** (or similar).
4. **Enter your server address:**
   ```
   http://localhost:3003
   ```
5. **Save settings.** You can now browse and use prompts directly in the IDE.

## 3. Using prompts and tools in the GUI (Claude Desktop, Cursor IDE)

- **Prompt templates** allow you to use variables in prompt text, e.g.:
  ```json
  {
    "id": "code-review-assistant",
    "name": "Code Review Assistant",
    "content": "Please review the following code: {{code}}",
    "isTemplate": true,
    "variables": ["code"]
  }
  ```
- **How to use prompt templates:**
  - In the GUI, select a template prompt.
  - Fill in the required variables in the form.
  - The result will be inserted into the chat or editor.
- **How to use tools:**
  - Open the tools menu (slider or tools icon).
  - Select a tool by name and description.
  - Enter the required parameters (e.g. prompt ID, variable values).
  - The result will be shown in the chat or output area.

## 4. Example use cases for specific prompts

- **Code Review Assistant:**
  - Use to get instant feedback on code snippets. Paste your code, select the prompt, and receive a review.
- **Data Analysis Template:**
  - Use to analyze CSV or JSON data. Paste your data, select the template, and get insights or summaries.
- **Project Analysis Assistant:**
  - Use to get a high-level overview of a project, its structure, and potential improvements.
- **Repository Explorer:**
  - Use to quickly understand the structure and key files in a code repository.
- **Custom workflow prompts:**
  - Chain multiple prompts for complex tasks (e.g. code generation, refactoring, documentation).

## 5. Troubleshooting and tips

- If the server is not detected:
  - Restart Claude Desktop or Cursor IDE after changing config.
  - Check that the MCP server is running and accessible at the configured URL.
  - Verify there are no typos in the config file.
  - Check logs for errors (see Claude Desktop logs or server console output).
- You can edit or add new prompt templates in the `prompts/` directory (JSON format). Restart the server to reload them.
- For advanced usage, see the [official MCP documentation](https://modelcontextprotocol.io/quickstart/user) and [API reference](docs/04-api-reference.md).

## 6. More information and resources

- [MCP Protocol documentation](https://modelcontextprotocol.io/quickstart/user)
- [How to connect Claude Desktop to an MCP server (MESA blog)](https://www.getmesa.com/blog/how-to-connect-mcp-server-claude/)
- [MCP-Prompts full documentation](docs/00-overview.md)
- [Prompt templates guide](docs/05-templates-guide.md)
- [Developer guide](docs/07-developer-guide.md) 