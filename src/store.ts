/**
 * Persistence - a small async key-value abstraction with pluggable adapters.
 *
 * The framework core never imposes a database: it speaks {@link KVStore}. Use
 * {@link memoryStore} for zero-setup/ephemeral data, {@link sqliteStore} for
 * durable storage (via `@ix-xs/node-comfort`'s built-in SQLite), or wrap any
 * backend (Redis, Postgres, ...) with {@link createStore}.
 *
 * @module store
 */
import comfort from "@ix-xs/node-comfort";
import type { ServiceDefinition } from "./container.js";
import { defineService } from "./definitions.js";
import { durationMs } from "./duration.js";

/** An async key-value store. Values are JSON-serialisable. */
export interface KVStore<V = unknown> {
  /** Reads a value, or `undefined` if absent/expired. */
  get(key: string): Promise<V | undefined>;
  /** Writes a value, with an optional TTL (`"10m"`, ms, or none = forever). */
  set(key: string, value: V, ttl?: number | string): Promise<void>;
  /** Whether a fresh value exists. */
  has(key: string): Promise<boolean>;
  /** Deletes a key; resolves `true` if something was removed. */
  delete(key: string): Promise<boolean>;
  /** All live keys in this (namespaced) store. */
  keys(): Promise<string[]>;
  /** Removes every key in this (namespaced) store. */
  clear(): Promise<void>;
  /** A view scoped under `prefix:` - isolates keys without a separate backend. */
  namespace<T = V>(prefix: string): KVStore<T>;
  /**
   * Reads a key or computes+stores it on a miss (single-flight per process).
   */
  getOrSet(key: string, factory: () => Promise<V> | V, ttl?: number | string): Promise<V>;
  /** Reads several keys at once. Missing keys are simply absent from the map. */
  getMany(keys: readonly string[]): Promise<Map<string, V>>;
  /** Writes several keys at once, sharing one optional TTL. */
  setMany(entries: Iterable<readonly [string, V]> | Record<string, V>, ttl?: number | string): Promise<void>;
  /** Every live `[key, value]` pair in this (namespaced) store, in one read. */
  entries(): Promise<Array<[string, V]>>;
  /** How many live keys this (namespaced) store holds. */
  size(): Promise<number>;
  /**
   * Adds `by` (default `1`) to a numeric key and returns the new value. A missing
   * key counts as `0`. Concurrent calls in one process never lose an update.
   */
  increment(key: string, by?: number, ttl?: number | string): Promise<number>;
  /**
   * Reads, transforms and writes back a key as one step. `fn` receives the
   * current value (or `undefined`). Calls for the same key are queued, so two
   * concurrent updates in one process cannot overwrite each other.
   */
  update(key: string, fn: (current: V | undefined) => V | Promise<V>, ttl?: number | string): Promise<V>;
  /** Releases the underlying resources (file handle, connection). Idempotent. */
  close(): Promise<void>;
}

/**
 * The minimal contract a storage backend has to fulfil. Implement these few
 * methods over Redis, Postgres or anything else and hand the object to
 * {@link createStore}, which derives the whole {@link KVStore} from them
 * (namespaces, single-flight, counters, bulk reads).
 *
 * Keys arrive fully prefixed; values are whatever was passed to `set`.
 */
export interface KVBackend {
  /** Reads a raw value, or `undefined` if absent or expired. */
  get(key: string): unknown | Promise<unknown>;
  /** Writes a value. `ttlMs` is `0` when the key never expires. */
  set(key: string, value: unknown, ttlMs: number): void | Promise<void>;
  /** Deletes a key and reports whether something was removed. */
  delete(key: string): boolean | Promise<boolean>;
  /** Every live key that starts with `prefix` (`""` means all keys). */
  keys(prefix: string): string[] | Promise<string[]>;
  /** Optional fast path to delete every key under `prefix`. */
  clear?(prefix: string): void | Promise<void>;
  /**
   * Optional fast path to write several keys at once, as one step when the
   * backend can (a transaction, a pipeline). Without it they are written one
   * by one through `set`.
   */
  setMany?(entries: ReadonlyArray<readonly [key: string, value: unknown]>, ttlMs: number): void | Promise<void>;
  /**
   * Optional fast path to read every live `[key, value]` pair under `prefix`
   * in one go. Without it the keys are listed, then read one by one.
   */
  entries?(prefix: string): Array<[key: string, value: unknown]> | Promise<Array<[key: string, value: unknown]>>;
  /** Optional cleanup hook, called by `store.close()`. */
  close?(): void | Promise<void>;
}

