# MCP-Prompts Deployment & Usage Guide

## 🚀 Quick Setup

One command to install, configure and deploy:
```
<copilot-edited-file>````
```markdown
# MCP-Prompts Deployment & Usage Guide

## 🚀 Quick Setup

One command to install, configure and deploy:
```
npx -y @sparesparrow/mcp-prompts
```

## Prerequisites

- **Node.js** (v18+ recommended) for local/server installs
- **Docker** (for containerized deployment)
- **Ports:** Default HTTP port is `3003`
- **API Key (recommended for production):** Set via `API_KEYS` environment variable (comma-separated for multiple keys)
- **Persistent storage:** Use Docker volume or map a host directory for file storage, or configure PostgreSQL

---

## 🚀 Quick Start Table

| Method         | Command/Config                                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Local (npx)    | `npx -y @sparesparrow/mcp-prompts`                                                                                             |
| Local (Node)   | `git clone ... && npm install && npm run build && node build/index.js`                                                         |
| Docker         | `docker run -d -p 3003:3003 -e HTTP_SERVER=true -e STORAGE_TYPE=file -v $(pwd)/data:/app/data sparesparrow/mcp-prompts:latest` |
| Docker Compose | See below for example (Postgres or file)                                                                                       |

---

## 🖥️ Local Deployment (npx/Node.js)

```bash
# Easiest: npx (no install needed)
npx -y @sparesparrow/mcp-prompts

# Or clone and run manually
# git clone https://github.com/sparesparrow/mcp-prompts.git
# cd mcp-prompts
# npm install && npm run build
# node build/index.js
```

### Environment Variables

- `HTTP_SERVER=true` (enable HTTP API)
- `PORT=3003` (change port if needed)
- `STORAGE_TYPE=file|postgres` (choose storage backend)
- `PROMPTS_DIR=./data/prompts` (for file storage)
- `POSTGRES_CONNECTION_STRING=...` (for Postgres)
- `API_KEYS=yourkey1,yourkey2` (comma-separated API keys)

---

## 🐳 Docker Deployment

```bash
docker run -d --name mcp-prompts \
  -p 3003:3003 \
  -e HTTP_SERVER=true \
  -e STORAGE_TYPE=file \
  -v $(pwd)/data:/app/data \
  sparesparrow/mcp-prompts:latest
```

- For persistent storage, always map a host directory to `/app/data`.
- For production, set `API_KEYS` and review CORS/rate limiting settings.

---

## 🐳 Docker Compose Example (PostgreSQL)

```yaml
version: '3'
services:
  prompts:
    image: sparesparrow/mcp-prompts:latest
    environment:
      HTTP_SERVER: 'true'
      STORAGE_TYPE: 'postgres'
      POSTGRES_CONNECTION_STRING: 'postgresql://postgres:password@db:5432/mcp_prompts'
      API_KEYS: 'your-production-key'
    ports: ['3003:3003']
    depends_on: [db]
    volumes:
      - ./data:/app/data
  db:
    image: postgres:14
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    volumes:
      - ./pgdata:/var/lib/postgresql/data
```

---

## 🔑 API Key Authentication

- Set `API_KEYS` env variable (comma-separated for multiple keys)
- All API requests (except `/health` and `/api-docs`) require `x-api-key` header
- **Example (curl):**
  ```bash
  curl -H "x-api-key: yourkey" http://localhost:3003/prompts
  ```
- **Example (LM Studio/LibreChat/other clients):**
  - Most clients allow you to set custom headers or an API key in their server/resource settings. Enter your key as required.
  - If not, use a proxy or request support from the client developer.
- **Tip:** If you get a 401/403 error, check your API key and header spelling.

---

## 🩺 Health Check & Troubleshooting

- Check server health:
  ```bash
  curl http://localhost:3003/health
  # { "status": "ok" }
  ```
- Logs are printed to stdout (Docker: `docker logs mcp-prompts`)

### Common Problems & Solutions

