import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { FileAdapter } from '../../src/adapters.js';

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
      savedPrompt.version as number,
      updates,
    );
    expect(updatedPrompt).toBeDefined();
    expect(updatedPrompt.content).toBe('Updated content');
    expect(updatedPrompt.version).toBe(savedPrompt.version);

    const retrieved = await adapter.getPrompt(updatedPrompt.id, updatedPrompt.version);
    expect(retrieved).toBeDefined();
    expect(retrieved?.content).toBe('Updated content');

    const versions = await adapter.listPromptVersions(savedPrompt.id);
    expect(versions).toHaveLength(1);
    expect(versions[0]).toBe(savedPrompt.version);
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

    const all = await adapter.listPrompts({}, true);
    expect(all.length).toBeGreaterThanOrEqual(2);
    expect(all.some(p => p.id === savedPrompts[0].id)).toBe(true);
    expect(all.some(p => p.id === savedPrompts[1].id)).toBe(true);
  });

  it('should delete a prompt (versioned)', async () => {
    const promptData = {
      id: 'delete-test',
      version: 1,
      name: 'Delete Test',
      content: 'To be deleted',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const savedPrompt = await adapter.savePrompt(promptData);
    await adapter.deletePrompt(savedPrompt.id, savedPrompt.version as number);
    const retrieved = await adapter.getPrompt(savedPrompt.id, savedPrompt.version as number);
    expect(retrieved).toBeNull();
  });
});
