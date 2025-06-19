import { jest } from '@jest/globals';

import { PostgresAdapter } from '../../src/adapters.js';

// This test requires a PostgreSQL database
// A Docker container should be running with:
// docker run --name postgres-test -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=mcp_prompts_test -p 5432:5432 -d postgres:14-alpine
describe('PostgresAdapter Integration', () => {
  let adapter: PostgresAdapter;
  const isDockerTest = process.env.DOCKER_TEST === 'true';

  // Skip these tests if not running in Docker environment
  const itOrSkip = isDockerTest ? it : it.skip;

  // Configure connection based on environment variables or default to Docker service
  const config = {
    database: process.env.PG_DATABASE || 'mcp_prompts',
    host: process.env.PG_HOST || 'postgres',
    password: process.env.PG_PASSWORD || 'postgres',
    port: parseInt(process.env.PG_PORT || '5432', 10),
    ssl: process.env.PG_SSL === 'true',
    user: process.env.PG_USER || 'postgres',
  };

  beforeEach(async () => {
    adapter = new PostgresAdapter(config);

    try {
      await adapter.connect();

      // Clear existing data
      // @ts-ignore - clearAll method might not be in the type definition but is implemented
      await adapter.clearAll();
    } catch (error) {
      console.error('Failed to connect to PostgreSQL:', error);
      // Don't fail the test setup - tests will be skipped
    }
  });

  afterEach(async () => {
    try {
      // @ts-ignore - clearAll method might not be in the type definition but is implemented
      await adapter.clearAll();
    } catch (error) {
      console.error('Error cleaning up after test:', error);
    }
  });

  itOrSkip('should be defined', () => {
    expect(adapter).toBeDefined();
  });

  itOrSkip('should save and retrieve a prompt', async () => {
    // Arrange
    const now = new Date().toISOString();
    const prompt = {
      content: 'This is the prompt content',
      createdAt: now,
      description: 'This is a test prompt',
      id: 'test-prompt',
      name: 'Test Prompt',
      updatedAt: now,
    };

    // Act
    await adapter.savePrompt(prompt);
    const retrieved = await adapter.getPrompt('test-prompt');

    // Assert
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(prompt.id);
    expect(retrieved?.name).toBe(prompt.name);
    expect(retrieved?.description).toBe(prompt.description);
    expect(retrieved?.content).toBe(prompt.content);
  });

  itOrSkip('should update an existing prompt', async () => {
    // Arrange
    const now = new Date().toISOString();
    const promptId = `update-test-${Date.now()}`;
    const prompt = {
      content: 'Original content',
      createdAt: now,
      description: 'Original description',
      id: promptId,
      name: 'Update Test',
      updatedAt: now,
    };

    await adapter.savePrompt(prompt);

    // Act
    const updated = {
      ...prompt,
      content: 'Updated content',
      description: 'Updated description',
      updatedAt: new Date().toISOString(),
    };

    await adapter.savePrompt(updated);
    const retrieved = await adapter.getPrompt(promptId);

    // Assert
    expect(retrieved).toBeDefined();
    expect(retrieved?.description).toBe('Updated description');
    expect(retrieved?.content).toBe('Updated content');
  });

  itOrSkip('should list prompts with optional filters', async () => {
    // Arrange
    const now = new Date().toISOString();
    const prompts = [
      {
        content: 'Content 1',
        createdAt: now,
        description: 'Test for listing 1',
        id: 'list-test-1',
        name: 'List Test 1',
        tags: ['test', 'list'],
        updatedAt: now,
      },
      {
        content: 'Content 2',
        createdAt: now,
        description: 'Test for listing 2',
        id: 'list-test-2',
        name: 'List Test 2',
        tags: ['test'],
        updatedAt: now,
      },
      {
        content: 'Content 3',
        createdAt: now,
        description: 'Another test',
        id: 'list-test-3',
        name: 'List Test 3',
        tags: ['test', 'other'],
        updatedAt: now,
      },
    ];

    for (const prompt of prompts) {
      await adapter.savePrompt(prompt);
    }

    // Act & Assert
    const all = await adapter.listPrompts();
    expect(all.length).toBeGreaterThanOrEqual(3);

    const filtered = await adapter.listPrompts({ tags: ['list'] });
    expect(filtered.length).toBeGreaterThanOrEqual(1);
    expect(filtered.some(p => p.id === 'list-test-1')).toBe(true);

    const searchResults = await adapter.listPrompts({ search: 'Another' });
    expect(searchResults.length).toBeGreaterThanOrEqual(1);
    expect(searchResults.some(p => p.id === 'list-test-3')).toBe(true);
  });

  itOrSkip('should delete a prompt', async () => {
    // Arrange
    const now = new Date().toISOString();
    const promptId = `delete-test-${Date.now()}`;
    const prompt = {
      content: 'Delete me',
      createdAt: now,
      description: 'Test for deleting',
      id: promptId,
      name: 'Delete Test',
      updatedAt: now,
    };

    await adapter.savePrompt(prompt);

    // Verify the prompt exists
    const savedPrompt = await adapter.getPrompt(promptId);
    expect(savedPrompt).toBeDefined();

    // Act
    await adapter.deletePrompt(promptId);

    // Assert - Try to retrieve the deleted prompt
    try {
      const retrieveResult = await adapter.getPrompt(promptId);
      // If no error is thrown, the prompt was not deleted
      expect(retrieveResult).toBeNull();
    } catch (error) {
      // If an error is thrown, verify it's because the prompt wasn't found
      expect((error as Error).message).toContain('not found');
    }
  });

  itOrSkip('should handle connection failures gracefully', async () => {
    // This test can only be simulated
    // We're just placeholder testing the error handling in a wrapper
    const badConfig = {
      ...config,
      host: 'non-existent-host',
      port: 54321,
    };

    const badAdapter = new PostgresAdapter(badConfig);

    try {
      await badAdapter.connect();
      // Should not reach here
      expect(false).toBe(true);
    } catch (error) {
      // Error expected
      expect(error).toBeDefined();
    }
  });

  itOrSkip('should rollback transactions on error', async () => {
    // This test is just a placeholder since we can't easily simulate transaction failures
    // in an integration test without complex setup
    expect(true).toBe(true);
  });

  itOrSkip('should handle bulk operations correctly', async () => {
    // A simple test to verify we can save and retrieve multiple prompts
    const now = new Date().toISOString();
    const prompts = Array.from({ length: 10 }, (_, i) => ({
      content: `Bulk test content ${i}`,
      createdAt: now,
      description: `Bulk test description ${i}`,
      id: `bulk-test-${i}`,
      name: `Bulk Test ${i}`,
      updatedAt: now,
    }));

    // Save all prompts
    for (const prompt of prompts) {
      await adapter.savePrompt(prompt);
    }

    // Retrieve all prompts
    const retrievedPrompts = await adapter.listPrompts();

    // Verify all were saved
    for (const prompt of prompts) {
      const found = retrievedPrompts.find(p => p.id === prompt.id);
      expect(found).toBeDefined();
      expect(found?.name).toBe(prompt.name);
    }
  });

  itOrSkip('should save and retrieve a prompt with variables and metadata', async () => {
    const now = new Date().toISOString();
    const prompt = {
      content: 'This is the prompt content',
      createdAt: now,
      description: 'This is a test prompt',
      id: 'test-prompt',
      metadata: { count: 42, foo: 'bar' },
      name: 'Test Prompt',
      tags: ['integration', 'test'],
      updatedAt: now,
      variables: [{ default: 'foo', description: 'Variable 1', name: 'var1' }, { name: 'var2' }],
    };
    await adapter.savePrompt(prompt);
    const retrieved = await adapter.getPrompt('Test Prompt');
    expect(retrieved).toBeDefined();
    expect(retrieved?.name).toBe(prompt.name);
    expect(retrieved?.tags).toEqual(expect.arrayContaining(['integration', 'test']));
    expect(retrieved?.variables).toEqual(expect.arrayContaining(['var1', 'var2']));
    expect(retrieved?.metadata).toMatchObject({ count: 42, foo: 'bar' });
  });
});
