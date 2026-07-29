/**
 * Persistence - a small async key-value abstraction with pluggable adapters.
 *
 * The framework core never imposes a database: it speaks {@link KVStore}. Use
 * {@link memoryStore} for zero-setup/ephemeral data, {@link sqliteStore} for
 * durable storage (via `@ix-xs/node-comfort`'s built-in SQLite), or implement
 * `KVStore` over Redis/Postgres/etc. yourself.
 *
 * @module store
 */
import comfort from "@ix-xs/node-comfort";
import type { ServiceDefinition } from "./container.js";
import { defineService } from "./definitions.js";

function toMs(ttl: number | string | undefined): number {
  if (ttl === undefined) return 0;
  if (typeof ttl === "number") return ttl;
  return comfort.time.parseDuration(ttl) ?? 0;
}

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
  /** All keys in this (namespaced) store. */
  keys(): Promise<string[]>;
  /** Removes every key in this (namespaced) store. */
  clear(): Promise<void>;
  /** A view scoped under `prefix:` - isolates keys without a separate backend. */
  namespace<T = V>(prefix: string): KVStore<T>;
  /**
   * Reads a key or computes+stores it on a miss (single-flight per process).
   */
  getOrSet(key: string, factory: () => Promise<V> | V, ttl?: number | string): Promise<V>;
}

/* ------------------------------- Memory ---------------------------------- */

interface MemEntry {
  value: unknown;
  expires: number;
}

class MemoryStore<V> implements KVStore<V> {
  private readonly inflight = new Map<string, Promise<V>>();
  public constructor(
    private readonly backend: Map<string, MemEntry>,
    private readonly prefix: string,
  ) {}

  private k(key: string): string {
    return this.prefix + key;
  }

  async get(key: string): Promise<V | undefined> {
    const entry = this.backend.get(this.k(key));
    if (!entry) return undefined;
    if (entry.expires && Date.now() > entry.expires) {
      this.backend.delete(this.k(key));
      return undefined;
    }
    return entry.value as V;
  }
  async set(key: string, value: V, ttl?: number | string): Promise<void> {
    const ms = toMs(ttl);
    this.backend.set(this.k(key), { value, expires: ms ? Date.now() + ms : 0 });
  }
  async has(key: string): Promise<boolean> {
    return (await this.get(key)) !== undefined;
  }
  async delete(key: string): Promise<boolean> {
    return this.backend.delete(this.k(key));
  }
  async keys(): Promise<string[]> {
    return [...this.backend.keys()].filter((k) => k.startsWith(this.prefix)).map((k) => k.slice(this.prefix.length));
  }
  async clear(): Promise<void> {
    for (const k of [...this.backend.keys()]) if (k.startsWith(this.prefix)) this.backend.delete(k);
  }
  namespace<T = V>(prefix: string): KVStore<T> {
    return new MemoryStore<T>(this.backend, `${this.prefix}${prefix}:`);
  }
  async getOrSet(key: string, factory: () => Promise<V> | V, ttl?: number | string): Promise<V> {
    const existing = await this.get(key);
    if (existing !== undefined) return existing;
    const pending = this.inflight.get(key);
    if (pending) return pending;
    const promise = Promise.resolve(factory())
      .then(async (value) => {
        await this.set(key, value, ttl);
        return value;
      })
      .finally(() => this.inflight.delete(key));
    this.inflight.set(key, promise);
    return promise;
  }
}

/** Creates an in-memory {@link KVStore} (fast, non-durable). */
export function memoryStore<V = unknown>(): KVStore<V> {
  return new MemoryStore<V>(new Map(), "");
}

/* ------------------------------- SQLite ---------------------------------- */

type SQLiteInstance = InstanceType<typeof comfort.SQLite>;

function unwrap<T>(result: T | { error: string }): T {
  if (result && typeof result === "object" && "error" in result) {
    throw new Error(`SQLite error: ${(result as { error: string }).error}`);
  }
  return result as T;
}

