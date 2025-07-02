// Manual re-exports for problematic external packages

export type { StorageAdapter, ApplyTemplateResult, Prompt, PromptSequence } from '../../node_modules/@sparesparrow/mcp-prompts-contracts/dist/interfaces';
export { promptSchemas } from '../../node_modules/@sparesparrow/mcp-prompts-contracts/dist/schemas';
// Add similar re-exports for @modelcontextprotocol/sdk if needed 