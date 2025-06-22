import { FileAdapter } from '../../src/adapters.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_PROMPTS_DIR = path.join(__dirname, '../../test-prompts');
function removeDirRecursive(dirPath) {
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
  let adapter;
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
  });
  afterAll(() => {
    // Clean up after all tests
    if (fs.existsSync(TEST_PROMPTS_DIR)) {
      removeDirRecursive(TEST_PROMPTS_DIR);
    }
  });
  it('should be defined', () => {
    expect(FileAdapter).toBeDefined();
  });
  it('should connect successfully', async () => {
    await expect(adapter.connect()).resolves.not.toThrow();
  });
});
