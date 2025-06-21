import { MemoryAdapter } from '../../src/adapters.js';

describe('MemoryAdapter Integration', () => {
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
      version: 1,
    };

    await adapter.savePrompt(testPrompt);

    const updatedPromptData = {
      ...testPrompt,
      content: 'Updated content',
      description: 'Updated description',
      tags: ['test', 'updated'],
      updatedAt: new Date().toISOString(),
      version: 2,
    };

    const updatedPrompt = await adapter.updatePrompt('test-prompt-2', updatedPromptData);

    expect(updatedPrompt?.description).toBe('Updated description');
    expect(updatedPrompt?.content).toBe('Updated content');
    expect(updatedPrompt?.tags).toEqual(['test', 'updated']);
    expect(updatedPrompt?.version).toBe(2);
  });

  it('should list all prompts', async () => {
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
    expect(allPrompts.length).toBe(2);

    const filteredPrompts = await adapter.listPrompts({ tags: ['important'] });
    expect(filteredPrompts.length).toBe(1);
    expect(filteredPrompts[0].id).toBe('list-test-2');
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
    const retrieved = await adapter.getPrompt('delete-test');

    // Verify it was deleted
    expect(retrieved).toBeNull();
  });
});