/* ------------------------------ Shared core ------------------------------ */

/** State shared by a store and every namespace view derived from it. */
interface Shared {
  readonly backend: KVBackend;
  /** In-flight `getOrSet` factories, keyed by full key. */
  readonly inflight: Map<string, Promise<unknown>>;
  /** Tail of the per-key write queue used by `update`/`increment`. */
  readonly locks: Map<string, Promise<unknown>>;
  closed: boolean;
}

class Store<V> implements KVStore<V> {
  public constructor(
    private readonly shared: Shared,
    private readonly prefix: string,
  ) {}

  private k(key: string): string {
    return this.prefix + key;
  }

  public async get(key: string): Promise<V | undefined> {
    return (await this.shared.backend.get(this.k(key))) as V | undefined;
  }

  public async set(key: string, value: V, ttl?: number | string): Promise<void> {
    await this.shared.backend.set(this.k(key), value, durationMs(ttl, 0));
  }

  public async has(key: string): Promise<boolean> {
    return (await this.get(key)) !== undefined;
  }

  public async delete(key: string): Promise<boolean> {
    return this.shared.backend.delete(this.k(key));
  }

  public async keys(): Promise<string[]> {
    const all = await this.shared.backend.keys(this.prefix);
    return all.map((key) => key.slice(this.prefix.length));
  }

  public async clear(): Promise<void> {
    const { backend } = this.shared;
    if (backend.clear) {
      await backend.clear(this.prefix);
      return;
    }
    for (const key of await backend.keys(this.prefix)) await backend.delete(key);
  }

  public namespace<T = V>(prefix: string): KVStore<T> {
    return new Store<T>(this.shared, `${this.prefix}${prefix}:`);
  }

  public async getOrSet(key: string, factory: () => Promise<V> | V, ttl?: number | string): Promise<V> {
    const existing = await this.get(key);
    if (existing !== undefined) return existing;

    const full = this.k(key);
    const pending = this.shared.inflight.get(full);
    if (pending) return pending as Promise<V>;

    const promise = Promise.resolve()
      .then(factory)
      .then(async (value) => {
        await this.set(key, value, ttl);
        return value;
      })
      .finally(() => this.shared.inflight.delete(full));
    this.shared.inflight.set(full, promise);
    return promise;
  }

  public async getMany(keys: readonly string[]): Promise<Map<string, V>> {
    const found = new Map<string, V>();
    const values = await Promise.all(keys.map((key) => this.get(key)));
    keys.forEach((key, index) => {
      const value = values[index];
      if (value !== undefined) found.set(key, value);
    });
    return found;
  }

  public async setMany(
    entries: Iterable<readonly [string, V]> | Record<string, V>,
    ttl?: number | string,
  ): Promise<void> {
    const pairs = Symbol.iterator in entries ? [...entries] : Object.entries(entries);
    const { backend } = this.shared;
    if (backend.setMany) {
      await backend.setMany(
        pairs.map(([key, value]) => [this.k(key), value] as const),
        durationMs(ttl, 0),
      );
      return;
    }
    for (const [key, value] of pairs) await this.set(key, value as V, ttl);
  }

  public async entries(): Promise<Array<[string, V]>> {
    const { backend } = this.shared;
    if (backend.entries) {
      const found = await backend.entries(this.prefix);
      return found.map(([key, value]) => [key.slice(this.prefix.length), value as V]);
    }
    const keys = await this.keys();
    const values = await this.getMany(keys);
    return [...values.entries()];
  }

  public async size(): Promise<number> {
    return (await this.shared.backend.keys(this.prefix)).length;
  }

  public increment(key: string, by = 1, ttl?: number | string): Promise<number> {
    return this.update(
      key,
      (current) => ((typeof current === "number" ? current : 0) + by) as V,
      ttl,
    ) as Promise<number>;
  }

