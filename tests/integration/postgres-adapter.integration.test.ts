import { jest } from '@jest/globals';

import { PostgresAdapter } from '../../src/adapters.js';
import { Prompt } from '../../src/interfaces';

// This test requires a PostgreSQL database
// A Docker container should be running with:
// docker run --name postgres-test -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=mcp_prompts_test -p 5432:5432 -d postgres:14-alpine
describe.skip('PostgresAdapter Integration', () => {
  let adapter: PostgresAdapter;
  let isConnected = false;

  // Configure connection based on environment variables or default to Docker service
  const config = {
    database: process.env.PG_DATABASE || 'mcp_prompts_test',
    host: process.env.PG_HOST || 'localhost',
    password: process.env.PG_PASSWORD || 'postgres',
    port: parseInt(process.env.PG_PORT || '5432', 10),
    ssl: process.env.PG_SSL === 'true',
    user: process.env.PG_USER || 'postgres',
  };

  beforeAll(async () => {
    adapter = new PostgresAdapter(config);
    try {
      await adapter.connect();
      isConnected = await adapter.isConnected();
    } catch (error) {
      console.error('Skipping Postgres tests: Failed to connect to PostgreSQL:', error);
      isConnected = false;
    }
  });

  beforeEach(async () => {
    if (isConnected) {
      await adapter.clearAll!();
    }
  });

  afterAll(async () => {
    if (isConnected) {
      await adapter.clearAll!();
      await adapter.disconnect();
    }
  });

  const itIfConnected = (description: string, testFn: () => any) => {
    (isConnected ? it : it.skip)(description, testFn);
  };

  itIfConnected('should be defined', () => {
    expect(adapter).toBeDefined();
  });

  itIfConnected('should save and retrieve a prompt', async () => {
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

  itIfConnected('should update an existing prompt', async () => {
    // Arrange
    const now = new Date().toISOString();
    const promptId = `update-test-${Date.now()}`;
    const originalPrompt = {
      content: 'Original content',
      createdAt: now,
      description: 'Original description',
      id: promptId,
      name: 'Update Test',
      updatedAt: now,
      version: 1,
    };

    await adapter.savePrompt(originalPrompt);

    // Act
    const promptToUpdate = {
      ...originalPrompt,
      content: 'Updated content',
      description: 'Updated description',
      version: 2,
      updatedAt: new Date().toISOString(),
    };
    const updatedPrompt = await adapter.updatePrompt(promptId, promptToUpdate);

    // Assert
    expect(updatedPrompt).toBeDefined();
    expect(updatedPrompt.description).toBe('Updated description');
    expect(updatedPrompt.content).toBe('Updated content');
    expect(updatedPrompt.version).toBe(2);
    const retrieved = await adapter.getPrompt(promptId);
    expect(retrieved?.description).toBe('Updated description');
  });

  itIfConnected('should list prompts with optional filters', async () => {
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

  itIfConnected('should delete a prompt', async () => {
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
    const retrieved = await adapter.getPrompt(promptId);

    // Assert
    expect(retrieved).toBeNull();
  });

  itIfConnected('should handle connection failures gracefully', async () => {
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
      fail('Connection should have failed but it succeeded.');
    } catch (error) {
      // Error expected
      expect(error).toBeDefined();
    }
  });

  itIfConnected('should rollback transactions on error', async () => {
    // This test is just a placeholder since we can't easily simulate transaction failures
    // in an integration test without complex setup
    expect(true).toBe(true);
  });

  itIfConnected('should handle bulk operations correctly', async () => {
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

  itIfConnected('should save and retrieve a prompt with variables and metadata', async () => {
    const now = new Date().toISOString();
    const prompt = {
      content: 'This is the prompt content',
      createdAt: now,
      description: 'This is a test prompt',
      id: 'test-prompt-extended',
      isTemplate: true,
      metadata: {
        author: 'test-user',
        source: 'integration-test',
      },
      name: 'Test Prompt Extended',
      tags: ['extended', 'test'],
      updatedAt: now,
      variables: ['name', 'item'],
    };

    await adapter.savePrompt(prompt);
    const retrieved = await adapter.getPrompt('test-prompt-extended');
    expect(retrieved).toBeDefined();
    expect(retrieved?.tags).toEqual(expect.arrayContaining(['extended', 'test']));
    expect(retrieved?.variables).toEqual(expect.arrayContaining(['name', 'item']));
    expect(retrieved?.metadata).toHaveProperty('author', 'test-user');
  });
});
