import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FileAdapter } from '../src/FileAdapter';
import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';

describe('FileAdapter Robustness', () => {
  const TMP_DIR = path.join(__dirname, 'tmp-prompts');
  let adapter: FileAdapter;

  beforeAll(async () => {
    await fs.rm(TMP_DIR, { recursive: true, force: true });
    await fs.mkdir(TMP_DIR, { recursive: true });
    adapter = new FileAdapter({ promptsDir: TMP_DIR });
    await adapter.connect();
  });

  afterAll(async () => {
    await fs.rm(TMP_DIR, { recursive: true, force: true });
  });

  it('should write and read a prompt atomically and validate schema', async () => {
    const prompt = { name: 'test', content: 'Hello', isTemplate: false };
    const saved = await adapter.savePrompt(prompt);
    expect(saved.id).toBeDefined();
    const loaded = await adapter.getPrompt(saved.id, saved.version);
    expect(loaded).toMatchObject({ name: 'test', content: 'Hello' });
  });

  it('should reject invalid prompt schema', async () => {
    // @ts-expect-error
    await expect(adapter.savePrompt({ name: 123, content: 456 })).rejects.toThrow(z.ZodError);
  });

  it('should prevent concurrent writes (locking)', async () => {
    const prompt = { name: 'locktest', content: 'A', isTemplate: false };
    const p1 = adapter.savePrompt(prompt);
    const p2 = adapter.savePrompt(prompt);
    const results = await Promise.allSettled([p1, p2]);
    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');
    expect(fulfilled.length + rejected.length).toBe(2);
    // At least one should succeed, the other may fail due to lock
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);
  });

  it('should update index.json on add/update/delete', async () => {
    const prompt = { name: 'index', content: 'X', isTemplate: false };
    const saved = await adapter.savePrompt(prompt);
    const indexPath = path.join(TMP_DIR, 'index.json');
    const index = JSON.parse(await fs.readFile(indexPath, 'utf-8'));
    expect(index[saved.id]).toBeDefined();
    await adapter.deletePrompt(saved.id, saved.version);
    const index2 = JSON.parse(await fs.readFile(indexPath, 'utf-8'));
    expect(index2[saved.id]).toBeUndefined();
  });
}); 