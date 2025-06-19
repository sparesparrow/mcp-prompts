import { MemoryAdapter } from '../../src/adapters.js';

describe('MemoryAdapter Integration', () => {
  let adapter: MemoryAdapter;

  beforeEach(async () => {
    adapter = new MemoryAdapter();
    await adapter.connect();
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

  it('should save and retrieve a prompt', async () => {
    const now = new Date().toISOString();
    const testPrompt = {
      content: 'This is a test prompt content',
      createdAt: now,
      description: 'A test prompt for unit testing',
      id: 'test-prompt-1',
      isTemplate: false,
      metadata: {
        author: 'Test Author',
        version: '1.0.0',
      },
      name: 'Test Prompt 1',
      tags: ['test', 'unit-test'],
      updatedAt: now,
      variables: [],
    };

    await adapter.savePrompt(testPrompt);
    const retrievedPrompt = await adapter.getPrompt('test-prompt-1');

    expect(retrievedPrompt).toBeDefined();
    expect(retrievedPrompt?.id).toBe('test-prompt-1');
    expect(retrievedPrompt?.name).toBe('Test Prompt 1');
    expect(retrievedPrompt?.content).toBe('This is a test prompt content');
    expect(retrievedPrompt?.tags).toEqual(['test', 'unit-test']);
  });

  it('should update an existing prompt', async () => {
    const now = new Date().toISOString();
    const testPrompt = {
      content: 'Original content',
      createdAt: now,
      description: 'Original description',
      id: 'test-prompt-2',
      isTemplate: false,
      metadata: {},
      name: 'Test Prompt 2',
      tags: ['test'],
      updatedAt: now,
      variables: [],
    };

    await adapter.savePrompt(testPrompt);

    const updatedPrompt = {
      ...testPrompt,
      content: 'Updated content',
      description: 'Updated description',
      tags: ['test', 'updated'],
      updatedAt: new Date().toISOString(),
    };

    await adapter.savePrompt(updatedPrompt);

    const retrievedPrompt = await adapter.getPrompt('test-prompt-2');

    expect(retrievedPrompt?.description).toBe('Updated description');
    expect(retrievedPrompt?.content).toBe('Updated content');
    expect(retrievedPrompt?.tags).toEqual(['test', 'updated']);
  });

  it('should list all prompts', async () => {
    // Clear existing prompts to ensure clean test
    try {
      // @ts-ignore - clearAll method might not be in the type definition but is implemented
      await adapter.clearAll();
    } catch (error) {
      console.warn('Could not clear prompts, test may not be reliable');
    }

    const now = new Date().toISOString();
    const testPrompts = [
      {
        content: 'Content 1',
        createdAt: now,
        description: 'Test prompt 1',
        id: 'list-test-1',
        isTemplate: false,
        metadata: {},
        name: 'List Test 1',
        tags: ['test', 'list'],
        updatedAt: now,
        variables: [],
      },
      {
        content: 'Content 2',
        createdAt: now,
        description: 'Test prompt 2',
        id: 'list-test-2',
        isTemplate: true,
        metadata: {},
        name: 'List Test 2',
        tags: ['test', 'list', 'important'],
        updatedAt: now,
        variables: ['var1', 'var2'],
      },
    ];

    for (const prompt of testPrompts) {
      await adapter.savePrompt(prompt);
    }

    const allPrompts = await adapter.listPrompts();
    expect(allPrompts.length).toBeGreaterThanOrEqual(2);

    const filteredPrompts = await adapter.listPrompts({ tags: ['important'] });
    expect(filteredPrompts.length).toBeGreaterThanOrEqual(1);
    expect(filteredPrompts.some(p => p.id === 'list-test-2')).toBe(true);
  });

  it('should delete a prompt', async () => {
    const now = new Date().toISOString();
    const testPrompt = {
      content: 'Delete me',
      createdAt: now,
      description: 'A prompt to be deleted',
      id: 'delete-test',
      isTemplate: false,
      metadata: {},
      name: 'Delete Test',
      tags: ['test', 'delete'],
      updatedAt: now,
      variables: [],
    };

    await adapter.savePrompt(testPrompt);

    // Verify the prompt exists
    const savedPrompt = await adapter.getPrompt('delete-test');
    expect(savedPrompt).toBeDefined();

    // Delete the prompt
    await adapter.deletePrompt('delete-test');

    // Verify it was deleted - either by returning null or by throwing an error
    try {
      const deletedPrompt = await adapter.getPrompt('delete-test');
      // If it returns a result, it should be null
      expect(deletedPrompt).toBeNull();
    } catch (error) {
      // Or if it throws an error, that's also acceptable
      expect(error).toBeDefined();
      expect((error as Error).message).toContain('not found');
    }
  });
});
