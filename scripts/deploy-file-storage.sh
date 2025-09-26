#!/bin/bash

set -e

echo "📁 Deploying MCP-Prompts with File Storage"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
STORAGE_TYPE="file"
PROMPTS_DIR="${PROMPTS_DIR:-./data/prompts}"
BACKUP_DIR="${BACKUP_DIR:-./data/backups}"
LOG_LEVEL="${LOG_LEVEL:-info}"
PORT="${PORT:-3000}"
HOST="${HOST:-0.0.0.0}"

echo -e "${BLUE}🔧 Configuration:${NC}"
echo -e "  Storage Type: ${YELLOW}$STORAGE_TYPE${NC}"
echo -e "  Prompts Directory: ${YELLOW}$PROMPTS_DIR${NC}"
echo -e "  Backup Directory: ${YELLOW}$BACKUP_DIR${NC}"
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

echo -e "${GREEN}✅ Prerequisites check passed${NC}"

# Create directories
echo "📁 Creating directories..."
mkdir -p "$PROMPTS_DIR"
mkdir -p "$BACKUP_DIR"
mkdir -p "./logs"

echo -e "${GREEN}✅ Directories created${NC}"

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Build the project
echo "🔨 Building project..."
pnpm run build

# Create sample prompts if directory is empty
if [ ! "$(ls -A $PROMPTS_DIR)" ]; then
    echo "📝 Creating sample prompts..."
    cp -r ./data/sample-prompts.json "$PROMPTS_DIR/"
    echo -e "${GREEN}✅ Sample prompts created${NC}"
fi

# Create systemd service file (optional)
if [ "$1" = "--systemd" ]; then
    echo "🔧 Creating systemd service..."
    sudo tee /etc/systemd/system/mcp-prompts-file.service > /dev/null <<EOF
[Unit]
Description=MCP Prompts Server (File Storage)
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)
Environment=STORAGE_TYPE=file
Environment=PROMPTS_DIR=$PROMPTS_DIR
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
    sudo systemctl enable mcp-prompts-file.service
    echo -e "${GREEN}✅ Systemd service created and enabled${NC}"
fi

# Create backup script
echo "💾 Creating backup script..."
cat > ./scripts/backup-file-storage.sh <<EOF
#!/bin/bash
BACKUP_FILE="$BACKUP_DIR/backup-\$(date +%Y%m%d-%H%M%S).tar.gz"
tar -czf "\$BACKUP_FILE" "$PROMPTS_DIR"
echo "Backup created: \$BACKUP_FILE"
EOF

chmod +x ./scripts/backup-file-storage.sh

# Create restore script
echo "🔄 Creating restore script..."
cat > ./scripts/restore-file-storage.sh <<EOF
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
tar -xzf "\$1" -C ./
echo "Restore completed"
EOF

chmod +x ./scripts/restore-file-storage.sh

# Create monitoring script
echo "📊 Creating monitoring script..."
cat > ./scripts/monitor-file-storage.sh <<EOF
#!/bin/bash
echo "📊 MCP Prompts File Storage Monitor"
echo "=================================="
echo "Storage Type: file"
echo "Prompts Directory: $PROMPTS_DIR"
echo "Backup Directory: $BACKUP_DIR"
echo ""
echo "📁 Directory Status:"
ls -la "$PROMPTS_DIR"
echo ""
echo "💾 Backup Status:"
ls -la "$BACKUP_DIR"
echo ""
echo "📈 Disk Usage:"
du -sh "$PROMPTS_DIR"
du -sh "$BACKUP_DIR"
EOF

chmod +x ./scripts/monitor-file-storage.sh

# Create environment file
echo "⚙️  Creating environment file..."
cat > .env.file-storage <<EOF
# MCP Prompts File Storage Configuration
STORAGE_TYPE=file
PROMPTS_DIR=$PROMPTS_DIR
BACKUP_DIR=$BACKUP_DIR
LOG_LEVEL=$LOG_LEVEL
PORT=$PORT
HOST=$HOST
NODE_ENV=production
EOF

echo ""
echo -e "${GREEN}🎉 File Storage Deployment Completed!${NC}"
echo ""
echo -e "${GREEN}📊 Deployment Summary:${NC}"
echo -e "  Storage Type: ${YELLOW}File System${NC}"
echo -e "  Prompts Directory: ${YELLOW}$PROMPTS_DIR${NC}"
echo -e "  Backup Directory: ${YELLOW}$BACKUP_DIR${NC}"
echo -e "  Port: ${YELLOW}$PORT${NC}"
echo -e "  Host: ${YELLOW}$HOST${NC}"
echo ""
echo -e "${GREEN}🚀 Start Commands:${NC}"
echo -e "  Development: ${YELLOW}STORAGE_TYPE=file pnpm run dev${NC}"
echo -e "  Production:  ${YELLOW}STORAGE_TYPE=file node dist/index.js${NC}"
echo -e "  HTTP Server: ${YELLOW}STORAGE_TYPE=file MODE=http node dist/index.js${NC}"
echo -e "  MCP Server:  ${YELLOW}STORAGE_TYPE=file MODE=mcp node dist/index.js${NC}"
echo ""
echo -e "${GREEN}🔧 Management Commands:${NC}"
echo -e "  Backup:      ${YELLOW}./scripts/backup-file-storage.sh${NC}"
echo -e "  Restore:     ${YELLOW}./scripts/restore-file-storage.sh <backup-file>${NC}"
echo -e "  Monitor:     ${YELLOW}./scripts/monitor-file-storage.sh${NC}"
echo ""
echo -e "${GREEN}📝 Next Steps:${NC}"
echo "1. Test the server: STORAGE_TYPE=file node dist/index.js"
echo "2. Add your prompts to: $PROMPTS_DIR"
echo "3. Set up regular backups with cron"
echo "4. Configure log rotation"
echo "5. Set up monitoring and alerting"
