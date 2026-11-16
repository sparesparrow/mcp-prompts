import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import type { StoredPrompt } from './prompt-store.js';
import { logger } from './utils.js';

// Where a PromptStore keeps the changes made through add, update and delete. The store holds the
// served prompts in memory and reads them synchronously; a backend only persists the changes and
// hands back what earlier runs (or other servers) saved.

/** A prompt with this id already exists. */
export class PromptConflictError extends Error {
  constructor(id: string) {
    super(`A prompt with ID ${id} already exists`);
  }
}

/** A change could not be saved; the prompt was left as it was. */
export class PromptStorageError extends Error {
  constructor(message: string) {
    super(message);
  }
}

/** What a backend holds: the saved prompts, and the ids of library prompts that were deleted. */
export interface StateSnapshot {
  prompts: StoredPrompt[];
  tombstones: string[];
}

export interface StateBackend {
  readonly kind: 'file' | 'postgres';
  /** False when the backend is only read: the store then refuses changes. */
  readonly writable: boolean;
  /** Everything saved. May be asynchronous; the file backend is synchronous. */
  load(): Promise<StateSnapshot> | StateSnapshot;
  /** A token that differs whenever what is saved may have changed since it was last read. */
  revision(): Promise<string> | string;
  /**
   * Saves a prompt. 'create' must fail with PromptConflictError when the id is taken (decided by
   * the backend itself, so two servers cannot both win), and also clears a tombstone for the id;
   * 'replace' overwrites. Any other failure is a PromptStorageError, and nothing is saved.
   */
  put(prompt: StoredPrompt, mode: 'create' | 'replace'): Promise<void>;
  /** Removes a prompt; with tombstone, also remembers the id as deleted (it exists in the library). */
  remove(id: string, tombstone: boolean): Promise<void>;
}

const TOMBSTONES_FILE = '.deleted.json';

/** A temporary file this old was left by a write that never finished, not by one in progress. */
const STALE_TMP_MS = 60_000;

/**
 * A directory's timestamp only moves in steps: a few milliseconds on most file systems, one or
 * two seconds on some. A change made within a step of the last scan can leave the timestamp as
 * it was, so a scan that close to the timestamp is repeated.
 */
const FINE_MTIME_MS = 50;
const COARSE_MTIME_MS = 2_000;

/**
 * Writes beside the target and moves the result into place, so a crash or a full disk never
 * leaves half a file. With exclusive the write fails with EEXIST when the target already exists,
 * even if another process created it a moment ago.
 */
