import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  PromptConflictError,
  PromptNotFoundError,
  PromptStaleError,
  PromptStorageError,
  PromptStore,
  PromptUsageError,
  type StoredPrompt,
} from './prompt-store';
import { staleChangeError, type StateBackend, type StateSnapshot } from './state-backend';
import { logger } from './utils';

/** What several servers share: the rows of one owner in a database. */
class Database {
  readonly prompts = new Map<string, StoredPrompt>();
  readonly tombstones = new Set<string>();
  rev = 0;
}

/** A backend that answers with promises, as a database does, and counts what it is asked. */
class AsyncBackend implements StateBackend {
  kind: 'file' | 'postgres' = 'postgres';
  writable = true;
  revisionCalls = 0;
  loadCalls = 0;
  failing: Error | undefined;
  /** When set, load() takes its snapshot at once and returns it only when this settles. */
  loadGate: Promise<void> | undefined;
  failPut: Error | undefined;
  /** revision() never answers. */
  hang = false;

  constructor(readonly db: Database = new Database()) {}

  async load(): Promise<StateSnapshot> {
    this.loadCalls++;
    if (this.failing) throw this.failing;
    const snapshot = { prompts: Array.from(this.db.prompts.values()), tombstones: Array.from(this.db.tombstones) };
    if (this.loadGate) await this.loadGate;
    return snapshot;
  }

  async revision(): Promise<string> {
    this.revisionCalls++;
    if (this.hang) return new Promise<string>(() => undefined);
    if (this.failing) throw this.failing;
    return String(this.db.rev);
  }

  async put(prompt: StoredPrompt, mode: 'create' | 'replace', expectedVersion?: string | null): Promise<void> {
    if (this.failPut) throw this.failPut;
    const current = this.db.prompts.get(prompt.id);
    if (mode === 'create' && current) throw new PromptConflictError(prompt.id);
    if (mode === 'replace' && expectedVersion !== undefined) {
      const matches = expectedVersion === null ? !current && !this.db.tombstones.has(prompt.id) : current !== undefined && String(current.version) === expectedVersion;
      if (!matches) throw staleChangeError(prompt.id);
    }
    this.db.prompts.set(prompt.id, prompt);
    this.db.rev++;
  }

  async remove(id: string, tombstone: boolean): Promise<void> {
    this.db.prompts.delete(id);
    if (tombstone) this.db.tombstones.add(id);
    this.db.rev++;
  }
}

