import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Pool } from 'pg';
import { PromptConflictError, PromptNotFoundError, PromptStorageError, PromptStore, type StoredPrompt } from '../prompt-store';
import { logger } from '../utils';
import { PostgresStateBackend, createPostgresPool, runMigrations } from './postgres';

const DATABASE_URL = process.env.TEST_DATABASE_URL;

const stored = (id: string, name = id, version: number | string = 1): StoredPrompt =>
  ({ id, name, content: `${name} content`, isTemplate: false, tags: [], createdAt: 't', updatedAt: 't', version });

/** Everything the logger was asked to write while fn ran, as one string. */
async function logged(fn: () => Promise<unknown>): Promise<string> {
  const lines: string[] = [];
  const spies = (['trace', 'debug', 'info', 'warn', 'error'] as const).map(level =>
    vi.spyOn(logger, level).mockImplementation(((...args: unknown[]) => {
      lines.push(JSON.stringify(args, (_key, value) => (value instanceof Error ? { ...value, name: value.name, message: value.message } : value)));
    }) as never)
  );
  try {
    await fn().catch(() => undefined);
  } finally {
    spies.forEach(spy => spy.mockRestore());
  }
  return lines.join('\n');
}

describe('PostgresStateBackend without a reachable database', () => {
  // Credentials and a host that must never show up in an error or a log line.
  const URL = 'postgresql://leaky_user:leaky_pw@127.0.0.1:1/leaky_db';
  const secrets = ['leaky_user', 'leaky_pw', 'leaky_db', '127.0.0.1', URL];

  it('reports a failed read as a PromptStorageError that names no connection detail', async () => {
    const pool = createPostgresPool(URL);
    const backend = new PostgresStateBackend({ pool, ownerSub: 'u' });
    let error: unknown;
    const output = await logged(async () => {
      try {
        await backend.load();
      } catch (err) {
        error = err;
        throw err;
      }
    });
    await pool.end();
    expect(error).toBeInstanceOf(PromptStorageError);
    // The failure was logged (so the absence of details below means something), by code only.
    expect(output).toContain('could not read the saved prompts');
    for (const secret of secrets) {
      expect((error as Error).message).not.toContain(secret);
      expect(output).not.toContain(secret);
    }
  });

  it('does the same for a failed revision check, write and migration', async () => {
    const pool = createPostgresPool(URL);
    const backend = new PostgresStateBackend({ pool, ownerSub: 'u' });
    const failures: unknown[] = [];
    const output = await logged(async () => {
      for (const run of [() => backend.revision(), () => backend.put(stored('x'), 'create'), () => backend.remove('x', true), () => runMigrations(pool)]) {
        await Promise.resolve(run()).catch(err => failures.push(err));
      }
    });
    await pool.end();
    expect(failures).toHaveLength(4);
    for (const failure of failures) {
      expect(failure).toBeInstanceOf(PromptStorageError);
      for (const secret of secrets) expect((failure as Error).message).not.toContain(secret);
    }
    for (const secret of secrets) expect(output).not.toContain(secret);
  });
});

