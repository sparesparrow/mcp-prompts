#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const packages = [
  {
    name: '@sparesparrow/mcp-prompts-contracts',
    repo: 'mcp-prompts-contracts',
    description: 'API contracts and schemas',
    language: 'TypeScript'
  },
  {
    name: '@sparesparrow/mcp-prompts-collection',
    repo: 'mcp-prompts-collection',
    description: 'Prompt collection and catalog',
    language: 'TypeScript'
  },
  {
    name: '@sparesparrow/mcp-prompts-ts',
    repo: 'mcp-prompts-ts',
    description: 'TypeScript implementation',
    language: 'TypeScript'
  },
  {
    name: 'mcp-prompts-rs',
    repo: 'mcp-prompts-rs',
    description: 'Rust implementation',
    language: 'Rust'
  },
  {
    name: '@sparesparrow/mcp-prompts-pg',
    repo: 'mcp-prompts-pg',
    description: 'PostgreSQL implementation',
    language: 'TypeScript'
  },
  {
    name: '@sparesparrow/mcp-prompts-aidl',
    repo: 'mcp-prompts-aidl',
    description: 'Android implementation',
    language: 'Kotlin/Rust'
  }
];

function generateMatrix() {
  const matrix = `# MCP Prompts Compatibility Matrix

## Package Overview

| Package | Repository | Description | Language | Status |
|---------|------------|-------------|----------|--------|
${packages.map(pkg => 
  `| \`${pkg.name}\` | [${pkg.repo}](https://github.com/sparesparrow/${pkg.repo}) | ${pkg.description} | ${pkg.language} | ✅ Active |
`).join('')}

## Version Compatibility

| Package | Latest Version | MCP Version | Node.js | Rust | Java |
|---------|----------------|-------------|---------|------|------|
${packages.map(pkg => {
  const version = pkg.language === 'Rust' ? '0.1.0' : '1.0.0';
  const mcpVersion = '0.1.0';
  const nodeVersion = pkg.language === 'TypeScript' ? '18+' : '-';
  const rustVersion = pkg.language === 'Rust' ? '1.70+' : '-';
  const javaVersion = pkg.language === 'Kotlin/Rust' ? '17+' : '-';
  
  return `| \`${pkg.name}\` | ${version} | ${mcpVersion} | ${nodeVersion} | ${rustVersion} | ${javaVersion} |`;
}).join('\n')}

## Integration Status

| Integration | Status | Notes |
|-------------|--------|-------|
| TypeScript ↔ Rust | ✅ Compatible | Shared contracts via NPM |
| TypeScript ↔ PostgreSQL | ✅ Compatible | Database schemas aligned |
| Android ↔ Rust | ✅ Compatible | Native service integration |
| Collection ↔ All | ✅ Compatible | Unified prompt format |

## Build Matrix

| Platform | TypeScript | Rust | PostgreSQL | Android |
|----------|------------|------|------------|---------|
| Linux | ✅ | ✅ | ✅ | ✅ |
| macOS | ✅ | ✅ | ✅ | ✅ |
| Windows | ✅ | ✅ | ✅ | ⚠️ |
| Docker | ✅ | ✅ | ✅ | ✅ |

*Last updated: ${new Date().toISOString()}*
`;

  return matrix;
}

// Write to file
const matrixContent = generateMatrix();
fs.writeFileSync(path.join(__dirname, '../docs/compatibility-matrix.md'), matrixContent);
console.log('✅ Compatibility matrix generated successfully'); 