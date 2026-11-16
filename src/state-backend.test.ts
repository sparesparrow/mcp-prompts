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
  private rev = 0;

  load(): StateSnapshot {
    return { prompts: Array.from(this.prompts.values()), tombstones: Array.from(this.tombstones) };
  }

  revision(): string {
    return String(this.rev);
  }

  async put(prompt: StoredPrompt, mode: 'create' | 'replace'): Promise<void> {
    this.log.push(`put ${mode} ${prompt.id}`);
    this.beforeWrite?.();
    if (this.failWith) throw this.failWith;
    if (mode === 'create' && this.prompts.has(prompt.id)) throw new PromptConflictError(prompt.id);
    this.prompts.set(prompt.id, prompt);
    if (mode === 'create') this.tombstones.delete(prompt.id);
    this.rev++;
  }

  async remove(id: string, tombstone: boolean): Promise<void> {
    this.log.push(`remove ${id} tombstone=${tombstone}`);
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
    expect(backend.log).toEqual(['put replace lib-a']);
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
