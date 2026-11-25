import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as net from 'net';
import * as os from 'os';
import * as path from 'path';
import { Pool, type PoolClient } from 'pg';
import { PromptConflictError, PromptNotFoundError, PromptStaleError, PromptStorageError, PromptStore, PromptUsageError, type StoredPrompt } from '../prompt-store';
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

describe('PostgresStateBackend when a rollback fails', () => {
  /** A connection that fails on the statement matching `failOn`, and on every ROLLBACK when rollbackFails. */
  const brokenClient = (failOn: RegExp, error: unknown, rollbackFails: boolean) => {
    const released: unknown[] = [];
    const client = {
      query: async (sql: string) => {
        if (sql === 'ROLLBACK' && rollbackFails) throw Object.assign(new Error('connection lost'), { code: '57P01' });
        if (failOn.test(sql)) throw error;
        return { rows: [], rowCount: 1 };
      },
      release: (arg?: unknown) => { released.push(arg); },
    };
    const pool = { connect: async () => client, query: async () => ({ rows: [] }) } as unknown as Pool;
    return { pool, released };
  };
  const duplicate = Object.assign(new Error('duplicate key value'), { code: '23505' });

  it('throws the connection away instead of returning it to the pool', async () => {
    const { pool, released } = brokenClient(/INSERT INTO prompts/, duplicate, true);
    const backend = new PostgresStateBackend({ pool, ownerSub: 'u' });
    // The caller still gets the conflict, but the connection may be in an unknown state.
    await expect(backend.put(stored('x'), 'create')).rejects.toThrow(PromptConflictError);
    expect(released).toEqual([true]);
  });

  it('puts a connection whose rollback worked back', async () => {
    const { pool, released } = brokenClient(/INSERT INTO prompts/, duplicate, false);
    const backend = new PostgresStateBackend({ pool, ownerSub: 'u' });
    await expect(backend.put(stored('x'), 'create')).rejects.toThrow(PromptConflictError);
    expect(released).toEqual([false]);
  });

  it('does the same for a failure that is not a conflict', async () => {
    const { pool, released } = brokenClient(/INSERT INTO prompts/, new Error('boom'), true);
    const backend = new PostgresStateBackend({ pool, ownerSub: 'u' });
    await expect(backend.put(stored('x'), 'create')).rejects.toThrow(PromptStorageError);
    expect(released).toEqual([true]);
  });
});

