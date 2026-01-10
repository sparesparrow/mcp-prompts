# Database Migrations

This directory contains SQL migration scripts for the mcp-prompts database.

## Migration Files

### Core Schema
- `000_migration_tracking.sql` - Creates the migration_history table to track applied migrations
- `001_add_agent_fields_to_prompts.sql` - Adds agent orchestration fields to the prompts table
- `002_create_agent_execution_records.sql` - Creates table for tracking agent execution history

## Running Migrations

### PostgreSQL

```bash
# Run all pending migrations
psql -d mcp_prompts -f data/migrations/000_migration_tracking.sql
psql -d mcp_prompts -f data/migrations/001_add_agent_fields_to_prompts.sql
psql -d mcp_prompts -f data/migrations/002_create_agent_execution_records.sql
```

### Via Node.js Script

```bash
# Run all pending migrations
npx tsx scripts/run-migrations.ts

# Dry run (show what would be executed)
npx tsx scripts/run-migrations.ts --dry-run

# Rollback last migration
npx tsx scripts/run-migrations.ts --rollback
```

## Migration Naming Convention

Migrations are named with a 3-digit prefix followed by a descriptive name:

```
<number>_<descriptive_name>.sql
```

Examples:
- `000_migration_tracking.sql`
- `001_add_agent_fields_to_prompts.sql`
- `002_create_agent_execution_records.sql`

## Schema Changes

### Prompts Table Extensions

New columns added for agent orchestration:

| Column | Type | Description |
|--------|------|-------------|
| prompt_type | VARCHAR(50) | Type: standard, subagent_registry, main_agent_template, project_orchestration_template |
| agent_model | VARCHAR(50) | Claude model: claude-opus, claude-sonnet, claude-haiku |
| agent_system_prompt | TEXT | Full system prompt for the agent |
| agent_tools | JSONB | Array of tool names |
| agent_mcp_servers | JSONB | Array of MCP server names |
| agent_subagents | JSONB | Array of subagent IDs (for main agents) |
| agent_compatible_with | JSONB | Array of compatible project types |
| agent_source_url | VARCHAR(500) | Source repository URL |
| agent_execution_count | INTEGER | Number of executions |
| agent_success_rate | NUMERIC(5,2) | Success rate percentage |
| agent_last_executed_at | TIMESTAMP | Last execution timestamp |

### Agent Execution Records Table

New table for tracking agent execution history:

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| agent_id | VARCHAR(255) | Agent identifier |
| agent_type | VARCHAR(50) | subagent or main_agent |
| project_id | VARCHAR(255) | Optional project identifier |
| project_type | VARCHAR(100) | Type of project |
| execution_started_at | TIMESTAMP | Start time |
| execution_completed_at | TIMESTAMP | Completion time |
| status | VARCHAR(50) | pending, executing, succeeded, failed, timeout |
| input_tokens | INTEGER | Input token count |
| output_tokens | INTEGER | Output token count |
| estimated_cost | NUMERIC(10,4) | Cost in USD |
| result_summary | TEXT | Execution summary |
| error_message | TEXT | Error details if failed |
| feedback | JSONB | User feedback object |
| metadata | JSONB | Additional metadata |

## Rollback Instructions

### Manual Rollback

```sql
-- Rollback migration 002
DROP TABLE IF EXISTS agent_execution_records CASCADE;

-- Rollback migration 001
ALTER TABLE prompts DROP COLUMN IF EXISTS prompt_type;
ALTER TABLE prompts DROP COLUMN IF EXISTS agent_model;
ALTER TABLE prompts DROP COLUMN IF EXISTS agent_system_prompt;
ALTER TABLE prompts DROP COLUMN IF EXISTS agent_tools;
ALTER TABLE prompts DROP COLUMN IF EXISTS agent_mcp_servers;
ALTER TABLE prompts DROP COLUMN IF EXISTS agent_subagents;
ALTER TABLE prompts DROP COLUMN IF EXISTS agent_compatible_with;
ALTER TABLE prompts DROP COLUMN IF EXISTS agent_source_url;
ALTER TABLE prompts DROP COLUMN IF EXISTS agent_execution_count;
ALTER TABLE prompts DROP COLUMN IF EXISTS agent_success_rate;
ALTER TABLE prompts DROP COLUMN IF EXISTS agent_last_executed_at;
DROP INDEX IF EXISTS idx_prompts_prompt_type;
DROP INDEX IF EXISTS idx_prompts_agent_model;
DROP INDEX IF EXISTS idx_prompts_category_type;

-- Delete migration record
DELETE FROM migration_history WHERE migration_name IN ('001_add_agent_fields_to_prompts', '002_create_agent_execution_records');
```

## Testing Migrations

```bash
# Create test database
createdb mcp_prompts_test

# Run migrations
psql -d mcp_prompts_test -f data/migrations/000_migration_tracking.sql
psql -d mcp_prompts_test -f data/migrations/001_add_agent_fields_to_prompts.sql
psql -d mcp_prompts_test -f data/migrations/002_create_agent_execution_records.sql

# Verify schema
psql -d mcp_prompts_test -c "\d prompts"
psql -d mcp_prompts_test -c "\d agent_execution_records"

# Clean up
dropdb mcp_prompts_test
```