| Problem               | Solution                                                      |
| --------------------- | ------------------------------------------------------------- |
| Port already in use   | Change `PORT` env variable or stop conflicting service        |
| Storage errors        | Check volume mapping or Postgres connection string            |
| Auth errors (401/403) | Ensure correct `x-api-key` header and value                   |
| Data not persistent   | Map a host directory to `/app/data` in Docker or use Postgres |
| API docs not loading  | Ensure server is running and visit `/api-docs`                |
| SSE not working       | Set `ENABLE_SSE=true` and check `/events` endpoint            |

---

## 🛡️ Production Security Checklist

- [ ] Set strong, unique `API_KEYS` (never use default or public keys)
- [ ] Restrict allowed origins with CORS settings
- [ ] Enable and tune rate limiting (see README for env vars)
- [ ] Use HTTPS (with reverse proxy or container orchestration)
- [ ] Use persistent storage (volume or Postgres)
- [ ] Regularly update server and dependencies
- [ ] Monitor logs and health endpoint
- [ ] Backup data directory or Postgres regularly

---

## ⬆️ How to Upgrade Safely

1. **Backup your data** (data directory or Postgres DB)
2. **Pull the latest image or update npm package**
   - Docker: `docker pull sparesparrow/mcp-prompts:latest`
   - npm: `npm install -g @sparesparrow/mcp-prompts`
3. **Restart the server/container**
4. **Check health endpoint and logs for errors**
5. **Test API and client integrations**

---

## Using with Clients

- **LM Studio, Cursor IDE, LibreChat, Tasker, Android:**
  - Add MCP-Prompts server URL in client settings
  - If API key is set, configure client to send `x-api-key`
  - See client-specific instructions in this guide

## API & Swagger/OpenAPI

