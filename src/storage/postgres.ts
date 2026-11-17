import * as fs from 'fs';
import * as path from 'path';
import { Pool, type PoolClient } from 'pg';
import { PromptConflictError, PromptStorageError, staleChangeError, type StateBackend, type StateSnapshot } from '../state-backend.js';
import { PromptUsageError, type StoredPrompt } from '../prompt-store.js';
import { logger } from '../utils.js';

// Saved prompts in Postgres, for one owner. Nothing here puts the connection string, host, user or
// the driver's own message into an error or a log line: those can carry them. A failure is logged
// and reported by its code (a SQLSTATE such as 28P01, or a system code such as ECONNREFUSED) only.

/** Where the numbered .sql files are, from src/storage and from dist/storage alike. */
const MIGRATIONS_DIR = path.resolve(__dirname, '../../migrations');

/** One number for every process that migrates this kind of database, taken for the transaction. */
const MIGRATION_LOCK = 726_201_001;

const UNIQUE_VIOLATION = '23505';

/** The driver gave up waiting for an answer: the connection may still be busy with the query. */
function timedOutOnClient(error: unknown): boolean {
  return error instanceof Error && error.message === 'Query read timeout';
}

/** The code of a failure, if it looks like one; the message of an error is never used. */
function errorCode(error: unknown): string | undefined {
  if (timedOutOnClient(error)) return 'QUERY_TIMEOUT';
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' && /^[A-Za-z0-9_]{1,32}$/.test(code) ? code : undefined;
}

/**
 * Rolls a transaction back. Returns false when the connection cannot be trusted afterwards: the
 * rollback failed, or the query before it timed out on the client, in which case the connection
 * is busy and a rollback would only wait behind it.
 */
async function rollback(client: PoolClient, cause: unknown): Promise<boolean> {
  if (timedOutOnClient(cause)) return false;
  try {
    await client.query('ROLLBACK');
    return true;
  } catch {
    return false;
  }
}

/**
 * Logs a failure by its code and throws the error callers get, which has no driver text. With
 * report false the log line is left to debug level: for a check that is repeated while the
 * database is down, which says so once.
 */
function fail(what: string, error: unknown, consequence: string, report = true): never {
  const code = errorCode(error);
  logger[report ? 'error' : 'debug']({ code }, `Postgres state backend: could not ${what}`);
  throw new PromptStorageError(`Could not ${what}${code ? ` (${code})` : ''}${consequence}`);
}

/** How long a statement may run before the server stops it, unless the pool is made with another limit. */
export const QUERY_TIMEOUT_MS = 10_000;

export interface PostgresPoolOptions {
  /**
   * The longest a statement may run. The server stops it after this long (a lock held by someone
   * else counts; set with SET on each new connection, not as a startup parameter, which a pooler
   * in transaction mode such as Neon's -pooler endpoint refuses), and the driver gives up a second
   * later on a connection that stopped answering, so no call waits for ever. Defaults to QUERY_TIMEOUT_MS.
   */
  queryTimeoutMs?: number;
}

/** A pool for the given connection string. An idle connection that drops is logged by code only. */
export function createPostgresPool(connectionString: string, options: PostgresPoolOptions = {}): Pool {
  const limit = options.queryTimeoutMs ?? QUERY_TIMEOUT_MS;
  const pool = new Pool({ connectionString, max: 5, connectionTimeoutMillis: 10_000, query_timeout: limit + 1_000 });
  // Queued on the connection before anything the caller sends. If it is refused the driver's
  // query_timeout still bounds every call; only the code is logged.
  const statementTimeout = `SET statement_timeout = ${Math.max(1, Math.trunc(limit))}`;
  pool.on('connect', client => {
    Promise.resolve(client.query(statementTimeout)).catch(error => {
      logger.warn({ code: errorCode(error) }, 'Postgres state backend: could not set the statement timeout on a connection');
    });
  });
  pool.on('error', error => {
    logger.warn({ code: errorCode(error) }, 'Postgres state backend: an idle connection failed');
  });
  return pool;
}

/** Whether schema_migrations exists and lists every file. Only reads. */
async function allApplied(pool: Pool, files: string[]): Promise<boolean> {
  const exists = await pool.query("SELECT to_regclass('schema_migrations') AS name");
  if (!exists.rows[0]?.name) return false;
  const done = new Set((await pool.query('SELECT name FROM schema_migrations')).rows.map(row => row.name as string));
  return files.every(name => done.has(name));
}

/**
 * Applies the .sql files in dir that were not applied yet, in name order, in one transaction, and
 * records them in schema_migrations. Returns the names it applied (none on a second run). Safe to
 * start from several processes at once.
 */