class SQLiteStore<V> implements KVStore<V> {
  private readonly ready: Promise<void>;
  private readonly inflight = new Map<string, Promise<V>>();

  public constructor(
    private readonly db: SQLiteInstance,
    private readonly prefix: string,
    ready?: Promise<void>,
  ) {
    this.ready =
      ready ??
      this.db
        .exec(
          "CREATE TABLE IF NOT EXISTS djsbot_kv (key TEXT PRIMARY KEY, value TEXT NOT NULL, expires INTEGER NOT NULL DEFAULT 0)",
        )
        .then(() => undefined);
  }

  private k(key: string): string {
    return this.prefix + key;
  }

  async get(key: string): Promise<V | undefined> {
    await this.ready;
    const row = unwrap(
      await this.db.queryOne("SELECT value, expires FROM djsbot_kv WHERE key = ?", [this.k(key)]),
    ) as { value: string; expires: number } | undefined;
    if (!row) return undefined;
    if (row.expires && Date.now() > row.expires) {
      await this.delete(key);
      return undefined;
    }
    return JSON.parse(row.value) as V;
  }
  async set(key: string, value: V, ttl?: number | string): Promise<void> {
    await this.ready;
    const ms = toMs(ttl);
    const expires = ms ? Date.now() + ms : 0;
    unwrap(
      await this.db.exec(
        "INSERT INTO djsbot_kv (key, value, expires) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, expires = excluded.expires",
        [this.k(key), JSON.stringify(value), expires],
      ),
    );
  }
  async has(key: string): Promise<boolean> {
    return (await this.get(key)) !== undefined;
  }
  async delete(key: string): Promise<boolean> {
    await this.ready;
    const result = unwrap(await this.db.exec("DELETE FROM djsbot_kv WHERE key = ?", [this.k(key)]));
    return (result as { changes: number }).changes > 0;
  }
  async keys(): Promise<string[]> {
    await this.ready;
    const rows = unwrap(
      await this.db.queryAll("SELECT key FROM djsbot_kv WHERE key LIKE ?", [`${this.prefix}%`]),
    ) as Array<{ key: string }>;
    return rows.map((r) => r.key.slice(this.prefix.length));
  }
  async clear(): Promise<void> {
    await this.ready;
    unwrap(await this.db.exec("DELETE FROM djsbot_kv WHERE key LIKE ?", [`${this.prefix}%`]));
  }
  namespace<T = V>(prefix: string): KVStore<T> {
    return new SQLiteStore<T>(this.db, `${this.prefix}${prefix}:`, this.ready);
  }
  async getOrSet(key: string, factory: () => Promise<V> | V, ttl?: number | string): Promise<V> {
    const existing = await this.get(key);
    if (existing !== undefined) return existing;
    const pending = this.inflight.get(key);
    if (pending) return pending;
    const promise = Promise.resolve(factory())
      .then(async (value) => {
        await this.set(key, value, ttl);
        return value;
      })
      .finally(() => this.inflight.delete(key));
    this.inflight.set(key, promise);
    return promise;
  }
}

/**
 * Creates a durable {@link KVStore} backed by SQLite (via node-comfort's
 * built-in `node:sqlite`). Pass a file path, or `":memory:"` for a transient DB.
 *
 * @example const store = sqliteStore("data/bot.sqlite");
 */
export function sqliteStore<V = unknown>(path = "data/store.sqlite"): KVStore<V> {
  return new SQLiteStore<V>(new comfort.SQLite(path), "");
}

/**
 * Wraps a {@link KVStore} as a service definition so it's injectable as
 * `ctx.services.<token>` and discovered from a `*.service.ts` file.
 *
 * @example export const Store = defineStore("store", sqliteStore("data/bot.sqlite"));
 */
export function defineStore(token: string, store: KVStore): ServiceDefinition<KVStore> {
  return defineService(token, { factory: () => store });
}
