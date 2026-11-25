import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  PromptConflictError,
  PromptNotFoundError,
  PromptStorageError,
  PromptStore,
  PromptUsageError,
  type StoredPrompt,
} from './prompt-store';
import { FileStateBackend, type StateBackend, type StateSnapshot } from './state-backend';

/** A state backend that keeps everything in memory, standing in for a database. */
class FakeBackend implements StateBackend {
  readonly kind = 'postgres' as const;
  writable = true;
  readonly prompts = new Map<string, StoredPrompt>();
  readonly tombstones = new Set<string>();
  readonly log: string[] = [];
  failWith: Error | undefined;
  beforeWrite: (() => void) | undefined;
  /** Makes every write wait this long, so concurrent changes overlap. */
  delayMs = 0;
  protected rev = 0;

  load(): StateSnapshot {
    return { prompts: Array.from(this.prompts.values()), tombstones: Array.from(this.tombstones) };
  }

  revision(): string {
    return String(this.rev);
  }

  /**
   * Like the Postgres backend: a replace with an expected version needs a saved prompt of that
   * version, and one with null (the first save of a library prompt) needs no saved prompt and no
   * tombstone.
   */
  async put(prompt: StoredPrompt, mode: 'create' | 'replace', expectedVersion?: string | null): Promise<void> {
    this.log.push(mode === 'replace' ? `put replace ${prompt.id} expected=${expectedVersion}` : `put create ${prompt.id}`);
    this.beforeWrite?.();
    if (this.delayMs) await new Promise(resolve => setTimeout(resolve, this.delayMs));
    if (this.failWith) throw this.failWith;
    if (mode === 'create' && this.prompts.has(prompt.id)) throw new PromptConflictError(prompt.id);
    if (mode === 'replace' && expectedVersion !== undefined) {
      const current = this.prompts.get(prompt.id);
      const matches = expectedVersion === null
        ? !current && !this.tombstones.has(prompt.id)
        : current !== undefined && String(current.version) === expectedVersion;
      if (!matches) throw new PromptConflictError(prompt.id);
    }
    this.prompts.set(prompt.id, prompt);
    if (mode === 'create') this.tombstones.delete(prompt.id);
    this.rev++;
  }

  async remove(id: string, tombstone: boolean): Promise<void> {
    this.log.push(`remove ${id} tombstone=${tombstone}`);
    if (this.delayMs) await new Promise(resolve => setTimeout(resolve, this.delayMs));
    if (this.failWith) throw this.failWith;
    this.prompts.delete(id);
    if (tombstone) this.tombstones.add(id);
    this.rev++;
  }
}

const stored = (id: string, name = id): StoredPrompt =>
  ({ id, name, content: `${name} content`, isTemplate: false, tags: [], createdAt: 't', updatedAt: 't', version: 1 });

