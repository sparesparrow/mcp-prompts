#!/bin/bash

set -e

echo "🧹 Cleaning up AWS resources"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}⚠️  This will delete ALL AWS resources created by this project.${NC}"
echo -e "${YELLOW}⚠️  This action is IRREVERSIBLE!${NC}"
echo ""
read -p "Are you sure you want to continue? (yes/no): " -r
echo ""

if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo "Cleanup cancelled."
    exit 0
fi

echo "🗑️  Destroying CDK stacks..."
cd cdk
cdk destroy --all --force
cd ..

echo "🧹 Cleaning up local build artifacts..."
rm -rf dist/
rm -rf layers/
rm -rf cdk/node_modules/
rm -rf cdk/cdk.out/

echo -e "${GREEN}✅ Cleanup completed!${NC}"
