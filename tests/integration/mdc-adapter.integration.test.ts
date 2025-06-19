import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { MdcAdapter } from '../../src/adapters.js';
import { Prompt } from '../../src/interfaces.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('MdcAdapter Integration', () => {
  const testDir = path.join(__dirname, '../../.test-mdc-integration');
  let adapter: MdcAdapter;

  beforeAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    await fs.mkdir(testDir, { recursive: true });
    adapter = new MdcAdapter(testDir);
    await adapter.connect();
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should save and retrieve a prompt', async () => {
    const prompt: Prompt = {
      id: 'test-mdc-1',
      name: 'Test MDC Prompt',
      description: 'Integration test prompt',
      content: 'Hello, {{name}}!',
      isTemplate: true,
      variables: ['name'],
      tags: ['test', 'mdc'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    };
    await adapter.savePrompt(prompt);
    const loaded = await adapter.getPrompt('test-mdc-1');
    expect(loaded).not.toBeNull();
    expect(loaded?.name).toBe(prompt.name);
    expect(loaded?.content).toContain('{{name}}');
    expect(loaded?.isTemplate).toBe(true);
    expect(loaded?.variables).toContain('name');
  });

  it('should update a prompt', async () => {
    const now = new Date().toISOString();
    const updated = await adapter.updatePrompt('test-mdc-1', {
      id: 'test-mdc-1',
      name: 'Test MDC',
      description: 'Updated desc',
      content: 'Test content',
      createdAt: now,
      updatedAt: now,
      isTemplate: false
    });
    expect(updated).not.toBeNull();
    expect(updated?.description).toBe('Updated desc');
  });

  it('should list prompts', async () => {
    const prompts = await adapter.listPrompts();
    expect(prompts.length).toBeGreaterThan(0);
    expect(prompts.some(p => p.id === 'test-mdc-1')).toBe(true);
  });

  it('should delete a prompt', async () => {
    await adapter.deletePrompt('test-mdc-1');
    const deleted = await adapter.getPrompt('test-mdc-1');
    expect(deleted).toBeNull();
  });

  it('should handle missing prompt gracefully', async () => {
    const missing = await adapter.getPrompt('nonexistent-mdc');
    expect(missing).toBeNull();
  });

  it('should not allow duplicate IDs', async () => {
    const prompt: Prompt = {
      id: 'dup-mdc',
      name: 'Dup MDC',
      description: 'Duplicate test',
      content: 'Test',
      isTemplate: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    };
    await adapter.savePrompt(prompt);
    await expect(adapter.savePrompt(prompt)).rejects.toThrow();
    await adapter.deletePrompt('dup-mdc');
  });

  it('should handle template variable extraction', async () => {
    const prompt: Prompt = {
      id: 'var-mdc',
      name: 'Var MDC',
      description: 'Variable extraction',
      content: 'Hi, {{user}} and {{other}}!',
      isTemplate: true,
      variables: ['user', 'other'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    };
    await adapter.savePrompt(prompt);
    const loaded = await adapter.getPrompt('var-mdc');
    expect(loaded?.variables).toEqual(expect.arrayContaining(['user', 'other']));
    await adapter.deletePrompt('var-mdc');
  });
}); 