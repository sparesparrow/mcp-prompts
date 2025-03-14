#!/bin/bash
set -e
echo "Verifying package can be run with npx..."
npx -y @sparesparrow/mcp-prompts --version
echo "NPX verification successful!"
