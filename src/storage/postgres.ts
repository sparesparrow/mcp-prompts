import * as fs from 'fs';
import * as path from 'path';
import { Pool, type PoolClient } from 'pg';
import { PromptConflictError, PromptStorageError, staleChangeError, type StateBackend, type StateSnapshot } from '../state-backend.js';
import type { StoredPrompt } from '../prompt-store.js';
import { logger } from '../utils.js';

// Saved prompts in Postgres, for one owner. Nothing here puts the connection string, host, user or
// the driver's own message into an error or a log line: those can carry them. A failure is logged
// and reported by its code (a SQLSTATE such as 28P01, or a system code such as ECONNREFUSED) only.

/** Where the numbered .sql files are, from src/storage and from dist/storage alike. */
const MIGRATIONS_DIR = path.resolve(__dirname, '../../migrations');

/** One number for every process that migrates this kind of database, taken for the transaction. */
const MIGRATION_LOCK = 726_201_001;

const UNIQUE_VIOLATION = '23505';

/** The code of a failure, if it looks like one; the message of an error is never used. */
function errorCode(error: unknown): string | undefined {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' && /^[A-Za-z0-9_]{1,32}$/.test(code) ? code : undefined;
}

/** Logs a failure by its code and throws the error callers get, which has no driver text. */
function fail(what: string, error: unknown, consequence: string): never {
  const code = errorCode(error);
  logger.error({ code }, `Postgres state backend: could not ${what}`);
  throw new PromptStorageError(`Could not ${what}${code ? ` (${code})` : ''}${consequence}`);
}

/** A pool for the given connection string. An idle connection that drops is logged by code only. */
export function createPostgresPool(connectionString: string): Pool {
  const pool = new Pool({ connectionString, max: 5, connectionTimeoutMillis: 10_000 });
  pool.on('error', error => {
    logger.warn({ code: errorCode(error) }, 'Postgres state backend: an idle connection failed');
  });
  return pool;
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
      await client.query('ROLLBACK').catch(() => undefined);
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
  readonly writable = true;
  private readonly pool: Pool;
  private readonly ownerSub: string;

  constructor(options: PostgresStateBackendOptions) {
    this.pool = options.pool;
    this.ownerSub = options.ownerSub;
  }

  async load(): Promise<StateSnapshot> {
    let client: PoolClient | undefined;
    let failed = false;
    try {
      client = await this.pool.connect();
      // One snapshot for both reads, so a write between them cannot show half of itself.
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      try {
        const rows = await client.query('SELECT id, body FROM prompts WHERE owner_sub = $1 ORDER BY id', [this.ownerSub]);
        const tombstones = await client.query('SELECT id FROM tombstones WHERE owner_sub = $1 ORDER BY id', [this.ownerSub]);
        const prompts: StoredPrompt[] = [];
        for (const row of rows.rows) {
          if (isPrompt(row.body, row.id)) prompts.push(row.body);
          else logger.warn(`Skipped saved prompt ${row.id}: it is not a usable prompt`);
        }
        return { prompts, tombstones: tombstones.rows.map(row => row.id as string) };
      } finally {
        await client.query('ROLLBACK').catch(() => undefined);
      }
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
      return result.rows[0] ? String(result.rows[0].rev) : '0';
    } catch (error) {
      return fail('check the database for changes', error, '');
    }
  }

  async put(prompt: StoredPrompt, mode: 'create' | 'replace', expectedVersion?: string | null): Promise<void> {
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
    let client: PoolClient | undefined;
    let failed = false;
    try {
      client = await this.pool.connect();
      await client.query('BEGIN');
      try {
        await client.query(
          'INSERT INTO revisions (owner_sub, rev) VALUES ($1, 1) ON CONFLICT (owner_sub) DO UPDATE SET rev = revisions.rev + 1',
          [this.ownerSub]
        );
        await change(client);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
      }
    } catch (error) {
      if (error instanceof PromptConflictError) throw error;
      failed = true;
      fail(what, error, '; nothing was changed');
    } finally {
      client?.release(failed);
    }
  }
}
