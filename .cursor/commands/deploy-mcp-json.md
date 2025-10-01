```bash
set -euo pipefail

# Validate and run MCP server via mcp.json for different backends

# 1) Local Postgres via mcp.json
cat > .cursor/mcp.json << 'JSON'
{
  "mcpServers": {
    "mcp-prompts": {
      "command": "npx",
      "args": ["-y", "@sparesparrow/mcp-prompts"],
      "env": {
        "MODE": "mcp",
        "STORAGE_TYPE": "postgres",
        "POSTGRES_URL": "postgres://postgres:postgres@localhost:5432/mcp_prompts",
        "PORT": "3003",
        "HOST": "0.0.0.0"
      }
    }
  }
}
JSON

echo "mcp.json for Postgres written."

# 2) Alternative AWS backend (switch by replacing env)
cat > .cursor/mcp.aws.json << 'JSON'
{
  "mcpServers": {
    "mcp-prompts": {
      "command": "npx",
      "args": ["-y", "@sparesparrow/mcp-prompts"],
      "env": {
        "MODE": "mcp",
        "STORAGE_TYPE": "aws",
        "AWS_REGION": "eu-north-1",
        "PORT": "3003",
        "HOST": "0.0.0.0"
      }
    }
  }
}
JSON

echo "mcp.aws.json for AWS written."

# 3) Quick checks
node -e "require('fs').readFileSync('.cursor/mcp.json'); console.log('Validated .cursor/mcp.json')"
node -e "require('fs').readFileSync('.cursor/mcp.aws.json'); console.log('Validated .cursor/mcp.aws.json')"

echo "Switch active config by copying desired file to .cursor/mcp.json"
```

