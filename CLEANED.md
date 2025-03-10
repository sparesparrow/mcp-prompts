# MCP TypeScript Prompt Manager - Cleaned Repository

This repository has been cleaned up and organized for better maintainability.

## Directory Structure

- `src/`: Source code
- `build/`: Compiled JavaScript
- `config/`: Configuration files
  - `config/docker/`: Docker-related configuration
- `prompts/`: Sample prompt templates
- `node_modules/`: Dependencies (git-ignored)

## Docker Support

The repository now includes a single Dockerfile that works reliably for both development and production.

## Development Workflow

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the TypeScript code:
   ```bash
   npm run build
   ```

3. Run the server locally:
   ```bash
   node build/index.js
   ```

4. Build and run in Docker:
   ```bash
   docker build -t mcp-prompts-ts:latest .
   docker run --rm -i -v mcp-prompts-ts-data:/data -v /path/to/prompts:/data/prompts mcp-prompts-ts:latest
   ```
