import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { FilePromptRepository } from './file-prompt-repository';

/**
 * Tests for src/adapters/file/file-prompt-repository.ts — recursive subdirectory scan.
 *
 * Backlog M2 (target: organize flat prompts into category subdirs):
 *   Recursive read is already implemented at line 340 (scanDirectory walker).
 *   This test pins that contract so that the subdir reorg (data/prompts/{voice-intelligence,...})
 *   does not silently break listing.
 *
 * Each test seeds a temp prompts directory with a fresh nested layout and tears it down,
 * so they can run in parallel without colliding.
 */

interface SeedSpec {
  relPath: string;          // e.g. 'category-a/prompt-1.json'
  id: string;
  name: string;
  category: string;
}

async function makeTempDir(prefix = 'mcp-prompts-test-'): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function seedPrompts(rootDir: string, specs: SeedSpec[]): Promise<void> {
  for (const spec of specs) {
    const fullPath = path.join(rootDir, spec.relPath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    const data = {
      id: spec.id,
      name: spec.name,
      description: `Seeded test prompt ${spec.id}`,
      template: `Hello {{name}}, from ${spec.id}`,
      category: spec.category,
      tags: ['test', 'nested-read'],
      variables: ['name'],
      version: '1.0.0',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      isLatest: true,
      metadata: {},
      accessLevel: 'public',
    };
    await fs.writeFile(fullPath, JSON.stringify(data, null, 2));
  }
}

describe('FilePromptRepository — recursive subdirectory scan', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await makeTempDir();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('findLatestVersions surfaces prompts from nested category subdirectories', async () => {
    await seedPrompts(tempDir, [
      { relPath: 'voice-intelligence/p1.json', id: 'p1', name: 'P1', category: 'voice-intelligence' },
      { relPath: 'voice-intelligence/p2.json', id: 'p2', name: 'P2', category: 'voice-intelligence' },
      { relPath: 'mia-car/p3.json',            id: 'p3', name: 'P3', category: 'mia-car' },
      { relPath: 'openclaw/p4.json',           id: 'p4', name: 'P4', category: 'openclaw' },
    ]);

    const repo = new FilePromptRepository(tempDir);
    const prompts = await repo.findLatestVersions(100);

    const ids = prompts.map(p => p.id).sort();
    expect(ids).toEqual(['p1', 'p2', 'p3', 'p4']);
  });

  it('findLatestVersions surfaces prompts at the root alongside nested ones (mixed layout)', async () => {
    await seedPrompts(tempDir, [
      { relPath: 'flat-root.json',           id: 'flat-root', name: 'Flat Root', category: 'misc' },
      { relPath: 'voice-intelligence/p1.json', id: 'p1',     name: 'P1',        category: 'voice-intelligence' },
    ]);

    const repo = new FilePromptRepository(tempDir);
    const prompts = await repo.findLatestVersions(100);

    const ids = prompts.map(p => p.id).sort();
    expect(ids).toEqual(['flat-root', 'p1']);
  });

  it('findLatestVersions walks deeper than one level (nested subdirs of subdirs)', async () => {
    await seedPrompts(tempDir, [
      { relPath: 'a/b/c/deep.json',          id: 'deep', name: 'Deep', category: 'a' },
      { relPath: 'a/sibling.json',           id: 'sib',  name: 'Sib',  category: 'a' },
    ]);

    const repo = new FilePromptRepository(tempDir);
    const prompts = await repo.findLatestVersions(100);

    const ids = prompts.map(p => p.id).sort();
    expect(ids).toEqual(['deep', 'sib']);
  });

  it('findLatestVersions ignores non-JSON files and the reserved index.json filename', async () => {
    await seedPrompts(tempDir, [
      { relPath: 'voice-intelligence/keep.json', id: 'keep', name: 'Keep', category: 'voice-intelligence' },
    ]);
    // Decoy files
    await fs.writeFile(path.join(tempDir, 'voice-intelligence', 'README.md'), '# decoy');
    await fs.writeFile(path.join(tempDir, 'voice-intelligence', 'index.json'), '{}');

    const repo = new FilePromptRepository(tempDir);
    const prompts = await repo.findLatestVersions(100);

    const ids = prompts.map(p => p.id);
    expect(ids).toEqual(['keep']);
  });

  it('findByCategory honours the category filter across nested subdirs', async () => {
    await seedPrompts(tempDir, [
      { relPath: 'voice-intelligence/v1.json', id: 'v1', name: 'V1', category: 'voice-intelligence' },
      { relPath: 'voice-intelligence/v2.json', id: 'v2', name: 'V2', category: 'voice-intelligence' },
      { relPath: 'openclaw/o1.json',           id: 'o1', name: 'O1', category: 'openclaw' },
    ]);

    const repo = new FilePromptRepository(tempDir);
    const result = await repo.findByCategory('voice-intelligence');

    const ids = result.map(p => p.id).sort();
    expect(ids).toEqual(['v1', 'v2']);
  });

  it('findById resolves a prompt that lives in a category subdirectory', async () => {
    await seedPrompts(tempDir, [
      { relPath: 'mia-car/navigation.json', id: 'navigation', name: 'Nav', category: 'mia-car' },
    ]);

    const repo = new FilePromptRepository(tempDir);
    const prompt = await repo.findById('navigation');

    expect(prompt).not.toBeNull();
    expect(prompt?.id).toBe('navigation');
    expect(prompt?.category).toBe('mia-car');
  });

  it('returns no prompts (and does not throw) when the prompts dir is empty', async () => {
    const repo = new FilePromptRepository(tempDir);
    const prompts = await repo.findLatestVersions(100);
    expect(prompts).toEqual([]);
  });
});
