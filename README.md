# MCP Prompts Server

An MCP (Model Context Protocol) server for managing, storing, and providing prompts and prompt templates for LLM interactions.

## Features

- Store and retrieve prompts and templates
- Apply variable substitution to prompt templates
- Tag-based organization and search
- MCP Prompts protocol support
- Tools for prompt management
- Import and process prompts from various sources
- Export prompts in different formats (JSON, Markdown)
- Share and import prompt collections
- Docker and devcontainer support
- Comprehensive test client
- **New:** PGAI database integration with semantic search
- **New:** High-quality professional prompt collection

## Installation

### Quick Install

The simplest way to install is using the unified installer script:

```bash
./install.sh
```

### Installation Options

The installer supports multiple installation modes:

```bash
# Install locally (default)
./install.sh --mode=local

# Install globally with npm
./install.sh --mode=npm

# Build and install as a Docker image
./install.sh --mode=docker --docker-user=yourusername

# Process raw prompts during installation
./install.sh --process-prompts

# Install in development mode
./install.sh --dev
```

For more options, run:

```bash
./install.sh --help
```

### Manual Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/mcp-prompts.git
   cd mcp-prompts
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the project:
   ```bash
   npm run build
   ```

### Docker Installation

Build and run with Docker:

```bash
# Build the image
docker build -t yourusername/mcp-prompts .

# Run the container
docker run -it --rm yourusername/mcp-prompts
```

## Usage

### Running the Server

Run the server with:

```bash
npm start
```

### Prompt Processing Pipeline

The easiest way to process, tag, and organize prompts is with the complete pipeline:

```bash
# Create your rawprompts.txt file first, then run:
npm run prompt:pipeline
```

This runs the complete process:
1. Extracts prompts from the raw file and generates metadata
2. Performs intelligent tagging based on content
3. Organizes prompts into appropriate category directories
4. Summarizes the results

Additional options:

```bash
# Preview without making changes
npm run prompt:pipeline:dry

# Show detailed output from each step
npm run prompt:pipeline:verbose

# Run pipeline but keep the raw prompts file
npm run prompt:pipeline:keep
```

### Processing Raw Prompts

To process raw prompts from a file:

```bash
# First create a rawprompts.txt file with your prompts
npm run prompt:process
```

This will:
1. Extract prompts from the raw file
2. De-duplicate similar prompts
3. Generate metadata, tags, and descriptions
4. Export as both JSON and Markdown formats
5. Place them in the `processed_prompts` directory

Additional options include:

```bash
# Process prompts and create a backup of the raw file
npm run prompt:process:backup

# Process prompts without removing the raw file
npm run prompt:process:keep
```

### Organizing Prompts

To organize prompts into a structured directory hierarchy based on their tags:

```bash
# Organize prompts into category directories
npm run prompt:organize

# Preview what would be organized without making changes
npm run prompt:organize:dry

# Force reorganization (overwrite existing files)
npm run prompt:organize:force
```

This organizes prompts into categories like:
- `development/` - Programming, coding, debugging prompts
- `analysis/` - Data analysis, research, and insights prompts
- `content/` - Translation and language prompts
- `planning/` - Future planning, decision-making prompts
- `productivity/` - Workflow and organization prompts
- `ai/` - General AI and language model prompts
- `templates/` - Reusable prompt templates

### Managing Tags

You can manage tags across all prompts with the tag management tool:

```bash
# List all unique tags and their usage statistics
npm run prompt:tags:list

# Add a tag to all prompts matching a search term
npm run prompt:tags:add ai-assistant "You are a"

# Remove a tag from all prompts
npm run prompt:tags:remove outdated-tag

# Rename a tag across all prompts
npm run prompt:tags:rename old-tag new-tag
```

### Exporting Prompts

You can export your prompts for sharing or backup in different formats:

```bash
# Export all prompts to a JSON file
npm run prompt:export

# Export as a ZIP archive with organized folder structure
npm run prompt:export:zip

# Export as a Markdown documentation file
npm run prompt:export:md
```

Additional options:

```bash
# Export only prompts with specific tags
npm run prompt:export -- --tags=ai,coding

# Specify a custom output filename
npm run prompt:export -- --out=my-collection.zip
```

All exports are saved to the `exports/` directory with a timestamp in the filename.

### Importing Prompts

You can import prompts from various sources:

```bash
# Import from a previously exported JSON file
npm run prompt:import -- --source=exports/mcp-prompts-export.json

# Import from a directory containing JSON prompt files
npm run prompt:import -- --source=path/to/prompts/

# Import from a ZIP archive
npm run prompt:import -- --source=path/to/prompts.zip

# Preview what would be imported without making changes
npm run prompt:import:dry -- --source=path/to/prompts.zip

# Force import (overwrite existing prompts)
npm run prompt:import:force -- --source=path/to/prompts.zip
```

Imported prompts will automatically be organized into appropriate category directories based on their tags.

### Testing the Server

The project includes a test client that can verify server functionality:

```bash
npm test
```

This will connect to the MCP server and test all its functionality.

### Claude Desktop Integration

To integrate with Claude Desktop, add the following to your Claude Desktop configuration file:

```json
{
  "mcpServers": {
    "prompt-manager": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-prompts/build/index.js"]
    }
  }
}
```

### Available Tools

