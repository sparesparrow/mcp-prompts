# MCP Prompts Server - MCP Mode

The MCP Prompts server can run in two modes:
1. **HTTP Mode** - Traditional REST API server
2. **MCP Mode** - Model Context Protocol server for AI assistants

## MCP Server Features

### Available Tools

1. **add_prompt** - Add a new prompt to the collection
2. **get_prompt** - Get a prompt by its ID
3. **list_prompts** - List all available prompts with optional filtering
4. **update_prompt** - Update an existing prompt
5. **delete_prompt** - Delete a prompt by its ID
6. **apply_template** - Apply variables to a template prompt

### Tool Usage Examples

#### Adding a Prompt
```json
{
  "name": "Code Review Assistant",
  "content": "Please review this code for best practices and potential issues: {{code}}",
  "isTemplate": true,
  "tags": ["code-review", "assistant"],
  "variables": [
    {
      "name": "code",
      "description": "The code to review",
      "required": true,
      "type": "string"
    }
  ]
}
```

#### Listing Prompts
```json
{
  "tags": ["assistant"],
  "search": "code"
}
```

#### Applying Template Variables
```json
{
  "id": "prompt_123",
  "variables": {
    "code": "function hello() { console.log('Hello World'); }"
  }
}
```

## Installation & Usage

### Local Development

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Build the project:**
   ```bash
   pnpm run build
   ```

3. **Start in MCP mode:**
   ```bash
   pnpm run start:mcp
   ```

### Docker

1. **Build MCP Docker image:**
   ```bash
   pnpm run docker:build:mcp
   ```

2. **Run with Docker Compose:**
   ```bash
   pnpm run docker:up:mcp
   ```

3. **View logs:**
   ```bash
   pnpm run docker:logs:mcp
   ```

### Cursor Integration

1. **Configure Cursor MCP:**
   Add to `.cursor/mcp.json`:
   ```json
   {
     "mcpServers": {
       "mcp-prompts": {
         "command": "node",
         "args": ["dist/index.js"],
         "env": {
           "MODE": "mcp"
         }
       }
     }
   }
   ```

2. **Restart Cursor** to load the MCP server

3. **Use in Cursor:**
   - The MCP tools will be available in Cursor's AI assistant
   - You can ask Cursor to manage prompts using natural language

## Environment Variables

- `MODE` - Set to `mcp` for MCP server mode (default: `http`)
- `NODE_ENV` - Environment mode (development/production)
- `LOG_LEVEL` - Logging level (debug/info/warn/error)

## Data Storage

Currently, the MCP server uses in-memory storage. Prompts are lost when the server restarts. For production use, consider implementing persistent storage adapters.

## Testing with MCP Inspector

1. **Install MCP Inspector:**
   ```bash
   npm install -g @modelcontextprotocol/inspector
   ```

2. **Test the server:**
   ```bash
   mcp-inspector --command "node dist/index.js" --env MODE=mcp
   ```

## Development

### Adding New Tools

1. Add tool definition in `src/mcp-server.ts`
2. Implement the handler function
3. Add proper validation using Zod schemas
4. Test with MCP Inspector

### Error Handling

All tools include proper error handling and logging. Errors are returned to the client with descriptive messages.

## Troubleshooting

### Common Issues

1. **Server won't start in MCP mode:**
   - Check that `MODE=mcp` environment variable is set
   - Verify all dependencies are installed
   - Check logs for specific error messages

2. **Tools not available in Cursor:**
   - Restart Cursor after updating `.cursor/mcp.json`
   - Verify the MCP server is running
   - Check Cursor's MCP server logs

3. **Build errors:**
   - Run `pnpm run build:clean` to clean and rebuild
   - Check TypeScript configuration
   - Verify all imports are correct

## Contributing

1. Fork the repository
2. Create a feature branch
3. Implement your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
