import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PromptService } from './prompt.service';
import { Prompt } from '../entities/prompt.entity';
import { PromptEvent } from '../events/prompt.event';
import { ValidationError, NotFoundError } from '../errors/custom-errors';
import type { IPromptRepository } from '../ports/prompt-repository.interface';
import type { ICatalogRepository } from '../ports/catalog-repository.interface';
import type { IEventBus } from '../ports/event-bus.interface';

/**
 * Minimal in-memory repo backed by a Map. Only implements the methods that
 * PromptService actually calls; cast to IPromptRepository for the tests.
 */
function createFakeRepo() {
  const store = new Map<string, Prompt>();
  const repo = {
    save: vi.fn(async (p: Prompt) => {
      store.set(p.id, p);
    }),
    findById: vi.fn(async (id: string, _version?: string) => store.get(id) ?? null),
    delete: vi.fn(async (id: string) => {
      store.delete(id);
    }),
    findByCategory: vi.fn(async (cat: string, limit?: number) => {
      const result = Array.from(store.values()).filter(p => p.category === cat);
      return limit ? result.slice(0, limit) : result;
    }),
    findLatestVersions: vi.fn(async (limit: number = 50) =>
      Array.from(store.values()).slice(0, limit)
    ),
    search: vi.fn(async (q: string, cat?: string) => {
      const lower = q.toLowerCase();
      return Array.from(store.values()).filter(p => {
        if (cat && p.category !== cat) return false;
        return (
          p.name.toLowerCase().includes(lower) ||
          p.template.toLowerCase().includes(lower)
        );
      });
    }),
    _store: store,
  };
  return repo;
}

function createFakeEventBus() {
  return {
    publish: vi.fn(async (_event: PromptEvent) => undefined),
    subscribe: vi.fn(),
    healthCheck: vi.fn(async () => ({ status: 'healthy' as const })),
  };
}

function createFakeCatalog() {
  return {
    syncFromGitHub: vi.fn(),
    getPromptTemplate: vi.fn(),
    getCatalogIndex: vi.fn(),
    uploadPrompt: vi.fn(),
    deletePrompt: vi.fn(),
    listPrompts: vi.fn(),
    healthCheck: vi.fn(async () => ({ status: 'healthy' as const })),
  };
}