  public update(key: string, fn: (current: V | undefined) => V | Promise<V>, ttl?: number | string): Promise<V> {
    const full = this.k(key);
    const { locks } = this.shared;
    // Chain onto the previous writer for this key, so read-modify-write cycles
    // run one after the other instead of interleaving.
    const previous = locks.get(full) ?? Promise.resolve();
    const run = previous
      .catch(() => undefined)
      .then(async () => {
        const next = await fn(await this.get(key));
        await this.set(key, next, ttl);
        return next;
      });
    locks.set(full, run);
    void run
      .catch(() => undefined)
      .finally(() => {
        if (locks.get(full) === run) locks.delete(full);
      });
    return run;
  }

  public async close(): Promise<void> {
    if (this.shared.closed) return;
    this.shared.closed = true;
    await this.shared.backend.close?.();
  }
}

/**
 * Builds a full {@link KVStore} from a minimal {@link KVBackend}. This is the
 * easiest way to plug in your own database: implement `get`, `set`, `delete`
 * and `keys`, and everything else is derived for you.
 *
 * @example
 * export const redisStore = (client: RedisClient) =>
 *   createStore({
 *     get: async (key) => JSON.parse((await client.get(key)) ?? "null") ?? undefined,
 *     set: async (key, value, ttlMs) => {
 *       await client.set(key, JSON.stringify(value), ttlMs ? { PX: ttlMs } : undefined);
 *     },
 *     delete: async (key) => (await client.del(key)) > 0,
 *     keys: (prefix) => client.keys(`${prefix}*`),
 *   });
 */
export function createStore<V = unknown>(backend: KVBackend): KVStore<V> {
  return new Store<V>({ backend, inflight: new Map(), locks: new Map(), closed: false }, "");
}

/** Methods added to {@link KVStore} after 1.0, used to detect older adapters. */
const EXTENDED_METHODS = ["getMany", "setMany", "entries", "size", "increment", "update", "close"] as const;

/**
 * Returns `store` unchanged when it already implements the whole
 * {@link KVStore} contract, and otherwise wraps it so the newer methods
 * (`increment`, `update`, `entries`, ...) exist. Lets a hand-written adapter from
 * an earlier version keep working without changes.
 */
export function upgradeStore<V = unknown>(store: KVStore<V>): KVStore<V> {
  const candidate = store as unknown as Record<string, unknown>;
  if (EXTENDED_METHODS.every((method) => typeof candidate[method] === "function")) return store;

  // The legacy store already namespaces its own keys, so expose it as a backend
  // working on bare keys and filter by prefix on our side.
  return createStore<V>({
    get: (key) => store.get(key),
    set: (key, value, ttlMs) => store.set(key, value as V, ttlMs || undefined),
    delete: (key) => store.delete(key),
    keys: async (prefix) => (await store.keys()).filter((key) => key.startsWith(prefix)),
  });
}

/* ------------------------------- Memory ---------------------------------- */

interface MemEntry {
  value: unknown;
  expires: number;
}

/** How many writes between two sweeps of expired entries. */
const SWEEP_EVERY = 500;

function memoryBackend(): KVBackend {
  const data = new Map<string, MemEntry>();
  let writes = 0;

  const sweep = (): void => {
    const now = Date.now();
    for (const [key, entry] of data) if (entry.expires && now > entry.expires) data.delete(key);
  };
  const live = (key: string): MemEntry | undefined => {
    const entry = data.get(key);
    if (!entry) return undefined;
    if (entry.expires && Date.now() > entry.expires) {
      data.delete(key);
      return undefined;
    }
    return entry;
  };

  return {
    get: (key) => live(key)?.value,
    set(key, value, ttlMs) {
      data.set(key, { value, expires: ttlMs ? Date.now() + ttlMs : 0 });
      // Keys written with a TTL and never read again would otherwise pile up.
      if (++writes % SWEEP_EVERY === 0) sweep();
    },
    delete: (key) => data.delete(key),
    keys: (prefix) => [...data.keys()].filter((key) => key.startsWith(prefix) && live(key) !== undefined),
    clear(prefix) {
      for (const key of [...data.keys()]) if (key.startsWith(prefix)) data.delete(key);
    },
    close: () => data.clear(),
  };
}

/** Creates an in-memory {@link KVStore} (fast, non-durable). */
export function memoryStore<V = unknown>(): KVStore<V> {
  return createStore<V>(memoryBackend());
}

/* ------------------------------- SQLite ---------------------------------- */

type SQLiteInstance = InstanceType<typeof comfort.SQLite>;

