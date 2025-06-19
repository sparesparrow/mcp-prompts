import { PromptService } from '../../src/prompt-service.js';
import { MemoryAdapter } from '../../src/adapters.js';

describe('PromptService', () => {
  let service: PromptService;
  let adapter: MemoryAdapter;

  beforeEach(async () => {
    adapter = new MemoryAdapter();
    await adapter.connect();
    service = new PromptService(adapter);
  });

  it('should create and retrieve a prompt', async () => {
    const prompt = await service.createPrompt({
      name: 'Unit Test Prompt',
      description: 'A prompt for unit testing',
      content: 'Hello, {{name}}!',
      isTemplate: true,
      variables: ['name'],
    });
    const loaded = await service.getPrompt(prompt.id);
    expect(loaded).not.toBeNull();
    expect(loaded?.name).toBe('Unit Test Prompt');
    expect(loaded?.content).toContain('{{name}}');
  });

  it('should update a prompt', async () => {
    const prompt = await service.createPrompt({
      name: 'Update Test',
      content: 'Test',
      isTemplate: false,
    });
    await service.updatePrompt(prompt.id, { description: 'Updated' });
    const updated = await service.getPrompt(prompt.id);
    expect(updated?.description).toBe('Updated');
  });

  it('should delete a prompt', async () => {
    const prompt = await service.createPrompt({
      name: 'Delete Test',
      content: 'Test',
      isTemplate: false,
    });
    await service.deletePrompt(prompt.id);
    const deleted = await service.getPrompt(prompt.id);
    expect(deleted).toBeNull();
  });

  it('should list prompts', async () => {
    const prompt = await service.createPrompt({
      name: 'List Test',
      content: 'Test',
      isTemplate: false,
    });
    const prompts = await service.listPrompts({});
    expect(prompts.some(p => p.id === prompt.id)).toBe(true);
  });

  it('should apply a template with variables', async () => {
    const prompt = await service.createPrompt({
      name: 'Template Test',
      content: 'Hello, {{user}}!',
      isTemplate: true,
      variables: ['user'],
    });
    const applied = await service.applyTemplate(prompt.id, { user: 'Alice' });
    expect(applied.content).toBe('Hello, Alice!');
  });

  it('should validate required fields', async () => {
    await expect(service.createPrompt({
      name: '',
      content: '',
      isTemplate: false,
    })).rejects.toThrow();
  });
}); 