# MCP-Prompts User Guide

## Contributing Screenshots
We welcome contributions of screenshots to improve this guide! Please:
- Save images in PNG format.
- Name files descriptively (e.g., `lm-studio-server-config.png`).
- Place them in the `images/` directory at the project root.
- Submit a pull request with your screenshot and update the relevant Markdown image link.

## Introduction
MCP-Prompts is a lightweight, extensible server for managing prompts and templates in the Model Context Protocol (MCP) ecosystem. This guide will help you set up, configure, and use MCP-Prompts with a variety of clients, including LM Studio, LibreChat, Tasker, Android, Cursor IDE, and Claude Desktop.

**Intended Audience:**
- Developers, prompt engineers, and advanced users who want to manage and version prompts for LLM workflows.

**Prerequisites:**
- Node.js (for local setup)
- Docker (for containerized setup)
- Basic familiarity with command-line tools

## Table of Contents
1. [Getting Started](#getting-started)
2. [Supported Clients Setup](#supported-clients-setup)
   - [LM Studio](#lm-studio)
   - [LibreChat](#librechat)
   - [Tasker (Android)](#tasker-android)
   - [Cursor IDE](#cursor-ide)
   - [Claude Desktop](#claude-desktop)
3. [Features and Functions](#features-and-functions)
4. [Advanced Usage Examples](#advanced-usage-examples)
5. [Troubleshooting & FAQ](#troubleshooting--faq)
6. [Contact & Support](#contact--support)

## Getting Started

### Local Setup (npx)
```bash
npx -y @sparesparrow/mcp-prompts
curl http://localhost:3003/health
```

### Docker Setup
```bash
docker run -d --name mcp-prompts \
  -p 3003:3003 \
  -e HTTP_SERVER=true \
  -e STORAGE_TYPE=file \
  -v $(pwd)/data:/app/data \
  sparesparrow/mcp-prompts:latest
```

### Docker Compose (PostgreSQL)
```yaml
version: "3"
services:
  prompts:
    image: sparesparrow/mcp-prompts:latest
    environment:
      HTTP_SERVER: "true"
      STORAGE_TYPE: "postgres"
      POSTGRES_CONNECTION_STRING: "postgresql://postgres:password@db:5432/mcp_prompts"
    ports: [ "3003:3003" ]
    depends_on: [ db ]
  db:
    image: postgres:14
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
```

## Supported Clients Setup

### LM Studio
- Add MCP-Prompts as a custom server in LM Studio settings.
- Example config:
  ```json
  {
    "name": "MCP Prompts",
    "url": "http://localhost:3003"
  }
  ```
- See [LM Studio docs](https://lmstudio.ai/docs/) for more details.

### LM Studio: Step-by-Step Setup

1. **Start MCP-Prompts Server**
   - Open a terminal and run:
     ```bash
     npx -y @sparesparrow/mcp-prompts
     ```
   - Or use Docker:
     ```bash
     docker run -d --name mcp-prompts -p 3003:3003 sparesparrow/mcp-prompts:latest
     ```
   - ![Terminal running MCP-Prompts](images/terminal-mcp-prompts.png) (Screenshot needed! Please contribute.)

2. **Verify Server is Running**
   - In your browser or terminal, check:
     ```bash
     curl http://localhost:3003/health
     # → { "status": "ok" }
     ```
   - ![Health check output](images/health-check-output.png) (Screenshot needed! Please contribute.)

3. **Configure LM Studio**
   - Open LM Studio and go to **Settings** → **Custom Servers**.
   - Click **Add Server** and enter:
     - **Name:** `MCP Prompts`
     - **URL:** `http://localhost:3003`
   - Click **Save**.
   - ![LM Studio server config screen](images/lm-studio-server-config.png) (Screenshot needed! Please contribute.)

4. **Test Integration**
   - In LM Studio, open the prompt manager or resource browser.
   - You should see prompts from MCP-Prompts available.

#### Troubleshooting LM Studio Integration

| Issue                        | Solution                                                                 |
|------------------------------|--------------------------------------------------------------------------|
| Cannot connect to server     | Ensure MCP-Prompts is running and accessible at `http://localhost:3003`. |
| Port 3003 already in use     | Stop other services or change the port in both MCP-Prompts and LM Studio.|
| Prompts not showing up       | Check server logs for errors; verify correct URL in LM Studio settings.  |

#### Quick Reference Checklist

- [ ] MCP-Prompts server is running (`curl http://localhost:3003/health`)
- [ ] LM Studio configured with correct server URL
- [ ] No firewall or port conflicts
- [ ] Prompts visible in LM Studio

### LibreChat
- Add MCP-Prompts as a backend resource.
- Example config:
  ```json
  {
    "resource": "http://localhost:3003/prompts"
  }
  ```
- See [LibreChat docs](https://github.com/danny-avila/LibreChat) for more details.

### LibreChat: Step-by-Step Setup

1. **Start MCP-Prompts Server**
   - Open a terminal and run:
     ```bash
     npx -y @sparesparrow/mcp-prompts
     ```
   - Or use Docker:
     ```bash
     docker run -d --name mcp-prompts -p 3003:3003 sparesparrow/mcp-prompts:latest
     ```
   - ![Terminal running MCP-Prompts](images/terminal-mcp-prompts.png) (Screenshot needed! Please contribute.)

2. **Verify Server is Running**
   - In your browser or terminal, check:
     ```bash
     curl http://localhost:3003/health
     # → { "status": "ok" }
     ```
   - ![Health check output](images/health-check-output.png) (Screenshot needed! Please contribute.)

3. **Configure LibreChat**
   - Open LibreChat and go to **Settings** → **Backend Resources**.
   - Click **Add Resource** and enter:
     - **Resource URL:** `http://localhost:3003/prompts`
   - Click **Save**.
   - ![LibreChat resource config screen](images/librechat-resource-config.png) (Screenshot needed! Please contribute.)

4. **Test Integration**
   - In LibreChat, open the prompt/resource browser.
   - You should see prompts from MCP-Prompts available.

#### Troubleshooting LibreChat Integration

| Issue                        | Solution                                                                 |
|------------------------------|--------------------------------------------------------------------------|
| Cannot connect to server     | Ensure MCP-Prompts is running and accessible at `http://localhost:3003`. |
| Port 3003 already in use     | Stop other services or change the port in both MCP-Prompts and LibreChat.|
| Prompts not showing up       | Check server logs for errors; verify correct URL in LibreChat settings.  |

#### Quick Reference Checklist

- [ ] MCP-Prompts server is running (`curl http://localhost:3003/health`)
- [ ] LibreChat configured with correct resource URL
- [ ] No firewall or port conflicts
- [ ] Prompts visible in LibreChat

### Tasker (Android): Step-by-Step Setup

1. **Start MCP-Prompts Server**
   - Open a terminal and run:
     ```bash
     npx -y @sparesparrow/mcp-prompts
     ```
   - Or use Docker:
     ```bash
     docker run -d --name mcp-prompts -p 3003:3003 sparesparrow/mcp-prompts:latest
     ```
   - ![Terminal running MCP-Prompts](images/terminal-mcp-prompts.png) (Screenshot needed! Please contribute.)

2. **Verify Server is Running**
   - In your browser or terminal, check:
     ```bash
     curl http://localhost:3003/health
     # → { "status": "ok" }
     ```
   - ![Health check output](images/health-check-output.png) (Screenshot needed! Please contribute.)

3. **Configure Tasker HTTP Request**
   - Open Tasker on your Android device.
   - Create a new **Profile** (e.g., "Fetch MCP Prompt").
   - Add a **Task** with an **HTTP Request** action:
     - **Method:** GET
     - **URL:** `http://<your-server-ip>:3003/prompts`
     - (Replace `<your-server-ip>` with your computer/server's IP address on the same network.)
   - Optionally, add actions to process the response (e.g., display with a Popup, save to a file, or trigger another Tasker action).
   - ![Tasker HTTP Request configuration](images/tasker-http-request-config.png) (Screenshot needed! Please contribute.)

4. **Test Integration**
   - Trigger the Tasker profile or task.
   - You should see the prompt data retrieved from MCP-Prompts.

#### Troubleshooting Tasker Integration

| Issue                        | Solution                                                                 |
|------------------------------|--------------------------------------------------------------------------|
| Cannot connect to server     | Ensure MCP-Prompts is running and accessible from your Android device.   |
| Network unreachable          | Make sure your Android device and server are on the same Wi-Fi network.  |
| Prompts not showing up       | Check server logs for errors; verify correct URL and port in Tasker.     |
| HTTP Request action missing  | Update Tasker to the latest version; see [Tasker User Guide](https://tasker.joaoapps.com/userguide/en/) for help. |

#### Quick Reference Checklist

- [ ] MCP-Prompts server is running and accessible from Android
- [ ] Tasker HTTP Request action uses correct server IP and port
- [ ] No firewall or network isolation between Android and server
- [ ] Tasker profile/task triggers and displays prompt data

### Cursor IDE: Step-by-Step Setup

1. **Start MCP-Prompts Server**
   - Open a terminal and run:
     ```bash
     npx -y @sparesparrow/mcp-prompts
     ```
   - Or use Docker:
     ```bash
     docker run -d --name mcp-prompts -p 3003:3003 sparesparrow/mcp-prompts:latest
     ```
   - ![Terminal running MCP-Prompts](images/terminal-mcp-prompts.png) (Screenshot needed! Please contribute.)

2. **Verify Server is Running**
   - In your browser or terminal, check:
     ```bash
     curl http://localhost:3003/health
     # → { "status": "ok" }
     ```
   - ![Health check output](images/health-check-output.png) (Screenshot needed! Please contribute.)

3. **Configure Cursor IDE**
   - Open Cursor IDE and go to **Settings** → **AI** → **Prompt Management**.
   - Find the field for **Custom MCP server URL** (or similar).
   - Enter your server address:
     ```
     http://localhost:3003
     ```
   - Click **Save**.
   - ![Cursor IDE settings with MCP server URL](images/cursor-ide-settings.png) (Screenshot needed! Please contribute.)

4. **Test Integration**
   - In Cursor IDE, open the prompt/resource browser.
   - You should see prompts from MCP-Prompts available.

#### Troubleshooting Cursor IDE Integration

| Issue                        | Solution                                                                 |
|------------------------------|--------------------------------------------------------------------------|
| Cannot connect to server     | Ensure MCP-Prompts is running and accessible at `http://localhost:3003`. |
| Port 3003 already in use     | Stop other services or change the port in both MCP-Prompts and Cursor IDE.|
| Prompts not showing up       | Check server logs for errors; verify correct URL in Cursor IDE settings.  |

#### Quick Reference Checklist

- [ ] MCP-Prompts server is running (`curl http://localhost:3003/health`)
- [ ] Cursor IDE configured with correct server URL
- [ ] No firewall or port conflicts
- [ ] Prompts visible in Cursor IDE

### Claude Desktop: Step-by-Step Setup

1. **Start MCP-Prompts Server**
   - Open a terminal and run:
     ```bash
     npx -y @sparesparrow/mcp-prompts
     ```
   - Or use Docker:
     ```bash
     docker run -d --name mcp-prompts -p 3003:3003 sparesparrow/mcp-prompts:latest
     ```
   - ![Terminal running MCP-Prompts](images/terminal-mcp-prompts.png) (Screenshot needed! Please contribute.)

2. **Verify Server is Running**
   - In your browser or terminal, check:
     ```bash
     curl http://localhost:3003/health
     # → { "status": "ok" }
     ```
   - ![Health check output](images/health-check-output.png) (Screenshot needed! Please contribute.)

3. **Configure Claude Desktop**
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
   - ![Claude Desktop config file and settings](images/claude-desktop-config.png) (Screenshot needed! Please contribute.)

4. **Test Integration**
   - You should see a slider/tool icon in the chat input area. Click it to access MCP tools and prompts.

#### Troubleshooting Claude Desktop Integration

| Issue                        | Solution                                                                 |
|------------------------------|--------------------------------------------------------------------------|
| Cannot connect to server     | Ensure MCP-Prompts is running and accessible at `http://localhost:3003`. |
| Port 3003 already in use     | Stop other services or change the port in both MCP-Prompts and Claude Desktop.|
| Prompts/tools not showing up | Check server logs for errors; verify correct config in Claude Desktop.    |

#### Quick Reference Checklist

- [ ] MCP-Prompts server is running (`curl http://localhost:3003/health`)
- [ ] Claude Desktop config file updated with correct MCP server command/args
- [ ] No firewall or port conflicts
- [ ] Prompts/tools visible in Claude Desktop

## Features and Functions
- Pluggable storage: file, Postgres, MDC (Cursor Rules)
- Versioned prompt management
- HTTP/SSE API endpoints
- Prompt templates and variable substitution
- Integration with multiple clients
- JSON schema validation

## Advanced Usage Examples
- Creating and applying prompt templates
- Using the MDC (Cursor Rules) adapter
- Multi-step workflow examples
- Exporting/importing prompts

## Troubleshooting & FAQ
- Common errors and solutions
- How to check server health
- How to reset storage
- Where to find logs
- How to report issues

## Contact & Support
- [GitHub Issues](https://github.com/sparesparrow/mcp-prompts/issues)
- [Official MCP Documentation](https://github.com/modelcontextprotocol)
- Community resources and Discord (if available)

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

## Using MCP-Prompts with Tasker (Android), Anthropic API, and Android Integrations (Preview)

> **Note:** Detailed instructions for these integrations are coming soon. Below is a preview of planned features and use cases.

### 1. Tasker (Android)
- Automate prompt sending and response handling via HTTP requests to MCP-Prompts server.
- Trigger prompts from Android events (e.g. notifications, location, app actions).
- Use Tasker actions to process responses (e.g. show notification, speak via TTS, copy to clipboard).

### 2. Anthropic API Key for HTTP Requests
- Configure Tasker or other HTTP clients to call MCP-Prompts server with your Anthropic API key for LLM completions.
- Securely store and use your API key in Tasker variables.

### 3. Text-to-Speech (TTS)
- Use Tasker to read out prompt responses using Android TTS engine.

### 4. Clipboard Integration
- Automatically copy prompt responses to clipboard for quick sharing or pasting.

### 5. Android Share Menu
- Share prompt results directly from MCP-Prompts to other apps via Android's share intent.

### 6. Android Digital Assistant
- Integrate MCP-Prompts with Google Assistant or other digital assistants for voice-driven workflows.

### 7. AIDL (Android Interface Definition Language)
- Advanced: Expose MCP-Prompts as a service accessible via AIDL for deep Android app integration.

> **Stay tuned!** Full guides, Tasker profiles, and example scripts will be added here soon.

## Using MCP-Prompts with LM Studio and Other MCP Clients

### 1. LM Studio
- **Setup:**
  - Ensure MCP-Prompts server is running (see Quickstart above).
  - In LM Studio, go to the settings or integrations section.
  - Find the option to add a custom MCP server or prompt provider.
  - Enter your MCP-Prompts server URL (e.g., `http://localhost:3003`).
  - Save and reload LM Studio if needed.
- **Usage:**
  - Prompts and tools from MCP-Prompts will appear in the LM Studio interface.
  - Select prompts, fill in variables, and use tools as needed.
  - Results will be shown in the chat or output area.

### 2. LibreChat
- **Setup:**
  - Start the MCP-Prompts server.
  - In LibreChat, open the integrations or plugin settings.
  - Add a new MCP server connection with the address of your MCP-Prompts instance.
  - Save and refresh the client.
- **Usage:**
  - Access prompt templates and tools from the MCP-Prompts server within LibreChat.
  - Use the GUI to select, fill, and submit prompts.

### 3. Other MCP Clients (General Instructions)
- **Setup:**
  - Start MCP-Prompts server and ensure it is accessible from the client machine.
  - In your MCP client (e.g., browser extension, desktop app, web app), look for an option to add or configure an MCP server.
  - Enter the MCP-Prompts server URL and save.
- **Usage:**
  - Prompts and tools will be available in the client's interface.
  - Use as you would in Claude Desktop or Cursor IDE: select prompts, fill variables, run tools, and view results.

> **Tip:** For client-specific details, consult the documentation for your MCP client. Most modern clients support the MCP protocol and can connect to any compatible server like MCP-Prompts. 