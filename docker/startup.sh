#!/bin/bash
set -e

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
until pg_isready -h postgres -p 5432 -U postgres; do
  echo "PostgreSQL is unavailable - sleeping"
  sleep 2
done

echo "PostgreSQL is up - executing migrations"

# Run PGAI migrations
echo "Running PGAI migrations..."
node build/scripts/pgai-utils.js migrate

# Run improved prompts migration if needed
if [ "$MIGRATE_IMPROVED_PROMPTS" = "true" ]; then
  echo "Migrating improved prompts collection..."
  node build/scripts/migrate-prompts.js
fi

# Start the MCP Prompts Server
echo "Starting MCP Prompts Server..."
exec node build/index.js 