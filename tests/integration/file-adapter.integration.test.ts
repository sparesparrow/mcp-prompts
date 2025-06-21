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

  it('should update an existing prompt', async () => {
    await adapter.connect();
    const originalPrompt = {
      id: 'update-test',
      name: 'Update Test',
      content: 'Original',
      createdAt: 'date',
      updatedAt: 'date',
      version: 1,
    };
    await adapter.savePrompt(originalPrompt);
    const updatedData = {
      ...originalPrompt,
      content: 'Updated',
      version: 2,
      updatedAt: 'new-date',
    };
    const updatedPrompt = await adapter.updatePrompt('update-test', updatedData);
    expect(updatedPrompt.content).toBe('Updated');
    expect(updatedPrompt.version).toBe(2);
    const retrieved = await adapter.getPrompt('update-test');
    expect(retrieved?.content).toBe('Updated');
  });

  it('should delete a prompt', async () => {
    await adapter.connect();
    const prompt = {
      id: 'delete-test',
      name: 'Delete Test',
      content: 'Delete me',
      createdAt: 'date',
      updatedAt: 'date',
    };
    await adapter.savePrompt(prompt);
    console.log('[DEBUG] Saved prompt:', testPromptFile, 'Exists:', fs.existsSync(testPromptFile));
    let retrieved = await adapter.getPrompt('delete-test');
    expect(retrieved).toBeDefined();
    await adapter.deletePrompt('delete-test');
    console.log(
      '[DEBUG] Deleted prompt:',
      testPromptFile,
      'Exists:',
      fs.existsSync(testPromptFile)
    );
    retrieved = await adapter.getPrompt('delete-test');
    expect(retrieved).toBeNull();
  });
});
