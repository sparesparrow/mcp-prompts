# MCP Prompt Manager

A Model Context Protocol (MCP) server for managing AI prompts with PostgreSQL database integration.

## Features

- Create, read, update, and delete prompts
- Apply variables to prompt templates
- Tag and categorize prompts
- Export prompts to PostgreSQL database
- Import prompts from PostgreSQL database
- Synchronize prompts between file system and database
- Automatic backup and restore capabilities

## Installation

```bash
npm install -g @sparesparrow/mcp-prompt-manager
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://localhost/mydb` |
| `PROMPTS_DIR` | Directory where prompts are stored | `/home/sparrow/mcp/data/prompts/` |
| `BACKUP_DIR` | Directory for backups | `/home/sparrow/mcp/backups/prompts/` |

### Claude Desktop Configuration

Add to your Claude Desktop configuration:

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

## Tools

### Prompt Management

| Tool | Description |
|------|-------------|
| `add_prompt` | Add a new prompt |
| `get_prompt` | Get a prompt by ID |
| `update_prompt` | Update an existing prompt |
| `list_prompts` | List all prompts |
| `delete_prompt` | Delete a prompt |
| `apply_template` | Apply variables to a prompt template |

### Database Integration

| Tool | Description |
|------|-------------|
| `export-prompts-to-db` | Export all prompts to PostgreSQL database |
| `import-prompts-from-db` | Import prompts from PostgreSQL database |
| `sync-prompts` | Synchronize prompts between file system and database |

### Backup and Restore

| Tool | Description |
|------|-------------|
| `create-backup` | Create a backup of all prompts |
| `list-backups` | List available backups |
| `restore-backup` | Restore from a backup |

## Usage Examples

### Adding a Prompt

```
add_prompt
{
  "prompt": {
    "name": "Project Introduction",
    "content": "Introduce the {{project_name}} project, which focuses on {{focus_area}}.",
    "description": "A template for project introductions",
    "isTemplate": true,
    "tags": ["project", "introduction"],
    "variables": ["project_name", "focus_area"]
  }
}
```

### Applying a Template

```
apply_template
{
  "id": "prompt-123",
  "variables": {
    "project_name": "MCP Prompt Manager",
    "focus_area": "streamlining prompt management"
  }
}
```

### Exporting Prompts to Database

```
export-prompts-to-db
```

### Importing Prompts from Database

```
import-prompts-from-db
{
  "overwrite": false
}
```

### Synchronizing Prompts

```
sync-prompts
```

## Database Schema

The PostgreSQL database uses the following schema:

```sql
CREATE TABLE IF NOT EXISTS prompts (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  description TEXT,
  category VARCHAR(255),
  tags TEXT[],
  is_template BOOLEAN DEFAULT FALSE,
  variables TEXT[],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Synchronization Strategy

The synchronization approach follows these principles:

1. **Unique identifiers**: All prompts use UUIDs for consistent tracking
2. **Automatic backups**: Before any import/export/sync operation
3. **Bidirectional sync**: Prompts can flow between file system and database
4. **File system preference**: When conflicts occur, file system version is preferred
5. **Data integrity**: Transactions ensure data consistency

## Local Storage

Prompts are stored as individual JSON files in the `PROMPTS_DIR` directory with the following format:

```json
{
  "id": "prompt-123",
  "name": "Example Prompt",
  "content": "This is the content of the prompt",
  "description": "An example prompt",
  "category": "examples",
  "tags": ["example", "documentation"],
  "isTemplate": false,
  "variables": []
}
```

## Development

### Building from Source

```bash
git clone https://github.com/sparesparrow/mcp-prompt-manager.git
cd mcp-prompt-manager
npm install
npm run build
```

### Testing

```bash
npm test
```

## License

MIT
