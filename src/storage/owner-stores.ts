import type { Pool } from 'pg';
import { PromptUsageError, type PromptStore } from '../prompt-store.js';
import type { StateBackend } from '../state-backend.js';
import { PostgresStateBackend } from './postgres.js';

/** How many owners' stores are kept; the one used longest ago is dropped when another arrives. */
export const OWNER_STORES_MAX = 100;

/** Longer than any identity provider's subject; a bound, so that a request cannot grow the cache keys without limit. */
const MAX_OWNER_CHARS = 256;

export interface OwnerStoresOptions {
  /** The library, loaded and without a backend of its own; every owner's store shares its prompts. */
  base: PromptStore;
  pool: Pool;
  /** How many owners to keep. */
  max?: number;
  /** How often a kept store checks the database on its own (it also checks on every storeForOwner call). */
  refreshIntervalMs?: number;
  /** Builds the backend of an owner; Postgres unless a test says otherwise. */
  backendFor?: (ownerSub: string) => StateBackend;
}

/**
 * One store per owner over one shared library. An owner's store keeps that owner's saved prompts
 * (in Postgres, filtered by owner) on top of the library the owners share; the stores of the
 * owners used last are kept, so a request does not read the database from scratch. A server does
 * not own the rows: another server may change them, which storeForOwner checks for before it
 * answers.
 */
export class OwnerStores {
  private readonly base: PromptStore;
  private readonly max: number;
  private readonly refreshIntervalMs?: number;
  private readonly backendFor: (ownerSub: string) => StateBackend;
  /** Insertion order is the order of use, oldest first; the promise is kept so simultaneous requests share one store. */
  private readonly stores = new Map<string, Promise<PromptStore>>();

  constructor(options: OwnerStoresOptions) {
    this.base = options.base;
    this.max = Math.max(1, options.max ?? OWNER_STORES_MAX);
    this.refreshIntervalMs = options.refreshIntervalMs;
    this.backendFor = options.backendFor ?? (ownerSub => new PostgresStateBackend({ pool: options.pool, ownerSub }));
  }

  /** The number of owners kept. */
  get size(): number {
    return this.stores.size;
  }

  /**
   * The store of one owner, up to date with what other servers saved: the database is asked
   * before this returns, whatever the refresh interval. The owner is whoever the caller has
   * already authenticated, never a value taken from a request as it is.
   */
  async storeForOwner(ownerSub: string): Promise<PromptStore> {
    if (typeof ownerSub !== 'string' || ownerSub.trim() === '' || ownerSub.length > MAX_OWNER_CHARS) {
      throw new PromptUsageError(`The owner must be a name of 1 to ${MAX_OWNER_CHARS} characters`);
    }
    let pending = this.stores.get(ownerSub);
    if (pending) {
      // Used now: move it to the end.
      this.stores.delete(ownerSub);
    } else {
      pending = this.base.overlay(this.backendFor(ownerSub), { refreshIntervalMs: this.refreshIntervalMs });
      // A store that could not be opened is not worth keeping; the next request tries again.
      pending.catch(() => {
        if (this.stores.get(ownerSub) === pending) this.stores.delete(ownerSub);
      });
    }
    this.stores.set(ownerSub, pending);
    while (this.stores.size > this.max) this.stores.delete(this.stores.keys().next().value as string);
    const store = await pending;
    await store.sync();
    return store;
  }
}
