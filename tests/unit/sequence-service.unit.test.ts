import { SequenceServiceImpl } from '../../src/sequence-service';
import { MemoryAdapter } from '../../src/adapters';
import { PromptSequence } from '../../src/interfaces';
import { MdcAdapter } from '../../src/adapters';
import { Prompt } from '../../src/interfaces';
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
    expect(prompts.some(p => p.name === 'List Prompt')).toBe(true);
  });
}); 