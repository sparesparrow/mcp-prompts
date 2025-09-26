#!/bin/bash

set -e

echo "🐘 Deploying MCP-Prompts with PostgreSQL Database"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
STORAGE_TYPE="postgres"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-mcp_prompts}"
DB_USER="${DB_USER:-mcp_user}"
DB_PASSWORD="${DB_PASSWORD:-mcp_password}"
DB_SSL="${DB_SSL:-false}"
LOG_LEVEL="${LOG_LEVEL:-info}"
PORT="${PORT:-3000}"
HOST="${HOST:-0.0.0.0}"

echo -e "${BLUE}🔧 Configuration:${NC}"
echo -e "  Storage Type: ${YELLOW}$STORAGE_TYPE${NC}"
echo -e "  Database Host: ${YELLOW}$DB_HOST${NC}"
echo -e "  Database Port: ${YELLOW}$DB_PORT${NC}"
echo -e "  Database Name: ${YELLOW}$DB_NAME${NC}"
echo -e "  Database User: ${YELLOW}$DB_USER${NC}"
echo -e "  SSL Enabled: ${YELLOW}$DB_SSL${NC}"
echo -e "  Port: ${YELLOW}$PORT${NC}"
echo -e "  Host: ${YELLOW}$HOST${NC}"
echo ""

# Check prerequisites
echo "🔍 Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install it first.${NC}"
    exit 1
fi

# Check PNPM
if ! command -v pnpm &> /dev/null; then
    echo -e "${YELLOW}⚠️  PNPM not found. Installing...${NC}"
    npm install -g pnpm
fi

# Check PostgreSQL client
if ! command -v psql &> /dev/null; then
    echo -e "${YELLOW}⚠️  PostgreSQL client not found. Installing...${NC}"
    if command -v apt-get &> /dev/null; then
        sudo apt-get update && sudo apt-get install -y postgresql-client
    elif command -v yum &> /dev/null; then
        sudo yum install -y postgresql
    elif command -v brew &> /dev/null; then
        brew install postgresql
    else
        echo -e "${RED}❌ Cannot install PostgreSQL client. Please install it manually.${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}"

# Test database connection
echo "🔌 Testing database connection..."
if ! PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" &> /dev/null; then
    echo -e "${YELLOW}⚠️  Database connection failed. Attempting to create database...${NC}"
    
    # Try to create database
    if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "CREATE DATABASE $DB_NAME;" &> /dev/null; then
        echo -e "${GREEN}✅ Database created successfully${NC}"
    else
        echo -e "${RED}❌ Failed to create database. Please check your PostgreSQL configuration.${NC}"
        echo -e "${YELLOW}💡 Make sure PostgreSQL is running and accessible.${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ Database connection successful${NC}"
fi

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Build the project
echo "🔨 Building project..."
pnpm run build

