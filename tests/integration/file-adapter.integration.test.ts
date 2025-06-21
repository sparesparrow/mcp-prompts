import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import { FileAdapter } from '../../src/adapters.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_PROMPTS_DIR = path.join(__dirname, '../../test-prompts');
const testPromptFile = path.join(TEST_PROMPTS_DIR, 'delete-test.json');

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
  let adapter: FileAdapter;

  beforeAll(() => {
    // Create test directory if it doesn't exist
    if (!fs.existsSync(TEST_PROMPTS_DIR)) {
      fs.mkdirSync(TEST_PROMPTS_DIR, { recursive: true });
    }
  });

  beforeEach(() => {
    // Clean the test directory before each test
    if (fs.existsSync(TEST_PROMPTS_DIR)) {
      removeDirRecursive(TEST_PROMPTS_DIR);
    }
    fs.mkdirSync(TEST_PROMPTS_DIR, { recursive: true });
    adapter = new FileAdapter(TEST_PROMPTS_DIR);

    // Clean up before test
    if (fs.existsSync(testPromptFile)) {
      fs.unlinkSync(testPromptFile);
      console.log('[DEBUG] Deleted test prompt file before test:', testPromptFile);
    }
  });

  afterAll(() => {
    // Clean up after all tests
    if (fs.existsSync(TEST_PROMPTS_DIR)) {
      removeDirRecursive(TEST_PROMPTS_DIR);
    }
  });

  afterEach(() => {
    // Clean up after test
    if (fs.existsSync(testPromptFile)) {
      fs.unlinkSync(testPromptFile);
      console.log('[DEBUG] Deleted test prompt file after test:', testPromptFile);
    }
  });

  it('should be defined', () => {
    expect(FileAdapter).toBeDefined();
  });

  it('should connect successfully', async () => {
    await expect(adapter.connect()).resolves.not.toThrow();
  });

  it('should save and retrieve a prompt', async () => {
    await adapter.connect();
    const prompt = {
      id: 'test',
      name: 'Test',
      content: 'Test content',
      createdAt: 'date',
      updatedAt: 'date',
    };
    await adapter.savePrompt(prompt);
    const retrieved = await adapter.getPrompt('test');
    expect(retrieved).toEqual(prompt);
  });

  it('should update an existing prompt (versioned)', async () => {
    await adapter.connect();
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
    await adapter.connect();
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
    await adapter.connect();
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
