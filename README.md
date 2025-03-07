# MCP Prompts Server

An MCP server for managing prompts and templates using a simplified architecture following SOLID principles.

## Features

- **Simplified Architecture**: Clean, maintainable codebase with SOLID principles
- **Prompt Management**: Create, retrieve, update, and delete prompts
- **Template Support**: Create prompts with variables that can be filled in at runtime
- **Focused Storage Adapters**: File storage adapter with extensibility for PostgreSQL
- **MCP Protocol Integration**: Seamless integration with Model Context Protocol
- **Docker Support**: Easy deployment with Docker and Docker Compose
- **Categories**: Organize prompts by category (e.g., 'development', 'project-orchestration')

## Installation

### Prerequisites

- Node.js 18 or later
- Docker (optional for containerized deployment)

### Quick Setup

Clone the repository and run the setup script:

```bash
git clone https://github.com/yourusername/mcp-prompts.git
cd mcp-prompts
./setup.sh
```

The setup script will:
1. Install dependencies
2. Create the necessary directories
3. Build the application
4. Set up environment variables

### Manual Setup

#### 1. Install dependencies

```bash
npm install
```

#### 2. Configure environment variables

Create a `.env` file in the root directory:

```
# Storage configuration
STORAGE_TYPE=file
PROMPTS_DIR=./prompts

# Server configuration
SERVER_NAME=mcp-prompts
SERVER_VERSION=1.0.0
LOG_LEVEL=info
```

#### 3. Build the application

```bash
npm run build
```

### Docker Setup

The project can be deployed using Docker:

```bash
# Build and start with Docker Compose
npm run docker:up

# Stop the containers
npm run docker:down
```

## Usage

### Starting the Server

```bash
# Start the server
npm start

# Start in development mode (with auto-reload)
npm run dev
```

### MCP Tools

The MCP Prompts Server exposes the following tools:

#### `add_prompt`

Add a new prompt.

```json
{
  "prompt": {
    "name": "Enhanced Code Review",
    "content": "Please review this code and provide detailed feedback...",
    "description": "A template for requesting advanced code reviews",
    "isTemplate": true,
    "tags": ["code", "review", "feedback"],
    "category": "development"
  }
}
```

#### `get_prompt`

Get a prompt by ID.

```json
{
  "id": "enhanced-code-review"
}
```

#### `update_prompt`

Update an existing prompt.

```json
{
  "id": "enhanced-code-review",
  "prompt": {
    "name": "Enhanced Code Review",
    "content": "Updated content...",
    "tags": ["code", "review", "updated"]
  }
}
```

#### `list_prompts`

List all prompts with optional filtering.

```json
{
  "tags": ["code", "review"],
  "isTemplate": true,
  "category": "development",
  "search": "review",
  "sort": "name",
  "order": "asc"
}
```

#### `apply_template`

Apply variables to a template prompt.

```json
{
  "id": "enhanced-code-review",
  "variables": {
    "language": "TypeScript",
    "focus": "performance optimization"
  }
}
```

#### `delete_prompt`

Delete a prompt by ID.

```json
{
  "id": "enhanced-code-review"
}
```

## Storage Options

The server supports multiple storage options:

### File Storage

Stores prompts as JSON files in a directory. Simple and easy to set up, ideal for individual use or small teams.

### Future Storage Options

The architecture is designed for easy extension to support other storage options like PostgreSQL or in-memory storage.

## Simplified Architecture

The project follows a simplified architecture with clear separation of concerns:

```
src/
├── adapters/          # Storage adapters for persistence
├── core/              # Core types and utilities
├── services/          # Business logic services
├── config.ts          # Configuration management
└── index.ts           # Main entry point with MCP tools
```

### SOLID Principles

The codebase follows SOLID principles:
- **Single Responsibility**: Each class has a single responsibility
- **Open/Closed**: Extensible for new features without modifying existing code
- **Liskov Substitution**: Storage adapters are interchangeable
- **Interface Segregation**: Clean, focused interfaces
- **Dependency Inversion**: High-level modules depend on abstractions

## Integration with Other MCP Servers

The MCP Prompts Server is designed to work seamlessly with other MCP servers. An extended Docker Compose configuration is provided in `docker-compose.full.yml` that demonstrates integration with:

- Filesystem Server
- Memory Server
- GitHub Server

## Development

### Testing

```bash
# Run all tests
npm test
```

### Linting and Formatting

```bash
# Lint the code
npm run lint

# Format the code
npm run format
```

### Building

```bash
# Build the application
npm run build

# Clean build artifacts
npm run clean
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.