import { describe, it, expect, beforeEach, vi } from 'vitest';
import { McpServer } from './mcp-server';

// Issue #105: tools expose `content`, the service expects `template`.
describe('McpServer content -> template mapping', () => {
  let promptService: any;
  let server: McpServer;
  const returned = { toJSON: () => ({ ok: true }) };

  beforeEach(() => {
    promptService = {
      createPrompt: vi.fn().mockResolvedValue(returned),
      updatePrompt: vi.fn().mockResolvedValue(returned),
    };
    server = new McpServer(promptService, { findLatestVersions: async () => [] } as any);
  });

  const call = (name: string, args: any) => (server as any).handleToolsCall({ name, arguments: args });

  it('create_prompt (JSON-RPC) maps content to template', async () => {
    await call('create_prompt', { name: 'n', content: 'Hello' });
    expect(promptService.createPrompt).toHaveBeenCalledWith({ name: 'n', template: 'Hello' });
  });

  it('update_prompt (JSON-RPC) maps content to template', async () => {
    await call('update_prompt', { id: 'p1', content: 'New body' });
    expect(promptService.updatePrompt).toHaveBeenCalledWith('p1', { id: 'p1', template: 'New body' });
  });

  it('update_prompt without content leaves the template untouched', async () => {
    await call('update_prompt', { id: 'p1', name: 'Renamed' });
    expect(promptService.updatePrompt).toHaveBeenCalledWith('p1', { id: 'p1', name: 'Renamed' });
  });

  it('legacy executeTool create_prompt maps content to template (the reported error)', async () => {
    await server.executeTool('create_prompt', { name: 'n', content: 'Hello' });
    expect(promptService.createPrompt).toHaveBeenCalledWith({ name: 'n', template: 'Hello' });
  });

  it('legacy executeTool update_prompt maps content to template', async () => {
    await server.executeTool('update_prompt', { id: 'p1', content: 'New body' });
    expect(promptService.updatePrompt).toHaveBeenCalledWith('p1', { id: 'p1', template: 'New body' });
  });

  it('an explicit template wins over content', async () => {
    await server.executeTool('create_prompt', { name: 'n', template: 'T', content: 'C' });
    expect(promptService.createPrompt).toHaveBeenCalledWith({ name: 'n', template: 'T', content: 'C' });
  });
});
