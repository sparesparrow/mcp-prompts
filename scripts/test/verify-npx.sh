#!/bin/bash
set -e
echo "Verifying package can be run with npx..."
npx -y @sparesparrow/mcp-prompt-manager --version
echo "NPX verification successful!"
