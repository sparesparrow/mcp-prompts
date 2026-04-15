import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryPromptRepository } from './memory-prompt-repository';
import { Prompt } from '../../core/entities/prompt.entity';

function makePrompt(overrides: Partial<ConstructorParameters<typeof Prompt>> | Record<string, any> = {}): Prompt {
  const o = overrides as Record<string, any>;
  return new Prompt(
    o.id ?? 'p1',
    o.name ?? 'Test Prompt',
    o.description ?? 'A test prompt',
    o.template ?? 'Hello {{name}}',
    o.category ?? 'general',
    o.tags ?? ['test'],
    o.variables ?? ['name'],
    o.version ?? 'v1',
    o.createdAt ?? new Date('2025-01-01T00:00:00Z'),
    o.updatedAt ?? new Date('2025-01-01T00:00:00Z'),
    o.isLatest ?? true,
    o.metadata ?? {},
    o.accessLevel ?? 'public',
    o.authorId
  );
}

describe('MemoryPromptRepository', () => {
  let repo: MemoryPromptRepository;

  beforeEach(() => {
    repo = new MemoryPromptRepository();
  });

  describe('save / findById', () => {
    it('saves and retrieves a prompt by id + version', async () => {
      const p = makePrompt({ id: 'p1', version: 'v1' });
      await repo.save(p);
      const found = await repo.findById('p1', 'v1');
      expect(found).not.toBeNull();
      expect(found!.id).toBe('p1');
      expect(found!.version).toBe('v1');
    });

    it('returns null for missing id', async () => {
      const found = await repo.findById('missing', 'v1');
      expect(found).toBeNull();
    });

    it('returns null for missing id without version', async () => {
      const found = await repo.findById('missing');
      expect(found).toBeNull();
    });

    it('returns the latest version when version is omitted', async () => {
      await repo.save(makePrompt({ id: 'p1', version: 'v1' }));
      await repo.save(makePrompt({ id: 'p1', version: 'v2' }));
      await repo.save(makePrompt({ id: 'p1', version: 'v3' }));
      const found = await repo.findById('p1');
      expect(found).not.toBeNull();
      expect(found!.version).toBe('v3');
    });
  });

  describe('findByCategory', () => {
    it('returns only prompts in the given category, newest first', async () => {
      await repo.save(makePrompt({ id: 'a', category: 'x', updatedAt: new Date('2025-01-01') }));
      await repo.save(makePrompt({ id: 'b', category: 'x', updatedAt: new Date('2025-02-01') }));
      await repo.save(makePrompt({ id: 'c', category: 'y' }));

      const result = await repo.findByCategory('x');
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('b');
      expect(result[1].id).toBe('a');
    });

    it('respects the limit parameter', async () => {
      await repo.save(makePrompt({ id: 'a', category: 'x' }));
      await repo.save(makePrompt({ id: 'b', category: 'x' }));
      const result = await repo.findByCategory('x', 1);
      expect(result).toHaveLength(1);
    });
  });

  describe('findLatestVersions', () => {
    it('returns prompts sorted by updatedAt desc and limited', async () => {
      await repo.save(makePrompt({ id: 'a', updatedAt: new Date('2025-01-01') }));
      await repo.save(makePrompt({ id: 'b', updatedAt: new Date('2025-03-01') }));
      await repo.save(makePrompt({ id: 'c', updatedAt: new Date('2025-02-01') }));

      const all = await repo.findLatestVersions();
      expect(all.map(p => p.id)).toEqual(['b', 'c', 'a']);

      const limited = await repo.findLatestVersions(2);
      expect(limited).toHaveLength(2);
      expect(limited[0].id).toBe('b');
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      await repo.save(
        makePrompt({
          id: 'a',
          name: 'Debugging Guide',
          description: 'help with bugs',
          template: 'resolve error step by step',
          category: 'dev',
          tags: ['debug', 'workflow'],
        })
      );
      await repo.save(
        makePrompt({
          id: 'b',
          name: 'Summary',
          description: 'summarize text',
          template: 'summarize this content',
          category: 'writing',
          tags: ['summary'],
        })
      );
    });

    it('matches on name, description, template, and tags (case-insensitive)', async () => {
      expect((await repo.search('DEBUG')).map(p => p.id)).toEqual(['a']);
      expect((await repo.search('summarize')).map(p => p.id)).toEqual(['b']);
      expect((await repo.search('bugs')).map(p => p.id)).toEqual(['a']);
      expect((await repo.search('WORKFLOW')).map(p => p.id)).toEqual(['a']);
    });

    it('filters by category when provided', async () => {
      const result = await repo.search('s', 'writing');
      expect(result.map(p => p.id)).toEqual(['b']);
    });

    it('returns empty when nothing matches', async () => {
      expect(await repo.search('nonexistent-query-xyz')).toEqual([]);
    });
  });

  describe('update', () => {
    it('updates an existing prompt in place', async () => {
      await repo.save(makePrompt({ id: 'p1', version: 'v1', name: 'Original' }));
      await repo.update('p1', 'v1', { name: 'Renamed' });
      const found = await repo.findById('p1', 'v1');
      expect(found!.name).toBe('Renamed');
    });

    it('throws when the target prompt does not exist', async () => {
      await expect(repo.update('missing', 'v1', { name: 'X' })).rejects.toThrow(
        /Prompt missing version v1 not found/
      );
    });
  });

  describe('delete', () => {
    it('deletes a specific version', async () => {
      await repo.save(makePrompt({ id: 'p1', version: 'v1' }));
      await repo.save(makePrompt({ id: 'p1', version: 'v2' }));
      await repo.delete('p1', 'v1');
      expect(await repo.findById('p1', 'v1')).toBeNull();
      expect(await repo.findById('p1', 'v2')).not.toBeNull();
    });

    it('deletes all versions when version is omitted', async () => {
      await repo.save(makePrompt({ id: 'p1', version: 'v1' }));
      await repo.save(makePrompt({ id: 'p1', version: 'v2' }));
      await repo.delete('p1');
      expect(await repo.findById('p1', 'v1')).toBeNull();
      expect(await repo.findById('p1', 'v2')).toBeNull();
    });
  });

  describe('getVersions', () => {
    it('returns sorted versions for a prompt', async () => {
      await repo.save(makePrompt({ id: 'p1', version: 'v3' }));
      await repo.save(makePrompt({ id: 'p1', version: 'v1' }));
      await repo.save(makePrompt({ id: 'p1', version: 'v2' }));
      const versions = await repo.getVersions('p1');
      expect(versions).toEqual(['v1', 'v2', 'v3']);
    });

    it('returns an empty array for an unknown id', async () => {
      expect(await repo.getVersions('missing')).toEqual([]);
    });
  });

  describe('healthCheck', () => {
    it('reports healthy', async () => {
      expect(await repo.healthCheck()).toEqual({ status: 'healthy' });
    });
  });
});