describe('PromptStore with a StateBackend', () => {
  let root: string;
  let library: string;
  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'prompts-backend-'));
    library = path.join(root, 'library');
    fs.mkdirSync(library, { recursive: true });
    fs.writeFileSync(path.join(library, 'lib-a.json'), JSON.stringify({ id: 'lib-a', name: 'Library A', content: 'a' }));
    fs.writeFileSync(path.join(library, 'lib-b.json'), JSON.stringify({ id: 'lib-b', name: 'Library B', content: 'b' }));
  });
  afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

  const open = async (backend: StateBackend = new FakeBackend()) => {
    const store = new PromptStore();
    store.load({ promptsDir: library });
    await store.useBackend(backend);
    return store;
  };

  it('serves what the backend holds over the library, and hides tombstoned ids', async () => {
    const backend = new FakeBackend();
    backend.prompts.set('lib-a', stored('lib-a', 'Library A, edited'));
    backend.prompts.set('mine', stored('mine'));
    backend.tombstones.add('lib-b');
    const store = await open(backend);
    expect(store.get('lib-a').name).toBe('Library A, edited');
    expect(store.get('mine').name).toBe('mine');
    expect(() => store.get('lib-b')).toThrow(PromptNotFoundError);
  });

  it('saves a change before it applies it in memory', async () => {
    const backend = new FakeBackend();
    const store = await open(backend);
    backend.beforeWrite = () => expect(() => store.get('early')).toThrow(PromptNotFoundError);
    await store.add({ id: 'early', name: 'Early', content: 'c', isTemplate: false, tags: [] });
    expect(store.get('early').name).toBe('Early');
    expect(backend.log).toEqual(['put create early']);
  });

  it('leaves the store unchanged and reports a PromptStorageError when a save fails', async () => {
    const backend = new FakeBackend();
    backend.prompts.set('kept', stored('kept'));
    const store = await open(backend);
    backend.failWith = new Error('connection terminated: password=hunter2');

    await expect(store.add({ id: 'lost', name: 'Lost', content: 'c', isTemplate: false, tags: [] })).rejects.toThrow(PromptStorageError);
    expect(() => store.get('lost')).toThrow(PromptNotFoundError);

    const update = store.update('kept', { name: 'Changed' });
    await expect(update).rejects.toThrow(PromptStorageError);
    await expect(update).rejects.toThrow(/nothing was changed/);
    await expect(update).rejects.not.toThrow(/hunter2/);
    expect(store.get('kept').name).toBe('kept');
    expect(store.get('kept').version).toBe(1);

    await expect(store.delete('kept')).rejects.toThrow(PromptStorageError);
    expect(store.get('kept').name).toBe('kept');
  });

  it('keeps the error a backend raises on purpose', async () => {
    const backend = new FakeBackend();
    const store = await open(backend);
    backend.failWith = new PromptStorageError('Could not save prompt x (EACCES); nothing was changed');
    await expect(store.add({ id: 'x', name: 'X', content: 'c', isTemplate: false, tags: [] })).rejects.toThrow('(EACCES)');
  });

  it('surfaces a create conflict decided by the backend', async () => {
    const backend = new FakeBackend();
    const store = await open(backend);
    // Another process saved this id after the store last looked.
    backend.prompts.set('claimed', stored('claimed', 'Theirs'));
    await expect(store.add({ id: 'claimed', name: 'Mine', content: 'c', isTemplate: false, tags: [] })).rejects.toThrow(PromptConflictError);
    expect(backend.prompts.get('claimed')!.name).toBe('Theirs');
  });

  it('still refuses a taken id without asking the backend', async () => {
    const backend = new FakeBackend();
    const store = await open(backend);
    await expect(store.add({ id: 'lib-a', name: 'Clash', content: 'c', isTemplate: false, tags: [] })).rejects.toThrow(PromptConflictError);
    expect(backend.log).toEqual([]);
  });

  it('records a tombstone when a library prompt is deleted, and none for other prompts', async () => {
    const backend = new FakeBackend();
    const store = await open(backend);
    await store.add({ id: 'mine', name: 'Mine', content: 'c', isTemplate: false, tags: [] });
    await store.delete('mine');
    await store.delete('lib-b');
    expect(backend.log).toEqual(['put create mine', 'remove mine tombstone=false', 'remove lib-b tombstone=true']);
    expect(Array.from(backend.tombstones)).toEqual(['lib-b']);
    expect(() => store.get('lib-b')).toThrow(PromptNotFoundError);
  });

  it('saves an update as a replace and raises the version', async () => {
    const backend = new FakeBackend();
    const store = await open(backend);
    const updated = await store.update('lib-a', { name: 'Library A, edited' });
    expect(updated.version).toBe(2);
    expect(backend.log).toEqual(['put replace lib-a expected=null']);
    expect(backend.prompts.get('lib-a')!.name).toBe('Library A, edited');
  });

  it('reads the backend again when its revision changes', async () => {
    const backend = new FakeBackend();
    const store = await open(backend);
    expect(() => store.get('late')).toThrow(PromptNotFoundError);
    await backend.put(stored('late'), 'create');
    expect(store.get('late').name).toBe('late');
    await backend.remove('lib-a', true);
    expect(() => store.get('lib-a')).toThrow(PromptNotFoundError);
  });

  it('refuses changes when the backend is read-only', async () => {
    const backend = new FakeBackend();
    backend.writable = false;
    const store = await open(backend);
    await expect(store.add({ name: 'Nope', content: 'c', isTemplate: false, tags: [] })).rejects.toThrow(PromptUsageError);
    await expect(store.delete('lib-a')).rejects.toThrow(PromptUsageError);
    expect(backend.log).toEqual([]);
  });
});

