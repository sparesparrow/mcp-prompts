# MCP Prompt Manager

An MCP server for managing prompts and templates with project orchestration capabilities.

<a href="https://glama.ai/mcp/servers/i0z4f3pr82">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/i0z4f3pr82/badge" alt="Prompts Server MCP server" />
</a>

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

## Installation

### Prerequisites

- Node.js 18 or later
- PostgreSQL (optional for database storage)
- Docker (optional for containerized deployment)

### Installation from NPM

The easiest way to use MCP Prompt Manager is via the NPM registry:

```bash
# Install globally
npm install -g @sparesparrow/mcp-prompt-manager

# Or run directly with npx without installation
npx @sparesparrow/mcp-prompt-manager
```

### Claude Desktop Configuration

Add the following to your Claude Desktop configuration file (usually located at `~/.config/Claude/config.json`):

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

### Manual Setup from Source

If you prefer to build from source:

#### 1. Clone the repository

```bash
git clone https://github.com/sparesparrow/mcp-prompt-manager.git
cd mcp-prompt-manager
```

#### 2. Install dependencies

```bash
npm install
```

#### 3. Configure environment variables

Create a `.env` file in the root directory:

```
# Storage configuration
# Possible values: file, postgres, memory
STORAGE_TYPE=file

# File storage configuration
PROMPTS_DIR=./prompts

# PostgreSQL storage configuration
# Required when STORAGE_TYPE=postgres
PG_CONNECTION_STRING=postgresql://localhost/mydb

# Server configuration
SERVER_NAME=mcp-prompt-manager
SERVER_VERSION=1.1.0
LOG_LEVEL=info
```

#### 4. Build and run the application

```bash
npm run build
npm start
```

## Usage

### Starting the Server

```bash
# If installed globally:
mcp-prompt-manager

# If using npx:
npx @sparesparrow/mcp-prompt-manager

# If running from source:
npm start
```

### MCP Tools

The MCP Prompt Manager exposes the following tools:

#### Prompt Management Tools

##### `add_prompt`

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

##### `get_prompt`

Get a prompt by ID.

```json
{
  "id": "enhanced-code-review"
}
```

##### `update_prompt`

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

##### `list_prompts`

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

##### `apply_template`

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

##### `delete_prompt`

Delete a prompt by ID.

```json
{
  "id": "enhanced-code-review"
}
```

#### Database Tools

##### `export_prompts_to_db`

Export all prompts from the file system to the PostgreSQL database.

```json
{}
```

##### `import_prompts_from_db`

Import all prompts from the PostgreSQL database to the file system.

```json
{
  "overwrite": true
}
```

##### `sync_prompts`

Synchronize prompts between the file system and PostgreSQL database.

```json
{}
```

##### `create_backup`

Create a backup of all prompts.

```json
{}
```

##### `list_backups`

List all available backups.

```json
{}
```

##### `restore_backup`

Restore prompts from a backup.

```json
{
  "timestamp": "2023-04-01T12-34-56-789Z"
}
```

#### Project Orchestrator Tools

##### `init_project_orchestrator`

Initialize project orchestrator templates.

```json
{}
```

##### `create_project`

Create a new project using the project orchestrator.

```json
{
  "project_name": "My New Project",
  "project_idea": "A microservices-based e-commerce platform with user authentication, product catalog, and order processing capabilities.",
  "output_directory": "/home/sparrow/projects/my-new-project"
}
```

##### `list_project_templates`

List available project templates.

```json
{}
```

##### `list_component_templates`

List available component templates.

```json
{}
```

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