const stored = (id: string, name = id, version: number | string = 1): StoredPrompt =>
  ({ id, name, content: `${name} content`, isTemplate: false, tags: [], createdAt: 't', updatedAt: 't', version });

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('a store over a backend that answers with promises', () => {
  let root: string;
  let library: string;
  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'prompts-refresh-'));
    library = path.join(root, 'library');
    fs.mkdirSync(library, { recursive: true });
    fs.writeFileSync(path.join(library, 'lib-a.json'), JSON.stringify({ id: 'lib-a', name: 'Library A', content: 'a' }));
    fs.writeFileSync(path.join(library, 'lib-b.json'), JSON.stringify({ id: 'lib-b', name: 'Library B', content: 'b' }));
  });
  afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

  const open = async (backend: StateBackend, options?: { refreshIntervalMs?: number; checkTimeoutMs?: number }) => {
    const store = new PromptStore();
    store.load({ promptsDir: library });
    await store.useBackend(backend, options);
    return store;
  };

  describe('errors', () => {
    it('PromptStaleError is a PromptConflictError, and is what a version conflict raises', () => {
      const error = staleChangeError('x');
      expect(error).toBeInstanceOf(PromptStaleError);
      expect(error).toBeInstanceOf(PromptConflictError);
      expect(new PromptConflictError('x')).not.toBeInstanceOf(PromptStaleError);
    });
  });

  describe('useBackend', () => {
    it('words a failing first read as a PromptStorageError without the backend\'s own text', async () => {
      for (const which of ['load', 'revision'] as const) {
        const backend = new AsyncBackend();
        backend.failing = new TypeError('connect to leaky-host:5432 failed');
        if (which === 'load') backend.revision = async () => '0';
        const store = new PromptStore();
        store.load({ promptsDir: library });
        const error = await store.useBackend(backend).catch(err => err);
        expect(error).toBeInstanceOf(PromptStorageError);
        expect(error.message).not.toContain('leaky-host');
      }
    });

    it('keeps the message of a PromptStorageError the backend worded itself', async () => {
      const backend = new AsyncBackend();
      backend.failing = new PromptStorageError('Could not read the saved prompts (28P01)');
      const error = await new PromptStore().useBackend(backend).catch(err => err);
      expect(error).toBeInstanceOf(PromptStorageError);
      expect(error.message).toContain('28P01');
    });

    it('refuses a second backend, and one after a state directory', async () => {
      const store = await open(new AsyncBackend());
      await expect(store.useBackend(new AsyncBackend())).rejects.toThrow(PromptUsageError);
      const withDir = new PromptStore();
      withDir.load({ promptsDir: library });
      withDir.openStateDir(path.join(root, 'state'));
      await expect(withDir.useBackend(new AsyncBackend())).rejects.toThrow(PromptUsageError);
    });
  });

  describe('storage', () => {
    it('is the backend\'s kind while it can be written, and memory otherwise', async () => {
      const bare = new PromptStore();
      expect(bare.storage).toBe('memory');
      expect((await open(new AsyncBackend())).storage).toBe('postgres');
      const readOnly = new AsyncBackend();
      readOnly.writable = false;
      expect((await open(readOnly)).storage).toBe('memory');
      const file = new AsyncBackend();
      file.kind = 'file';
      expect((await open(file)).storage).toBe('file');
      const view = (await open(new AsyncBackend())).select({ prompts: ['lib-a'], templates: 'all', exclude: [] });
      expect(view.storage).toBe('postgres');
    });
  });

  describe('refresh', () => {
    it('does not ask the backend on every read', async () => {
      const backend = new AsyncBackend();
      const store = await open(backend, { refreshIntervalMs: 60_000 });
      const before = backend.revisionCalls;
      for (let i = 0; i < 200; i++) {
        store.list();
        store.get('lib-a');
      }
      expect(backend.revisionCalls).toBe(before);
    });

    it('checks at most once per two seconds by default, and then reloads what changed', async () => {
      const backend = new AsyncBackend();
      let now = 1_000_000;
      const clock = vi.spyOn(Date, 'now').mockImplementation(() => now);
      try {
        const store = await open(backend);
        const before = backend.revisionCalls;
        await backend.put(stored('late'), 'create');
        now += 1_900;
        store.list();
        await wait(5);
        expect(backend.revisionCalls).toBe(before);
        expect(() => store.get('late')).toThrow(PromptNotFoundError);
        now += 200;
        store.list();
        store.list();
        store.get('lib-a');
        await vi.waitFor(() => expect(store.get('late').name).toBe('late'));
        // One check for all those reads, and none for the next ones inside the interval.
        expect(backend.revisionCalls).toBe(before + 1);
        store.list();
        await wait(5);
        expect(backend.revisionCalls).toBe(before + 1);
      } finally {
        clock.mockRestore();
      }
    });

    it('does not load the prompts again when the revision is the same', async () => {
      const backend = new AsyncBackend();
      const store = await open(backend, { refreshIntervalMs: 1 });
      const loads = backend.loadCalls;
      for (let i = 0; i < 5; i++) {
        await wait(3);
        store.list();
      }
      await wait(10);
      expect(backend.loadCalls).toBe(loads);
    });

    it('sync() checks now, whatever the interval', async () => {
      const backend = new AsyncBackend();
      const store = await open(backend, { refreshIntervalMs: 60_000 });
      await backend.put(stored('late'), 'create');
      expect(() => store.get('late')).toThrow(PromptNotFoundError);
      await store.sync();
      expect(store.get('late').name).toBe('late');
      await backend.remove('lib-a', true);
      await store.sync();
      expect(() => store.get('lib-a')).toThrow(PromptNotFoundError);
    });

    it('keeps serving what it has when the backend fails, and says so once', async () => {
      const backend = new AsyncBackend();
      const store = await open(backend, { refreshIntervalMs: 60_000 });
      await backend.put(stored('kept'), 'create');
      await store.sync();
      const warn = vi.spyOn(logger, 'warn').mockImplementation((() => undefined) as never);
      try {
        backend.failing = new PromptStorageError('Could not check the database for changes (ECONNREFUSED)');
        await store.sync();
        await store.sync();
        await store.sync();
        expect(warn).toHaveBeenCalledTimes(1);
        expect(JSON.stringify(warn.mock.calls)).not.toContain('leaky');
        expect(store.get('kept').name).toBe('kept');
        backend.failing = undefined;
        await store.sync();
        backend.failing = new PromptStorageError('Could not check the database for changes (ECONNREFUSED)');
        await store.sync();
        expect(warn).toHaveBeenCalledTimes(2);
      } finally {
        warn.mockRestore();
      }
    });

    it('does not drop a change made here while an older read of the backend was still on its way', async () => {
      const backend = new AsyncBackend();
      const store = await open(backend, { refreshIntervalMs: 60_000 });
      await new AsyncBackend(backend.db).put(stored('theirs'), 'create');
      let release!: () => void;
      backend.loadGate = new Promise<void>(resolve => { release = resolve; });
      const syncing = store.sync();
      await vi.waitFor(() => expect(backend.loadCalls).toBeGreaterThan(1));
      backend.loadGate = undefined;
      await store.add({ id: 'mine', name: 'Mine', content: 'c', isTemplate: false, tags: [] });
      release();
      await syncing;
      expect(store.get('mine').name).toBe('Mine');
      expect(store.get('theirs').name).toBe('theirs');
    });
  });

  describe('a backend that stops answering', () => {
    it('ends a check that takes too long, so that the next one can run and recovery is seen', async () => {
      const backend = new AsyncBackend();
      const store = await open(backend, { refreshIntervalMs: 5, checkTimeoutMs: 60 });
      await backend.put(stored('late'), 'create');
      backend.hang = true;
      const warn = vi.spyOn(logger, 'warn').mockImplementation((() => undefined) as never);
      try {
        const started = Date.now();
        await store.sync();
        expect(Date.now() - started).toBeLessThan(1_000);
        // Reads keep starting checks; each ends by itself, and the failure is reported once.
        for (let i = 0; i < 4; i++) {
          store.list();
          await wait(80);
        }
        expect(warn).toHaveBeenCalledTimes(1);
        expect(() => store.get('late')).toThrow(PromptNotFoundError);
        backend.hang = false;
        await vi.waitFor(() => {
          store.list();
          expect(store.get('late').name).toBe('late');
        });
      } finally {
        warn.mockRestore();
      }
    });

    it('fails checkStorage within the bound instead of waiting', async () => {
      const backend = new AsyncBackend();
      const store = await open(backend, { checkTimeoutMs: 60 });
      backend.hang = true;
      const started = Date.now();
      await expect(store.checkStorage()).rejects.toThrow(PromptStorageError);
      expect(Date.now() - started).toBeLessThan(1_000);
    });
  });

  describe('a stale store', () => {
    it('heals: after a conflict it has read what the other server saved, and a retry succeeds', async () => {
      const db = new Database();
      db.prompts.set('shared', stored('shared'));
      const a = await open(new AsyncBackend(db), { refreshIntervalMs: 60_000 });
      const b = await open(new AsyncBackend(db), { refreshIntervalMs: 60_000 });
      await b.update('shared', { name: 'Theirs' });

      const conflict = await a.update('shared', { content: 'Mine' }).catch(err => err);
      expect(conflict).toBeInstanceOf(PromptStaleError);
      expect(conflict).toBeInstanceOf(PromptConflictError);
      // Nothing saved, nothing changed here by the failed attempt...
      expect(db.prompts.get('shared')).toMatchObject({ name: 'Theirs', version: 2 });
      // ...and the store has caught up, so the same call again goes through, on top of theirs.
      expect(a.get('shared').name).toBe('Theirs');
      const retried = await a.update('shared', { content: 'Mine' });
      expect(retried).toMatchObject({ name: 'Theirs', content: 'Mine', version: 3 });
      expect(db.prompts.get('shared')).toMatchObject({ content: 'Mine', version: 3 });
    });

    it('heals through sync() as well', async () => {
      const db = new Database();
      db.prompts.set('shared', stored('shared'));
      const a = await open(new AsyncBackend(db), { refreshIntervalMs: 60_000 });
      await (await open(new AsyncBackend(db))).update('shared', { name: 'Theirs' });
      await a.sync();
      expect(await a.update('shared', { content: 'Mine' })).toMatchObject({ name: 'Theirs', version: 3 });
    });

    it('does not turn another kind of failure into a reload', async () => {
      const backend = new AsyncBackend();
      const store = await open(backend, { refreshIntervalMs: 60_000 });
      await store.add({ id: 'p', name: 'P', content: 'c', isTemplate: false, tags: [] });
      const revisions = backend.revisionCalls;
      backend.failPut = new PromptStorageError('down');
      await expect(store.update('p', { name: 'Q' })).rejects.toThrow(PromptStorageError);
      expect(backend.revisionCalls).toBe(revisions);
    });
  });

  describe('a rejection by the backend', () => {
    it('passes a PromptUsageError on, so that it is a 400 and not a storage failure', async () => {
      const backend = new AsyncBackend();
      backend.failPut = new PromptUsageError('contains a character that cannot be saved');
      const store = await open(backend);
      await expect(store.add({ name: 'N', content: 'c', isTemplate: false, tags: [] })).rejects.toThrow(PromptUsageError);
    });
  });

  describe('overlay', () => {
    it('serves the same library to every owner, and keeps what each saved apart', async () => {
      const base = new PromptStore();
      base.load({ promptsDir: library });
      const one = await base.overlay(new AsyncBackend());
      const two = await base.overlay(new AsyncBackend());
      await one.add({ id: 'only-one', name: 'One', content: 'c', isTemplate: false, tags: [] });
      await two.update('lib-a', { name: 'Edited for two' });
      expect(() => two.get('only-one')).toThrow(PromptNotFoundError);
      expect(one.get('lib-a').name).toBe('Library A');
      expect(two.get('lib-a').name).toBe('Edited for two');
      // The base store itself keeps no saved prompts, and the library prompts are the same objects.
      expect(base.size).toBe(2);
      expect(base.get('lib-b')).toBe(one.get('lib-b'));
      expect(one.storage).toBe('postgres');
      expect(base.storage).toBe('memory');
    });

    it('refuses a base store that already has a backend', async () => {
      const store = await open(new AsyncBackend());
      await expect(store.overlay(new AsyncBackend())).rejects.toThrow(PromptUsageError);
    });
  });
});
