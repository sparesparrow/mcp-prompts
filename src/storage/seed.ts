import { PromptConflictError, PromptStore, PromptUsageError } from '../prompt-store.js';
import { PostgresStateBackend, createPostgresPool, runMigrations } from './postgres.js';

export interface SeedOptions {
  /** The database. Used to connect and never reported. */
  databaseUrl: string;
  /** Whose prompts these become. */
  ownerSub: string;
  /** A prompts directory, read recursively like the library. */
  dir: string;
}

export interface SeedCounts {
  /** Prompts saved. */
  imported: number;
  /** Prompts the owner already had, left as they are. */
  skipped: number;
  /** Prompts the database cannot keep (a NUL character, say). */
  rejected: number;
}

/**
 * Copies the prompts of a directory into the database for one owner, once: an id the owner
 * already has is left alone (it may have been edited since), so running it again changes nothing.
 * Applies the migrations first. Throws a PromptStorageError, which names no connection detail,
 * when the database cannot be used.
 */
export async function seedFromDirectory(options: SeedOptions): Promise<SeedCounts> {
  const library = new PromptStore();
  library.loadDirectory(options.dir);
  const pool = createPostgresPool(options.databaseUrl);
  try {
    await runMigrations(pool);
    const backend = new PostgresStateBackend({ pool, ownerSub: options.ownerSub });
    const existing = new Set((await backend.load()).prompts.map(prompt => prompt.id));
    const counts: SeedCounts = { imported: 0, skipped: 0, rejected: 0 };
    for (const prompt of library.all()) {
      if (existing.has(prompt.id)) {
        counts.skipped++;
        continue;
      }
      try {
        await backend.put(prompt, 'create');
        counts.imported++;
      } catch (error) {
        // Saved by someone else a moment ago counts as already there.
        if (error instanceof PromptConflictError) counts.skipped++;
        else if (error instanceof PromptUsageError) counts.rejected++;
        else throw error;
      }
    }
    return counts;
  } finally {
    await pool.end().catch(() => undefined);
  }
}
