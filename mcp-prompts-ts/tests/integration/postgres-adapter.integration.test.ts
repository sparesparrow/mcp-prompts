import { jest } from '@jest/globals';

import { PostgresAdapter } from '../../src/adapters.js';
import { promptSchemas } from '../../src/schemas.js';
import type { Prompt } from '../../src/interfaces.js';

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
      // Clear the tables before each test
      await adapter.clearForTest();
    }
  });

  afterAll(async () => {
    if (isConnected) {
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
    const promptToUpdate: Partial<Prompt> = { content: 'Updated content' };
    const updatedPrompt = await adapter.updatePrompt(promptId, 1, promptToUpdate);

    // Assert
    expect(updatedPrompt).toBeDefined();
    expect(updatedPrompt.content).toBe('Updated content');
    const retrieved = await adapter.getPrompt(promptId);
    expect(retrieved?.description).toBe('Original description');
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
    const promptId = 'delete-test-prompt';
    const prompt = {
      content: 'This is the prompt content',
      createdAt: now,
      description: 'This is a test prompt',
      id: promptId,
      name: 'Test Prompt',
      updatedAt: now,
    };

    // Act
    await adapter.savePrompt(prompt);
    await adapter.deletePrompt(promptId);
    const retrieved = await adapter.getPrompt(promptId);

    // Assert
    expect(retrieved).toBeNull();
  });
});