describe.skipIf(!DATABASE_URL)('PostgresStateBackend', () => {
  let pool: Pool;
  let root: string;
  let library: string;
  const owners: string[] = [];
  const run = crypto.randomBytes(4).toString('hex');
  const newOwner = (label: string): string => {
    const owner = `test-${run}-${label}`;
    owners.push(owner);
    return owner;
  };

  beforeAll(async () => {
    pool = createPostgresPool(DATABASE_URL!);
    await runMigrations(pool);
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'prompts-postgres-'));
    library = path.join(root, 'library');
    fs.mkdirSync(library, { recursive: true });
    fs.writeFileSync(path.join(library, 'lib-a.json'), JSON.stringify({ id: 'lib-a', name: 'Library A', content: 'a' }));
    fs.writeFileSync(path.join(library, 'lib-b.json'), JSON.stringify({ id: 'lib-b', name: 'Library B', content: 'b' }));
  });

  afterAll(async () => {
    for (const table of ['prompts', 'tombstones', 'revisions']) {
      await pool.query(`DELETE FROM ${table} WHERE owner_sub = ANY($1)`, [owners]);
    }
    await pool.end();
    fs.rmSync(root, { recursive: true, force: true });
  });

  const backendFor = (ownerSub: string, source: Pick<Pool, 'query' | 'connect'> = pool) =>
    new PostgresStateBackend({ pool: source as Pool, ownerSub });

  const storeFor = async (backend: PostgresStateBackend) => {
    const store = new PromptStore();
    store.load({ promptsDir: library });
    await store.useBackend(backend);
    return store;
  };

  const add = (store: PromptStore, id: string, name = id) =>
    store.add({ id, name, content: `${name} content`, isTemplate: false, tags: [] });

  describe('migrations', () => {
    it('apply once and are idempotent', async () => {
      const again = await runMigrations(pool);
      expect(again).toEqual([]);
      const applied = await pool.query('SELECT name FROM schema_migrations ORDER BY name');
      expect(applied.rows.map(row => row.name)).toEqual(['001_prompts.sql']);
      const tables = await pool.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = ANY($1) ORDER BY table_name",
        [['prompts', 'revisions', 'schema_migrations', 'tombstones']]
      );
      expect(tables.rows.map(row => row.table_name)).toEqual(['prompts', 'revisions', 'schema_migrations', 'tombstones']);
    });

    it('survive two runners starting together', async () => {
      const results = await Promise.all([runMigrations(pool), runMigrations(pool)]);
      expect(results).toEqual([[], []]);
    });
  });

  describe('owners', () => {
    it('keep the same id apart', async () => {
      const [a, b] = [backendFor(newOwner('same-a')), backendFor(newOwner('same-b'))];
      await a.put(stored('shared', 'Of A'), 'create');
      await b.put(stored('shared', 'Of B'), 'create');
      expect((await a.load()).prompts.map(prompt => prompt.name)).toEqual(['Of A']);
      expect((await b.load()).prompts.map(prompt => prompt.name)).toEqual(['Of B']);
    });

    it('cannot be seen, replaced or deleted by another owner (404 through the store)', async () => {
      const ownerB = newOwner('priv-b');
      const storeB = await storeFor(backendFor(ownerB));
      await add(storeB, 'secret', 'B secret');

      const storeA = await storeFor(backendFor(newOwner('priv-a')));
      expect(() => storeA.get('secret')).toThrow(PromptNotFoundError);
      expect(storeA.list().map(prompt => prompt.id)).not.toContain('secret');
      await expect(storeA.update('secret', { name: 'Stolen' })).rejects.toThrow(PromptNotFoundError);
      await expect(storeA.delete('secret')).rejects.toThrow(PromptNotFoundError);

      const row = await pool.query('SELECT body FROM prompts WHERE owner_sub = $1 AND id = $2', [ownerB, 'secret']);
      expect(row.rows[0].body.name).toBe('B secret');
    });

    it('cannot be reached through the backend either', async () => {
      const ownerB = newOwner('raw-b');
      await backendFor(ownerB).put(stored('mine', 'B mine'), 'create');
      const a = backendFor(newOwner('raw-a'));
      await expect(a.put(stored('mine', 'Stolen', 2), 'replace', '1')).rejects.toThrow(PromptConflictError);
      await a.remove('mine', true);
      expect((await backendFor(ownerB).load()).prompts.map(prompt => prompt.name)).toEqual(['B mine']);
      expect((await backendFor(ownerB).load()).tombstones).toEqual([]);
      expect((await a.load()).tombstones).toEqual(['mine']);
    });
  });

  describe('create', () => {
    it('fails with PromptConflictError when the id is taken, even for a store that has not seen it', async () => {
      const owner = newOwner('conflict');
      const first = await storeFor(backendFor(owner));
      const second = await storeFor(backendFor(owner));
      await add(first, 'taken', 'First');
      await expect(add(second, 'taken', 'Second')).rejects.toThrow(PromptConflictError);
      expect(() => second.get('taken')).toThrow(PromptNotFoundError);
      const row = await pool.query('SELECT body FROM prompts WHERE owner_sub = $1 AND id = $2', [owner, 'taken']);
      expect(row.rows[0].body.name).toBe('First');
    });

    it('stores the prompt as it was, with its version', async () => {
      const backend = backendFor(newOwner('roundtrip'));
      const prompt: StoredPrompt = { ...stored('rt', 'Round trip', '1.2.3'), tags: ['a', 'b'], description: 'd', metadata: { n: 1 } };
      await backend.put(prompt, 'create');
      expect((await backend.load()).prompts).toEqual([prompt]);
    });
  });

  describe('replace', () => {
    it('replaces the version that was read and refuses an older one', async () => {
      const backend = backendFor(newOwner('replace'));
      await backend.put(stored('p', 'v1'), 'create');
      await backend.put(stored('p', 'v2', 2), 'replace', '1');
      await expect(backend.put(stored('p', 'stale', 2), 'replace', '1')).rejects.toThrow(PromptConflictError);
      expect((await backend.load()).prompts.map(prompt => prompt.name)).toEqual(['v2']);
    });

    it('saves a library prompt the first time with a null expected version, once', async () => {
      const owner = newOwner('first-edit');
      const backend = backendFor(owner);
      await backend.put(stored('lib-a', 'Edited', 2), 'replace', null);
      await expect(backend.put(stored('lib-a', 'Edited too', 2), 'replace', null)).rejects.toThrow(PromptConflictError);
      expect((await backend.load()).prompts.map(prompt => prompt.name)).toEqual(['Edited']);
    });

    it('does not bring back a prompt that was deleted, whether or not the id is recorded as deleted', async () => {
      const backend = backendFor(newOwner('no-resurrect'));
      await backend.put(stored('gone'), 'create');
      await backend.remove('gone', false);
      await expect(backend.put(stored('gone', 'back', 2), 'replace', '1')).rejects.toThrow(PromptConflictError);
      await backend.remove('lib-b', true);
      await expect(backend.put(stored('lib-b', 'back', 2), 'replace', null)).rejects.toThrow(PromptConflictError);
      expect((await backend.load()).prompts).toEqual([]);
    });

    it('replaces without a check when no expected version is given', async () => {
      const backend = backendFor(newOwner('unconditional'));
      await backend.put(stored('p'), 'create');
      await backend.put(stored('p', 'forced', 9), 'replace');
      expect((await backend.load()).prompts.map(prompt => prompt.name)).toEqual(['forced']);
    });

    it('through the store: edits a library prompt twice, and a stale store gets a conflict', async () => {
      const owner = newOwner('store-replace');
      const first = await storeFor(backendFor(owner));
      const second = await storeFor(backendFor(owner));
      await first.update('lib-a', { name: 'One' });
      await first.update('lib-a', { name: 'Two' });
      expect(first.get('lib-a').version).toBe(3);
      await expect(second.update('lib-a', { name: 'Stale' })).rejects.toThrow(PromptConflictError);
      const row = await pool.query('SELECT body, version FROM prompts WHERE owner_sub = $1 AND id = $2', [owner, 'lib-a']);
      expect(row.rows[0].body.name).toBe('Two');
      expect(row.rows[0].version).toBe('3');
    });

    it('through the store: two updates started together are both kept', async () => {
      const store = await storeFor(backendFor(newOwner('together')));
      await add(store, 'p');
      await Promise.all([store.update('p', { name: 'First' }), store.update('p', { content: 'Second content' })]);
      expect(store.get('p')).toMatchObject({ name: 'First', content: 'Second content', version: 3 });
    });

    it('through the store: an update queued behind a delete finds nothing to bring back', async () => {
      const owner = newOwner('update-delete');
      const store = await storeFor(backendFor(owner));
      await add(store, 'doomed');
      const deleting = store.delete('doomed');
      const updating = store.update('doomed', { name: 'Too late' });
      await deleting;
      await expect(updating).rejects.toThrow(PromptNotFoundError);
      const rows = await pool.query('SELECT 1 FROM prompts WHERE owner_sub = $1', [owner]);
      expect(rows.rowCount).toBe(0);
    });
  });

  describe('remove', () => {
    it('deletes the row, and records a tombstone only when asked; create clears it', async () => {
      const backend = backendFor(newOwner('remove'));
      await backend.put(stored('plain'), 'create');
      await backend.remove('plain', false);
      await backend.remove('lib-a', true);
      await backend.remove('lib-a', true);
      let snapshot = await backend.load();
      expect(snapshot).toEqual({ prompts: [], tombstones: ['lib-a'] });
      await backend.put(stored('lib-a', 'Again'), 'create');
      snapshot = await backend.load();
      expect(snapshot.tombstones).toEqual([]);
      expect(snapshot.prompts.map(prompt => prompt.name)).toEqual(['Again']);
    });

    it('through the store: a deleted library prompt stays deleted for another store', async () => {
      const owner = newOwner('store-tombstone');
      const first = await storeFor(backendFor(owner));
      await first.delete('lib-b');
      const second = await storeFor(backendFor(owner));
      expect(() => second.get('lib-b')).toThrow(PromptNotFoundError);
      expect(second.get('lib-a').name).toBe('Library A');
    });
  });

  describe('revision', () => {
    it('starts at 0 and goes up with every successful write, in the same transaction', async () => {
      const backend = backendFor(newOwner('revision'));
      expect(await backend.revision()).toBe('0');
      await backend.put(stored('a'), 'create');
      const afterCreate = await backend.revision();
      expect(afterCreate).toBe('1');
      await backend.put(stored('a', 'a2', 2), 'replace', '1');
      expect(await backend.revision()).toBe('2');
      await backend.remove('a', false);
      expect(await backend.revision()).toBe('3');
    });

    it('does not move for a write that failed, and is kept per owner', async () => {
      const owner = newOwner('revision-fail');
      const backend = backendFor(owner);
      await backend.put(stored('a'), 'create');
      await expect(backend.put(stored('a', 'again'), 'create')).rejects.toThrow(PromptConflictError);
      await expect(backend.put(stored('a', 'stale', 2), 'replace', '7')).rejects.toThrow(PromptConflictError);
      expect(await backend.revision()).toBe('1');
      expect(await backendFor(newOwner('revision-other')).revision()).toBe('0');
    });

    it('is seen by a second store through the same backend state', async () => {
      const owner = newOwner('revision-seen');
      const one = backendFor(owner);
      const two = backendFor(owner);
      await one.put(stored('a'), 'create');
      expect(await two.revision()).toBe(await one.revision());
    });
  });

  describe('load', () => {
    it('serves the saved prompts of the owner in id order and skips rows that are not prompts', async () => {
      const owner = newOwner('load');
      const backend = backendFor(owner);
      await backend.put(stored('b'), 'create');
      await backend.put(stored('a'), 'create');
      await pool.query("INSERT INTO prompts (owner_sub, id, body, version) VALUES ($1, 'broken', '{\"nope\":true}', '1')", [owner]);
      const output = await logged(async () => {
        expect((await backend.load()).prompts.map(prompt => prompt.id)).toEqual(['a', 'b']);
      });
      expect(output).toContain('broken');
    });
  });

  describe('a database that fails', () => {
    /** The real pool until it is told to fail, then a driver error full of connection details. */
    const flaky = () => {
      const state = { broken: false };
      const fail = (): never => {
        throw Object.assign(new Error('password authentication failed for user "leaky_user" at 10.9.8.7:5432'), { code: '28P01' });
      };
      const source = {
        query: (...args: unknown[]) => (state.broken ? fail() : (pool.query as (...a: unknown[]) => unknown)(...args)),
        connect: async () => (state.broken ? fail() : pool.connect())
      } as unknown as Pick<Pool, 'query' | 'connect'>;
      return { state, source };
    };

    it('leaves the store unchanged and says nothing about the connection', async () => {
      const { state, source } = flaky();
      const owner = newOwner('failing');
      const store = await storeFor(backendFor(owner, source));
      await add(store, 'kept');
      state.broken = true;

      const errors: unknown[] = [];
      const output = await logged(async () => {
        for (const change of [
          () => add(store, 'lost'),
          () => store.update('kept', { name: 'Changed' }),
          () => store.delete('kept')
        ]) await change().catch(err => errors.push(err));
      });
      state.broken = false;

      expect(errors).toHaveLength(3);
      for (const error of errors) {
        expect(error).toBeInstanceOf(PromptStorageError);
        expect((error as Error).message).toMatch(/nothing was changed/);
        for (const secret of ['leaky_user', '10.9.8.7', 'password', '5432']) expect((error as Error).message).not.toContain(secret);
      }
      for (const secret of ['leaky_user', '10.9.8.7', 'password authentication']) expect(output).not.toContain(secret);
      expect(() => store.get('lost')).toThrow(PromptNotFoundError);
      expect(store.get('kept')).toMatchObject({ name: 'kept', version: 1 });
      const rows = await pool.query('SELECT id FROM prompts WHERE owner_sub = $1', [owner]);
      expect(rows.rows.map(row => row.id)).toEqual(['kept']);
    });

    it('refuses to attach to a backend whose first read fails, without details', async () => {
      const { state, source } = flaky();
      state.broken = true;
      const store = new PromptStore();
      store.load({ promptsDir: library });
      const error = await store.useBackend(backendFor(newOwner('attach'), source)).catch(err => err);
      expect(error).toBeInstanceOf(PromptStorageError);
      expect(error.message).not.toContain('leaky_user');
    });
  });
});
