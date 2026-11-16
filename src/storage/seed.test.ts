import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Pool } from 'pg';
import { PostgresStateBackend, createPostgresPool, runMigrations } from './postgres';
import { seedFromDirectory } from './seed';

const SCRIPT = path.resolve(__dirname, '../../scripts/seed-postgres.mjs');
const DATABASE_URL = process.env.TEST_DATABASE_URL;

/** Runs the script with exactly this environment, so that nothing of the developer's shell leaks in. */
const runScript = (args: string[], env: Record<string, string> = {}) =>
  spawnSync(process.execPath, [SCRIPT, ...args], { env: { PATH: process.env.PATH ?? '', ...env }, encoding: 'utf8' });

describe('scripts/seed-postgres.mjs', () => {
  it('refuses to run without DATABASE_URL', () => {
    const result = runScript(['somewhere', '--owner', 'me']);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('DATABASE_URL');
    expect(result.stdout).toBe('');
  });

  it('refuses to run without --owner', () => {
    const result = runScript(['somewhere'], { DATABASE_URL: 'postgresql://leaky_user:leaky_pw@127.0.0.1:1/leaky_db' });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('--owner');
    for (const secret of ['leaky_user', 'leaky_pw', 'leaky_db']) expect(result.stderr).not.toContain(secret);
  });

  it('refuses an empty owner, and a missing directory', () => {
    const env = { DATABASE_URL: 'postgresql://u:p@127.0.0.1:1/d' };
    expect(runScript(['somewhere', '--owner', '  '], env).status).toBe(2);
    const noDir = runScript(['--owner', 'me'], env);
    expect(noDir.status).toBe(2);
    expect(noDir.stderr).toContain('directory');
  });

  it('says what it needs with --help, and connects to nothing', () => {
    const result = runScript(['--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/seed-postgres\.mjs <prompts-dir> --owner <owner>/);
  });
});

describe.skipIf(!DATABASE_URL)('seedFromDirectory', () => {
  let pool: Pool;
  let root: string;
  const owners: string[] = [];
  const run = crypto.randomBytes(4).toString('hex');
  const newOwner = (label: string) => {
    const owner = `test-${run}-seed-${label}`;
    owners.push(owner);
    return owner;
  };

  beforeAll(async () => {
    pool = createPostgresPool(DATABASE_URL!);
    await runMigrations(pool);
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'prompts-seed-'));
    fs.mkdirSync(path.join(root, 'group'), { recursive: true });
    fs.writeFileSync(path.join(root, 'one.json'), JSON.stringify({ id: 'one', name: 'One', content: 'first', version: '1.0.0' }));
    fs.writeFileSync(path.join(root, 'group', 'two.json'), JSON.stringify({ id: 'two', name: 'Two', content: 'second', isTemplate: true, tags: ['t'] }));
    fs.writeFileSync(path.join(root, 'broken.json'), '{ not json');
    fs.writeFileSync(path.join(root, 'has-nul.json'), JSON.stringify({ id: 'nul', name: 'Nul', content: 'a\u0000b' }));
  });
  afterAll(async () => {
    for (const table of ['prompts', 'tombstones', 'revisions']) {
      await pool.query(`DELETE FROM ${table} WHERE owner_sub = ANY($1)`, [owners]);
    }
    await pool.end();
    fs.rmSync(root, { recursive: true, force: true });
  });

  const saved = async (owner: string) => (await new PostgresStateBackend({ pool, ownerSub: owner }).load()).prompts;

  it('imports every usable prompt under the owner, and counts what it did not', async () => {
    const owner = newOwner('basic');
    const counts = await seedFromDirectory({ databaseUrl: DATABASE_URL!, ownerSub: owner, dir: root });
    expect(counts).toEqual({ imported: 2, skipped: 0, rejected: 1 });
    const prompts = await saved(owner);
    expect(prompts.map(prompt => prompt.id)).toEqual(['one', 'two']);
    expect(prompts.find(prompt => prompt.id === 'one')).toMatchObject({ content: 'first', version: '1.0.0' });
    const row = await pool.query('SELECT version FROM prompts WHERE owner_sub = $1 AND id = $2', [owner, 'two']);
    expect(row.rows[0].version).toBe('1');
  });

  it('is idempotent: a second run skips what exists and never overwrites it', async () => {
    const owner = newOwner('again');
    await seedFromDirectory({ databaseUrl: DATABASE_URL!, ownerSub: owner, dir: root });
    const backend = new PostgresStateBackend({ pool, ownerSub: owner });
    await backend.put({ ...(await saved(owner)).find(prompt => prompt.id === 'one')!, content: 'edited since', version: '1.0.1' }, 'replace', '1.0.0');
    const revision = await backend.revision();
    const counts = await seedFromDirectory({ databaseUrl: DATABASE_URL!, ownerSub: owner, dir: root });
    expect(counts).toEqual({ imported: 0, skipped: 2, rejected: 1 });
    expect((await saved(owner)).find(prompt => prompt.id === 'one')!.content).toBe('edited since');
    // Nothing was written, so other servers are not told to read again.
    expect(await backend.revision()).toBe(revision);
  });

  it('lets running servers see the import, and keeps other owners out of it', async () => {
    const owner = newOwner('visible');
    const other = newOwner('other');
    const backend = new PostgresStateBackend({ pool, ownerSub: owner });
    const before = await backend.revision();
    await seedFromDirectory({ databaseUrl: DATABASE_URL!, ownerSub: owner, dir: root });
    expect(await backend.revision()).not.toBe(before);
    expect(await saved(other)).toEqual([]);
  });

  it('fails without connection details when the database cannot be reached', async () => {
    const error = await seedFromDirectory({ databaseUrl: 'postgresql://leaky_user:leaky_pw@127.0.0.1:1/leaky_db', ownerSub: 'x', dir: root }).catch(err => err);
    expect(error).toBeInstanceOf(Error);
    for (const secret of ['leaky_user', 'leaky_pw', 'leaky_db']) expect(error.message).not.toContain(secret);
  });
});
