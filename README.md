# MCP Prompt Manager

An MCP server for managing prompts and templates with project orchestration capabilities.

## Features

- **Prompt Management**: Create, retrieve, update, and delete prompts
- **Template Support**: Create prompts with variables that can be filled in at runtime
- **Project Orchestration**: Automate software project creation using templates and design patterns
- **Multiple Storage Options**: File storage and PostgreSQL database adapters
- **Database Export/Import**: Tools for exporting prompts to PostgreSQL database
- **Backup and Restore**: Create backups and restore from backups
- **MCP Protocol Integration**: Seamless integration with Model Context Protocol
- **Docker Support**: Easy deployment with Docker and Docker Compose
- **Categories**: Organize prompts by category (e.g., 'development', 'project-orchestration')

## Quick Start with NPX

The fastest way to use this package is with npx in a fresh container or environment:

```bash
# Run directly without installation using npx
npx -y @sparesparrow/mcp-prompt-manager

# To test with MCP Inspector
npx @modelcontextprotocol/inspector npx -y @sparesparrow/mcp-prompt-manager
```

### Using in Docker

```bash
# Run in a Docker container
docker run -it --rm node:18-alpine sh -c "npx -y @sparesparrow/mcp-prompt-manager"
```

## Installation

### Prerequisites

- Node.js 18 or later
- npm 7 or later
- PostgreSQL (optional for database storage)
- Docker (optional for containerized deployment)
- Claude Desktop (for integration)

### Installation from NPM

The easiest way to use MCP Prompt Manager is via the NPM registry:

```bash
# Install globally
npm install -g @sparesparrow/mcp-prompt-manager

# Or run directly with npx without installation
npx @sparesparrow/mcp-prompt-manager
```

### Manual Installation

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

### Claude Desktop Configuration

Add the following to your Claude Desktop configuration file:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "prompt-manager-ts": {
      "command": "npx",
      "args": [
        "-y",
        "@sparesparrow/mcp-prompt-manager"
      ]
    }
  }
}
```

For a local installation:

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

### Docker Installation

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

### Automatic Installation

For convenience, we provide a script that automates the installation process:

```bash
# Make the script executable
chmod +x setup.sh

