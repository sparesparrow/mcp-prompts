import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PromptService } from './prompt.service';
import { Prompt } from '../entities/prompt.entity';
import { ValidationError, NotFoundError } from '../errors/custom-errors';

/**
 * Tests for src/core/services/prompt.service.ts
 *
 * Backlog H4 target #5: covers the core CRUD path, template rendering,
 * and the access-control / rate-limit helpers — the bits the HTTP layer and
 * MCP layer both delegate to.
 */

class MockPromptRepository {
  store = new Map<string, Prompt>();
  async save(p: Prompt) { this.store.set(p.id, p); }
  async findById(id: string) { return this.store.get(id) ?? null; }
  async findByCategory(cat: string, limit = 50) {
    return Array.from(this.store.values()).filter((p) => p.category === cat).slice(0, limit);
  }
  async findLatestVersions(limit = 100) {
    return Array.from(this.store.values()).slice(0, limit);
  }
  async search(q: string, _cat?: string) {
    return Array.from(this.store.values()).filter((p) => p.name.includes(q));
  }
  async delete(id: string) { this.store.delete(id); }
  // unused-but-required surface
  async update() {}
  async getVersions() { return ['1']; }
  async healthCheck() { return { status: 'healthy' as const }; }
  async findByType() { return []; }
  async findSubagents() { return []; }
  async findMainAgents() { return []; }
  async findProjectTemplates() { return []; }
  async getSubagentCategories() { return []; }
  async getAgentModels() { return []; }
  async updateExecutionStats() {}
}

class MockCatalogRepository {
  async healthCheck() { return { status: 'healthy' }; }
}

class MockEventBus {
  events: any[] = [];
  async publish(e: any) { this.events.push(e); }
  async healthCheck() { return { status: 'healthy' }; }
}

function makeSvc() {
  const repo = new MockPromptRepository();
  const cat = new MockCatalogRepository();
  const bus = new MockEventBus();
  const svc = new PromptService(repo as any, cat as any, bus as any);
  return { svc, repo, bus };
}

