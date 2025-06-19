import { SequenceServiceImpl } from '../../src/sequence-service.js';
import { MemoryAdapter } from '../../src/adapters.js';
import { PromptSequence } from '../../src/interfaces.js';
import { MdcAdapter } from '../../src/adapters.js';
import { Prompt } from '../../src/interfaces.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('SequenceService', () => {
  let storage: MemoryAdapter;
  let service: SequenceServiceImpl;

  beforeEach(async () => {
    storage = new MemoryAdapter();
    await storage.connect();
    service = new SequenceServiceImpl(storage);
  });

  it('should create and retrieve a sequence (happy path)', async () => {
    const seq = await service.createSequence({
      name: 'Test Sequence',
      description: 'Demo',
      promptIds: ['p1', 'p2'],
    });
    expect(seq.id).toBeDefined();
    const result = await service.getSequenceWithPrompts(seq.id);
    expect(result.sequence.name).toBe('Test Sequence');
    expect(result.sequence.promptIds).toEqual(['p1', 'p2']);
    expect(Array.isArray(result.prompts)).toBe(true);
  });

  it('should return not found for unknown sequence', async () => {
    await expect(service.getSequenceWithPrompts('nonexistent')).rejects.toThrow(/not found/i);
  });

  it('should throw for invalid ID', async () => {
    await expect(service.getSequenceWithPrompts('')).rejects.toThrow();
  });
});

describe('MdcAdapter', () => {
  const tempDir = path.join(__dirname, '../../.test-mdc-prompts');
  let adapter: MdcAdapter;

  beforeAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
    adapter = new MdcAdapter(tempDir);
    await adapter.connect();
  });

  afterAll(async () => {
    await adapter.disconnect();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should save and get a prompt', async () => {
    const prompt: Prompt = {
      id: '',
      name: 'Test Prompt',
      description: 'A test prompt',
      content: 'Hello, world!',
      tags: ['glob:test'],
      isTemplate: false,
      variables: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const saved = await adapter.savePrompt(prompt);
    expect(saved.id).toBeTruthy();
    const fetched = await adapter.getPrompt(saved.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.name).toBe('Test Prompt');
    expect(fetched!.content).toBe('Hello, world!');
  });

  it('should update a prompt', async () => {
    const prompt: Prompt = {
      id: '',
      name: 'Update Prompt',
      description: 'To update',
      content: 'Initial',
      tags: [],
      isTemplate: false,
      variables: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const saved = await adapter.savePrompt(prompt);
    const updated = await adapter.updatePrompt(saved.id, { ...saved, content: 'Updated!' });
    expect(updated.content).toBe('Updated!');
    const fetched = await adapter.getPrompt(saved.id);
    expect(fetched!.content).toBe('Updated!');
  });

  it('should delete a prompt', async () => {
    const prompt: Prompt = {
      id: '',
      name: 'Delete Prompt',
      description: '',
      content: 'To delete',
      tags: [],
      isTemplate: false,
      variables: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const saved = await adapter.savePrompt(prompt);
    await adapter.deletePrompt(saved.id);
    const fetched = await adapter.getPrompt(saved.id);
    expect(fetched).toBeNull();
  });

  it('should list prompts', async () => {
    const prompt: Prompt = {
      id: '',
      name: 'List Prompt',
      description: '',
      content: 'To list',
      tags: ['glob:list'],
      isTemplate: false,
      variables: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await adapter.savePrompt(prompt);
    const prompts = await adapter.listPrompts();
    expect(prompts.length).toBeGreaterThan(0);
    expect(prompts.some((p: Prompt) => p.name === 'List Prompt')).toBe(true);
  });
});

describe('MdcAdapter edge and error cases', () => {
  const tempDir = path.join(__dirname, '../../.test-mdc-prompts-edge');
  let adapter: MdcAdapter;

  beforeEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
    adapter = new MdcAdapter(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should throw if not connected', async () => {
    await expect(adapter.savePrompt({ id: '', name: 'x', description: '', content: '', tags: [], isTemplate: false, variables: [], createdAt: '', updatedAt: '' })).rejects.toThrow(/not connected/);
    await expect(adapter.getPrompt('id')).rejects.toThrow(/not connected/);
    await expect(adapter.updatePrompt('id', { id: 'id', name: '', description: '', content: '', tags: [], isTemplate: false, variables: [], createdAt: '', updatedAt: '' })).rejects.toThrow(/not connected/);
    await expect(adapter.deletePrompt('id')).rejects.toThrow(/not connected/);
    await expect(adapter.listPrompts()).rejects.toThrow(/not connected/);
    await expect(adapter.getAllPrompts()).rejects.toThrow(/not connected/);
  });

  it('should return null for getPrompt on missing file', async () => {
    await adapter.connect();
    const result = await adapter.getPrompt('does-not-exist');
    expect(result).toBeNull();
  });

  it('should handle malformed MDC frontmatter gracefully', async () => {
    await adapter.connect();
    const badFile = path.join(tempDir, 'bad.mdc');
    await fs.writeFile(badFile, '---\nthis is not yaml\n---\n\n# Title\n\nContent', 'utf8');
    const result = await adapter.getPrompt('bad');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Title');
  });

  it('should filter prompts by tags, isTemplate, category, and search', async () => {
    await adapter.connect();
    const prompts = [
      { id: '', name: 'A', description: '', content: 'foo', tags: ['glob:foo', 'cat:alpha'], isTemplate: false, variables: [], createdAt: '', updatedAt: '', category: 'alpha' },
      { id: '', name: 'B', description: '', content: 'bar', tags: ['glob:bar'], isTemplate: true, variables: ['x'], createdAt: '', updatedAt: '', category: 'beta' },
    ];
    for (const p of prompts) await adapter.savePrompt(p);
    const all = await adapter.listPrompts();
    expect(all.length).toBeGreaterThanOrEqual(2);
    const byTag = await adapter.listPrompts({ tags: ['glob:foo'] });
    expect(byTag.some(p => p.name === 'A')).toBe(true);
    const byTemplate = await adapter.listPrompts({ isTemplate: true });
    expect(byTemplate.every(p => p.isTemplate)).toBe(true);
    const byCategory = await adapter.listPrompts({ category: 'alpha' });
    expect(byCategory.every(p => p.category === 'alpha')).toBe(true);
    const bySearch = await adapter.listPrompts({ search: 'bar' });
    expect(bySearch.some(p => p.name === 'B')).toBe(true);
  });

  it('should extract variables from content', async () => {
    await adapter.connect();
    const prompt: Prompt = {
      id: '',
      name: 'Vars',
      description: '',
      content: 'Some text\n\n## Variables\n\n- `foo`\n- `bar`\n',
      tags: [],
      isTemplate: true,
      variables: ['foo', 'bar'],
      createdAt: '',
      updatedAt: '',
    };
    const saved = await adapter.savePrompt(prompt);
    const fetched = await adapter.getPrompt(saved.id);
    expect(fetched!.variables).toContain('foo');
    expect(fetched!.variables).toContain('bar');
  });

  it('should return null or throw for sequence methods', async () => {
    await adapter.connect();
    expect(await adapter.getSequence('any')).toBeNull();
    await expect(adapter.saveSequence({ id: 'x', name: '', description: '', promptIds: [], createdAt: '', updatedAt: '' })).rejects.toThrow(/not supported/);
    await expect(adapter.deleteSequence('x')).rejects.toThrow(/not supported/);
  });
}); 