describe('createPostgresPool', () => {
  const options = (pool: Pool) => pool.options as { statement_timeout?: number; query_timeout?: number };

  it('limits every query on the client by default and by option', () => {
    const url = 'postgresql://u:p@127.0.0.1:1/d';
    const standard = createPostgresPool(url);
    const quick = createPostgresPool(url, { queryTimeoutMs: 2_500 });
    expect(options(standard).query_timeout).toBeGreaterThan(10_000);
    expect(options(quick).query_timeout).toBeGreaterThan(2_500);
    void standard.end();
    void quick.end();
  });

  it('does not send statement_timeout as a startup parameter, which a pooler in transaction mode refuses', async () => {
    const pool = createPostgresPool('postgresql://u:p@127.0.0.1:1/d');
    expect(options(pool).statement_timeout).toBeUndefined();
    void pool.end();

    // What a server actually receives when a connection opens.
    const received: string[] = [];
    const server = net.createServer(socket => {
      socket.once('data', data => { received.push(data.toString('latin1')); socket.destroy(); });
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as net.AddressInfo).port;
    const real = createPostgresPool(`postgresql://u:p@127.0.0.1:${port}/d`, { queryTimeoutMs: 2_500 });
    await real.query('SELECT 1').catch(() => undefined);
    await real.end();
    await new Promise(resolve => server.close(resolve));
    expect(received.length).toBeGreaterThan(0);
    expect(received.join('')).toContain('database');
    expect(received.join('')).not.toContain('statement_timeout');
  });

  it('sets the server-side limit on each new connection instead', () => {
    const pool = createPostgresPool('postgresql://u:p@127.0.0.1:1/d', { queryTimeoutMs: 2_500 });
    const sent: string[] = [];
    pool.emit('connect', { query: (sql: string) => { sent.push(sql); return Promise.resolve({ rows: [] }); } } as unknown as PoolClient);
    expect(sent).toEqual(['SET statement_timeout = 2500']);
    void pool.end();
  });

  it('logs a refused SET by its code only and carries on', async () => {
    const pool = createPostgresPool('postgresql://u:p@127.0.0.1:1/d');
    const refusal = Object.assign(new Error('permission denied for leaky_user at 10.9.8.7'), { code: '42501' });
    const output = await logged(async () => {
      pool.emit('connect', { query: () => Promise.reject(refusal) } as unknown as PoolClient);
      await new Promise(resolve => setTimeout(resolve, 20));
    });
    void pool.end();
    expect(output).toContain('42501');
    expect(output).not.toContain('leaky_user');
    expect(output).not.toContain('10.9.8.7');
  });
});

describe('PostgresStateBackend when a query times out on the client', () => {
  it('does not wait for a rollback on a connection that stopped answering, and throws it away', async () => {
    const released: unknown[] = [];
    const client = {
      query: (sql: string) => {
        if (sql === 'ROLLBACK') return new Promise(() => undefined);
        if (/INSERT INTO prompts/.test(sql)) return Promise.reject(new Error('Query read timeout'));
        return Promise.resolve({ rows: [], rowCount: 1 });
      },
      release: (arg?: unknown) => { released.push(arg); },
    };
    const pool = { connect: async () => client, query: async () => ({ rows: [] }) } as unknown as Pool;
    const backend = new PostgresStateBackend({ pool, ownerSub: 'u' });
    const error = await backend.put(stored('x'), 'create').catch(err => err);
    expect(error).toBeInstanceOf(PromptStorageError);
    expect(error.message).toMatch(/nothing was changed/);
    expect(error.message).not.toContain('read timeout');
    expect(released).toEqual([true]);
  });
});

describe('PostgresStateBackend when the answer to COMMIT never comes', () => {
  const clientWhere = (failing: (sql: string) => boolean) => {
    const released: unknown[] = [];
    const client = {
      query: (sql: string) => (failing(sql) ? Promise.reject(new Error('Query read timeout')) : Promise.resolve({ rows: [], rowCount: 1 })),
      release: (arg?: unknown) => { released.push(arg); },
    };
    return { pool: { connect: async () => client, query: async () => ({ rows: [] }) } as unknown as Pool, released };
  };

  it('says the change may have been saved, because the database may have committed it', async () => {
    const { pool, released } = clientWhere(sql => sql === 'COMMIT');
    const backend = new PostgresStateBackend({ pool, ownerSub: 'u' });
    const error = await backend.put(stored('x'), 'create').catch(err => err);
    expect(error).toBeInstanceOf(PromptStorageError);
    expect(error.message).toMatch(/may not have been saved/);
    expect(error.message).not.toMatch(/nothing was changed/);
    expect(error.message).not.toContain('read timeout');
    expect(released).toEqual([true]);
  });

  it('still says nothing was changed when the failure came before COMMIT', async () => {
    const { pool } = clientWhere(sql => /INSERT INTO prompts/.test(sql));
    const error = await new PostgresStateBackend({ pool, ownerSub: 'u' }).put(stored('x'), 'create').catch(err => err);
    expect(error.message).toMatch(/nothing was changed/);
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

  const storeFor = async (backend: PostgresStateBackend, refreshIntervalMs?: number) => {
    const store = new PromptStore();
    store.load({ promptsDir: library });
    await store.useBackend(backend, { refreshIntervalMs });
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

  describe('several servers for one owner', () => {
    it('see each other\'s changes after the refresh interval, without being asked', async () => {
      const owner = newOwner('shared');
      const a = await storeFor(backendFor(owner), 50);
      const b = await storeFor(backendFor(owner), 50);
      await add(a, 'from-a');
      await b.add({ id: 'from-b', name: 'From B', content: 'c', isTemplate: false, tags: [] });
      // Reads trigger the checks; the changes arrive within a moment.
      await vi.waitFor(() => expect(b.get('from-a').name).toBe('from-a'));
      await vi.waitFor(() => expect(a.get('from-b').name).toBe('From B'));
      await a.delete('lib-a');
      await vi.waitFor(() => expect(() => b.get('lib-a')).toThrow(PromptNotFoundError));
    });

    it('never see another owner\'s changes', async () => {
      const one = await storeFor(backendFor(newOwner('owner-one')), 20);
      const two = await storeFor(backendFor(newOwner('owner-two')), 20);
      await add(one, 'private-to-one');
      await one.update('lib-b', { name: 'Edited by one' });
      await one.delete('lib-a');
      await new Promise(resolve => setTimeout(resolve, 60));
      await two.sync();
      expect(() => two.get('private-to-one')).toThrow(PromptNotFoundError);
      expect(two.get('lib-b').name).toBe('Library B');
      expect(two.get('lib-a').name).toBe('Library A');
      expect(two.size).toBe(2);
    });

    it('recover from a conflict: after another server changed a prompt, a retry goes through', async () => {
      const owner = newOwner('heal');
      const a = await storeFor(backendFor(owner), 60_000);
      const b = await storeFor(backendFor(owner), 60_000);
      await add(a, 'doc');
      await b.sync();
      await b.update('doc', { name: 'By B' });
      await expect(a.update('doc', { content: 'By A' })).rejects.toThrow(PromptStaleError);
      expect(a.get('doc').name).toBe('By B');
      const retried = await a.update('doc', { content: 'By A' });
      expect(retried).toMatchObject({ name: 'By B', content: 'By A', version: 3 });
      await b.sync();
      expect(b.get('doc')).toMatchObject({ name: 'By B', content: 'By A', version: 3 });
    });
  });

  describe('text Postgres cannot keep', () => {
    it('rejects a NUL character with a usage error (a 400), and saves nothing', async () => {
      const owner = newOwner('nul');
      const backend = backendFor(owner);
      const store = await storeFor(backend);
      await add(store, 'fine');
      const revision = await backend.revision();
      const fields = [
        { name: 'N', content: 'before\u0000after' },
        { name: 'N\u0000', content: 'c' },
        { name: 'N', content: 'c', tags: ['t\u0000'] },
        { name: 'N', content: 'c', metadata: { 'k\u0000': 'v' } },
      ];
      for (const input of fields) {
        const error = await store.add({ id: 'nul', isTemplate: false, tags: [], ...input }).catch(err => err);
        expect(error).toBeInstanceOf(PromptUsageError);
        expect(error.message).toMatch(/NUL/);
        expect(error.message).not.toContain('before');
      }
      await expect(store.update('fine', { content: 'x\u0000y' })).rejects.toThrow(PromptUsageError);
      expect(store.get('fine').version).toBe(1);
      expect(() => store.get('nul')).toThrow(PromptNotFoundError);
      expect(await backend.revision()).toBe(revision);
    });

    it('rejects a lone surrogate the same way', async () => {
      const store = await storeFor(backendFor(newOwner('surrogate')));
      await expect(add(store, 'lone').then(() => store.update('lone', { content: 'broken \ud800 text' }))).rejects.toThrow(PromptUsageError);
    });

    it('keeps text that merely looks like an escape', async () => {
      const store = await storeFor(backendFor(newOwner('escape')));
      await store.add({ id: 'text', name: 'Text', content: 'a literal \\u0000 and a pair \ud83d\ude00', isTemplate: false, tags: [] });
      expect(store.get('text').content).toContain('\\u0000');
    });
  });

  describe('migrations in a database of their own', () => {
    const schemas: string[] = [];
    const tmpDirs: string[] = [];
    /** A pool whose connections see an empty schema only. */
    const emptyDatabase = async () => {
      const schema = `mig_${run}_${schemas.length}`;
      schemas.push(schema);
      await pool.query(`CREATE SCHEMA ${schema}`);
      const scoped = new Pool({ connectionString: DATABASE_URL, options: `-c search_path=${schema}`, max: 5 });
      const tables = async () => (await pool.query('SELECT table_name FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name', [schema])).rows.map(row => row.table_name as string);
      return { scoped, tables };
    };
    afterAll(async () => {
      for (const schema of schemas) await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
    });

    it('applied by two runners starting together on an empty database, are applied once', async () => {
      const { scoped, tables } = await emptyDatabase();
      try {
        const results = await Promise.all([runMigrations(scoped), runMigrations(scoped), runMigrations(scoped)]);
        expect(results.filter(applied => applied.length > 0)).toEqual([['001_prompts.sql']]);
        expect((await scoped.query('SELECT name FROM schema_migrations')).rows).toEqual([{ name: '001_prompts.sql' }]);
        expect(await tables()).toEqual(['prompts', 'revisions', 'schema_migrations', 'tombstones']);
      } finally {
        await scoped.end();
      }
    });

    it('roll back everything when one file fails, and leave the connection usable', async () => {
      const { scoped, tables } = await emptyDatabase();
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migrations-bad-'));
      tmpDirs.push(dir);
      fs.writeFileSync(path.join(dir, '001_ok.sql'), 'CREATE TABLE first_table (id int);');
      fs.writeFileSync(path.join(dir, '002_bad.sql'), 'CREATE TABLE second_table (id int); SELECT * FROM table_that_does_not_exist;');
      try {
        const error = await runMigrations(scoped, dir).catch(err => err);
        expect(error).toBeInstanceOf(PromptStorageError);
        expect(error.message).toMatch(/migrations/);
        expect(error.message).not.toContain('table_that_does_not_exist');
        // Not even the first file or the record of it: the whole run was one transaction.
        expect(await tables()).toEqual([]);
        // Fixed, the same directory applies in full.
        fs.writeFileSync(path.join(dir, '002_bad.sql'), 'CREATE TABLE second_table (id int);');
        expect(await runMigrations(scoped, dir)).toEqual(['001_ok.sql', '002_bad.sql']);
        expect(await tables()).toEqual(['first_table', 'schema_migrations', 'second_table']);
      } finally {
        await scoped.end();
      }
    });
  });

  /** The test database's URL with a role and a schema of its own, for a pool that must see that schema only. */
  const urlFor = (schema: string, credentials?: { user: string; password: string }) => {
    const url = new URL(DATABASE_URL!);
    if (credentials) {
      url.username = credentials.user;
      url.password = credentials.password;
    }
    url.searchParams.set('options', `-c search_path=${schema}`);
    return url.toString();
  };

  describe('a database that stops answering', () => {
    const schema = `hang_${run}`;
    let setup: Pool;
    let fast: Pool;
    let holder: PoolClient | undefined;

    beforeAll(async () => {
      await pool.query(`CREATE SCHEMA ${schema}`);
      setup = new Pool({ connectionString: urlFor(schema), max: 2 });
      await runMigrations(setup);
      fast = createPostgresPool(urlFor(schema), { queryTimeoutMs: 300 });
      await setup.query('SELECT 1');
    });
    afterAll(async () => {
      await release();
      await fast.end();
      await setup.end();
      await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    });

    /** Holds the table that every revision check and write touches, as a stuck transaction would. */
    const hold = async () => {
      holder = await pool.connect();
      await holder.query('BEGIN');
      await holder.query(`LOCK TABLE ${schema}.revisions IN ACCESS EXCLUSIVE MODE`);
    };
    const release = async () => {
      if (!holder) return;
      await holder.query('ROLLBACK').catch(() => undefined);
      holder.release();
      holder = undefined;
    };
    const timed = async <T>(work: Promise<T>): Promise<{ result: T | Error; ms: number }> => {
      const started = Date.now();
      const result = await work.catch(err => err as Error);
      return { result, ms: Date.now() - started };
    };

    it('has the server-side limit on every connection of the pool, from the first query on', async () => {
      const limited = createPostgresPool(urlFor(schema), { queryTimeoutMs: 2_500 });
      try {
        // Two connections at once, so the second one is opened by the pool too.
        const [first, second] = await Promise.all([limited.query('SHOW statement_timeout'), limited.query('SHOW statement_timeout')]);
        expect(first.rows[0].statement_timeout).toBe('2500ms');
        expect(second.rows[0].statement_timeout).toBe('2500ms');
      } finally {
        await limited.end();
      }
    });

    it('fails a revision check, a health check and a write within the bound, and queues nothing behind them', async () => {
      const owner = newOwner('hang-bound');
      const store = await storeFor(backendFor(owner, fast), 60_000);
      await hold();
      try {
        const revision = await timed(backendFor(owner, fast).revision());
        expect(revision.result).toBeInstanceOf(PromptStorageError);
        expect(revision.ms).toBeLessThan(3_000);
        const health = await timed(store.checkStorage());
        expect(health.result).toBeInstanceOf(PromptStorageError);
        expect(health.ms).toBeLessThan(3_000);
        // Two writes to one prompt id: the second must not wait for a first that never ends.
        const first = await timed(store.add({ id: 'stuck', name: 'S', content: 'c', isTemplate: false, tags: [] }));
        const second = await timed(store.add({ id: 'stuck', name: 'S', content: 'c', isTemplate: false, tags: [] }));
        for (const write of [first, second]) {
          expect(write.result).toBeInstanceOf(PromptStorageError);
          expect((write.result as Error).message).toMatch(/nothing was changed/);
          expect(write.ms).toBeLessThan(3_000);
        }
        expect(() => store.get('stuck')).toThrow(PromptNotFoundError);
      } finally {
        await release();
      }
      // The pool is whole again: the same store writes once the database answers.
      await store.add({ id: 'after', name: 'After', content: 'c', isTemplate: false, tags: [] });
      expect(store.get('after').name).toBe('After');
    });

    it('lets the background check recover when the database answers again', async () => {
      const owner = newOwner('hang-recover');
      const store = await storeFor(backendFor(owner, fast), 20);
      // Another server of the same owner, over the same schema but without the short limits.
      const other = await storeFor(backendFor(owner, setup), 60_000);
      await hold();
      try {
        // Reads start checks that fail against the held table.
        for (let i = 0; i < 6; i++) {
          store.list();
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } finally {
        await release();
      }
      await add(other, 'while-away');
      await vi.waitFor(() => expect(store.get('while-away').name).toBe('while-away'), { timeout: 5_000 });
    }, 15_000);
  });

  describe('a role that may not create anything', () => {
    const schema = `role_${run}`;
    const credentials = { user: `limited_${run}`, password: crypto.randomBytes(12).toString('hex') };
    let setup: Pool;

    beforeAll(async () => {
      await pool.query(`CREATE SCHEMA ${schema}`);
      setup = new Pool({ connectionString: urlFor(schema), max: 2 });
      await runMigrations(setup);
      // Hex only, so nothing here can be anything but a name and a password.
      await pool.query(`CREATE ROLE ${credentials.user} LOGIN PASSWORD '${credentials.password}'`);
      await pool.query(`GRANT USAGE ON SCHEMA ${schema} TO ${credentials.user}`);
      await pool.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ${schema} TO ${credentials.user}`);
    });
    afterAll(async () => {
      await setup.end();
      await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await pool.query(`DROP OWNED BY ${credentials.user}`);
      await pool.query(`DROP ROLE IF EXISTS ${credentials.user}`);
    });

    it('starts once the migrations are applied, and reads and writes its own rows', async () => {
      const limited = createPostgresPool(urlFor(schema, credentials));
      try {
        // The role really cannot create (so that this test means something).
        await expect(limited.query('CREATE TABLE should_not_exist (id int)')).rejects.toBeTruthy();
        expect(await runMigrations(limited)).toEqual([]);
        const owner = newOwner('limited');
        const store = await storeFor(backendFor(owner, limited));
        await add(store, 'by-limited');
        await store.update('by-limited', { name: 'Edited' });
        await store.delete('by-limited');
        expect(await backendFor(owner, limited).revision()).toBe('3');
      } finally {
        await limited.end();
      }
    });
  });

  describe('opened read-only', () => {
    it('serves what is saved and what others save, refuses changes, and reports memory like a read-only state directory', async () => {
      const owner = newOwner('readonly');
      const writer = await storeFor(backendFor(owner), 60_000);
      await add(writer, 'saved-before');
      const store = new PromptStore();
      store.load({ promptsDir: library });
      await store.useBackend(new PostgresStateBackend({ pool, ownerSub: owner, readOnly: true }), { refreshIntervalMs: 60_000 });
      expect(store.get('saved-before').name).toBe('saved-before');
      expect(store.storage).toBe('memory');
      expect(store.stats().storage).toBe('memory');
      await expect(add(store, 'nope')).rejects.toThrow(PromptUsageError);
      await expect(store.delete('lib-a')).rejects.toThrow(PromptUsageError);
      await add(writer, 'saved-after');
      await store.sync();
      expect(store.get('saved-after').name).toBe('saved-after');
    });

    it('is refused at the backend as well, with nothing written', async () => {
      const owner = newOwner('readonly-backend');
      const backend = new PostgresStateBackend({ pool, ownerSub: owner, readOnly: true });
      expect(backend.writable).toBe(false);
      await expect(backend.put(stored('x'), 'create')).rejects.toThrow(PromptStorageError);
      await expect(backend.remove('x', true)).rejects.toThrow(/read-only/);
      expect(await backend.revision()).toBe('0');
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

    it('reports an outage once, however often the store and the health check ask', async () => {
      const { state, source } = flaky();
      const store = await storeFor(backendFor(newOwner('outage'), source), 1);
      /** What an operator would see at the default log level: everything above debug. */
      const reported = async (fn: () => Promise<unknown>): Promise<string[]> => {
        const lines: string[] = [];
        const spies = (['info', 'warn', 'error'] as const).map(level =>
          vi.spyOn(logger, level).mockImplementation(((...args: unknown[]) => { lines.push(`${level} ${JSON.stringify(args)}`); }) as never)
        );
        try {
          await fn();
        } finally {
          spies.forEach(spy => spy.mockRestore());
        }
        return lines;
      };
      state.broken = true;
      const outage = await reported(async () => {
        for (let i = 0; i < 5; i++) {
          await store.sync();
          await store.checkStorage().catch(() => undefined);
        }
      });
      // One line from the backend and one from the store; the rest of the failed checks say nothing.
      expect(outage.length).toBeLessThanOrEqual(2);
      expect(outage.length).toBeGreaterThan(0);
      state.broken = false;
      await store.sync();
      // Once it is back, a new outage is reported again.
      state.broken = true;
      const second = await reported(async () => { await store.sync(); await store.sync(); });
      state.broken = false;
      expect(second.length).toBeGreaterThan(0);
      expect(second.length).toBeLessThanOrEqual(2);
      for (const line of [...outage, ...second]) for (const secret of ['leaky_user', '10.9.8.7', 'password']) expect(line).not.toContain(secret);
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