describe('PromptService', () => {
  describe('createPrompt', () => {
    it('persists a valid prompt and publishes prompt_created', async () => {
      const { svc, repo, bus } = makeSvc();
      const p = await svc.createPrompt({
        name: 'greet',
        template: 'Hello {{name}}',
        category: 'social',
        tags: ['demo'],
      });
      expect(p).toBeInstanceOf(Prompt);
      expect(p.name).toBe('greet');
      expect(p.template).toBe('Hello {{name}}');
      expect(repo.store.size).toBe(1);
      const event = bus.events.at(-1);
      expect(event.type).toBe('prompt_created');
    });

    it('rejects missing name', async () => {
      const { svc } = makeSvc();
      await expect(svc.createPrompt({ template: 'x' })).rejects.toBeInstanceOf(ValidationError);
    });

    it('rejects whitespace-only name', async () => {
      const { svc } = makeSvc();
      await expect(svc.createPrompt({ name: '   ', template: 'x' })).rejects.toBeInstanceOf(
        ValidationError,
      );
    });

    it('rejects missing template', async () => {
      const { svc } = makeSvc();
      await expect(svc.createPrompt({ name: 'x' })).rejects.toBeInstanceOf(ValidationError);
    });

    it('defaults category to general when omitted', async () => {
      const { svc } = makeSvc();
      const p = await svc.createPrompt({ name: 'x', template: 'y' });
      expect(p.category).toBe('general');
    });

    it('coerces numeric version to string', async () => {
      const { svc } = makeSvc();
      const p = await svc.createPrompt({ name: 'x', template: 'y', version: 7 });
      expect(p.version).toBe('7');
      expect(typeof p.version).toBe('string');
    });
  });

  describe('getPrompt / updatePrompt / deletePrompt', () => {
    it('getPrompt returns null when missing, the prompt when present, and publishes prompt_accessed on hit', async () => {
      const { svc, bus } = makeSvc();
      expect(await svc.getPrompt('missing')).toBeNull();
      const created = await svc.createPrompt({ name: 'x', template: 'y' });
      bus.events.length = 0;
      const got = await svc.getPrompt(created.id);
      expect(got?.id).toBe(created.id);
      expect(bus.events.at(-1).type).toBe('prompt_accessed');
    });

    it('updatePrompt requires id, requires the prompt to exist, and merges only provided fields', async () => {
      const { svc } = makeSvc();
      await expect(svc.updatePrompt('', { name: 'y' })).rejects.toBeInstanceOf(ValidationError);
      await expect(svc.updatePrompt('nope', { name: 'y' })).rejects.toBeInstanceOf(NotFoundError);
      const created = await svc.createPrompt({ name: 'x', template: 't1', description: 'd1' });
      const updated = await svc.updatePrompt(created.id, { template: 't2' });
      expect(updated.template).toBe('t2');
      expect(updated.description).toBe('d1'); // preserved
      expect(updated.name).toBe('x'); // preserved
    });

    it('updatePrompt rejects whitespace-only name override', async () => {
      const { svc } = makeSvc();
      const p = await svc.createPrompt({ name: 'x', template: 'y' });
      await expect(svc.updatePrompt(p.id, { name: '   ' })).rejects.toBeInstanceOf(
        ValidationError,
      );
    });

    it('deletePrompt requires id, requires the prompt to exist, and publishes prompt_deleted', async () => {
      const { svc, bus, repo } = makeSvc();
      await expect(svc.deletePrompt('')).rejects.toBeInstanceOf(ValidationError);
      await expect(svc.deletePrompt('nope')).rejects.toBeInstanceOf(NotFoundError);
      const p = await svc.createPrompt({ name: 'x', template: 'y' });
      bus.events.length = 0;
      await svc.deletePrompt(p.id);
      expect(repo.store.size).toBe(0);
      expect(bus.events.at(-1).type).toBe('prompt_deleted');
    });
  });

  describe('applyTemplate', () => {
    it('replaces every {{var}} occurrence with the matching variable', async () => {
      const { svc } = makeSvc();
      const p = await svc.createPrompt({
        name: 'greet',
        template: 'Hello {{name}}, welcome to {{place}}! Bye, {{name}}.',
      });
      const out = await svc.applyTemplate(p.id, { name: 'Mia', place: 'studio' });
      expect(out).toBe('Hello Mia, welcome to studio! Bye, Mia.');
    });

    it('coerces non-string values via String()', async () => {
      const { svc } = makeSvc();
      const p = await svc.createPrompt({ name: 'x', template: 'n={{n}}' });
      const out = await svc.applyTemplate(p.id, { n: 42 });
      expect(out).toBe('n=42');
    });

    it('throws when the prompt is missing', async () => {
      const { svc } = makeSvc();
      await expect(svc.applyTemplate('nope', { x: 'y' })).rejects.toThrow('Prompt not found');
    });
  });

  describe('access control', () => {
    function publicPrompt() {
      return new Prompt('id', 'n', 'd', 't', 'cat', [], [], '1', new Date(), new Date(), true, {}, 'public');
    }
    function premiumPrompt() {
      return new Prompt('id', 'n', 'd', 't', 'cat', [], [], '1', new Date(), new Date(), true, {}, 'premium');
    }
    function privatePrompt(authorId: string) {
      return new Prompt('id', 'n', 'd', 't', 'cat', [], [], '1', new Date(), new Date(), true, {}, 'private', authorId);
    }

    it('public prompts are visible without a userContext', () => {
      const { svc } = makeSvc();
      expect(svc.hasAccessToPrompt(publicPrompt())).toBe(true);
    });

    it('premium prompts require subscriptionTier=premium', () => {
      const { svc } = makeSvc();
      const p = premiumPrompt();
      expect(svc.hasAccessToPrompt(p, { subscriptionTier: 'free' })).toBe(false);
      expect(svc.hasAccessToPrompt(p, { subscriptionTier: 'premium' })).toBe(true);
      // No context falls back to "only public" -> false for premium
      expect(svc.hasAccessToPrompt(p)).toBe(false);
    });

    it('private prompts are only visible to the author', () => {
      const { svc } = makeSvc();
      const p = privatePrompt('user-A');
      expect(svc.hasAccessToPrompt(p, { userId: 'user-A' })).toBe(true);
      expect(svc.hasAccessToPrompt(p, { userId: 'user-B' })).toBe(false);
      expect(svc.hasAccessToPrompt(p)).toBe(false);
    });

    it('canCreatePrompt requires a premium user context', () => {
      const { svc } = makeSvc();
      expect(svc.canCreatePrompt()).toBe(false);
      expect(svc.canCreatePrompt({ subscriptionTier: 'free' })).toBe(false);
      expect(svc.canCreatePrompt({ subscriptionTier: 'premium' })).toBe(true);
    });

    it('canUploadPrompt caps free users at 5 uploads', () => {
      const { svc } = makeSvc();
      expect(svc.canUploadPrompt({ subscriptionTier: 'free' }, 4)).toBe(true);
      expect(svc.canUploadPrompt({ subscriptionTier: 'free' }, 5)).toBe(false);
      expect(svc.canUploadPrompt({ subscriptionTier: 'premium' }, 9999)).toBe(true);
      expect(svc.canUploadPrompt()).toBe(false);
    });

    it('getRateLimit returns 100/hour for free or anon, 1000/hour for premium', () => {
      const { svc } = makeSvc();
      const anon = svc.getRateLimit();
      const free = svc.getRateLimit({ subscriptionTier: 'free' });
      const premium = svc.getRateLimit({ subscriptionTier: 'premium' });
      expect(anon).toEqual({ requests: 100, windowMs: 60 * 60 * 1000 });
      expect(free).toEqual({ requests: 100, windowMs: 60 * 60 * 1000 });
      expect(premium).toEqual({ requests: 1000, windowMs: 60 * 60 * 1000 });
    });
  });

  describe('getLatestPrompts access filtering', () => {
    it('hides premium prompts from free users', async () => {
      const { svc, repo } = makeSvc();
      // Seed: 1 public, 1 premium
      const pub = await svc.createPrompt({ name: 'public', template: 't', accessLevel: 'public' });
      const prem = await svc.createPrompt({ name: 'prem', template: 't', accessLevel: 'premium' });
      const seenFree = await svc.getLatestPrompts(10, { subscriptionTier: 'free' });
      const seenPrem = await svc.getLatestPrompts(10, { subscriptionTier: 'premium' });
      expect(seenFree.map((p) => p.id)).toEqual([pub.id]);
      expect(seenPrem.map((p) => p.id).sort()).toEqual([pub.id, prem.id].sort());
      expect(repo.store.size).toBe(2);
    });
  });
});
