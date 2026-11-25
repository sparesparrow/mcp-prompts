import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Pool } from 'pg';
import { PromptNotFoundError, PromptStaleError, PromptStore, PromptUsageError, type StoredPrompt } from '../prompt-store';
import { staleChangeError, type StateBackend, type StateSnapshot } from '../state-backend';
import { OWNER_STORES_MAX, OwnerStores } from './owner-stores';
import { createPostgresPool, runMigrations } from './postgres';

/** Rows of every owner, as a database holds them. */
class Rows {
  readonly byOwner = new Map<string, { prompts: Map<string, StoredPrompt>; rev: number }>();
  of(owner: string) {
    if (!this.byOwner.has(owner)) this.byOwner.set(owner, { prompts: new Map(), rev: 0 });
    return this.byOwner.get(owner)!;
  }
}

class FakeBackend implements StateBackend {
  readonly kind = 'postgres' as const;
  readonly writable = true;
  constructor(private readonly rows: Rows, readonly owner: string) {}
  async load(): Promise<StateSnapshot> {
    return { prompts: Array.from(this.rows.of(this.owner).prompts.values()), tombstones: [] };
  }
  async revision(): Promise<string> {
    return String(this.rows.of(this.owner).rev);
  }
  async put(prompt: StoredPrompt, mode: 'create' | 'replace', expected?: string | null): Promise<void> {
    const owner = this.rows.of(this.owner);
    const current = owner.prompts.get(prompt.id);
    if (mode === 'replace' && expected !== undefined && expected !== null && String(current?.version) !== expected) throw staleChangeError(prompt.id);
    owner.prompts.set(prompt.id, prompt);
    owner.rev++;
  }
  async remove(id: string): Promise<void> {
    const owner = this.rows.of(this.owner);
    owner.prompts.delete(id);
    owner.rev++;
  }
}

const stored = (id: string, name = id): StoredPrompt =>
  ({ id, name, content: `${name} content`, isTemplate: false, tags: [], createdAt: 't', updatedAt: 't', version: 1 });

describe('OwnerStores', () => {
  let root: string;
  let base: PromptStore;
  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'prompts-owners-'));
    fs.writeFileSync(path.join(root, 'lib-a.json'), JSON.stringify({ id: 'lib-a', name: 'Library A', content: 'a' }));
    base = new PromptStore();
    base.load({ promptsDir: root });
  });
  afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

  const stores = (options: { max?: number; rows?: Rows } = {}) => {
    const rows = options.rows ?? new Rows();
    const made: string[] = [];
    const owners = new OwnerStores({
      base,
      pool: undefined as unknown as Pool,
      max: options.max,
      refreshIntervalMs: 60_000,
      backendFor: owner => {
        made.push(owner);
        return new FakeBackend(rows, owner);
      },
    });
    return { owners, rows, made };
  };

  it('keeps at most 100 owners by default', async () => {
    expect(OWNER_STORES_MAX).toBe(100);
    const { owners, made } = stores();
    for (let i = 0; i < 101; i++) await owners.storeForOwner(`owner-${i}`);
    expect(owners.size).toBe(100);
    expect(made).toHaveLength(101);
  });

  it('hands out one store per owner, and builds it once even for simultaneous first requests', async () => {
    const { owners, made } = stores();
    const [a, b] = await Promise.all([owners.storeForOwner('sub-1'), owners.storeForOwner('sub-1')]);
    expect(a).toBe(b);
    expect(await owners.storeForOwner('sub-1')).toBe(a);
    expect(made).toEqual(['sub-1']);
  });

  it('drops the owner that was used longest ago', async () => {
    const { owners, made } = stores({ max: 2 });
    const a = await owners.storeForOwner('a');
    await owners.storeForOwner('b');
    await owners.storeForOwner('a');
    await owners.storeForOwner('c');
    expect(owners.size).toBe(2);
    expect(await owners.storeForOwner('a')).toBe(a);
    expect(made).toEqual(['a', 'b', 'c']);
    await owners.storeForOwner('b');
    expect(made).toEqual(['a', 'b', 'c', 'b']);
  });

  it('does not keep an owner whose store could not be opened', async () => {
    const rows = new Rows();
    let failing = true;
    const owners = new OwnerStores({
      base,
      pool: undefined as unknown as Pool,
      backendFor: owner => {
        const backend = new FakeBackend(rows, owner);
        if (failing) backend.revision = async () => { throw new Error('down'); };
        return backend;
      },
    });
    await expect(owners.storeForOwner('x')).rejects.toThrow();
    expect(owners.size).toBe(0);
    failing = false;
    expect((await owners.storeForOwner('x')).get('lib-a').name).toBe('Library A');
  });

  it('checks for other servers\' changes on every request, whatever the refresh interval', async () => {
    const { owners, rows } = stores();
    const store = await owners.storeForOwner('sub-1');
    await new FakeBackend(rows, 'sub-1').put(stored('from-elsewhere'), 'create');
    expect(() => store.get('from-elsewhere')).toThrow(PromptNotFoundError);
    const again = await owners.storeForOwner('sub-1');
    expect(again).toBe(store);
    expect(again.get('from-elsewhere').name).toBe('from-elsewhere');
  });

  it('keeps owners apart while sharing one library', async () => {
    const { owners } = stores();
    const one = await owners.storeForOwner('one');
    const two = await owners.storeForOwner('two');
    await one.add({ id: 'mine', name: 'Mine', content: 'c', isTemplate: false, tags: [] });
    await two.sync();
    expect(() => two.get('mine')).toThrow(PromptNotFoundError);
    expect(one.get('lib-a')).toBe(two.get('lib-a'));
  });

  it('refuses an owner that is not a usable name', async () => {
    const { owners } = stores();
    for (const bad of ['', '   ', 'x'.repeat(257), undefined as unknown as string, 42 as unknown as string]) {
      await expect(owners.storeForOwner(bad)).rejects.toThrow(PromptUsageError);
    }
  });
});