describe('PromptService', () => {
  let repo: ReturnType<typeof createFakeRepo>;
  let catalog: ReturnType<typeof createFakeCatalog>;
  let events: ReturnType<typeof createFakeEventBus>;
  let service: PromptService;

  beforeEach(() => {
    repo = createFakeRepo();
    catalog = createFakeCatalog();
    events = createFakeEventBus();
    service = new PromptService(
      repo as unknown as IPromptRepository,
      catalog as unknown as ICatalogRepository,
      events as unknown as IEventBus
    );
  });

  describe('createPrompt', () => {
    it('creates and persists a valid prompt', async () => {
      const prompt = await service.createPrompt({
        name: 'test',
        template: 'hello {{name}}',
        category: 'dev',
      });
      expect(prompt).toBeInstanceOf(Prompt);
      expect(prompt.name).toBe('test');
      expect(repo.save).toHaveBeenCalledOnce();
      expect(events.publish).toHaveBeenCalledOnce();
      const evt = events.publish.mock.calls[0][0] as PromptEvent;
      expect(evt.type).toBe('prompt_created');
      expect(evt.promptId).toBe(prompt.id);
    });

    it('generates an id when not supplied', async () => {
      const prompt = await service.createPrompt({ name: 'a', template: 't' });
      expect(prompt.id).toMatch(/^prompt_/);
    });

    it('uses a supplied id', async () => {
      const prompt = await service.createPrompt({ id: 'my-id', name: 'a', template: 't' });
      expect(prompt.id).toBe('my-id');
    });

    it('defaults category to "general"', async () => {
      const prompt = await service.createPrompt({ name: 'a', template: 't' });
      expect(prompt.category).toBe('general');
    });

    it('trims whitespace from the name', async () => {
      const prompt = await service.createPrompt({ name: '  spaced  ', template: 't' });
      expect(prompt.name).toBe('spaced');
    });

    it('throws ValidationError when name is missing', async () => {
      await expect(service.createPrompt({ template: 't' })).rejects.toBeInstanceOf(ValidationError);
    });

    it('throws ValidationError when name is blank', async () => {
      await expect(service.createPrompt({ name: '   ', template: 't' })).rejects.toBeInstanceOf(
        ValidationError
      );
    });

    it('throws ValidationError when template is missing', async () => {
      await expect(service.createPrompt({ name: 'a' })).rejects.toBeInstanceOf(ValidationError);
    });

    it('throws ValidationError when template is blank', async () => {
      await expect(service.createPrompt({ name: 'a', template: '  ' })).rejects.toBeInstanceOf(
        ValidationError
      );
    });
  });

  describe('getPrompt', () => {
    it('returns the stored prompt and publishes an access event', async () => {
      await service.createPrompt({ id: 'p1', name: 'a', template: 't' });
      events.publish.mockClear();

      const found = await service.getPrompt('p1');
      expect(found).not.toBeNull();
      expect(events.publish).toHaveBeenCalledOnce();
      const evt = events.publish.mock.calls[0][0] as PromptEvent;
      expect(evt.type).toBe('prompt_accessed');
    });

    it('returns null and emits no event when not found', async () => {
      const found = await service.getPrompt('missing');
      expect(found).toBeNull();
      expect(events.publish).not.toHaveBeenCalled();
    });
  });

  describe('updatePrompt', () => {
    beforeEach(async () => {
      await service.createPrompt({ id: 'p1', name: 'original', template: 't' });
      events.publish.mockClear();
    });

    it('updates fields while preserving id and createdAt', async () => {
      const before = repo._store.get('p1')!;
      const updated = await service.updatePrompt('p1', { name: 'renamed' });
      expect(updated.id).toBe('p1');
      expect(updated.name).toBe('renamed');
      expect(updated.template).toBe('t');
      expect(updated.createdAt).toBe(before.createdAt);
    });

    it('publishes a prompt_updated event', async () => {
      await service.updatePrompt('p1', { name: 'renamed' });
      const evt = events.publish.mock.calls[0][0] as PromptEvent;
      expect(evt.type).toBe('prompt_updated');
    });

    it('throws NotFoundError for unknown id', async () => {
      await expect(service.updatePrompt('missing', { name: 'x' })).rejects.toBeInstanceOf(
        NotFoundError
      );
    });

    it('throws ValidationError when id is empty', async () => {
      await expect(service.updatePrompt('', { name: 'x' })).rejects.toBeInstanceOf(ValidationError);
    });

    it('throws ValidationError when provided name is blank', async () => {
      await expect(service.updatePrompt('p1', { name: '  ' })).rejects.toBeInstanceOf(
        ValidationError
      );
    });

    it('throws ValidationError when provided template is blank', async () => {
      await expect(service.updatePrompt('p1', { template: '   ' })).rejects.toBeInstanceOf(
        ValidationError
      );
    });
  });

  describe('deletePrompt', () => {
    it('deletes an existing prompt and publishes an event', async () => {
      await service.createPrompt({ id: 'p1', name: 'a', template: 't' });
      events.publish.mockClear();

      await service.deletePrompt('p1');
      expect(repo.delete).toHaveBeenCalledWith('p1');
      expect(events.publish).toHaveBeenCalledOnce();
      const evt = events.publish.mock.calls[0][0] as PromptEvent;
      expect(evt.type).toBe('prompt_deleted');
    });

    it('throws NotFoundError for unknown id', async () => {
      await expect(service.deletePrompt('missing')).rejects.toBeInstanceOf(NotFoundError);
    });

    it('throws ValidationError for empty id', async () => {
      await expect(service.deletePrompt('  ')).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('applyTemplate', () => {
    it('substitutes variables in the template', async () => {
      await service.createPrompt({
        id: 'p1',
        name: 'greet',
        template: 'Hello {{name}}, you are {{age}} years old',
      });
      const result = await service.applyTemplate('p1', { name: 'Ada', age: 30 });
      expect(result).toBe('Hello Ada, you are 30 years old');
    });

    it('replaces repeated occurrences of the same variable', async () => {
      await service.createPrompt({
        id: 'p1',
        name: 'echo',
        template: '{{x}}-{{x}}-{{x}}',
      });
      const result = await service.applyTemplate('p1', { x: 'a' });
      expect(result).toBe('a-a-a');
    });

    it('leaves placeholders untouched when variable is not provided', async () => {
      await service.createPrompt({ id: 'p1', name: 'g', template: 'Hello {{name}}' });
      const result = await service.applyTemplate('p1', {});
      expect(result).toBe('Hello {{name}}');
    });

    it('throws when prompt is not found', async () => {
      await expect(service.applyTemplate('missing', {})).rejects.toThrow(/not found/i);
    });
  });

  describe('access control', () => {
    const anon = undefined;
    const freeUser = { userId: 'u1', subscriptionTier: 'free' as const };
    const premiumUser = { userId: 'u2', subscriptionTier: 'premium' as const };

    function promptWith(accessLevel: string, authorId?: string): Prompt {
      return new Prompt('p', 'n', '', 't', 'c', [], [], 'v', new Date(), new Date(), true, {}, accessLevel, authorId);
    }

    it('allows anon to read public prompts only', () => {
      expect(service.hasAccessToPrompt(promptWith('public'), anon)).toBe(true);
      expect(service.hasAccessToPrompt(promptWith('premium'), anon)).toBe(false);
      expect(service.hasAccessToPrompt(promptWith('private', 'u1'), anon)).toBe(false);
    });

    it('allows premium access for premium users only', () => {
      expect(service.hasAccessToPrompt(promptWith('premium'), freeUser)).toBe(false);
      expect(service.hasAccessToPrompt(promptWith('premium'), premiumUser)).toBe(true);
    });

    it('allows private access only to the author', () => {
      expect(service.hasAccessToPrompt(promptWith('private', 'u1'), freeUser)).toBe(true);
      expect(service.hasAccessToPrompt(promptWith('private', 'u2'), freeUser)).toBe(false);
    });

    it('canCreatePrompt requires premium tier', () => {
      expect(service.canCreatePrompt(anon)).toBe(false);
      expect(service.canCreatePrompt(freeUser)).toBe(false);
      expect(service.canCreatePrompt(premiumUser)).toBe(true);
    });

    it('canUploadPrompt caps free users at 5 and lets premium upload freely', () => {
      expect(service.canUploadPrompt(anon, 0)).toBe(false);
      expect(service.canUploadPrompt(freeUser, 4)).toBe(true);
      expect(service.canUploadPrompt(freeUser, 5)).toBe(false);
      expect(service.canUploadPrompt(premiumUser, 1000)).toBe(true);
    });

    it('getRateLimit returns 100/hr for free and 1000/hr for premium', () => {
      expect(service.getRateLimit(anon)).toEqual({ requests: 100, windowMs: 3600_000 });
      expect(service.getRateLimit(freeUser)).toEqual({ requests: 100, windowMs: 3600_000 });
      expect(service.getRateLimit(premiumUser)).toEqual({ requests: 1000, windowMs: 3600_000 });
    });
  });

  describe('search / category helpers', () => {
    beforeEach(async () => {
      await service.createPrompt({ id: 'a', name: 'debug', template: 'x', category: 'dev' });
      await service.createPrompt({ id: 'b', name: 'summary', template: 'y', category: 'write' });
    });

    it('getPromptsByCategory delegates to repo', async () => {
      const result = await service.getPromptsByCategory('dev');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('a');
    });

    it('searchPrompts delegates to repo', async () => {
      const result = await service.searchPrompts('summary');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('b');
    });

    it('getLatestPrompts filters by access level for anon users', async () => {
      await service.createPrompt({
        id: 'premium-one',
        name: 'premium',
        template: 't',
        access_level: 'premium',
      });
      const anon = await service.getLatestPrompts(10);
      expect(anon.some(p => p.id === 'premium-one')).toBe(false);

      const premium = await service.getLatestPrompts(10, { subscriptionTier: 'premium' });
      expect(premium.some(p => p.id === 'premium-one')).toBe(true);
    });
  });
});
