import { MemoryAdapter } from '../../src/adapters.js';
import { PromptService } from '../../src/prompt-service.js';

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
      content: 'Hello, {{name}}!',
      description: 'A prompt for unit testing',
      isTemplate: true,
      name: 'Unit Test Prompt',
      variables: ['name'],
    });
    const loaded = await service.getPrompt(prompt.id);
    expect(loaded).not.toBeNull();
    expect(loaded?.name).toBe('Unit Test Prompt');
    expect(loaded?.content).toContain('{{name}}');
  });

  it('should update a prompt', async () => {
    const now = new Date().toISOString();
    const prompt = {
      id: 'update-test',
      content: 'Original content',
      isTemplate: false,
      name: 'Update Test',
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    await service.createPrompt(prompt);
    const updatedPrompt = {
      ...prompt,
      content: 'Updated content',
      updatedAt: new Date().toISOString(),
    };
    await service.updatePrompt('update-test', 1, updatedPrompt);
    const retrieved = await service.getPrompt('update-test', 1);
    expect(retrieved).toBeDefined();
    expect(retrieved?.content).toBe('Updated content');
  });

  it('should delete a prompt', async () => {
    const prompt = await service.createPrompt({
      content: 'Test',
      isTemplate: false,
      name: 'Delete Test',
    });
    await service.deletePrompt(prompt.id);
    const deleted = await service.getPrompt(prompt.id);
    expect(deleted).toBeNull();
  });

  it('should list prompts', async () => {
    const prompt = await service.createPrompt({
      content: 'Test',
      isTemplate: false,
      name: 'List Test',
    });
    const prompts = await service.listPrompts({});
    expect(prompts.some(p => p.id === prompt.id)).toBe(true);
  });

  it('should apply a template with variables', async () => {
    const prompt = await service.createPrompt({
      content: 'Hello, {{user}}!',
      isTemplate: true,
      name: 'Template Test',
      variables: ['user'],
    });
    const applied = await service.applyTemplate(prompt.id, { user: 'Alice' });
    expect(applied.content).toBe('Hello, Alice!');
  });

  it('should validate required fields', async () => {
    await expect(
      service.createPrompt({
        content: '',
        isTemplate: false,
        name: '',
      }),
    ).rejects.toThrow();
  });

  describe('Conditional Templating', () => {
    it('should handle a simple if block', async () => {
      const prompt = await service.createPrompt({
        name: 'if-test',
        content: '{{#if show}}Welcome!{{/if}}',
        isTemplate: true,
      });
      const result1 = await service.applyTemplate(prompt.id, { show: true });
      expect(result1.content).toBe('Welcome!');
      const result2 = await service.applyTemplate(prompt.id, { show: false });
      expect(result2.content).toBe('');
    });

    it('should handle an if-else block', async () => {
      const prompt = await service.createPrompt({
        name: 'if-else-test',
        content: '{{#if user}}Hello, {{user.name}}{{else}}Hello, guest{{/if}}',
        isTemplate: true,
      });
      const result1 = await service.applyTemplate(prompt.id, { user: { name: 'Alice' } });
      expect(result1.content).toBe('Hello, Alice');
      const result2 = await service.applyTemplate(prompt.id, {});
      expect(result2.content).toBe('Hello, guest');
    });

    it('should handle truthy and falsy values', async () => {
      const prompt = await service.createPrompt({
        name: 'truthy-falsy-test',
        content:
          '{{#if item}}Item exists.{{/if}}{{#if nonItem}}No item.{{/if}}{{#if count}}Has count.{{/if}}',
        isTemplate: true,
      });
      const result = await service.applyTemplate(prompt.id, { item: 'thing', count: 1 });
      expect(result.content).toBe('Item exists.Has count.');
    });
  });

  describe('Template Helpers', () => {
    it('should use toUpperCase helper', async () => {
      const prompt = await service.createPrompt({
        name: 'helper-upper',
        content: '{{toUpperCase "hello"}}',
        isTemplate: true,
      });
      const result = await service.applyTemplate(prompt.id, {});
      expect(result.content).toBe('HELLO');
    });

    it('should use toLowerCase helper', async () => {
      const prompt = await service.createPrompt({
        name: 'helper-lower',
        content: '{{toLowerCase "WORLD"}}',
        isTemplate: true,
      });
      const result = await service.applyTemplate(prompt.id, {});
      expect(result.content).toBe('world');
    });

    it('should use jsonStringify helper', async () => {
      const prompt = await service.createPrompt({
        name: 'helper-json',
        content: '{{{jsonStringify data}}}',
        isTemplate: true,
      });
      const data = { a: 1, b: 'test' };
      const result = await service.applyTemplate(prompt.id, { data });
      expect(result.content).toBe(JSON.stringify(data, null, 2));
    });

    it('should use join helper', async () => {
      const prompt = await service.createPrompt({
        name: 'helper-join',
        content: '{{join items ", "}}',
        isTemplate: true,
      });
      const result = await service.applyTemplate(prompt.id, { items: ['a', 'b', 'c'] });
      expect(result.content).toBe('a, b, c');
    });

    it('should use eq helper for conditional logic', async () => {
      const prompt = await service.createPrompt({
        name: 'helper-eq',
        content: '{{#if (eq status "active")}}User is active.{{else}}User is inactive.{{/if}}',
        isTemplate: true,
      });
      const result1 = await service.applyTemplate(prompt.id, { status: 'active' });
      expect(result1.content).toBe('User is active.');
      const result2 = await service.applyTemplate(prompt.id, { status: 'pending' });
      expect(result2.content).toBe('User is inactive.');
    });
  });
});
