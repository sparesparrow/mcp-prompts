#!/bin/sh
# android-fetch-prompt.sh
# Fetches a prompt from MCP-Prompts and prints it to the terminal.
# Usage: bash android-fetch-prompt.sh [PROMPT_ID]
# Example: bash android-fetch-prompt.sh my-prompt-id

SERVER_URL="http://<your-server-ip>:3003"
PROMPT_ID="$1"

if [ -z "$PROMPT_ID" ]; then
  echo "Usage: $0 PROMPT_ID"
  exit 1
fi

curl -s "$SERVER_URL/prompts/$PROMPT_ID" | jq . 