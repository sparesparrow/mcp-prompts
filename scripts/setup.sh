#!/bin/bash
set -e

echo "🚀 Setting up MCP-Prompts..."

# Check and install required tools
check_and_install_tool() {
    if ! command -v $1 &> /dev/null; then
        echo "📦 Installing $1..."
        npm install -g $1
    fi
}

check_and_install_tool pnpm
check_and_install_tool typescript
check_and_install_tool ts-node

# Create required directories
echo "📁 Creating project structure..."
mkdir -p {data/{prompts,backups},packages/{core,contracts,adapters-{mdc,file,memory,postgres}}}

# Setup Git hooks
echo "🔧 Setting up Git hooks..."
mkdir -p .git/hooks
cat > .git/hooks/pre-commit << 'EOL'
#!/bin/bash
npm run lint
npm run typecheck
EOL
chmod +x .git/hooks/pre-commit

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install --frozen-lockfile

# Build packages
echo "🔨 Building packages..."
pnpm run build

# Run tests
echo "🧪 Running tests..."
pnpm run test

# Generate documentation
echo "📚 Generating documentation..."
pnpm run docs

echo "✅ Setup complete! Run 'pnpm start' to launch the server."
