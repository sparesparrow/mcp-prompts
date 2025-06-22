import { fail } from 'assert';
import { mock } from 'jest-mock-extended';
import type { StorageAdapter } from '../../src/interfaces.js';
import { PromptService } from '../../src/prompt-service.js';
import { AppError } from '../../src/errors.js';

describe('PromptService', () => {
  let service: PromptService;
  let mockAdapter: ReturnType<typeof mock<StorageAdapter>>;

  beforeEach(() => {
    mockAdapter = mock<StorageAdapter>();
    service = new PromptService(mockAdapter);
  });

  it('should create and retrieve a prompt', async () => {
    const promptData = {
      name: 'Unit Test Prompt',
      content: 'Hello, {{name}}!',
      description: 'A prompt for unit testing',
      isTemplate: true,
      variables: ['name'],
    };
    const id = 'unit-test-prompt';
    const expectedPrompt = {
      ...promptData,
      id,
      version: 1,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    };

    mockAdapter.listPromptVersions.calledWith(id).mockResolvedValue([]);
    mockAdapter.savePrompt.mockResolvedValue(expectedPrompt);
    mockAdapter.getPrompt.calledWith(id, 1).mockResolvedValue(expectedPrompt);

    const prompt = await service.createPrompt(promptData);
    const loaded = await service.getPrompt(prompt.id, prompt.version);

    expect(mockAdapter.savePrompt).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Unit Test Prompt' }),
    );
    expect(loaded).toEqual(expectedPrompt);
  });

  it('should update a prompt', async () => {
    const now = new Date().toISOString();
    const existingPrompt = {
      id: 'update-test',
      name: 'Update Test',
      content: 'Original content',
      isTemplate: false,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    const updatedData = { content: 'Updated content' };
    const expectedPrompt = {
      ...existingPrompt,
      ...updatedData,
      updatedAt: expect.any(String),
    };

    mockAdapter.getPrompt.mockResolvedValue(existingPrompt);
    mockAdapter.updatePrompt.mockResolvedValue(expectedPrompt);

    const retrieved = await service.updatePrompt('update-test', 1, updatedData);

    expect(mockAdapter.updatePrompt).toHaveBeenCalledWith(
      'update-test',
      1,
      expect.objectContaining(updatedData),
    );
    expect(retrieved?.content).toBe('Updated content');
  });

  it('should delete a prompt', async () => {
    const promptId = 'delete-test';
    mockAdapter.deletePrompt.mockResolvedValue(undefined);
    mockAdapter.getPrompt.mockResolvedValue(null);

    await service.deletePrompt(promptId);
    const deleted = await service.getPrompt(promptId);

    expect(mockAdapter.deletePrompt).toHaveBeenCalledWith(promptId, undefined);
    expect(deleted).toBeNull();
  });

  it('should list prompts', async () => {
    const expectedPrompts = [
      {
        id: 'list-test',
        name: 'List Test',
        content: 'Test',
        isTemplate: false,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    mockAdapter.listPrompts.mockResolvedValue(expectedPrompts);

    const prompts = await service.listPrompts({});

    expect(prompts).toEqual(expectedPrompts);
    expect(mockAdapter.listPrompts).toHaveBeenCalled();
  });

  it('should apply a template with variables', async () => {
    const templatePrompt = {
      id: 'template-test',
      name: 'Template Test',
      content: 'Hello, {{user}}!',
      isTemplate: true,
      variables: ['user'],
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockAdapter.getPrompt.mockResolvedValue(templatePrompt);

    const applied = await service.applyTemplate(templatePrompt.id, { user: 'Alice' });
    expect(applied.content).toBe('Hello, Alice!');
  });

  it('should throw for invalid fields', async () => {
    const invalidPromptData = {
      content: '',
      isTemplate: false,
      name: '',
    };

    await expect(service.createPrompt(invalidPromptData)).rejects.toThrow(AppError);
  });

  describe('Conditional Templating', () => {
    it('should handle a simple if block', async () => {
      const prompt = {
        id: 'if-test',
        name: 'if-test',
        content: '{{#if show}}Welcome!{{/if}}',
        isTemplate: true,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      mockAdapter.getPrompt.mockResolvedValue(prompt);

      const result1 = await service.applyTemplate(prompt.id, { show: true });
      expect(result1.content).toBe('Welcome!');

      const result2 = await service.applyTemplate(prompt.id, { show: false });
      expect(result2.content).toBe('');
    });

    it('should handle an if-else block', async () => {
      const prompt = {
        id: 'if-else-test',
        name: 'if-else-test',
        content: '{{#if user}}Hello, {{user.name}}{{else}}Hello, guest{{/if}}',
        isTemplate: true,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      mockAdapter.getPrompt.mockResolvedValue(prompt);
      const result1 = await service.applyTemplate(prompt.id, { user: { name: 'Alice' } });
      expect(result1.content).toBe('Hello, Alice');

      const result2 = await service.applyTemplate(prompt.id, {});
      expect(result2.content).toBe('Hello, guest');
    });

    it('should handle truthy and falsy values', async () => {
      const prompt = {
        id: 'truthy-falsy-test',
        name: 'truthy-falsy-test',
        content:
          '{{#if item}}Item exists.{{/if}}{{#if nonItem}}No item.{{/if}}{{#if count}}Has count.{{/if}}',
        isTemplate: true,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      mockAdapter.getPrompt.mockResolvedValue(prompt);
      const result = await service.applyTemplate(prompt.id, { item: 'thing', count: 1 });
      expect(result.content).toBe('Item exists.Has count.');
    });
  });

  describe('Template Helpers', () => {
    it('should use toUpperCase helper', async () => {
      const prompt = {
        id: 'helper-upper',
        name: 'helper-upper',
        content: '{{toUpperCase "hello"}}',
        isTemplate: true,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      mockAdapter.getPrompt.mockResolvedValue(prompt);
      const result = await service.applyTemplate('helper-upper', {});
      expect(result.content).toBe('HELLO');
    });

    it('should use toLowerCase helper', async () => {
      const prompt = {
        id: 'helper-lower',
        name: 'helper-lower',
        content: '{{toLowerCase "WORLD"}}',
        isTemplate: true,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      mockAdapter.getPrompt.mockResolvedValue(prompt);
      const result = await service.applyTemplate('helper-lower', {});
      expect(result.content).toBe('world');
    });

    it('should use jsonStringify helper', async () => {
      const prompt = {
        id: 'helper-json',
        name: 'helper-json',
        content: '{{{jsonStringify data}}}',
        isTemplate: true,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      mockAdapter.getPrompt.mockResolvedValue(prompt);
      const data = { a: 1, b: 'test' };
      const result = await service.applyTemplate('helper-json', { data });
      expect(result.content).toBe(JSON.stringify(data, null, 2));
    });

    it('should use jsonStringify helper with an Error object', async () => {
      const prompt = {
        id: 'helper-json-error',
        name: 'helper-json-error',
        content: '{{{jsonStringify data}}}',
        isTemplate: true,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      mockAdapter.getPrompt.mockResolvedValue(prompt);
      const error = new Error('test error');
      const result = await service.applyTemplate('helper-json-error', { data: error });
      const parsed = JSON.parse(result.content);
      expect(parsed.name).toBe('Error');
      expect(parsed.message).toBe('test error');
      expect(parsed).toHaveProperty('stack');
    });

    it('should use join helper', async () => {
      const prompt = {
        id: 'helper-join',
        name: 'helper-join',
        content: '{{join items ", "}}',
        isTemplate: true,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      mockAdapter.getPrompt.mockResolvedValue(prompt);
      const result = await service.applyTemplate('helper-join', { items: ['a', 'b', 'c'] });
      expect(result.content).toBe('a, b, c');
    });

    it('should use eq helper for conditional logic', async () => {
      const prompt = {
        id: 'helper-eq',
        name: 'helper-eq',
        content: '{{#if (eq status "active")}}User is active.{{else}}User is inactive.{{/if}}',
        isTemplate: true,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      mockAdapter.getPrompt.mockResolvedValue(prompt);
      const result1 = await service.applyTemplate('helper-eq', { status: 'active' });
      expect(result1.content).toBe('User is active.');
      const result2 = await service.applyTemplate('helper-eq', { status: 'pending' });
      expect(result2.content).toBe('User is inactive.');
    });
  });
});