- Interactive API docs: [http://localhost:3003/api-docs](http://localhost:3003/api-docs)
- Explore endpoints, schemas, and try requests in browser
- All endpoints (except `/health` and `/api-docs`) require API key if set

## Server-Sent Events (SSE)

- Enable with `ENABLE_SSE=true` (optional)
- Default endpoint: `/events`
- See docs/06-mcp-integration.md for usage

## Storage Configuration

- **File:** Default, stores prompts/workflows in `/app/data` (map to host for persistence)
- **Postgres:** Set `STORAGE_TYPE=postgres` and provide `POSTGRES_CONNECTION_STRING`
- **MDC (Cursor Rules):** See advanced docs

## Support & Resources

- [GitHub Issues](https://github.com/sparesparrow/mcp-prompts/issues)
- [Official MCP Docs](https://github.com/modelcontextprotocol)
- See full user and API guides below for advanced usage

---

## 🌐 Advanced Deployment Scenarios

### Reverse Proxy (HTTPS, Domain Routing)

- **Recommended for production:** Use Nginx, Caddy, or Traefik to provide HTTPS and custom domain.
- **Example (Nginx):**

  ```nginx
  server {
    listen 443 ssl;
    server_name prompts.example.com;
    ssl_certificate /etc/letsencrypt/live/prompts.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/prompts.example.com/privkey.pem;

    location / {
      proxy_pass http://localhost:3003;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
    }
  }
  ```

- **Caddy (auto HTTPS):**
  ```caddyfile
  prompts.example.com {
    reverse_proxy localhost:3003
  }
  ```
- **Tip:** Always restrict direct access to port 3003 in production (firewall, security group).

### Cloud/VPS Deployment

- Open only necessary ports (e.g., 443 for HTTPS, 3003 for local testing).
- Use Docker or systemd for process management.
- Set environment variables securely (never commit secrets).

### Multi-Instance/High Availability

- Use Docker Compose or Kubernetes for scaling.
- Use a shared Postgres database for prompt/workflow storage.
- Place a load balancer (e.g., Nginx, Traefik) in front of multiple MCP-Prompts instances.
- For file storage, use a shared volume (NFS, cloud storage) or prefer Postgres for distributed setups.

---

## 🤖 Client Integration: Step-by-Step

### LM Studio

1. **Open LM Studio → Settings → Custom Servers**
2. **Add server:**
   - Name: `MCP Prompts`
   - URL: `https://your-domain.com` or `http://localhost:3003`
3. **API Key:** If required, enter in the custom header or API key field (if available). If not, use a reverse proxy to inject the header or request support.
4. **Test:** Open the prompt manager. Prompts should appear.
5. **Troubleshooting:**
   - 401/403: Check API key and server URL.
   - Not loading: Check network, firewall, and server logs.

### Cursor IDE

1. **Open Cursor IDE → Settings → AI → Prompt Management**
2. **Add resource server:**
   - URL: `https://your-domain.com/prompts` or `http://localhost:3003/prompts`
3. **API Key:** Enter in the custom header field if supported.
4. **Test:** Prompts should be visible in the resource browser.
5. **Troubleshooting:**
   - 401/403: Check API key.
   - Not loading: Check URL and server status.

### LibreChat

1. **Open LibreChat → Settings → Backend Resources**
2. **Add resource:**
   - Resource URL: `https://your-domain.com/prompts` or `http://localhost:3003/prompts`
3. **API Key:** Enter in the resource config if supported.
4. **Test:** Prompts should appear in the resource browser.
5. **Troubleshooting:**
   - 401/403: Check API key.
   - Not loading: Check URL and server status.

### Tasker (Android)

1. **Create HTTP Request action:**
   - Method: GET
   - URL: `http://<server>:3003/prompts`
   - Headers: `x-api-key: yourkey` (add custom header)
2. **Test:** Run the task and check for prompt data.
3. **Troubleshooting:**
   - Connection error: Check network and server status.
   - 401/403: Check API key header.

---

## 🖼️ Visual Aids & Screenshots

- **[ARCHITECTURE DIAGRAM PLACEHOLDER]**
  - (Contributors: add a diagram showing client(s) → reverse proxy → MCP-Prompts → storage)
- **[NETWORK FLOW DIAGRAM PLACEHOLDER]**
  - (Contributors: add a diagram showing API key flow, HTTPS, and SSE)
- **[SCREENSHOT PLACEHOLDERS]**
  - LM Studio: server config screen
  - Cursor IDE: resource server config
  - LibreChat: backend resource config
  - Tasker: HTTP request setup

---

# MCP-Prompts User Guide

This guide will walk you through setting up the MCP-Prompts server, creating your first prompt and workflow, and integrating it with your tools.

## 📚 Table of Contents

- [🚀 First Steps: Your First Workflow](#-first-steps-your-first-workflow)
  - [Step 1: Installation & Setup](#step-1-installation--setup)
  - [Step 2: Creating Your First Prompt](#step-2-creating-your-first-prompt)
  - [Step 3: Creating a Workflow](#step-3-creating-a-workflow)
  - [Step 4: Running the Workflow](#step-4-running-the-workflow)
- [🐳 Deployment Options](#-deployment-options)
  - [Local Deployment (npx)](#local-deployment-npx)
  - [Docker Deployment](#docker-deployment)
  - [Docker Compose (with PostgreSQL)](#docker-compose-with-postgresql)
- [🔑 API Key Authentication](#-api-key-authentication)
- [🩺 Health Check & Troubleshooting](#-health-check--troubleshooting)
- [🤖 Client Integration](#-client-integration)
- [🛡️ Production Security Checklist](#-production-security-checklist)

---

## 🚀 First Steps: Your First Workflow

This section will guide you through getting the server running and executing a complete workflow in just a few minutes.

### Step 1: Installation & Setup

The quickest way to get started is with `npx`, which runs the server without a permanent installation.

```bash
# Run the server with file-based storage
npx -y @sparesparrow/mcp-prompts
```

You should see a confirmation that the server is running on `http://localhost:3003`. For other installation methods like Docker, see the [Deployment Options](#-deployment-options) section below.

### Step 2: Creating Your First Prompt

Now, let's create a simple "Hello, World!" prompt. Open a new terminal and use `curl` to send a `POST` request to the `/prompts` endpoint.

```bash
curl -X POST http://localhost:3003/prompts \
-H "Content-Type: application/json" \
-d '{
  "id": "hello-world-prompt",
  "name": "Hello World",
  "content": "You are a helpful assistant. Please respond to the user by saying: {{greeting}}",
  "isTemplate": true
}'
```

You should receive a JSON response confirming the prompt was created.

### Step 3: Creating a Workflow

Next, let's create a workflow that uses this prompt. This workflow will have a single step that runs our "Hello, World!" prompt.

```bash
curl -X POST http://localhost:3003/workflows \
-H "Content-Type: application/json" \
-d '{
    "id": "hello-workflow",
    "name": "Hello Workflow",
    "steps": [
        {
            "id": "step1",
            "type": "prompt",
            "promptId": "hello-world-prompt",
            "input": {
                "greeting": "Hello from your first workflow!"
            },
            "output": "final_greeting"
        }
    ]
}'
```

This defines a workflow that will execute `hello-world-prompt` and pass "Hello from your first workflow!" as the `greeting` variable.

### Step 4: Running the Workflow

Finally, let's run the workflow. We do this by sending a `POST` request to the `/workflows/run/:id` endpoint.

```bash
curl -X POST http://localhost:3003/workflows/run/hello-workflow
```

You should get a result similar to this, showing the final output from your prompt:

```json
{
  "success": true,
  "outputs": {
    "final_greeting": "You are a helpful assistant. Please respond to the user by saying: Hello from your first workflow!"
  },
  "executionId": "some-unique-id"
}
```

Congratulations! You have successfully set up the server, created a prompt and a workflow, and executed it.

---

## 🐳 Deployment Options

### Local Deployment (npx)

```bash
# Easiest: npx (no install needed)
npx -y @sparesparrow/mcp-prompts
```

### Docker Deployment

```bash
docker run -d --name mcp-prompts \
  -p 3003:3003 \
  -e HTTP_SERVER=true \
  -e STORAGE_TYPE=file \
  -v $(pwd)/data:/app/data \
  sparesparrow/mcp-prompts:latest
```

### Docker Compose (with PostgreSQL)

See `docker-compose.yml` in the repository for a full example with PostgreSQL.

---

## 🔑 API Key Authentication

- For production, set the `API_KEYS` environment variable (e.g., `API_KEYS=key1,key2`).
- If set, all API requests (except `/health`) must include an `x-api-key` header.
  ```bash
  curl -H "x-api-key: yourkey" http://localhost:3003/prompts
  ```

---

## 🩺 Health Check & Troubleshooting

- **Health Check:** `curl http://localhost:3003/health`
- **Logs:** Logs are printed to `stdout`. For Docker, use `docker logs mcp-prompts`.

---

## 🤖 Client Integration

See the client integration guides in the `docs` folder for step-by-step instructions for tools like LM Studio, Cursor, and LibreChat.

---

## 🛡️ Production Security Checklist

- [ ] Set strong, unique `API_KEYS`.
- [ ] Use a reverse proxy (Nginx, Caddy) to provide HTTPS.
- [ ] Use a persistent storage option (Postgres or Docker volumes).
- [ ] Regularly back up your data.
- [ ] Monitor server logs and health.

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
version: '3'
services:
  prompts:
    image: sparesparrow/mcp-prompts:latest
    environment:
      HTTP_SERVER: 'true'
      STORAGE_TYPE: 'postgres'
      POSTGRES_CONNECTION_STRING: 'postgresql://postgres:password@db:5432/mcp_prompts'
    ports: ['3003:3003']
    depends_on: [db]
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

| Issue                    | Solution                                                                  |
| ------------------------ | ------------------------------------------------------------------------- |
| Cannot connect to server | Ensure MCP-Prompts is running and accessible at `http://localhost:3003`.  |
| Port 3003 already in use | Stop other services or change the port in both MCP-Prompts and LM Studio. |
| Prompts not showing up   | Check server logs for errors; verify correct URL in LM Studio settings.   |

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

| Issue                    | Solution                                                                  |
| ------------------------ | ------------------------------------------------------------------------- |
| Cannot connect to server | Ensure MCP-Prompts is running and accessible at `http://localhost:3003`.  |
| Port 3003 already in use | Stop other services or change the port in both MCP-Prompts and LibreChat. |
| Prompts not showing up   | Check server logs for errors; verify correct URL in LibreChat settings.   |

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
   - **Downloadable Example:** [examples/tasker-fetch-prompts.xml](./examples/tasker-fetch-prompts.xml)

4. **Test Integration**
   - Trigger the Tasker profile or task.
   - You should see the prompt data retrieved from MCP-Prompts.

#### Troubleshooting Tasker Integration

| Issue                       | Solution                                                                                                          |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Cannot connect to server    | Ensure MCP-Prompts is running and accessible from your Android device.                                            |
| Network unreachable         | Make sure your Android device and server are on the same Wi-Fi network.                                           |
| Prompts not showing up      | Check server logs for errors; verify correct URL and port in Tasker.                                              |
| HTTP Request action missing | Update Tasker to the latest version; see [Tasker User Guide](https://tasker.joaoapps.com/userguide/en/) for help. |

#### Quick Reference Checklist

- [ ] MCP-Prompts server is running and accessible from Android
- [ ] Tasker HTTP Request action uses correct server IP and port
- [ ] No firewall or network isolation between Android and server
- [ ] Tasker profile/task triggers and displays prompt data

### Android Automation Scripts

You can also use a shell script (e.g., with Termux) to fetch prompts from MCP-Prompts:

```sh
bash examples/android-fetch-prompt.sh
```

See [examples/android-fetch-prompt.sh](./examples/android-fetch-prompt.sh) for a ready-to-use script.

> Contributions of more advanced Tasker profiles or Android automation scripts are welcome! Submit a PR to the `examples/` directory.

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

| Issue                    | Solution                                                                   |
| ------------------------ | -------------------------------------------------------------------------- |
| Cannot connect to server | Ensure MCP-Prompts is running and accessible at `http://localhost:3003`.   |
| Port 3003 already in use | Stop other services or change the port in both MCP-Prompts and Cursor IDE. |
| Prompts not showing up   | Check server logs for errors; verify correct URL in Cursor IDE settings.   |

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
   - You should see a slider/tool icon in the chat input area. Click it to access MCP tools and prompts.

4. **Test Integration**
   - You should see a slider/tool icon in the chat input area. Click it to access MCP tools and prompts.

#### Troubleshooting Claude Desktop Integration

| Issue                        | Solution                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------ |
| Cannot connect to server     | Ensure MCP-Prompts is running and accessible at `http://localhost:3003`.       |
| Port 3003 already in use     | Stop other services or change the port in both MCP-Prompts and Claude Desktop. |
| Prompts/tools not showing up | Check server logs for errors; verify correct config in Claude Desktop.         |

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

---

## 🛠️ Advanced Usage & API Examples

### Common API Calls (with curl)

- **List prompts:**
  ```bash
  curl -H "x-api-key: yourkey" http://localhost:3003/prompts
  ```
- **Add a prompt:**
  ```bash
  curl -X POST -H "x-api-key: yourkey" -H "Content-Type: application/json" \
    -d '{"id":"my-prompt","name":"Test","content":"Say hello!"}' \
    http://localhost:3003/prompts
  ```
- **Update a prompt:**
  ```bash
  curl -X PUT -H "x-api-key: yourkey" -H "Content-Type: application/json" \
    -d '{"name":"Updated name"}' \
    http://localhost:3003/prompts/my-prompt
  ```
- **Delete a prompt:**
  ```bash
  curl -X DELETE -H "x-api-key: yourkey" http://localhost:3003/prompts/my-prompt
  ```
- **List workflows:**
  ```bash
  curl -H "x-api-key: yourkey" http://localhost:3003/workflows
  ```
- **Run a workflow:**
  ```bash
  curl -X POST -H "x-api-key: yourkey" http://localhost:3003/workflows/run/<workflowId>
  ```

### Using HTTPie (alternative to curl)

```bash
http GET :3003/prompts x-api-key:yourkey
http POST :3003/prompts x-api-key:yourkey id=my2 name=Test2 content='Hi!'
```

### Using Postman

- Set the request URL and method as above.
- Add `x-api-key` header with your key.
- For POST/PUT, set body to raw JSON.

---

### Workflows & Templates

- **Templates** allow variables in prompt content, e.g.:
  ```json
  {
    "id": "code-review-assistant",
    "name": "Code Review Assistant",
    "content": "Please review: {{code}}",
    "isTemplate": true,
    "variables": ["code"]
  }
  ```
- **To use:**
  - In a client, select the template, fill in variables, and submit.
  - Via API, POST to `/prompts/apply-template` (see API docs for details).
- **Workflows** chain multiple steps (see `/workflows` endpoint and API docs).

---

### Server-Sent Events (SSE) Example

- **Enable SSE:** Set `ENABLE_SSE=true` and connect to `/events`.
- **Sample JS client:**
  ```js
  const es = new EventSource('http://localhost:3003/events');
  es.onmessage = e => console.log('SSE:', e.data);
  es.onerror = err => es.close();
  ```
- **Use case:** Get real-time updates when prompts or workflows change.

---

## 🧩 Troubleshooting & FAQ (Advanced)

| Problem                           | Solution/Tip                                                                   |
| --------------------------------- | ------------------------------------------------------------------------------ |
| CORS error in browser             | Set allowed origins via CORS env vars (see README); use HTTPS in production    |
| Rate limit exceeded (429)         | Increase limits via env vars or slow down requests                             |
| Postgres migration needed         | Export prompts to file, import to new DB; see migration utility (if available) |
| File permission denied            | Ensure Docker volume/host dir is writable by container user                    |
| Logs unclear                      | Increase log level (if supported); check for stack traces and error codes      |
| SSE not receiving events          | Check network/firewall, ensure SSE enabled, use correct endpoint               |
| API key works in curl, not client | Check for header typos, client proxying, or CORS issues                        |
| Workflow not running              | Check workflow definition, logs, and API docs for required fields              |

---

## 🤝 Contributing

We welcome contributions to MCP-Prompts documentation and code!

### Documentation

- **Screenshots:** Add PNGs to the `images/` directory and update Markdown links.
- **Diagrams:** Add architecture or network diagrams (SVG/PNG) to `images/` and reference in the guide.
- **Translations:** Help keep the Czech and English guides in sync, or add new languages.
- **FAQ & Examples:** Expand the FAQ or add real-world usage examples.
- **How to contribute:** Fork the repo, make your changes, and submit a pull request (PR).

### Code

- **Fork and branch:** Fork the repo and create a feature branch.
- **Code style:** Follow the code style and linting rules (see README and `.eslintrc.js`).
- **Tests:** Add or update tests for new features or bugfixes.
- **Pull requests:** Submit PRs with a clear description and reference related issues if applicable.

### Questions & Feature Requests

- **GitHub Issues:** [https://github.com/sparesparrow/mcp-prompts/issues](https://github.com/sparesparrow/mcp-prompts/issues)
- **Discussions:** Use GitHub Discussions or open an issue for questions, ideas, or feedback.

### Syncing Guides

- If you update the English guide, please update the Czech guide (and vice versa) to keep them aligned.

---

## 🏷️ Versioning & Updates

- **Check current version:**
  - CLI: `mcp-prompts --version` or `npx @sparesparrow/mcp-prompts --version`
  - Docker: `docker run sparesparrow/mcp-prompts:latest --version`
  - npm: `npm list @sparesparrow/mcp-prompts` or check `package.json`
- **Upgrade:**
  - Docker: `docker pull sparesparrow/mcp-prompts:latest`
  - npm: `npm install -g @sparesparrow/mcp-prompts`
- **Release notes & changelog:**
  - See [CHANGELOG.md](./CHANGELOG.md) in the repo or GitHub Releases page
- **Versioning:**
  - MCP-Prompts uses [semantic versioning](https://semver.org/). Major version changes may include breaking changes; minor/patch are backward compatible.

---

## 🫂 Support & Community

- **GitHub Issues:** For bugs, feature requests, and questions: [https://github.com/sparesparrow/mcp-prompts/issues](https://github.com/sparesparrow/mcp-prompts/issues)
- **Discussions:** For ideas, help, and community chat: GitHub Discussions tab
- **Discord/Community:** (If available, link here)
- **Etiquette:** Be respectful, provide details (logs, steps, version), and check existing issues before posting
- **Response times:** Maintainers aim to respond within a few days; community help may be faster

---

_Last updated: [YYYY-MM-DD]_
