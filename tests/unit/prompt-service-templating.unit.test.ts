import { jest } from '@jest/globals';
import type { MockProxy } from 'jest-mock-extended';
import { mock } from 'jest-mock-extended';

import type { Prompt, StorageAdapter } from '../../src/interfaces.js';
import { PromptService } from '../../src/prompt-service.js';

describe('PromptService Advanced Templating', () => {
  let service: PromptService;
  let adapter: MockProxy<StorageAdapter>;

  beforeEach(() => {
    adapter = mock<StorageAdapter>();
    service = new PromptService(adapter);
  });

  describe('Conditional Logic (if/else)', () => {
    it('should correctly process an if/else block when the condition is true', async () => {
      const prompt: Prompt = {
        content:
          'Hello, {{#if showDetails}}This is a detailed message.{{else}}This is a simple message.{{/if}}',
        createdAt: new Date().toISOString(),
        id: 'conditional-test',
        isTemplate: true,
        name: 'Conditional Test',
        updatedAt: new Date().toISOString(),
        version: 1,
      };
      adapter.getPrompt.mockResolvedValue(prompt);

      const result = await service.applyTemplate('conditional-test', { showDetails: true });

      expect(result.content).toBe('Hello, This is a detailed message.');
      expect(result.missingVariables).toBeUndefined();
    });

    it('should correctly process an if/else block when the condition is false', async () => {
      const prompt: Prompt = {
        content:
          'Hello, {{#if showDetails}}This is a detailed message.{{else}}This is a simple message.{{/if}}',
        createdAt: new Date().toISOString(),
        id: 'conditional-test',
        isTemplate: true,
        name: 'Conditional Test',
        updatedAt: new Date().toISOString(),
        version: 1,
      };
      adapter.getPrompt.mockResolvedValue(prompt);

      const result = await service.applyTemplate('conditional-test', { showDetails: false });

      expect(result.content).toBe('Hello, This is a simple message.');
      expect(result.missingVariables).toBeUndefined();
    });

    it('should correctly process an if block without an else when the condition is true', async () => {
      const prompt: Prompt = {
        content: 'Hello, world!{{#if showExtra}} Extra content.{{/if}}',
        createdAt: new Date().toISOString(),
        id: 'conditional-test-no-else',
        isTemplate: true,
        name: 'Conditional Test No Else',
        updatedAt: new Date().toISOString(),
        version: 1,
      };
      adapter.getPrompt.mockResolvedValue(prompt);

      const result = await service.applyTemplate('conditional-test-no-else', { showExtra: true });

      expect(result.content).toBe('Hello, world! Extra content.');
    });

    it('should correctly process an if block without an else when the condition is false', async () => {
      const prompt: Prompt = {
        content: 'Hello, world!{{#if showExtra}} Extra content.{{/if}}',
        createdAt: new Date().toISOString(),
        id: 'conditional-test-no-else',
        isTemplate: true,
        name: 'Conditional Test No Else',
        updatedAt: new Date().toISOString(),
        version: 1,
      };
      adapter.getPrompt.mockResolvedValue(prompt);

      const result = await service.applyTemplate('conditional-test-no-else', { showExtra: false });

      expect(result.content).toBe('Hello, world!');
    });
  });

  describe('Looping Logic (each)', () => {
    it('should iterate over an array of strings', async () => {
      const prompt: Prompt = {
        content: 'Items:{{#each items}} {{this}}{{/each}}.',
        createdAt: new Date().toISOString(),
        id: 'loop-test-simple',
        isTemplate: true,
        name: 'Loop Test Simple',
        updatedAt: new Date().toISOString(),
        version: 1,
      };
      adapter.getPrompt.mockResolvedValue(prompt);

      const result = await service.applyTemplate('loop-test-simple', {
        items: ['apple', 'banana', 'cherry'],
      });

      expect(result.content).toBe('Items: apple banana cherry.');
    });

    it('should iterate over an array of objects', async () => {
      const prompt: Prompt = {
        content: 'Users:{{#each users}} {{this.name}} ({{this.email}}){{/each}}.',
        createdAt: new Date().toISOString(),
        id: 'loop-test-objects',
        isTemplate: true,
        name: 'Loop Test Objects',
        updatedAt: new Date().toISOString(),
        version: 1,
      };
      adapter.getPrompt.mockResolvedValue(prompt);

      const result = await service.applyTemplate('loop-test-objects', {
        users: [
          { email: 'alice@example.com', name: 'Alice' },
          { email: 'bob@example.com', name: 'Bob' },
        ],
      });

      expect(result.content).toBe('Users: Alice (alice@example.com) Bob (bob@example.com).');
    });

    it('should render nothing for an empty array', async () => {
      const prompt: Prompt = {
        content: 'Items:{{#each items}} {{this}}{{/each}}.',
        createdAt: new Date().toISOString(),
        id: 'loop-test-empty',
        isTemplate: true,
        name: 'Loop Test Empty',
        updatedAt: new Date().toISOString(),
        version: 1,
      };
      adapter.getPrompt.mockResolvedValue(prompt);

      const result = await service.applyTemplate('loop-test-empty', { items: [] });

      expect(result.content).toBe('Items:.');
    });
  });

  describe('Nested Templates / Partials', () => {
    it('should include a simple partial', async () => {
      const mainPrompt: Prompt = {
        content: 'Main content; {{> partial-prompt }}.',
        createdAt: '',
        id: 'main-prompt',
        isTemplate: true,
        name: 'Main Prompt',
        updatedAt: '',
        version: 1,
      };
      const partialPrompt: Prompt = {
        content: 'Partial content',
        createdAt: '',
        id: 'partial-prompt',
        isTemplate: true,
        name: 'Partial Prompt',
        updatedAt: '',
        version: 1,
      };

      adapter.getPrompt.mockImplementation(async (id: string) => {
        if (id === 'main-prompt') return mainPrompt;
        if (id === 'partial-prompt') return partialPrompt;
        return null;
      });

      const result = await service.applyTemplate('main-prompt', {});
      expect(result.content).toBe('Main content; Partial content.');
    });

    it('should handle nested partials', async () => {
      const promptA: Prompt = {
        content: 'A includes B: {{> b }}',
        createdAt: '',
        id: 'a',
        isTemplate: true,
        name: 'A',
        updatedAt: '',
        version: 1,
      };
      const promptB: Prompt = {
        content: 'B includes C: {{> c }}',
        createdAt: '',
        id: 'b',
        isTemplate: true,
        name: 'B',
        updatedAt: '',
        version: 1,
      };
      const promptC: Prompt = {
        content: 'C is the end.',
        createdAt: '',
        id: 'c',
        isTemplate: true,
        name: 'C',
        updatedAt: '',
        version: 1,
      };

      adapter.getPrompt.mockImplementation(async (id: string) => {
        if (id === 'a') return promptA;
        if (id === 'b') return promptB;
        if (id === 'c') return promptC;
        return null;
      });

      const result = await service.applyTemplate('a', {});
      expect(result.content).toBe('A includes B: B includes C: C is the end.');
    });

    it('should handle missing partials gracefully', async () => {
      const mainPrompt: Prompt = {
        content: 'Main content; {{> missing }}.',
        createdAt: '',
        id: 'main',
        isTemplate: true,
        name: 'Main',
        updatedAt: '',
        version: 1,
      };

      adapter.getPrompt.calledWith('main').mockResolvedValue(mainPrompt);
      adapter.getPrompt.calledWith('missing').mockResolvedValue(null);

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
        /* do nothing */
      });
      const result = await service.applyTemplate('main', {});

      expect(result.content).toBe('Main content; .');
      expect(consoleWarnSpy).toHaveBeenCalled();
      consoleWarnSpy.mockRestore();
    });

    it('should throw an error for direct recursion', async () => {
      const recursivePrompt: Prompt = {
        content: 'Recursive call: {{> recursive }}',
        createdAt: '',
        id: 'recursive',
        isTemplate: true,
        name: 'Recursive',
        updatedAt: '',
        version: 1,
      };
      adapter.getPrompt.mockResolvedValue(recursivePrompt);

      await expect(service.applyTemplate('recursive', {})).rejects.toThrow(
        'Recursive partial detected: recursive -> recursive',
      );
    });

    it('should throw an error for indirect recursion', async () => {
      const promptA: Prompt = {
        content: 'A calls B: {{> b-rec }}',
        createdAt: '',
        id: 'a-rec',
        isTemplate: true,
        name: 'A-rec',
        updatedAt: '',
        version: 1,
      };
      const promptB: Prompt = {
        content: 'B calls A: {{> a-rec }}',
        createdAt: '',
        id: 'b-rec',
        isTemplate: true,
        name: 'B-rec',
        updatedAt: '',
        version: 1,
      };

      adapter.getPrompt.mockImplementation(async (id: string) => {
        if (id === 'a-rec') return promptA;
        if (id === 'b-rec') return promptB;
        return null;
      });

      await expect(service.applyTemplate('a-rec', {})).rejects.toThrow(
        'Recursive partial detected: a-rec -> b-rec -> a-rec',
      );
    });
  });
});