const DATABASE_URL = process.env.TEST_DATABASE_URL;

describe.skipIf(!DATABASE_URL)('OwnerStores over Postgres', () => {
  let pool: Pool;
  let root: string;
  let base: PromptStore;
  const owners: string[] = [];
  const run = crypto.randomBytes(4).toString('hex');
  const newOwner = (label: string) => {
    const owner = `test-${run}-os-${label}`;
    owners.push(owner);
    return owner;
  };

  beforeAll(async () => {
    pool = createPostgresPool(DATABASE_URL!);
    await runMigrations(pool);
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'prompts-owners-pg-'));
    fs.writeFileSync(path.join(root, 'lib-a.json'), JSON.stringify({ id: 'lib-a', name: 'Library A', content: 'a' }));
    base = new PromptStore();
    base.load({ promptsDir: root });
  });
  afterAll(async () => {
    for (const table of ['prompts', 'tombstones', 'revisions']) {
      await pool.query(`DELETE FROM ${table} WHERE owner_sub = ANY($1)`, [owners]);
    }
    await pool.end();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('serves each owner their own prompts, and sees a change another server made before answering', async () => {
    // Two servers, each with its own cache over the one database.
    const first = new OwnerStores({ base, pool, refreshIntervalMs: 60_000 });
    const second = new OwnerStores({ base, pool, refreshIntervalMs: 60_000 });
    const alice = newOwner('alice');
    const bob = newOwner('bob');

    const aliceHere = await first.storeForOwner(alice);
    await aliceHere.add({ id: 'note', name: 'Note', content: 'c', isTemplate: false, tags: [] });
    const aliceThere = await second.storeForOwner(alice);
    expect(aliceThere.get('note').name).toBe('Note');

    await aliceThere.update('note', { name: 'Note, edited' });
    expect((await first.storeForOwner(alice)).get('note').name).toBe('Note, edited');

    const bobHere = await first.storeForOwner(bob);
    expect(() => bobHere.get('note')).toThrow(PromptNotFoundError);
    expect(bobHere.get('lib-a').name).toBe('Library A');
  });

  it('lets a store that conflicted catch up and retry', async () => {
    const first = new OwnerStores({ base, pool, refreshIntervalMs: 60_000 });
    const second = new OwnerStores({ base, pool, refreshIntervalMs: 60_000 });
    const owner = newOwner('retry');
    const a = await first.storeForOwner(owner);
    await a.add({ id: 'doc', name: 'Doc', content: 'c', isTemplate: false, tags: [] });
    const b = await second.storeForOwner(owner);
    await b.update('doc', { name: 'By B' });

    await expect(a.update('doc', { content: 'By A' })).rejects.toThrow(PromptStaleError);
    // Asking the factory again also catches up, with no help from the failed call.
    const again = await first.storeForOwner(owner);
    expect(again).toBe(a);
    expect(await a.update('doc', { content: 'By A' })).toMatchObject({ name: 'By B', content: 'By A', version: 3 });
  });
});
