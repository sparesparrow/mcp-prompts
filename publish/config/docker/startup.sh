#!/bin/bash
set -e

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
until pg_isready -h postgres -p 5432 -U postgres; do
  echo "PostgreSQL is unavailable - sleeping"
  sleep 2
done

echo "PostgreSQL is up - executing migrations"

# Run schema migration
echo "Running schema migration..."
node build/scripts/migrate-schema.js

# Run prompts migration
echo "Migrating prompts to PostgreSQL..."
node build/scripts/migrate-prompts.js

# Verify migration
echo "Verifying migration..."
node build/scripts/verify-improved-prompts.js

# Start the MCP Prompts Server
echo "Starting MCP Prompts Server..."
exec node build/index.js 