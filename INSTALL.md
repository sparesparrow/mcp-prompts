# Installation Guide for MCP Prompts Server

This document provides detailed instructions for installing and setting up the MCP Prompts server.

## Prerequisites

- Node.js 18 or later
- npm 7 or later
- Claude Desktop (for integration)

## Manual Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/mcp-prompts.git
   cd mcp-prompts
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create environment file**
   Create a `.env` file in the project root:
   ```
   # Storage configuration
   STORAGE_TYPE=file
   PROMPTS_DIR=./prompts
   
   # Server configuration
   SERVER_NAME=mcp-prompts
   SERVER_VERSION=1.0.0
   LOG_LEVEL=info
   ```

4. **Build the project**
   ```bash
   npm run build
   ```

5. **Configure Claude Desktop**

   Edit your Claude Desktop configuration file:
   
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Linux**: `~/.config/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

   Add the following configuration:
   
   ```json
   {
     "mcpServers": {
       "mcp-prompts": {
         "command": "node",
         "args": ["/absolute/path/to/mcp-prompts/build/index.js"]
       }
     }
   }
   ```

   Replace `/absolute/path/to` with the actual absolute path to your project directory.

6. **Restart Claude Desktop**

   Close and reopen Claude Desktop to load the MCP server.

## Docker Installation

For a Docker-based installation:

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/mcp-prompts.git
   cd mcp-prompts
   ```

2. **Build and start with Docker Compose**
   ```bash
   npm run docker:up
   ```

3. **Configure Claude Desktop to use the containerized server**
   
   Edit your Claude Desktop configuration file:
   
   ```json
   {
     "mcpServers": {
       "mcp-prompts": {
         "command": "docker",
         "args": ["exec", "-i", "mcp-prompts", "node", "/app/build/index.js"]
       }
     }
   }
   ```

## Automatic Installation

For convenience, we provide a script that automates the installation process:

```bash
# Make the script executable
chmod +x setup.sh

# Run the installation script
./setup.sh
```

The script will:
1. Install dependencies
2. Create necessary directories
3. Build the project
4. Guide you through Claude Desktop configuration

## Verifying Installation

After installation, you can verify that the server is working by:

1. Opening Claude Desktop
2. Typing "/" in the chat input to see if prompts from the server appear
3. Testing with a simple tool call:
   ```
   use_mcp_tool({
     server_name: "mcp-prompts",
     tool_name: "list_prompts",
     arguments: {}
   });
   ```

## Integration with Other MCP Servers

The MCP Prompts Server can be integrated with other MCP servers:

```bash
# Start with extended Docker Compose configuration
docker-compose -f docker-compose.full.yml up -d
```

This will start:
- MCP Prompts Server
- Filesystem Server
- Memory Server
- GitHub Server (requires GITHUB_TOKEN environment variable)

## Troubleshooting

If you encounter issues:

1. **Server not appearing in Claude**
   - Check that the path in your configuration is correct and absolute
   - Verify that the server builds successfully
   - Check Claude's logs for any error messages

2. **Cannot find prompts**
   - Verify that the `prompts` directory exists
   - Check storage configuration in the `.env` file

3. **Import failures**
   - Make sure you're using the correct format for the MCP tools
   - Check that the data you're providing matches the expected schema

4. **Permission issues with Docker**
   - Make sure Docker is running and you have appropriate permissions
   - Try running Docker commands with sudo if necessary

For more help, check the logs or open an issue on the GitHub repository.