describe('PromptStore changes that overlap', () => {
  let root: string;
  let library: string;
  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'prompts-overlap-'));
    library = path.join(root, 'library');
    fs.mkdirSync(library, { recursive: true });
    fs.writeFileSync(path.join(library, 'lib-a.json'), JSON.stringify({ id: 'lib-a', name: 'Library A', content: 'a' }));
  });
  afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

  const open = async (backend: StateBackend) => {
    const store = new PromptStore();
    store.load({ promptsDir: library });
    await store.useBackend(backend);
    return store;
  };

  it('asks for no expected version on the first edit of a library prompt, then for the saved one', async () => {
    const backend = new FakeBackend();
    const store = await open(backend);
    await store.update('lib-a', { name: 'One' });
    await store.update('lib-a', { name: 'Two' });
    expect(backend.log).toEqual(['put replace lib-a expected=null', 'put replace lib-a expected=2']);
    expect(store.get('lib-a').version).toBe(3);
  });

  it('applies two updates of one prompt one after the other, so neither is lost', async () => {
    const backend = new FakeBackend();
    backend.delayMs = 10;
    const store = await open(backend);
    await store.add({ id: 'mine', name: 'Mine', content: 'c', isTemplate: false, tags: [] });
    const [first, second] = await Promise.all([
      store.update('mine', { name: 'First' }),
      store.update('mine', { content: 'second content' })
    ]);
    expect([first.version, second.version]).toEqual([2, 3]);
    expect(store.get('mine')).toMatchObject({ name: 'First', content: 'second content', version: 3 });
    expect(backend.prompts.get('mine')).toMatchObject({ name: 'First', content: 'second content', version: 3 });
  });

  it('reports a conflict when another server changed the prompt after this store read it', async () => {
    const backend = new FakeBackend();
    backend.prompts.set('shared', stored('shared'));
    const store = await open(backend);
    backend.prompts.set('shared', { ...stored('shared', 'Theirs'), version: 2 });
    await expect(store.update('shared', { name: 'Mine' })).rejects.toThrow(PromptConflictError);
    expect(backend.prompts.get('shared')!.name).toBe('Theirs');
    expect(store.get('shared').name).toBe('shared');
  });

  it('does not bring a prompt back when an update was queued behind its deletion', async () => {
    const backend = new FakeBackend();
    backend.delayMs = 10;
    const store = await open(backend);
    await store.add({ id: 'doomed', name: 'Doomed', content: 'c', isTemplate: false, tags: [] });
    const deleting = store.delete('doomed');
    const updating = store.update('doomed', { name: 'Too late' });
    await expect(deleting).resolves.toMatchObject({ id: 'doomed' });
    await expect(updating).rejects.toThrow(PromptNotFoundError);
    expect(backend.prompts.has('doomed')).toBe(false);
    expect(() => store.get('doomed')).toThrow(PromptNotFoundError);
  });

  it('does not bring a prompt back when another server deleted it first', async () => {
    const backend = new FakeBackend();
    backend.prompts.set('doomed', stored('doomed'));
    const store = await open(backend);
    backend.prompts.delete('doomed');
    await expect(store.update('doomed', { name: 'Too late' })).rejects.toThrow(PromptConflictError);
    expect(backend.prompts.has('doomed')).toBe(false);
  });

  it('keeps going after a change failed', async () => {
    const backend = new FakeBackend();
    backend.prompts.set('kept', stored('kept'));
    const store = await open(backend);
    backend.failWith = new Error('down');
    // The backend recovers by the time the second change reaches it.
    backend.beforeWrite = () => {
      if (backend.log.length === 2) backend.failWith = undefined;
    };
    const failing = store.update('kept', { name: 'A' });
    const next = store.update('kept', { name: 'B' });
    await expect(failing).rejects.toThrow(PromptStorageError);
    await expect(next).resolves.toMatchObject({ name: 'B', version: 2 });
  });

  it('works with a backend whose load and revision answer with promises', async () => {
    class AsyncBackend extends FakeBackend {
      // @ts-expect-error narrowing the return type to the asynchronous half of the contract
      async load(): Promise<StateSnapshot> {
        return super.load();
      }
      // @ts-expect-error narrowing the return type to the asynchronous half of the contract
      async revision(): Promise<string> {
        return super.revision();
      }
    }
    const backend = new AsyncBackend();
    backend.prompts.set('saved', stored('saved'));
    backend.tombstones.add('lib-a');
    const store = await open(backend);
    expect(store.get('saved').name).toBe('saved');
    expect(() => store.get('lib-a')).toThrow(PromptNotFoundError);
    // Reads stay synchronous and do not wait for, or trip over, the pending revision check.
    expect(store.list()).toHaveLength(1);
    await store.add({ id: 'new-one', name: 'New', content: 'c', isTemplate: false, tags: [] });
    expect(store.get('new-one').name).toBe('New');
    expect(store.stats().total).toBe(2);
  });
});

describe('FileStateBackend', () => {
  let dir: string;
  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompts-file-backend-'));
  });
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  const parse = (raw: unknown): StoredPrompt | undefined =>
    typeof raw === 'object' && raw !== null && 'id' in raw ? (raw as StoredPrompt) : undefined;

  it('creates exclusively, replaces, tombstones and reports changes through its revision', async () => {
    const backend = new FileStateBackend(path.join(dir, 'state'), { parse });
    expect(backend.kind).toBe('file');
    expect(backend.writable).toBe(true);
    expect(backend.load()).toEqual({ prompts: [], tombstones: [] });
    const before = backend.revision();

    await backend.put(stored('one'), 'create');
    await expect(backend.put(stored('one', 'again'), 'create')).rejects.toThrow(PromptConflictError);
    await backend.put(stored('one', 'replaced'), 'replace');
    await backend.remove('gone', true);

    const snapshot = backend.load();
    expect(snapshot.prompts.map(prompt => prompt.name)).toEqual(['replaced']);
    expect(snapshot.tombstones).toEqual(['gone']);
    expect(backend.revision()).not.toBe(before);

    await backend.put(stored('gone'), 'create');
    expect(backend.load().tombstones).toEqual([]);
    await backend.remove('one', false);
    expect(backend.load().prompts.map(prompt => prompt.id)).toEqual(['gone']);
  });

  it('reports a directory it cannot write as a PromptStorageError', () => {
    const file = path.join(dir, 'a-file');
    fs.writeFileSync(file, 'x');
    expect(() => new FileStateBackend(path.join(file, 'state'), { parse })).toThrow(PromptStorageError);
  });

  it('is not writable when opened read-only', async () => {
    const backend = new FileStateBackend(path.join(dir, 'state'), { parse, readOnly: true });
    expect(backend.writable).toBe(false);
    await expect(backend.put(stored('x'), 'create')).rejects.toThrow(PromptStorageError);
  });
});