export function writeFileAtomic(file: string, data: string, options: { exclusive?: boolean } = {}): void {
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`);
  const fd = fs.openSync(tmp, 'wx', 0o600);
  try {
    fs.writeSync(fd, data);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  try {
    if (!options.exclusive) {
      fs.renameSync(tmp, file);
      return;
    }
    try {
      // A hard link is the atomic "create only if absent"; rename would replace the other file.
      fs.linkSync(tmp, file);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw error;
      // File systems without hard links (some network and removable ones).
      fs.copyFileSync(tmp, file, fs.constants.COPYFILE_EXCL);
    }
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

function byName(a: fs.Dirent, b: fs.Dirent): number {
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
}

export interface FileStateBackendOptions {
  /** Only read the directory; changes are refused. */
  readOnly?: boolean;
  /** Checks one parsed file; logs why and returns undefined when it is not a usable prompt. */
  parse: (raw: unknown, source: string, quiet: boolean) => StoredPrompt | undefined;
}

/**
 * A directory with one JSON file per saved prompt (atomic writes, exclusive create) and the
 * deleted library ids in .deleted.json. Several servers may share one directory.
 */
export class FileStateBackend implements StateBackend {
  readonly kind = 'file' as const;
  readonly writable: boolean;
  /** The directory was last read at this timestamp, at this time (see FINE_MTIME_MS). */
  private loadedMtimeMs = -1;
  private scannedAt = 0;
  private lastRevision = '';
  private unsettled = 0;
  /** Files already reported as unusable; the directory is read many times, so each is reported once. */
  private readonly reported = new Set<string>();
  private readonly parse: FileStateBackendOptions['parse'];

  /** Throws PromptStorageError when a directory that should be writable is not. */
  constructor(readonly dir: string, options: FileStateBackendOptions) {
    this.writable = !options.readOnly;
    this.parse = options.parse;
    if (!this.writable) return;
    try {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      fs.accessSync(dir, fs.constants.R_OK | fs.constants.W_OK);
      // Left behind by a write that was interrupted before it finished. Recent ones are left
      // alone: another server sharing the directory may be in the middle of a write.
      const now = Date.now();
      for (const name of fs.readdirSync(dir)) {
        if (!name.startsWith('.') || !name.endsWith('.tmp')) continue;
        const file = path.join(dir, name);
        if (now - fs.statSync(file).mtimeMs > STALE_TMP_MS) fs.rmSync(file, { force: true });
      }
    } catch (error) {
      throw new PromptStorageError(
        `State directory ${dir} is not writable (${error instanceof Error ? error.message : String(error)}). ` +
        'Mount or create a writable directory, or start read-only.'
      );
    }
  }

  /** Reads the directory. Throws when it cannot be read. */
  load(): StateSnapshot {
    // The timestamp first: a change made while the files are read is then seen by the next check.
    const mtimeMs = fs.statSync(this.dir).mtimeMs;
    const entries = fs.readdirSync(this.dir, { withFileTypes: true }).sort(byName);
    const prompts: StoredPrompt[] = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json') || entry.name.startsWith('.')) continue;
      const prompt = this.readPromptFile(path.join(this.dir, entry.name));
      if (prompt) prompts.push(prompt);
    }
    const snapshot = { prompts, tombstones: this.readTombstones() };
    this.loadedMtimeMs = mtimeMs;
    this.scannedAt = Date.now();
    return snapshot;
  }

  revision(): string {
    let mtimeMs: number;
    try {
      mtimeMs = fs.statSync(this.dir).mtimeMs;
    } catch {
      // Unreadable now: say nothing changed, and keep serving what was read.
      return this.lastRevision;
    }
    // Whole seconds mean a file system that keeps no finer time than that.
    const granularity = Number.isInteger(mtimeMs / 1000) ? COARSE_MTIME_MS : FINE_MTIME_MS;
    // A scan this close to the timestamp may have missed a later change within the same step:
    // report a revision that matches nothing, so the directory is read once more.
    const settled = mtimeMs !== this.loadedMtimeMs || this.scannedAt - mtimeMs >= granularity;
    this.lastRevision = settled ? String(mtimeMs) : `${mtimeMs}#${++this.unsettled}`;
    return this.lastRevision;
  }

  async put(prompt: StoredPrompt, mode: 'create' | 'replace'): Promise<void> {
    this.saving(`prompt ${prompt.id}`, () => {
      const data = `${JSON.stringify(prompt, null, 2)}\n`;
      if (mode === 'replace') {
        writeFileAtomic(this.stateFile(prompt.id), data);
        return;
      }
      try {
        // Exclusive: another server sharing the directory may have saved this id a moment ago.
        writeFileAtomic(this.stateFile(prompt.id), data, { exclusive: true });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new PromptConflictError(prompt.id);
        throw error;
      }
      this.writeTombstones(ids => ids.delete(prompt.id));
    });
  }

  async remove(id: string, tombstone: boolean): Promise<void> {
    this.saving(`the deletion of prompt ${id}`, () => {
      // A prompt that also exists in the library or a user directory would come back the next
      // time the directory is read, so its id is recorded as deleted.
      if (tombstone) this.writeTombstones(ids => ids.add(id));
      fs.rmSync(this.stateFile(id), { force: true });
    });
  }

  /** Reads one prompt file; logs why (once) and returns undefined when it cannot be served. */
  private readPromptFile(file: string): StoredPrompt | undefined {
    const quiet = this.reported.has(file);
    this.reported.add(file);
    let raw: unknown;
    try {
      raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
      if (!quiet) logger.warn({ err }, `Skipped ${file}: it is not readable JSON`);
      return undefined;
    }
    const prompt = this.parse(raw, file, quiet);
    if (prompt) this.reported.delete(file);
    return prompt;
  }

  private stateFile(id: string): string {
    // Lower-case safe ids are their own file name; anything else is hashed, so two ids can never
    // share a file (not even on a case-insensitive file system) and no id can leave the directory.
    const name = /^[a-z0-9][a-z0-9._-]{0,127}$/.test(id)
      ? id
      : `x-${crypto.createHash('sha256').update(id).digest('hex').slice(0, 40)}`;
    return path.join(this.dir, `${name}.json`);
  }

  private readTombstones(): string[] {
    try {
      const parsed = JSON.parse(fs.readFileSync(path.join(this.dir, TOMBSTONES_FILE), 'utf8'));
      return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
    } catch {
      return [];
    }
  }

  private writeTombstones(change: (ids: Set<string>) => void): void {
    // Re-read first: another server process may share this directory.
    const ids = new Set(this.readTombstones());
    const before = ids.size;
    change(ids);
    if (ids.size === before) return;
    writeFileAtomic(path.join(this.dir, TOMBSTONES_FILE), `${JSON.stringify(Array.from(ids).sort(), null, 2)}\n`);
  }

  /** Runs a write, turning a file system failure into a PromptStorageError. */
  private saving(what: string, write: () => void): void {
    if (!this.writable) throw new PromptStorageError(`Could not save ${what}: the state directory is read-only; nothing was changed`);
    try {
      write();
    } catch (error) {
      if (error instanceof PromptConflictError) throw error;
      logger.error({ err: error }, `Could not save ${what} to ${this.dir}`);
      // The log has the path and the full error; callers get the error code only.
      const code = (error as NodeJS.ErrnoException)?.code ?? 'write failed';
      throw new PromptStorageError(`Could not save ${what} to the state directory (${code}); nothing was changed`);
    }
  }
}
