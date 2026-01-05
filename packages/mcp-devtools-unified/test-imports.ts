// Test file to validate imports work correctly
import { DevToolsServer } from './src/mcp/devtools-server.js';
import { WorkflowOrchestrationService } from './src/services/workflow-orchestration.service.js';
import { McpPromptsClient } from './src/adapters/mcp-prompts-client.js';
import { PromptLayer, Domain } from '@sparesparrow/mcp-fbs';

// Simple test to validate imports
console.log('Imports successful!');
console.log('PromptLayer:', PromptLayer.Unknown);
console.log('Domain:', Domain.SoftwareDevelopment);