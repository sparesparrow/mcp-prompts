import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

import { MemoryAdapter } from '../../src/adapters.js';
import { MdcAdapter } from '../../src/adapters.js';
import type { Prompt } from '../../src/interfaces.js';
import { PromptSequence } from '../../src/interfaces.js';
import { SequenceServiceImpl } from '../../src/sequence-service.js';

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
      description: 'Demo',
      name: 'Test Sequence',
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
    await fs.rm(tempDir, { force: true, recursive: true });
    adapter = new MdcAdapter(tempDir);
    await adapter.connect();
  });

  afterAll(async () => {
    await adapter.disconnect();
    await fs.rm(tempDir, { force: true, recursive: true });
  });

  it('should save and get a prompt', async () => {
    const prompt: Prompt = {
      content: 'Hello, world!',
      createdAt: new Date().toISOString(),
      description: 'A test prompt',
      id: '',
      isTemplate: false,
      name: 'Test Prompt',
      tags: ['glob:test'],
      updatedAt: new Date().toISOString(),
      variables: [],
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
      content: 'Initial',
      createdAt: new Date().toISOString(),
      description: 'To update',
      id: '',
      isTemplate: false,
      name: 'Update Prompt',
      tags: [],
      updatedAt: new Date().toISOString(),
      variables: [],
    };
    const saved = await adapter.savePrompt(prompt);
    const updated = await adapter.updatePrompt(saved.id, { ...saved, content: 'Updated!' });
    expect(updated.content).toBe('Updated!');
    const fetched = await adapter.getPrompt(saved.id);
    expect(fetched!.content).toBe('Updated!');
  });

  it('should delete a prompt', async () => {
    const prompt: Prompt = {
      content: 'To delete',
      createdAt: new Date().toISOString(),
      description: '',
      id: '',
      isTemplate: false,
      name: 'Delete Prompt',
      tags: [],
      updatedAt: new Date().toISOString(),
      variables: [],
    };
    const saved = await adapter.savePrompt(prompt);
    await adapter.deletePrompt(saved.id);
    const fetched = await adapter.getPrompt(saved.id);
    expect(fetched).toBeNull();
  });

  it('should list prompts', async () => {
    const prompt: Prompt = {
      content: 'To list',
      createdAt: new Date().toISOString(),
      description: '',
      id: '',
      isTemplate: false,
      name: 'List Prompt',
      tags: ['glob:list'],
      updatedAt: new Date().toISOString(),
      variables: [],
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
    await fs.rm(tempDir, { force: true, recursive: true });
    adapter = new MdcAdapter(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { force: true, recursive: true });
  });

  it('should throw if not connected', async () => {
    await expect(
      adapter.savePrompt({
        content: '',
        createdAt: '',
        description: '',
        id: '',
        isTemplate: false,
        name: 'x',
        tags: [],
        updatedAt: '',
        variables: [],
      }),
    ).rejects.toThrow(/not connected/);
    await expect(adapter.getPrompt('id')).rejects.toThrow(/not connected/);
    await expect(
      adapter.updatePrompt('id', {
        content: '',
        createdAt: '',
        description: '',
        id: 'id',
        isTemplate: false,
        name: '',
        tags: [],
        updatedAt: '',
        variables: [],
      }),
    ).rejects.toThrow(/not connected/);
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
      {
        category: 'alpha',
        content: 'foo',
        createdAt: '',
        description: '',
        id: '',
        isTemplate: false,
        name: 'A',
        tags: ['glob:foo', 'cat:alpha'],
        updatedAt: '',
        variables: [],
      },
      {
        category: 'beta',
        content: 'bar',
        createdAt: '',
        description: '',
        id: '',
        isTemplate: true,
        name: 'B',
        tags: ['glob:bar'],
        updatedAt: '',
        variables: ['x'],
      },
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
      content: 'Some text\n\n## Variables\n\n- `foo`\n- `bar`\n',
      createdAt: '',
      description: '',
      id: '',
      isTemplate: true,
      name: 'Vars',
      tags: [],
      updatedAt: '',
      variables: ['foo', 'bar'],
    };
    const saved = await adapter.savePrompt(prompt);
    const fetched = await adapter.getPrompt(saved.id);
    expect(fetched!.variables).toContain('foo');
    expect(fetched!.variables).toContain('bar');
  });

  it('should return null or throw for sequence methods', async () => {
    await adapter.connect();
    expect(await adapter.getSequence('any')).toBeNull();
    await expect(
      adapter.saveSequence({
        createdAt: '',
        description: '',
        id: 'x',
        name: '',
        promptIds: [],
        updatedAt: '',
      }),
    ).rejects.toThrow(/not supported/);
    await expect(adapter.deleteSequence('x')).rejects.toThrow(/not supported/);
  });
});
