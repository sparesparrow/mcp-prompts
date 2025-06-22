import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fsp from 'node:fs/promises';
import os from 'node:os';
import { z } from 'zod';

import { FileAdapter } from '../../src/adapters.js';
import { Prompt, StorageAdapter, PromptSequence } from '../../src/interfaces.js';
import { rmdir } from 'fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_PROMPTS_DIR = path.join(__dirname, '../../test-prompts');
const testPromptFile = path.join(TEST_PROMPTS_DIR, 'delete-test.json');

const TEST_DIR_BASE = path.resolve(process.cwd(), 'test-runs');
let testDir: string;

/**
 *
 * @param dirPath
 */
function removeDirRecursive(dirPath: string) {
  if (fs.existsSync(dirPath)) {
    for (const entry of fs.readdirSync(dirPath)) {
      const entryPath = path.join(dirPath, entry);
      if (fs.statSync(entryPath).isDirectory()) {
        removeDirRecursive(entryPath);
      } else {
        fs.unlinkSync(entryPath);
      }
    }
    fs.rmdirSync(dirPath);
  }
}

describe.skip('FileAdapter Integration Tests', () => {
  let adapter: StorageAdapter;
  const testDirName = './test-prompts-file-adapter';

  beforeAll(() => {
    // Create a unique directory for this test run
    if (!fs.existsSync(TEST_DIR_BASE)) {
      fs.mkdirSync(TEST_DIR_BASE);
    }
    testDir = fs.mkdtempSync(path.join(TEST_DIR_BASE, 'file-adapter-'));
  });

  afterAll(() => {
    // Clean up the unique directory
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    // Each test gets its own subdirectory to ensure isolation
    const testCaseDir = fs.mkdtempSync(path.join(testDir, 'test-case-'));
    adapter = new FileAdapter({ promptsDir: testCaseDir });
    await adapter.connect();
  });

  afterEach(async () => {
    await adapter.disconnect();
  });

  it('should be defined', () => {
    expect(FileAdapter).toBeDefined();
  });

  it('should connect successfully', async () => {
    await expect(adapter.connect()).resolves.not.toThrow();
  });

  it('should save and retrieve a prompt', async () => {
    const promptData = {
      id: 'test',
      version: 1,
      name: 'Test',
      content: 'Test content',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const savedPrompt = await adapter.savePrompt(promptData);
    const retrieved = await adapter.getPrompt(savedPrompt.id, savedPrompt.version);
    expect(retrieved).toBeDefined();
    expect(retrieved?.name).toBe(promptData.name);
    expect(retrieved?.content).toBe(promptData.content);
  });

  it('should update an existing prompt (versioned)', async () => {
    const promptData = {
      id: 'update-test',
      version: 1,
      name: 'Update Test',
      content: 'Initial content',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const savedPrompt = await adapter.savePrompt(promptData);

    const updates = {
      content: 'Updated content',
    };
    const updatedPrompt = await adapter.updatePrompt(
      savedPrompt.id,
      savedPrompt.version || 1,
      updates,
    );
    expect(updatedPrompt).toBeDefined();
    expect(updatedPrompt.content).toBe('Updated content');
    expect(updatedPrompt.version).toBe(savedPrompt.version);

    const retrieved = await adapter.getPrompt(savedPrompt.id, updatedPrompt.version);
    expect(retrieved).toBeDefined();
    expect(retrieved?.content).toBe('Updated content');
    expect(retrieved?.version).toBe(2);

    const originalRetrieved = await adapter.getPrompt(savedPrompt.id, savedPrompt.version);
    expect(originalRetrieved).toBeDefined();
    expect(originalRetrieved?.content).toBe('Initial content');
    expect(originalRetrieved?.version).toBe(1);
  });

  it('should list all prompts (versioned)', async () => {
    const promptsData = [
      {
        id: 'list-1',
        version: 1,
        name: 'List 1',
        content: 'Prompt 1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'list-2',
        version: 1,
        name: 'List 2',
        content: 'Prompt 2',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const savedPrompts = await Promise.all(promptsData.map(p => adapter.savePrompt(p)));

    const result = await adapter.listPrompts({}, true);
    expect(result.prompts.length).toBeGreaterThanOrEqual(2);
    expect(result.prompts.some(p => p.id === savedPrompts[0].id)).toBe(true);
    expect(result.prompts.some(p => p.id === savedPrompts[1].id)).toBe(true);
  });

  it('should delete all versions of a prompt', async () => {
    const promptData = {
      id: 'delete-test',
      version: 1,
      name: 'Delete Test',
      content: 'To be deleted',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    // Save two versions
    const savedPrompt1 = await adapter.savePrompt(promptData);
    const savedPrompt2 = await adapter.updatePrompt(savedPrompt1.id, savedPrompt1.version, {
      content: 'v2',
    });

    // Delete the whole prompt (all versions)
    await adapter.deletePrompt(savedPrompt1.id);

    // Verify no versions are left
    const versions = await adapter.listPromptVersions(savedPrompt1.id);
    expect(versions).toEqual([]);
  });

  describe('Schema Validation', () => {
    it('should throw a ZodError when saving a prompt with invalid data', async () => {
      const invalidPromptData: any = {
        // name is missing, which is required by the schema
        content: 'This prompt is invalid',
      };
      await expect(adapter.savePrompt(invalidPromptData)).rejects.toThrow(z.ZodError);
    });

    it('should skip malformed JSON files when listing prompts', async () => {
      // Manually create a malformed file
      const malformedFilePath = path.join(testDir, 'malformed.json');
      await fsp.writeFile(malformedFilePath, '{ "name": "malformed", "content": "test"'); // Missing closing brace

      const prompts = await adapter.listPrompts();
      expect(prompts.prompts.find(p => p.name === 'malformed')).toBeUndefined();
    });

    it('should skip files that fail schema validation when listing prompts', async () => {
      // Manually create a file with valid JSON but invalid schema
      const invalidSchemaPrompt = {
        id: 'invalid-schema-prompt',
        name: 'Invalid Schema',
        content: 'test',
        version: 'not-a-number', // version should be a number
      };
      const invalidSchemaFilePath = path.join(testDir, 'invalid-schema-prompt.json');
      await fsp.writeFile(invalidSchemaFilePath, JSON.stringify(invalidSchemaPrompt));

      const prompts = await adapter.listPrompts();
      expect(prompts.prompts.find(p => p.id === 'invalid-schema-prompt')).toBeUndefined();
    });
  });

  describe('validation', () => {
    it('should ignore malformed JSON files', async () => {
      // Setup a malformed file
      const malformedFilePath = path.join(testDir, 'malformed.json');
      await fsp.writeFile(malformedFilePath, '{"name": "malformed", "content": }'); // Invalid JSON

      const prompts = await adapter.listPrompts();
      expect(prompts.prompts.find((p: Prompt) => p.name === 'malformed')).toBeUndefined();
    });

    it('should ignore files that do not match the prompt schema', async () => {
      // Setup a file with an invalid schema
      const invalidSchemaFilePath = path.join(testDir, 'invalid-schema-prompt-v1.json');
      await fsp.writeFile(
        invalidSchemaFilePath,
        JSON.stringify({ id: 'invalid-schema-prompt', name: 'Invalid Schema' }), // Missing 'content'
      );

      const prompts = await adapter.listPrompts();
      expect(prompts.prompts.find((p: Prompt) => p.id === 'invalid-schema-prompt')).toBeUndefined();
    });
  });
});
