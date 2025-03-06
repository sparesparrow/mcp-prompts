# Setting Up PostgreSQL with PGAI for MCP Prompts Server

This guide provides instructions for setting up PostgreSQL with the PGAI extension to enable the enhanced prompt management capabilities of the MCP Prompts Server.

## Prerequisites

- PostgreSQL 14 or higher
- Database administration privileges
- Node.js 18 or higher

## Installation Steps

### 1. Install PostgreSQL

```bash
# Install PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib

# Verify installation
sudo systemctl status postgresql
```

### 2. Create Database and User

```bash
# Login to PostgreSQL
sudo -u postgres psql

# Create a database for MCP Prompts
CREATE DATABASE mcp_prompts;

# Create a user (optional, you can use postgres)
CREATE USER mcp_user WITH ENCRYPTED PASSWORD 'your_secure_password';

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE mcp_prompts TO mcp_user;

# Exit PostgreSQL
\q
```

### 3. Install Vector Extension

```bash
# Install required packages
sudo apt install postgresql-server-dev-14 build-essential git

# Clone and install pgvector
git clone https://github.com/pgvector/pgvector.git
cd pgvector
make
sudo make install

# Connect to the database
sudo -u postgres psql -d mcp_prompts

# Create the extension
CREATE EXTENSION vector;

# Verify installation
\dx

# Exit PostgreSQL
\q
```

### 4. Install PGAI Extension

```bash
# Clone and install PGAI
git clone https://github.com/pgai/pgai.git
cd pgai
make
sudo make install

# Connect to the database
sudo -u postgres psql -d mcp_prompts

# Create the extension
CREATE EXTENSION pgai;

# Verify installation
\dx

# Exit PostgreSQL
\q
```

### 5. Update Configuration

Update your configuration file at `config/pgai.json` with the correct connection string:

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
      "connectionString": "postgresql://username:password@localhost:5432/mcp_prompts",
      "poolSize": 10,
      "sslMode": false
    }
  }
}
```

Replace `username` and `password` with your PostgreSQL credentials.

### 6. Install Node.js Dependencies

```bash
# Install PostgreSQL client for Node.js
npm run install:deps
```

## Testing the Setup

Run the PGAI test to verify the connection:

```bash
npm run pgai:test
```

## Migrating Prompts

After setting up the database, you can migrate prompts:

```bash
# Migrate selected prompts
npm run pgai:migrate

# Or migrate improved prompts
npm run pgai:migrate:improved
```

## Troubleshooting

### Connection Issues

If you encounter connection problems:

1. Check if PostgreSQL is running:
   ```bash
   sudo systemctl status postgresql
   ```

2. Verify the connection string in your configuration.

3. Ensure the user has appropriate permissions:
   ```bash
   sudo -u postgres psql
   GRANT ALL PRIVILEGES ON DATABASE mcp_prompts TO username;
   ```

### Extension Issues

If extension installation fails:

1. Check PostgreSQL version compatibility
2. Look for error messages in the PostgreSQL logs:
   ```bash
   sudo journalctl -u postgresql
   ```

3. Verify required development packages are installed:
   ```bash
   sudo apt install postgresql-server-dev-$(pg_config --version | grep -oP '\d+' | head -1)
   ```

## Running with Docker

If you prefer using Docker, you can use the following command:

```bash
docker run -d \
  --name postgres-pgai \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_DB=mcp_prompts \
  -p 5432:5432 \
  postgres:14

# Then connect to it and install extensions
docker exec -it postgres-pgai psql -U postgres -d mcp_prompts -c 'CREATE EXTENSION vector;'
docker exec -it postgres-pgai psql -U postgres -d mcp_prompts -c 'CREATE EXTENSION pgai;'
``` 