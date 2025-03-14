# PostgreSQL Adapter for MCP Prompts Server

This document provides detailed information on how to use the PostgreSQL adapter for the MCP Prompts Server. The PostgreSQL adapter allows you to store your prompts in a PostgreSQL database instead of the file system, providing better scalability, reliability, and querying capabilities.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Configuration](#configuration)
- [Docker Compose Setup](#docker-compose-setup)
- [Schema](#schema)
- [Testing](#testing)
- [Performance Optimization](#performance-optimization)
- [Troubleshooting](#troubleshooting)

## Prerequisites

To use the PostgreSQL adapter, you need:

1. PostgreSQL 12+ installed and running
2. A database user with permissions to create tables and indexes
3. A database created for the MCP Prompts Server

## Configuration

You can configure the PostgreSQL adapter in several ways:

### Environment Variables

```bash
# Required
STORAGE_TYPE=postgres

# Option 1: Connection string (recommended)
POSTGRES_CONNECTION_STRING=postgresql://username:password@hostname:port/database

# Option 2: Individual connection parameters
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=mcp_prompts
PG_USER=postgres
PG_PASSWORD=your_password
PG_SSL=false  # Set to 'true' to enable SSL
```

### Config Object

If you're using the MCP Prompts Server programmatically, you can pass a configuration object:

```javascript
import { startServer } from '@sparesparrow/mcp-prompts';

const config = {
  storage: {
    type: 'postgres',
    pgConnectionString: 'postgresql://username:password@hostname:port/database'
  }
};

startServer(config);
```

## Docker Compose Setup

The easiest way to get started with the PostgreSQL adapter is to use the provided Docker Compose configuration. This will set up both the PostgreSQL database and the MCP Prompts Server with the correct configuration.

1. Start the services:

```bash
npm run docker:postgres:up
```

2. Stop the services:

```bash
npm run docker:postgres:down
```

### Custom Docker Compose Configuration

You can customize the Docker Compose configuration by creating your own `docker-compose.yml` file based on the provided `docker/docker-compose.postgres.yml`. Here's an example:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:14-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: my_secure_password
      POSTGRES_DB: mcp_prompts
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  mcp-prompts:
    image: sparesparrow/mcp-prompts:latest
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      - STORAGE_TYPE=postgres
      - POSTGRES_CONNECTION_STRING=postgresql://postgres:my_secure_password@postgres:5432/mcp_prompts
      - HTTP_SERVER=true
    ports:
      - "3003:3003"
    volumes:
      - prompts_backup:/app/data

volumes:
  postgres_data:
  prompts_backup:
```

## Schema

The PostgreSQL adapter creates the following schema automatically when it connects to the database:

```sql
CREATE TABLE IF NOT EXISTS prompts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  is_template BOOLEAN NOT NULL DEFAULT FALSE,
  variables JSONB,
  tags TEXT[],
  category TEXT,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_prompts_name ON prompts (name);
CREATE INDEX IF NOT EXISTS idx_prompts_category ON prompts (category);
CREATE INDEX IF NOT EXISTS idx_prompts_is_template ON prompts (is_template);
CREATE INDEX IF NOT EXISTS idx_prompts_tags ON prompts USING GIN (tags);
```

## Testing

To test the PostgreSQL adapter:

```bash
npm run test:postgres
```

This will:

1. Start a PostgreSQL database and MCP Prompts Server using Docker Compose
2. Run a series of tests to verify all functionality works correctly
3. Shut down the Docker Compose environment when finished

## Performance Optimization

For better performance with larger prompt collections:

1. **Indexing**: The adapter creates basic indexes automatically, but you may want to add additional indexes based on your query patterns.

2. **Connection Pooling**: The adapter uses a connection pool to manage database connections efficiently. You can adjust the pool size in `src/adapters/postgres-adapter.ts` if needed:

```typescript
this.pool = new Pool({
  connectionString,
  max: 20, // Increase for higher concurrency
  idleTimeoutMillis: 30000
});
```

3. **Query Optimization**: When using the `listPrompts` function with filters, consider specifying only the filters you need to allow the database to use indexes effectively.

## Troubleshooting

### Connection Issues

If you're having trouble connecting to the database:

1. Verify the connection string is correct
2. Ensure the PostgreSQL server is running and accessible
3. Check that the database and user exist with the correct permissions
4. Verify network connectivity and firewall settings

### Schema Issues

If you encounter schema-related errors:

1. The adapter should create the schema automatically on first connection
2. If you're seeing errors, you can manually create the schema using the SQL in the [Schema](#schema) section
3. Make sure the database user has permissions to create tables and indexes

### Query Performance

If you're experiencing slow queries:

1. Check the PostgreSQL logs for slow query warnings
2. Consider adding additional indexes to support your common query patterns
3. Analyze query plans to identify potential bottlenecks 