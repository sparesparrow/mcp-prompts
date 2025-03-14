# MCP Prompts Server

An MCP server for managing prompts and templates with project orchestration capabilities. Part of the Model Context Protocol ecosystem.

<a href="https://glama.ai/mcp/servers/i0z4f3pr82">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/i0z4f3pr82/badge" alt="Prompts Server MCP server" />
</a>

This server provides a simple way to store, retrieve, and apply templates for AI prompts, making it easier to maintain consistent prompting patterns across your AI applications.

## Features

- Store and retrieve prompts
- Create and use templates with variables
- List prompts with filtering by tags
- Apply variables to templates
- Multiple storage backends (file system and PostgreSQL)
- Easy to use with Claude and other AI assistants

## Installation

### Using npx (recommended)

```bash
npx -y @sparesparrow/mcp-prompts
```

### Global installation

```bash
npm install -g @sparesparrow/mcp-prompts
```

### Using Docker

```bash
docker run -p 3003:3003 -v ~/mcp/data:/app/data sparesparrow/mcp-prompts:latest
```

## Configuration

The server can be configured using environment variables:

| Environment Variable | Description | Default |
|----------------------|-------------|---------|
| SERVER_NAME | Server name | MCP Prompts Server |
| SERVER_VERSION | Server version | package.json version |
| STORAGE_TYPE | Storage type: 'file' or 'postgres' | file |
| PROMPTS_DIR | Directory for storing prompts | ~/mcp/data/prompts |
| BACKUPS_DIR | Directory for backups | ~/mcp/data/backups |
| PORT | Port for HTTP server | 3003 |
| LOG_LEVEL | Logging level | info |
| HTTP_SERVER | Enable HTTP server | false |
| HOST | Host for HTTP server | 0.0.0.0 |

### PostgreSQL settings (required if STORAGE_TYPE=postgres)

| Environment Variable | Description | Default |
|----------------------|-------------|---------|
| PG_HOST | PostgreSQL host | localhost |
| PG_PORT | PostgreSQL port | 5432 |
| PG_DATABASE | PostgreSQL database name | mcp_prompts |
| PG_USER | PostgreSQL username | postgres |
| PG_PASSWORD | PostgreSQL password | |
| PG_SSL | Use SSL for PostgreSQL connection | false |
| POSTGRES_CONNECTION_STRING | Full PostgreSQL connection string (overrides individual settings) | |

## Usage

### Using with Claude

In Claude 3 desktop app, you can configure the MCP Prompts server in your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "prompts": {
      "command": "npx",
      "args": [
        "-y",
        "@sparesparrow/mcp-prompts"
      ],
      "env": {
        "STORAGE_TYPE": "file",
        "PROMPTS_DIR": "/path/to/your/prompts/directory",
        "LOG_LEVEL": "debug"
      }
    }
  }
}
```

### Available Tools

The MCP Prompts server provides the following tools:

- `add_prompt`: Add a new prompt
- `get_prompt`: Get a prompt by ID
- `update_prompt`: Update an existing prompt
- `list_prompts`: List all prompts
- `delete_prompt`: Delete a prompt by ID
- `apply_template`: Apply variables to a prompt template

### HTTP Endpoints

If the HTTP server is enabled, the following endpoints are available:

- `/health`: Health check endpoint
- `/`: Alias for health check endpoint

## Prompt Format

A prompt has the following structure:

```json
{
  "id": "unique-id",
  "name": "Prompt Name",
  "description": "Optional description",
  "content": "The prompt content with {{variables}}",
  "tags": ["tag1", "tag2"],
  "isTemplate": true,
  "variables": ["variable1", "variable2"],
  "metadata": {
    "author": "Your Name",
    "version": "1.0.0"
  }
}
```

## Development

To set up the development environment:

```bash
git clone https://github.com/sparesparrow/mcp-prompts.git
cd mcp-prompts
npm install
npm run build
npm run dev
```

### Testing

Run the tests:

```bash
npm test
```

Run the MCP Inspector for testing:

```bash
npm run test:inspector
```

## License

MIT