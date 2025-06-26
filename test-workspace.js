/**
 * Test workspace imports
 */

const catalog = require('@sparesparrow/mcp-prompts-catalog');
const contracts = require('@sparesparrow/mcp-prompts-contracts');

console.log('✅ Workspace imports successful!');
console.log('Catalog version:', catalog.version);
console.log('Contracts version:', contracts.version); 