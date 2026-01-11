#!/usr/bin/env bash
# Start test server for orchestration API testing

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PORT="${PORT:-3000}"
HOST="${HOST:-localhost}"

cd "$PROJECT_DIR"

echo "Starting test server on http://$HOST:$PORT"
echo "Press Ctrl+C to stop"
echo ""

# Use node if dist exists, otherwise ts-node
if [[ -f "dist/http/server-with-agents.js" ]]; then
    NODE_ENV=test PROMPTS_DIR="$PROJECT_DIR/data/prompts" PORT="$PORT" HOST="$HOST" node dist/http/server-with-agents.js
elif command -v ts-node >/dev/null 2>&1; then
    NODE_ENV=test PROMPTS_DIR="$PROJECT_DIR/data/prompts" PORT="$PORT" HOST="$HOST" ts-node src/http/server-with-agents.ts
elif command -v tsx >/dev/null 2>&1; then
    NODE_ENV=test PROMPTS_DIR="$PROJECT_DIR/data/prompts" PORT="$PORT" HOST="$HOST" tsx src/http/server-with-agents.ts
else
    echo "Error: Need either built dist files or ts-node/tsx to run server"
    exit 1
fi