/**
 * The prefix as a GLOB pattern, with `*`, `?` and `[` in brackets so a
 * namespace containing those characters matches literally. GLOB, not LIKE:
 * LIKE ignores the case of ASCII letters, which would mix the keys of
 * `namespace("Users")` with those of `namespace("users")`.
 */
function globPattern(prefix: string): string {
  return `${prefix.replace(/[*?[]/g, (c) => `[${c}]`)}*`;
}

function sqliteBackend(db: SQLiteInstance): KVBackend {
  db.exec(
    "CREATE TABLE IF NOT EXISTS djsbot_kv (key TEXT PRIMARY KEY, value TEXT NOT NULL, expires INTEGER NOT NULL DEFAULT 0)",
  );
  // Lets the purge below find expired rows without scanning the whole table.
  db.exec("CREATE INDEX IF NOT EXISTS djsbot_kv_expires ON djsbot_kv (expires) WHERE expires > 0");

  let writes = 0;
  const purge = (): void => {
    db.exec("DELETE FROM djsbot_kv WHERE expires > 0 AND expires < ?", [Date.now()]);
  };
  purge();

  const upsert = (key: string, value: unknown, ttlMs: number): void => {
    db.exec(
      "INSERT INTO djsbot_kv (key, value, expires) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, expires = excluded.expires",
      [key, JSON.stringify(value), ttlMs ? Date.now() + ttlMs : 0],
    );
  };
  // Expired rows that are never read again would otherwise grow the file.
  const wrote = (count: number): void => {
    const before = writes;
    writes += count;
    if (Math.floor(writes / SWEEP_EVERY) > Math.floor(before / SWEEP_EVERY)) purge();
  };

  return {
    get(key) {
      const row = db.queryOne<{ value: string; expires: number }>(
        "SELECT value, expires FROM djsbot_kv WHERE key = ?",
        [key],
      );
      if (!row) return undefined;
      if (row.expires && Date.now() > row.expires) {
        db.exec("DELETE FROM djsbot_kv WHERE key = ?", [key]);
        return undefined;
      }
      return JSON.parse(row.value) as unknown;
    },
    set(key, value, ttlMs) {
      upsert(key, value, ttlMs);
      wrote(1);
    },
    // One transaction: a single commit instead of one per key, and all or nothing.
    setMany(entries, ttlMs) {
      db.transaction(
        () => {
          for (const [key, value] of entries) upsert(key, value, ttlMs);
        },
        { immediate: true },
      );
      wrote(entries.length);
    },
    entries(prefix) {
      const rows = db.queryAll<{ key: string; value: string }>(
        "SELECT key, value FROM djsbot_kv WHERE key GLOB ? AND (expires = 0 OR expires > ?)",
        [globPattern(prefix), Date.now()],
      );
      return rows.map((row) => [row.key, JSON.parse(row.value) as unknown]);
    },
    delete(key) {
      return db.exec("DELETE FROM djsbot_kv WHERE key = ?", [key]).changes > 0;
    },
    keys(prefix) {
      const rows = db.queryAll<{ key: string }>(
        "SELECT key FROM djsbot_kv WHERE key GLOB ? AND (expires = 0 OR expires > ?)",
        [globPattern(prefix), Date.now()],
      );
      return rows.map((row) => row.key);
    },
    clear(prefix) {
      db.exec("DELETE FROM djsbot_kv WHERE key GLOB ?", [globPattern(prefix)]);
    },
    close: () => db.close(),
  };
}

/**
 * Creates a durable {@link KVStore} backed by SQLite (via node-comfort's
 * built-in `node:sqlite`). Pass a file path, or `":memory:"` for a transient DB.
 *
 * @example const store = sqliteStore("data/bot.sqlite");
 */
export function sqliteStore<V = unknown>(path = "data/store.sqlite"): KVStore<V> {
  return createStore<V>(sqliteBackend(new comfort.SQLite(path)));
}

/**
 * Wraps a {@link KVStore} as a service definition so it's injectable as
 * `ctx.services.<token>` and discovered from a `*.service.ts` file.
 *
 * @example export const Store = defineStore("store", sqliteStore("data/bot.sqlite"));
 */
export function defineStore(token: string, store: KVStore): ServiceDefinition<KVStore> {
  return defineService(token, { factory: () => upgradeStore(store) });
}
