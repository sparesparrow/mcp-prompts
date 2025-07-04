import 'reflect-metadata';
import { container } from 'tsyringe';
import { FilePromptRepository } from '@mcp-prompts/adapters-file';
import { PromptApplication } from './PromptApplication.js';
import { startMcpServer } from '@mcp-prompts/adapters-mcp';
import { startRest } from './startRest.js';

const storage = process.env.PROMPT_STORAGE || 'file';

if (storage === 'file') {
  container.register('IPromptRepository', { useClass: FilePromptRepository });
} else {
  throw new Error(`Unknown storage: ${storage}`);
}

container.register('IPromptApplication', {
  useFactory: c => new PromptApplication(c.resolve('IPromptRepository')),
});

const promptApp = container.resolve('IPromptApplication');
startMcpServer(promptApp);

if (process.env.REST === '1') {
  startRest();
}

console.log('mcp-prompts server started with file storage');
