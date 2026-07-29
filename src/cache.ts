/**
 * Smart caching & resolution.
 *
 * - {@link TTLCache} - an in-memory cache with per-entry TTL, a max-size LRU
 *   bound, single-flight `getOrFetch`, and optional stale-while-revalidate.
 * - {@link resolve} - cache-first fetch helpers for Discord entities, so you
 *   read from discord.js's cache when possible and only hit the API on a miss.
 *
 * @module cache
 */
import comfort from "@ix-xs/node-comfort";
import type { Channel, Client, Guild, GuildMember, Message, Role, TextBasedChannel, User } from "discord.js";

interface Entry<V> {
  value: V;
  expires: number;
  refreshing?: boolean;
}

/** Options for {@link TTLCache}. */
export interface TTLCacheOptions {
  /** Time-to-live: ms, or a duration string like `"30s"`, `"5m"`, `"1h"`. Default `"5m"`. */
  ttl?: number | string;
  /** Max entries before least-recently-used ones are evicted. Default `1000`. */
  max?: number;
  /**
   * Serve stale values immediately while refreshing in the background. Great for
   * hot keys where a slightly-old value is fine. Default `false`.
   */
  staleWhileRevalidate?: boolean;
}

function toMs(ttl: number | string | undefined, fallback: number): number {
  if (typeof ttl === "number") return ttl;
  if (typeof ttl === "string") return comfort.time.parseDuration(ttl) ?? fallback;
  return fallback;
}

/**
 * An in-memory TTL + LRU cache with single-flight fetching.
 *
 * @example
 * const cache = new TTLCache<string, Guild>({ ttl: "10m" });
 * const guild = await cache.getOrFetch(id, () => client.guilds.fetch(id));
 */
export class TTLCache<K, V> {
  private readonly store = new Map<K, Entry<V>>();
  private readonly inflight = new Map<K, Promise<V>>();
  private readonly ttl: number;
  private readonly max: number;
  private readonly swr: boolean;

  public constructor(options: TTLCacheOptions = {}) {
    this.ttl = toMs(options.ttl, 300_000);
    this.max = options.max ?? 1000;
    this.swr = options.staleWhileRevalidate ?? false;
  }

  /** Returns a fresh value, or `undefined` if missing/expired. */
  public get(key: K): V | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expires && !this.swr) {
      this.store.delete(key);
      return undefined;
    }
    // Refresh LRU recency.
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  /** Stores a value with the configured (or overridden) TTL. */
  public set(key: K, value: V, ttl?: number | string): void {
    if (this.store.size >= this.max && !this.store.has(key)) {
      const oldest = this.store.keys().next().value as K | undefined;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    this.store.set(key, { value, expires: Date.now() + toMs(ttl, this.ttl) });
  }

  /** Whether a fresh value exists. */
  public has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  /** Removes an entry. */
  public delete(key: K): void {
    this.store.delete(key);
  }

  /** Empties the cache. */
  public clear(): void {
    this.store.clear();
  }

  /**
   * Returns the cached value, or runs `fetcher` (deduplicating concurrent calls
   * for the same key) and caches the result. With `staleWhileRevalidate`, a
   * stale value is returned immediately and refreshed in the background.
   */
  public async getOrFetch(key: K, fetcher: () => Promise<V> | V, ttl?: number | string): Promise<V> {
    const entry = this.store.get(key);
    const now = Date.now();

    if (entry && now <= entry.expires) return entry.value;

    if (entry && this.swr) {
      // Serve stale, refresh in background (once).
      if (!entry.refreshing) {
        entry.refreshing = true;
        void Promise.resolve(fetcher())
          .then((value) => this.set(key, value, ttl))
          .catch(() => undefined)
          .finally(() => {
            const e = this.store.get(key);
            if (e) e.refreshing = false;
          });
      }
      return entry.value;
    }

    const pending = this.inflight.get(key);
    if (pending) return pending;

    const promise = Promise.resolve(fetcher())
      .then((value) => {
        this.set(key, value, ttl);
        return value;
      })
      .finally(() => this.inflight.delete(key));
    this.inflight.set(key, promise);
    return promise;
  }
}

/** Creates a {@link TTLCache}. */
export function createCache<K, V>(options?: TTLCacheOptions): TTLCache<K, V> {
  return new TTLCache<K, V>(options);
}

/* -------------------------------------------------------------------------- */
/*  Cache-first resolution of Discord entities                                */
/* -------------------------------------------------------------------------- */

/**
 * Cache-first fetch helpers. Each reads discord.js's own cache and only calls
 * the API on a miss. Pass `force: true` to always fetch.
 */
export const resolve = {
  /** Resolve a guild member. */
  member(guild: Guild, id: string, force = false): Promise<GuildMember> {
    const cached = guild.members.cache.get(id);
    return !force && cached ? Promise.resolve(cached) : guild.members.fetch(id);
  },
  /** Resolve a user. */
  user(client: Client, id: string, force = false): Promise<User> {
    const cached = client.users.cache.get(id);
    return !force && cached ? Promise.resolve(cached) : client.users.fetch(id);
  },
  /** Resolve a role. */
  role(guild: Guild, id: string, force = false): Promise<Role | null> {
    const cached = guild.roles.cache.get(id);
    return !force && cached ? Promise.resolve(cached) : guild.roles.fetch(id);
  },
  /** Resolve a channel. */
  channel(client: Client, id: string, force = false): Promise<Channel | null> {
    const cached = client.channels.cache.get(id);
    return !force && cached ? Promise.resolve(cached) : client.channels.fetch(id);
  },
  /** Resolve a message from a channel. */
  message(channel: TextBasedChannel, id: string, force = false): Promise<Message> {
    const cached = channel.messages.cache.get(id);
    return !force && cached ? Promise.resolve(cached) : channel.messages.fetch(id);
  },
};