export async function runMigrations(pool: Pool, dir: string = MIGRATIONS_DIR): Promise<string[]> {
  let client: PoolClient | undefined;
  let failed = false;
  try {
    const files = fs.readdirSync(dir).filter(name => name.endsWith('.sql')).sort();
    // Every statement below that creates something needs the right to create in the schema, even
    // CREATE ... IF NOT EXISTS on a table that exists. A role that may only read and write rows
    // must still start, so when everything is applied nothing is run that could need it.
    if (await allApplied(pool, files)) return [];
    client = await pool.connect();
    await client.query('BEGIN');
    try {
      await client.query('SELECT pg_advisory_xact_lock($1)', [MIGRATION_LOCK]);
      await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
      const done = new Set((await client.query('SELECT name FROM schema_migrations')).rows.map(row => row.name as string));
      const applied: string[] = [];
      for (const name of files) {
        if (done.has(name)) continue;
        await client.query(fs.readFileSync(path.join(dir, name), 'utf8'));
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
        applied.push(name);
      }
      await client.query('COMMIT');
      return applied;
    } catch (error) {
      if (!(await rollback(client, error))) failed = true;
      throw error;
    }
  } catch (error) {
    failed = true;
    return fail('run the database migrations', error, '; the database was left as it was');
  } finally {
    client?.release(failed);
  }
}

export interface PostgresStateBackendOptions {
  /** The connection pool; the caller creates it and ends it. */
  pool: Pool;
  /** Whose prompts these are. Every statement is limited to this owner; it never comes from a request. */
  ownerSub: string;
  /** Only read: changes are refused before anything is sent to the database. */
  readOnly?: boolean;
}

const LONE_SURROGATE = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/;

/**
 * Postgres refuses the NUL character, and a lone surrogate, in jsonb text (22P05). Say so before
 * anything is written, as a problem with the input (a 400) and not as a storage failure, without
 * repeating any of the text.
 */
function assertStorable(prompt: StoredPrompt): void {
  const bad = (text: string) => text.includes('\u0000') || LONE_SURROGATE.test(text);
  JSON.stringify(prompt, (key, value) => {
    if (bad(key) || (typeof value === 'string' && bad(value))) {
      throw new PromptUsageError(
        `Prompt ${prompt.id} contains a NUL character (U+0000) or an unpaired surrogate, which the database cannot store; remove it and try again`
      );
    }
    return value;
  });
}

/** Whether a stored row is a prompt the store can serve. */
function isPrompt(body: unknown, id: string): body is StoredPrompt {
  const prompt = body as Partial<StoredPrompt> | null;
  return typeof prompt === 'object' && prompt !== null
    && prompt.id === id
    && typeof prompt.name === 'string'
    && typeof prompt.content === 'string';
}

/**
 * The saved prompts of one owner in Postgres. Every write is one transaction that first raises the
 * owner's revision, which both tells other servers to read again and makes one owner's writes
 * wait for each other, so a check made inside a write holds until it commits.
 */
export class PostgresStateBackend implements StateBackend {
  readonly kind = 'postgres' as const;
  readonly writable: boolean;
  private readonly pool: Pool;
  private readonly ownerSub: string;
  /** The last revision check failed, and said so. */
  private checkFailing = false;

  constructor(options: PostgresStateBackendOptions) {
    this.pool = options.pool;
    this.ownerSub = options.ownerSub;
    this.writable = !options.readOnly;
  }

  async load(): Promise<StateSnapshot> {
    let client: PoolClient | undefined;
    let failed = false;
    try {
      client = await this.pool.connect();
      // One snapshot for both reads, so a write between them cannot show half of itself.
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      let snapshot: StateSnapshot;
      try {
        const rows = await client.query('SELECT id, body FROM prompts WHERE owner_sub = $1 ORDER BY id', [this.ownerSub]);
        const tombstones = await client.query('SELECT id FROM tombstones WHERE owner_sub = $1 ORDER BY id', [this.ownerSub]);
        const prompts: StoredPrompt[] = [];
        for (const row of rows.rows) {
          if (isPrompt(row.body, row.id)) prompts.push(row.body);
          else logger.warn(`Skipped saved prompt ${row.id}: it is not a usable prompt`);
        }
        snapshot = { prompts, tombstones: tombstones.rows.map(row => row.id as string) };
      } catch (error) {
        if (!(await rollback(client, error))) failed = true;
        throw error;
      }
      // End the read-only transaction; a connection that cannot is not put back.
      if (!(await rollback(client, undefined))) failed = true;
      return snapshot;
    } catch (error) {
      failed = true;
      return fail('read the saved prompts from the database', error, '');
    } finally {
      client?.release(failed);
    }
  }

