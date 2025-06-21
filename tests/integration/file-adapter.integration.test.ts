import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fsp from 'node:fs/promises';
import os from 'node:os';

import { FileAdapter } from '../../src/adapters.js';
import { Prompt } from '../../src/interfaces';

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

describe('FileAdapter Integration', () => {
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

  let adapter: FileAdapter;

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
      name: 'Test',
      content: 'Test content',
    };
    const savedPrompt = await adapter.savePrompt(promptData);
    const retrieved = await adapter.getPrompt(savedPrompt.id, savedPrompt.version);
    expect(retrieved).toBeDefined();
    expect(retrieved?.name).toBe(promptData.name);
    expect(retrieved?.content).toBe(promptData.content);
  });

  it('should update an existing prompt (versioned)', async () => {
    const promptData = {
      name: 'Update Test',
      content: 'Initial content',
    };
    const savedPrompt = await adapter.savePrompt(promptData);

    const updates = {
      content: 'Updated content',
    };
    const updatedPrompt = await adapter.updatePrompt(
      savedPrompt.id,
      savedPrompt.version,
      updates,
    );
    expect(updatedPrompt).toBeDefined();
    expect(updatedPrompt.content).toBe('Updated content');

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
      { name: 'List 1', content: 'Prompt 1' },
      { name: 'List 2', content: 'Prompt 2' },
    ];

    const savedPrompts = await Promise.all(
      promptsData.map(p => adapter.savePrompt(p)),
    );

    const all = await adapter.listPrompts({}, true);
    expect(all.length).toBeGreaterThanOrEqual(2);
    expect(all.some(p => p.id === savedPrompts[0].id)).toBe(true);
    expect(all.some(p => p.id === savedPrompts[1].id)).toBe(true);
  });

  it('should delete all versions of a prompt', async () => {
    const promptData = {
      name: 'Delete Test',
      content: 'To be deleted',
    };
    // Save two versions
    const savedPrompt1 = await adapter.savePrompt(promptData);
    const savedPrompt2 = await adapter.updatePrompt(savedPrompt1.id, savedPrompt1.version, { content: 'v2' });

    // Delete the whole prompt (all versions)
    await adapter.deletePrompt(savedPrompt1.id);

    // Verify no versions are left
    const versions = await adapter.listPromptVersions(savedPrompt1.id);
    expect(versions).toEqual([]);
  });
});
