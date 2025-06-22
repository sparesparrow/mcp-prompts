import { MemoryAdapter } from '../../src/adapters';
import { Prompt } from '../../src/interfaces';

describe.skip('MemoryAdapter Integration', () => {
  let adapter: MemoryAdapter;

  beforeEach(async () => {
    adapter = new MemoryAdapter();
    await adapter.connect();
  });

  afterEach(async () => {
    await adapter.disconnect();
  });

  it('should be defined', () => {
    expect(MemoryAdapter).toBeDefined();
  });

  it('should connect successfully', async () => {
    const newAdapter = new MemoryAdapter();
    await expect(newAdapter.connect()).resolves.not.toThrow();
  });

  it('should have required methods', () => {
    expect(typeof adapter.savePrompt).toBe('function');
    expect(typeof adapter.getPrompt).toBe('function');
    expect(typeof adapter.deletePrompt).toBe('function');
    expect(typeof adapter.listPrompts).toBe('function');
  });

  it('should save and retrieve a prompt (versioned)', async () => {
    const now = new Date().toISOString();
    const prompt = {
      id: 'test-prompt',
      content: 'Hello, Memory!',
      isTemplate: false,
      name: 'Memory Test',
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    await adapter.savePrompt(prompt);
    const retrieved = await adapter.getPrompt('test-prompt', 1);
    expect(retrieved).toBeDefined();
    expect(retrieved?.version).toBe(1);
    expect(retrieved?.id).toBe('test-prompt');
    expect(retrieved?.name).toBe('Memory Test');
    expect(retrieved?.content).toBe('Hello, Memory!');
  });

  it('should update an existing prompt (versioned)', async () => {
    const now = new Date().toISOString();
    const prompt = {
      id: 'update-prompt',
      content: 'Initial content',
      isTemplate: false,
      name: 'Update Test',
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    await adapter.savePrompt(prompt);
    const updatedPrompt = {
      ...prompt,
      content: 'Updated content',
      updatedAt: new Date().toISOString(),
    };
    await adapter.updatePrompt('update-prompt', 1, updatedPrompt);
    const retrieved = await adapter.getPrompt('update-prompt', 1);
    expect(retrieved).toBeDefined();
    expect(retrieved?.content).toBe('Updated content');
  });

  it('should list all prompts (versioned)', async () => {
    const now = new Date().toISOString();
    const prompts = [
      {
        id: 'list-prompt-1',
        content: 'Prompt 1',
        isTemplate: false,
        name: 'List 1',
        version: 1,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'list-prompt-2',
        content: 'Prompt 2',
        isTemplate: false,
        name: 'List 2',
        version: 1,
        createdAt: now,
        updatedAt: now,
      },
    ];
    for (const p of prompts) {
      await adapter.savePrompt(p);
    }
    const all = await adapter.listPrompts({}, true);
    expect(all.length).toBeGreaterThanOrEqual(2);
    expect(all.some(p => p.id === 'list-prompt-1')).toBe(true);
    expect(all.some(p => p.id === 'list-prompt-2')).toBe(true);
  });

  it('should delete a prompt (versioned)', async () => {
    const now = new Date().toISOString();
    const prompt = {
      id: 'delete-prompt',
      content: 'To be deleted',
      isTemplate: false,
      name: 'Delete Test',
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    await adapter.savePrompt(prompt);
    await adapter.deletePrompt('delete-prompt', 1);
    const retrieved = await adapter.getPrompt('delete-prompt', 1);
    expect(retrieved).toBeNull();
  });
});