# Create database schema
echo "🗄️  Creating database schema..."
cat > ./scripts/create-postgres-schema.sql <<EOF
-- MCP Prompts PostgreSQL Schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Prompts table
CREATE TABLE IF NOT EXISTS prompts (
    id VARCHAR(255) PRIMARY KEY,
    version VARCHAR(50) NOT NULL DEFAULT 'latest',
    name VARCHAR(255) NOT NULL,
    description TEXT,
    template TEXT NOT NULL,
    category VARCHAR(100) DEFAULT 'general',
    tags TEXT[] DEFAULT '{}',
    variables TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_latest BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    UNIQUE(id, version)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_prompts_category ON prompts(category);
CREATE INDEX IF NOT EXISTS idx_prompts_created_at ON prompts(created_at);
CREATE INDEX IF NOT EXISTS idx_prompts_is_latest ON prompts(is_latest);
CREATE INDEX IF NOT EXISTS idx_prompts_tags ON prompts USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_prompts_metadata ON prompts USING GIN(metadata);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS \$\$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
\$\$ language 'plpgsql';

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_prompts_updated_at ON prompts;
CREATE TRIGGER update_prompts_updated_at
    BEFORE UPDATE ON prompts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Sessions table for caching
CREATE TABLE IF NOT EXISTS sessions (
    session_id VARCHAR(255) PRIMARY KEY,
    data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 hour')
);

-- Create index for session expiration
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- Create function to clean expired sessions
CREATE OR REPLACE FUNCTION clean_expired_sessions()
RETURNS INTEGER AS \$\$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM sessions WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
\$\$ language 'plpgsql';
EOF

# Execute schema creation
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f ./scripts/create-postgres-schema.sql

echo -e "${GREEN}✅ Database schema created${NC}"

# Insert sample data
echo "📝 Inserting sample data..."
cat > ./scripts/insert-sample-data.sql <<EOF
-- Insert sample prompts
INSERT INTO prompts (id, name, description, template, category, tags, variables, metadata) VALUES
('code_review_assistant', 'Code Review Assistant', 'Assists with code review tasks', 'Please review this code for best practices, potential bugs, security issues, and performance improvements:

```{{language}}
{{code}}
```

Focus on:
- Code quality and readability
- Security vulnerabilities
- Performance optimizations
- Best practices for {{language}}
- Error handling
- Documentation', 'general', ARRAY['code-review', 'assistant', 'development'], ARRAY['language', 'code'], '{"difficulty": "intermediate", "estimated_time": "5-10 minutes"}'),

('documentation_writer', 'Documentation Writer', 'Helps write comprehensive documentation', 'Write comprehensive documentation for the following {{type}}:

{{content}}

Include:
- Overview and purpose
- Installation/setup instructions
- Usage examples
- API reference (if applicable)
- Troubleshooting section
- Contributing guidelines', 'general', ARRAY['documentation', 'writing', 'technical'], ARRAY['type', 'content'], '{"difficulty": "beginner", "estimated_time": "15-30 minutes"}'),

('bug_analyzer', 'Bug Analyzer', 'Analyzes and helps debug issues', 'Analyze the following bug report and provide debugging assistance:

**Bug Description:**
{{bug_description}}

**Expected Behavior:**
{{expected_behavior}}

**Actual Behavior:**
{{actual_behavior}}

**Environment:**
{{environment}}

Please provide:
- Root cause analysis
- Step-by-step debugging approach
- Potential fixes
- Prevention strategies', 'general', ARRAY['debugging', 'analysis', 'troubleshooting'], ARRAY['bug_description', 'expected_behavior', 'actual_behavior', 'environment'], '{"difficulty": "advanced", "estimated_time": "10-20 minutes"}'),

('architecture_reviewer', 'Architecture Reviewer', 'Reviews system architecture', 'Review the following system architecture:

{{architecture_description}}

Evaluate:
- Scalability and performance
- Security considerations
- Maintainability
- Technology choices
- Design patterns
- Potential improvements

Provide recommendations for optimization.', 'general', ARRAY['architecture', 'review', 'design'], ARRAY['architecture_description'], '{"difficulty": "advanced", "estimated_time": "20-30 minutes"}'),

('test_case_generator', 'Test Case Generator', 'Generates comprehensive test cases', 'Generate comprehensive test cases for the following {{component_type}}:

{{component_description}}

Include:
- Unit tests
- Integration tests
- Edge cases
- Error scenarios
- Performance tests (if applicable)
- Test data requirements', 'general', ARRAY['testing', 'quality-assurance', 'automation'], ARRAY['component_type', 'component_description'], '{"difficulty": "intermediate", "estimated_time": "15-25 minutes"}');

-- Update the updated_at timestamp
UPDATE prompts SET updated_at = NOW();
EOF

PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f ./scripts/insert-sample-data.sql

echo -e "${GREEN}✅ Sample data inserted${NC}"

# Create backup script
echo "💾 Creating backup script..."
cat > ./scripts/backup-postgres.sh <<EOF
#!/bin/bash
BACKUP_FILE="./data/backups/postgres-backup-\$(date +%Y%m%d-%H%M%S).sql"
mkdir -p ./data/backups

echo "Creating PostgreSQL backup..."
PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > "\$BACKUP_FILE"
echo "Backup created: \$BACKUP_FILE"
EOF

chmod +x ./scripts/backup-postgres.sh

# Create restore script
echo "🔄 Creating restore script..."
cat > ./scripts/restore-postgres.sh <<EOF
#!/bin/bash
if [ -z "\$1" ]; then
    echo "Usage: \$0 <backup-file>"
    exit 1
fi

if [ ! -f "\$1" ]; then
    echo "Backup file not found: \$1"
    exit 1
fi

echo "Restoring from backup: \$1"
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" < "\$1"
echo "Restore completed"
EOF

chmod +x ./scripts/restore-postgres.sh

# Create monitoring script
echo "📊 Creating monitoring script..."
cat > ./scripts/monitor-postgres.sh <<EOF
#!/bin/bash
echo "📊 MCP Prompts PostgreSQL Monitor"
echo "================================="
echo "Database Host: $DB_HOST:$DB_PORT"
echo "Database Name: $DB_NAME"
echo "Database User: $DB_USER"
echo ""
echo "🔌 Connection Test:"
if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" &> /dev/null; then
    echo "✅ Database connection successful"
else
    echo "❌ Database connection failed"
fi
echo ""
echo "📈 Database Statistics:"
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
SELECT 
    'prompts' as table_name, 
    COUNT(*) as row_count,
    pg_size_pretty(pg_total_relation_size('prompts')) as size
FROM prompts
UNION ALL
SELECT 
    'sessions' as table_name, 
    COUNT(*) as row_count,
    pg_size_pretty(pg_total_relation_size('sessions')) as size
FROM sessions;
"
echo ""
echo "🗑️  Cleanup expired sessions:"
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT clean_expired_sessions();"
EOF

chmod +x ./scripts/monitor-postgres.sh

# Create systemd service file (optional)
if [ "$1" = "--systemd" ]; then
    echo "🔧 Creating systemd service..."
    sudo tee /etc/systemd/system/mcp-prompts-postgres.service > /dev/null <<EOF
[Unit]
Description=MCP Prompts Server (PostgreSQL)
After=network.target postgresql.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)
Environment=STORAGE_TYPE=postgres
Environment=DB_HOST=$DB_HOST
Environment=DB_PORT=$DB_PORT
Environment=DB_NAME=$DB_NAME
Environment=DB_USER=$DB_USER
Environment=DB_PASSWORD=$DB_PASSWORD
Environment=DB_SSL=$DB_SSL
Environment=LOG_LEVEL=$LOG_LEVEL
Environment=PORT=$PORT
Environment=HOST=$HOST
ExecStart=$(which node) dist/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    sudo systemctl daemon-reload
    sudo systemctl enable mcp-prompts-postgres.service
    echo -e "${GREEN}✅ Systemd service created and enabled${NC}"
fi

# Create environment file
echo "⚙️  Creating environment file..."
cat > .env.postgres <<EOF
# MCP Prompts PostgreSQL Configuration
STORAGE_TYPE=postgres
DB_HOST=$DB_HOST
DB_PORT=$DB_PORT
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_SSL=$DB_SSL
LOG_LEVEL=$LOG_LEVEL
PORT=$PORT
HOST=$HOST
NODE_ENV=production
EOF

echo ""
echo -e "${GREEN}🎉 PostgreSQL Deployment Completed!${NC}"
echo ""
echo -e "${GREEN}📊 Deployment Summary:${NC}"
echo -e "  Storage Type: ${YELLOW}PostgreSQL Database${NC}"
echo -e "  Database Host: ${YELLOW}$DB_HOST:$DB_PORT${NC}"
echo -e "  Database Name: ${YELLOW}$DB_NAME${NC}"
echo -e "  Database User: ${YELLOW}$DB_USER${NC}"
echo -e "  Port: ${YELLOW}$PORT${NC}"
echo -e "  Host: ${YELLOW}$HOST${NC}"
echo ""
echo -e "${GREEN}🚀 Start Commands:${NC}"
echo -e "  Development: ${YELLOW}STORAGE_TYPE=postgres pnpm run dev${NC}"
echo -e "  Production:  ${YELLOW}STORAGE_TYPE=postgres node dist/index.js${NC}"
echo -e "  HTTP Server: ${YELLOW}STORAGE_TYPE=postgres MODE=http node dist/index.js${NC}"
echo -e "  MCP Server:  ${YELLOW}STORAGE_TYPE=postgres MODE=mcp node dist/index.js${NC}"
echo ""
echo -e "${GREEN}🔧 Management Commands:${NC}"
echo -e "  Backup:      ${YELLOW}./scripts/backup-postgres.sh${NC}"
echo -e "  Restore:     ${YELLOW}./scripts/restore-postgres.sh <backup-file>${NC}"
echo -e "  Monitor:     ${YELLOW}./scripts/monitor-postgres.sh${NC}"
echo ""
echo -e "${GREEN}📝 Next Steps:${NC}"
echo "1. Test the server: STORAGE_TYPE=postgres node dist/index.js"
echo "2. Set up regular backups with cron"
echo "3. Configure PostgreSQL performance tuning"
echo "4. Set up monitoring and alerting"
echo "5. Configure SSL/TLS for production"