# Run the installation script
./setup.sh
```

## Usage

### Accessing Prompts

#### Listing Available Prompts

To see what prompts are available:

```
use_mcp_tool({
  server_name: "mcp-prompts",
  tool_name: "list_prompts",
  arguments: {}
});
```

To filter by tags:

```
use_mcp_tool({
  server_name: "mcp-prompts",
  tool_name: "list_prompts",
  arguments: {
    tags: ["development"]
  }
});
```

You can also filter by category, template status, or use search:

```
use_mcp_tool({
  server_name: "mcp-prompts",
  tool_name: "list_prompts",
  arguments: {
    isTemplate: true,
    category: "development",
    search: "workflow"
  }
});
```

#### Getting a Specific Prompt

To retrieve a specific prompt by ID:

```
use_mcp_tool({
  server_name: "mcp-prompts",
  tool_name: "get_prompt",
  arguments: {
    id: "development-workflow"
  }
});
```

#### Using a Template Prompt

To apply variables to a template prompt:

```
use_mcp_tool({
  server_name: "mcp-prompts",
  tool_name: "apply_template",
  arguments: {
    id: "development-system-prompt",
    variables: {
      "project_type": "web frontend",
      "language": "JavaScript/React",
      "project_name": "TaskManager",
      "project_goal": "create a task management application with drag-and-drop functionality",
      "technical_context": "Using React 18, TypeScript, and Material UI"
    }
  }
});
```

### Managing Prompts

#### Adding a New Prompt

To add a new prompt:

```
use_mcp_tool({
  server_name: "mcp-prompts",
  tool_name: "add_prompt",
  arguments: {
    prompt: {
      name: "Bug Report Template",
      description: "Template for submitting bug reports",
      content: "## Bug Report\n\n### Description\n{{description}}\n\n### Steps to Reproduce\n{{steps}}\n\n### Expected Behavior\n{{expected}}\n\n### Actual Behavior\n{{actual}}\n\n### Environment\n{{environment}}",
      isTemplate: true,
      tags: ["bug", "template", "documentation"],
      category: "development"
    }
  }
});
```

#### Updating an Existing Prompt

To update an existing prompt:

```
use_mcp_tool({
  server_name: "mcp-prompts",
  tool_name: "update_prompt",
  arguments: {
    id: "development-workflow",
    prompt: {
      content: "Updated workflow content here...",
      tags: ["development", "workflow", "python", "updated"]
    }
  }
});
```

#### Deleting a Prompt

To delete a prompt:

```
use_mcp_tool({
  server_name: "mcp-prompts",
  tool_name: "delete_prompt",
  arguments: {
    id: "outdated-prompt"
  }
});
```

### Tips for Effective Prompt Management

1. **Use Consistent Naming**: Name prompts clearly and consistently for easy discovery
2. **Tag Effectively**: Use tags to organize prompts by purpose, project, or context
3. **Templatize Reusable Prompts**: Create templates for frequently used prompts with variables
4. **Update Regularly**: Keep your prompts up-to-date as your needs change
5. **Share with Team**: Share effective prompts with your team for consistent interactions
6. **Use Categories**: Organize prompts into categories for better organization
7. **Leverage Search**: Use the search functionality to find prompts quickly

## Roadmap

### Completed (v1.3.0)

- ✅ Implemented simplified architecture following SOLID principles
- ✅ Created unified core types in a single file
- ✅ Implemented focused storage adapters with file-based storage
- ✅ Created streamlined prompt service
- ✅ Simplified configuration management
- ✅ Streamlined MCP server implementation with tools
- ✅ Removed complex CLI interface in favor of focused MCP tools
- ✅ Improved error handling with proper TypeScript types
- ✅ Created Docker and Docker Compose configurations for easy deployment

### Upcoming Improvements

#### Phase 1: Testing
- [ ] Add comprehensive Jest tests for all components
- [ ] Add integration tests for the MCP tools
- [ ] Set up test coverage reporting

#### Phase 2: Additional Adapters
- [ ] Implement PostgreSQL storage adapter
- [ ] Implement in-memory storage adapter
- [ ] Add adapter selection based on configuration

#### Phase 3: Documentation
- [ ] Add JSDoc comments to all public interfaces and classes
- [ ] Create API documentation with TypeDoc
- [ ] Add more examples in documentation

#### Phase 4: CI/CD
- [ ] Set up GitHub Actions for continuous integration
- [ ] Add automated testing on pull requests
- [ ] Set up automatic versioning and releases

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

For more help, check the logs or open an issue on the GitHub repository.

## Project Orchestration

The Project Orchestrator feature enables automated software project creation using templates and design patterns.

### How It Works

1. **Templates**: The system includes predefined project templates and component templates for various software architectures and design patterns.

2. **Project Creation Process**:
   - Analyze the project idea to identify suitable design patterns
   - Select the most appropriate project template
   - Generate comprehensive project documentation and structure
   - Create a detailed implementation plan

3. **Generated Output**:
   - Structured project directory
   - README.md with implementation plan
   - Basic configuration files
   - Source code placeholders

### Available Project Templates

- **MicroservicesArchitectureProject**: Microservice-based architecture with multiple small, loosely coupled services
- **EventDrivenArchitectureProject**: Architecture based on production and reaction to events
- **RepositoryPatternProject**: Data access abstraction with Repository pattern
- **CQRSProject**: Command Query Responsibility Segregation architecture
- **ClientServerProject**: Basic client-server architecture
- And many more design pattern implementations

### Component Templates

The system includes templates for various design patterns:
- Factory Method
- Abstract Factory
- Builder
- Singleton
- Adapter
- Decorator
- Observer
- Strategy
- And many more

### Using the Project Orchestrator

1. First, initialize the project orchestrator templates:
   ```
   init_project_orchestrator
   ```

2. List available project templates to find the most suitable one:
   ```
   list_project_templates
   ```

3. Create a new project:
   ```
   create_project
   {
     "project_name": "EcommerceApp",
     "project_idea": "An e-commerce application with user authentication, product catalog, and order processing.",
     "output_directory": "/home/sparrow/projects/ecommerce-app"
   }
   ```

4. Follow the implementation plan in the generated README.md file to develop your project.

## Storage Options

The server supports multiple storage options:

### File Storage

Stores prompts as JSON files in a directory. Simple and easy to set up, ideal for individual use or small teams.

### PostgreSQL Storage

Stores prompts in a PostgreSQL database. Suitable for production environments and teams with more complex requirements.

To use PostgreSQL storage:

1. Configure your database connection string in the `.env` file:
   ```
   STORAGE_TYPE=postgres
   PG_CONNECTION_STRING=postgresql://username:password@hostname/database
   ```

2. The server will automatically create the necessary tables on startup.

### Exporting and Importing Prompts

Regardless of your primary storage configuration, you can export prompts to a PostgreSQL database for backup or sharing purposes using the database tools:

- `export_prompts_to_db`: Export prompts from file storage to PostgreSQL
- `import_prompts_from_db`: Import prompts from PostgreSQL to file storage
- `sync_prompts`: Synchronize prompts between file storage and PostgreSQL

Before exporting, ensure you have a valid PostgreSQL connection string in your environment variables:
```
PG_CONNECTION_STRING=postgresql://localhost/mydb
```

### Backups

The server includes robust backup functionality:

- Automatic backups are created before export/import operations
- Manual backups can be created with the `create_backup` tool
- Backups can be listed and restored with `list_backups` and `restore_backup`

All backups are stored in the `backups` directory with timestamped folders.

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

### Publishing to NPM

To publish to NPM registry:

```bash
# Ensure you're logged in to NPM
npm login

# Build and publish
npm run build
npm publish --access=public
```

### Docker Setup

The project can be deployed using Docker:

```bash
# Build Docker image
npm run docker:build

# Build and start with Docker Compose
npm run docker:up

# Stop the containers
npm run docker:down
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.