  async revision(): Promise<string> {
    try {
      const result = await this.pool.query('SELECT rev FROM revisions WHERE owner_sub = $1', [this.ownerSub]);
      this.checkFailing = false;
      return result.rows[0] ? String(result.rows[0].rev) : '0';
    } catch (error) {
      // Asked every couple of seconds, and by every health check: an outage is reported once.
      const first = !this.checkFailing;
      this.checkFailing = true;
      return fail('check the database for changes', error, '', first);
    }
  }

  async put(prompt: StoredPrompt, mode: 'create' | 'replace', expectedVersion?: string | null): Promise<void> {
    assertStorable(prompt);
    await this.write(`save prompt ${prompt.id}`, async client => {
      const values = [this.ownerSub, prompt.id, JSON.stringify(prompt), String(prompt.version)];
      if (mode === 'create') {
        try {
          await client.query('INSERT INTO prompts (owner_sub, id, body, version) VALUES ($1, $2, $3::jsonb, $4)', values);
        } catch (error) {
          if (errorCode(error) === UNIQUE_VIOLATION) throw new PromptConflictError(prompt.id);
          throw error;
        }
        await client.query('DELETE FROM tombstones WHERE owner_sub = $1 AND id = $2', [this.ownerSub, prompt.id]);
        return;
      }
      if (expectedVersion === undefined) {
        await client.query(
          `INSERT INTO prompts (owner_sub, id, body, version) VALUES ($1, $2, $3::jsonb, $4)
           ON CONFLICT (owner_sub, id) DO UPDATE SET body = EXCLUDED.body, version = EXCLUDED.version, updated_at = now()`,
          values
        );
        return;
      }
      if (expectedVersion === null) {
        // The first save of a library prompt: nothing saved yet, and not deleted since it was read.
        const deleted = await client.query('SELECT 1 FROM tombstones WHERE owner_sub = $1 AND id = $2', [this.ownerSub, prompt.id]);
        if (deleted.rowCount) throw staleChangeError(prompt.id);
        const inserted = await client.query(
          'INSERT INTO prompts (owner_sub, id, body, version) VALUES ($1, $2, $3::jsonb, $4) ON CONFLICT (owner_sub, id) DO NOTHING',
          values
        );
        if (!inserted.rowCount) throw staleChangeError(prompt.id);
        return;
      }
      const updated = await client.query(
        'UPDATE prompts SET body = $3::jsonb, version = $4, updated_at = now() WHERE owner_sub = $1 AND id = $2 AND version = $5',
        [...values, expectedVersion]
      );
      if (!updated.rowCount) throw staleChangeError(prompt.id);
    });
  }

  async remove(id: string, tombstone: boolean): Promise<void> {
    await this.write(`delete prompt ${id}`, async client => {
      await client.query('DELETE FROM prompts WHERE owner_sub = $1 AND id = $2', [this.ownerSub, id]);
      if (tombstone) {
        await client.query('INSERT INTO tombstones (owner_sub, id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [this.ownerSub, id]);
      }
    });
  }

  /**
   * Runs a change in a transaction that starts by raising the revision. Whatever goes wrong rolls
   * everything back; a conflict the change raised is passed on, anything else becomes a
   * PromptStorageError without the driver's words.
   */
  private async write(what: string, change: (client: PoolClient) => Promise<void>): Promise<void> {
    if (!this.writable) throw new PromptStorageError(`Could not ${what}: the database is opened read-only; nothing was changed`);
    let client: PoolClient | undefined;
    let failed = false;
    // Once COMMIT has been sent, a failure no longer says whether the database applied the change.
    let committing = false;
    try {
      client = await this.pool.connect();
      await client.query('BEGIN');
      try {
        await client.query(
          'INSERT INTO revisions (owner_sub, rev) VALUES ($1, 1) ON CONFLICT (owner_sub) DO UPDATE SET rev = revisions.rev + 1',
          [this.ownerSub]
        );
        await change(client);
        committing = true;
        await client.query('COMMIT');
      } catch (error) {
        // A connection that cannot even roll back may still hold the transaction: do not reuse it.
        if (!(await rollback(client, error))) failed = true;
        throw error;
      }
    } catch (error) {
      if (error instanceof PromptConflictError) throw error;
      failed = true;
      fail(what, error, committing ? '; the change may not have been saved: read the prompt again before repeating it' : '; nothing was changed');
    } finally {
      client?.release(failed);
    }
  }
}
