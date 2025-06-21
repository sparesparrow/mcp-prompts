import { mock, MockProxy } from 'jest-mock-extended';
import { PromptService } from '../../src/prompt-service.js';
import { IStorageAdapter, Prompt } from '../../src/interfaces.js';

describe.skip('PromptService', () => {
  let service: PromptService;
  let adapter: MockProxy<IStorageAdapter>;

  beforeEach(() => {
    adapter = mock<IStorageAdapter>();
    service = new PromptService(adapter);
  });

  it('should create and retrieve a prompt', async () => {
    const promptData = {
      content: 'Hello, {{name}}!',
      description: 'A prompt for unit testing',
      isTemplate: true,
      name: 'Unit Test Prompt',
      variables: ['name'],
    };

    const createdPrompt: Prompt = {
      ...promptData,
      id: 'unit-test-prompt',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    adapter.savePrompt.mockResolvedValue(createdPrompt);
    adapter.getPrompt.mockResolvedValue(createdPrompt);

    await service.createPrompt(promptData);
    const loaded = await service.getPrompt('unit-test-prompt');

    expect(adapter.savePrompt).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Unit Test Prompt' }),
    );
    expect(loaded).toEqual(createdPrompt);
  });

  it('should update a prompt', async () => {
    const now = new Date().toISOString();
    const existingPrompt: Prompt = {
      id: 'update-test',
      content: 'Original content',
      isTemplate: false,
      name: 'Update Test',
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    const updatedPromptData: Partial<Prompt> = {
      content: 'Updated content',
    };

    const finalUpdatedPrompt: Prompt = {
      ...existingPrompt,
      ...updatedPromptData,
      updatedAt: expect.any(String),
    };

    adapter.getPrompt.mockResolvedValue(existingPrompt);
    adapter.updatePrompt.mockResolvedValue(finalUpdatedPrompt);

    await service.updatePrompt('update-test', 1, updatedPromptData);
    const retrieved = await service.getPrompt('update-test', 1);

    expect(adapter.updatePrompt).toHaveBeenCalledWith('update-test', 1, expect.objectContaining({ content: 'Updated content' }));
    expect(retrieved).toBeDefined();
    
  });

  it('should delete a prompt', async () => {
    const promptId = 'delete-test';
    adapter.deletePrompt.mockResolvedValue(undefined);
    adapter.getPrompt.mockResolvedValue(null);

    await service.deletePrompt(promptId);
    
    expect(adapter.deletePrompt).toHaveBeenCalledWith(promptId, undefined);
    const deleted = await service.getPrompt(promptId);
    expect(deleted).toBeNull();
  });

  it('should list prompts', async () => {
    const prompts: Prompt[] = [{
      id: 'list-test',
      content: 'Test',
      isTemplate: false,
      name: 'List Test',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }];
    adapter.listPrompts.mockResolvedValue(prompts);

    const listedPrompts = await service.listPrompts({});
    expect(listedPrompts).toEqual(prompts);
  });

  it('should apply a template with variables', async () => {
    const prompt: Prompt = {
      id: 'template-test',
      content: 'Hello, {{user}}!',
      isTemplate: true,
      name: 'Template Test',
      variables: ['user'],
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    adapter.getPrompt.mockResolvedValue(prompt);

    const applied = await service.applyTemplate(prompt.id, { user: 'Alice' });
    expect(applied.content).toBe('Hello, Alice!');
  });

  it('should validate required fields', async () => {
    await expect(
      service.createPrompt({
        // @ts-ignore
        content: '',
        isTemplate: false,
        name: '',
      }),
    ).rejects.toThrow();
  });

  describe('Conditional Templating', () => {
    it('should handle a simple if block', async () => {
      const prompt: Prompt = {
        name: 'if-test',
        content: '{{#if show}}Welcome!{{/if}}',
        isTemplate: true,
        id: 'if-test',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      adapter.getPrompt.mockResolvedValue(prompt);
      
      const result1 = await service.applyTemplate(prompt.id, { show: true });
      expect(result1.content).toBe('Welcome!');
      
      const result2 = await service.applyTemplate(prompt.id, { show: false });
      expect(result2.content).toBe('');
    });

    it('should handle an if-else block', async () => {
      const prompt: Prompt = {
        name: 'if-else-test',
        content: '{{#if user}}Hello, {{user.name}}{{else}}Hello, guest{{/if}}',
        isTemplate: true,
        id: 'if-else-test',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      adapter.getPrompt.mockResolvedValue(prompt);

      const result1 = await service.applyTemplate(prompt.id, { user: { name: 'Alice' } });
      expect(result1.content).toBe('Hello, Alice');
      
      const result2 = await service.applyTemplate(prompt.id, {});
      expect(result2.content).toBe('Hello, guest');
    });

    it('should handle truthy and falsy values', async () => {
      const prompt: Prompt = {
        name: 'truthy-falsy-test',
        content:
          '{{#if item}}Item exists.{{/if}}{{#if nonItem}}No item.{{/if}}{{#if count}}Has count.{{/if}}',
        isTemplate: true,
        id: 'truthy-falsy-test',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      adapter.getPrompt.mockResolvedValue(prompt);
      
      const result = await service.applyTemplate(prompt.id, { item: 'thing', count: 1 });
      expect(result.content).toBe('Item exists.Has count.');
    });
  });

  describe('Template Helpers', () => {
    it('should use toUpperCase helper', async () => {
      const prompt: Prompt = {
        id: 'template-helper-test',
        name: 'template-helper-test',
        content: '{{toUpperCase "hello"}}',
        isTemplate: true,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      adapter.getPrompt.mockResolvedValue(prompt);
      const result = await service.applyTemplate('template-helper-test', {});
      expect(result.content).toBe('HELLO');
    });

    it('should use toLowerCase helper', async () => {
      const prompt: Prompt = {
        id: 'template-helper-test',
        name: 'template-helper-test',
        content: '{{toLowerCase "WORLD"}}',
        isTemplate: true,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      adapter.getPrompt.mockResolvedValue(prompt);
      const result = await service.applyTemplate('template-helper-test', {});
      expect(result.content).toBe('world');
    });

    it('should use jsonStringify helper', async () => {
      const prompt: Prompt = {
        id: 'template-helper-test',
        name: 'template-helper-test',
        content: '{{{jsonStringify data}}}',
        isTemplate: true,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      adapter.getPrompt.mockResolvedValue(prompt);
      const data = { a: 1, b: 'test' };
      const result = await service.applyTemplate('template-helper-test', { data });
      expect(result.content).toBe(JSON.stringify(data, null, 2));
    });

    it('should use jsonStringify helper with an Error object', async () => {
      const prompt: Prompt = {
        id: 'template-helper-test',
        name: 'template-helper-test',
        content: '{{{jsonStringify data}}}',
        isTemplate: true,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      adapter.getPrompt.mockResolvedValue(prompt);
      const error = new Error('test error');
      const result = await service.applyTemplate('template-helper-test', { data: error });
      const parsed = JSON.parse(result.content);
      expect(parsed.name).toBe('Error');
      expect(parsed.message).toBe('test error');
      expect(parsed).toHaveProperty('stack');
    });

    it('should use join helper', async () => {
      const prompt: Prompt = {
        id: 'template-helper-test',
        name: 'template-helper-test',
        content: '{{join items ", "}}',
        isTemplate: true,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      adapter.getPrompt.mockResolvedValue(prompt);
      const result = await service.applyTemplate('template-helper-test', {
        items: ['a', 'b', 'c'],
      });
      expect(result.content).toBe('a, b, c');
    });

    it('should use eq helper for conditional logic', async () => {
      const prompt: Prompt = {
        id: 'template-helper-test',
        name: 'template-helper-test',
        content: '{{#if (eq type "admin")}}Admin{{else}}User{{/if}}',
        isTemplate: true,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      adapter.getPrompt.mockResolvedValue(prompt);
      const resultAdmin = await service.applyTemplate('template-helper-test', {
        type: 'admin',
      });
      expect(resultAdmin.content).toBe('Admin');
      const resultUser = await service.applyTemplate('template-helper-test', {
        type: 'user',
      });
      expect(resultUser.content).toBe('User');
    });
  });
});