The server provides the following MCP tools:

- `add_prompt`: Add a new prompt to the collection
- `edit_prompt`: Edit an existing prompt
- `get_prompt`: Retrieve a prompt by ID
- `list_prompts`: List all prompts, optionally filtered by tags
- `apply_template`: Apply a template prompt with variable substitution
- `delete_prompt`: Delete a prompt from the collection

### Using Prompts in Claude

Prompts can be accessed through Claude using MCP tools or the standard MCP prompts protocol:

```
I need to review some code.

use_mcp_tool({
  server_name: "prompt-manager",
  tool_name: "apply_template",
  arguments: {
    id: "code-review",
    variables: {
      language: "python",
      code: "def example():\n    return 'Hello, World!'"
    }
  }
});
```

## Development

### DevContainer Support

The project includes VS Code DevContainer configuration for consistent development environments. To use it:

1. Open the project in VS Code
2. When prompted, click "Reopen in Container"
3. VS Code will build the container and set up the environment

### Project Structure

The project has been consolidated to reduce file count and improve maintainability:

- `src/core/` - Core functionality consolidated into modular components
  - `index.ts` - Central type definitions and core functions
  - `prompt-management.ts` - Unified prompt management functionality
  - `test.ts` - Test utilities

- `bin/` - Command-line tools
  - `prompt-cli.js/ts` - Unified CLI for all prompt management tasks
  - `cli.js` - Main MCP server CLI

## Prompt Management

Prompts can be managed using the consolidated prompt-cli tool:

```bash
# Process raw prompts
npm run prompt:process

# Import prompts
npm run prompt:import -- --source=path/to/prompts

# Export prompts
npm run prompt:export -- --format=markdown

# Manage tags
npm run prompt:tags:list
npm run prompt:tags:add -- --tag=example --prompts=id1,id2
```

## PGAI Integration

The MCP Prompts Server now supports PostgreSQL-based storage using PGAI (PostgreSQL AI) for enhanced prompt management capabilities.

### Setting Up PostgreSQL with PGAI

For detailed setup instructions, see our [PGAI Setup Guide](docs/pgai-setup.md).

Quick setup:

```bash
# Install PostgreSQL
sudo apt-get install postgresql postgresql-contrib
   
# Install vector extension for embeddings
psql -U postgres -c 'CREATE EXTENSION vector;'
   
# Install PGAI extension
psql -U postgres -c 'CREATE EXTENSION pgai;'

# Create a database for MCP Prompts
createdb -U postgres mcp_prompts

# Install the required Node.js dependencies
npm run install:deps
```

### Configuring PGAI Storage

To use PGAI for prompt storage, update your configuration in `config/pgai.json`:

```json
{
  "server": {
    "port": 3000,
    "host": "localhost",
    "logLevel": "info"
  },
  "storage": {
    "type": "pgai",
    "options": {
      "connectionString": "postgresql://username:password@localhost:5432/mcp_prompts"
    }
  }
}
```

### Migrating Prompts to PGAI

The system provides tools to migrate prompts from file storage to the PGAI database:

```bash
# Preview migration without making changes
npm run pgai:migrate:dry

# Migrate selected prompts to PGAI
npm run pgai:migrate

# Migrate with a custom connection string
npm run pgai:migrate -- --connection=postgresql://username:password@localhost:5432/mcp_prompts
```

### Improved Prompts Collection

The system now includes a collection of high-quality, professionally crafted prompts designed for various specialized use cases:

```bash
# Migrate the improved prompts collection to PGAI
npm run pgai:migrate:improved

# Preview the improved prompts without migrating
npm run pgai:migrate:improved:dry
```

The improved prompts collection includes:

#### Development Category
- **Enhanced Code Review Assistant** - Comprehensive code review with security focus
- **Advanced Code Refactoring Assistant** - Structured approach to code improvement
- **Intelligent Debugging Assistant** - Systematic problem diagnosis and resolution

#### Analysis Category
- **Comprehensive Data Analysis Assistant** - Advanced analytics for complex datasets
- **Advanced Content Analysis Assistant** - Sophisticated content structure analysis

#### Design Category
- **System Architecture Designer** - Professional software architecture planning

#### Research Category
- **Comprehensive Research Assistant** - Research methodology and synthesis
- **Topic Modeling Specialist** - Hierarchical theme identification and organization

#### Language Category
- **Contextual Translation Assistant** - Context-aware translation between languages

#### Planning Category
- **Strategic Foresight Planner** - Decision analysis and scenario planning

#### Productivity Category
- **Question Generation Specialist** - Creating diverse, thought-provoking questions
- **Follow-up Question Generator** - Targeted questions for deeper conversations

### Testing PGAI Functionality

A test script is provided to verify the PGAI integration:

```bash
# Run PGAI integration tests
npm run pgai:test

# Test with a custom connection string
npm run pgai:test -- --connection=postgresql://username:password@localhost:5432/mcp_prompts
```

### Benefits of PGAI Integration

Using PGAI for prompt storage provides several advantages:

1. **Semantic Search**: Find prompts by meaning rather than just keywords
2. **Scalability**: Support for larger prompt collections
3. **Database Features**: Transactions, concurrent access, and data integrity
4. **AI Capabilities**: Leverage PostgreSQL AI features for advanced prompt management

## License

MIT