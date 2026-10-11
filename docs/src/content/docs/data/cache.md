---
title: "Cache and entity resolution"
description: "An in-process cache with expiry and a size limit for the results of slow work, helpers that read discord.js's cache before calling the API, and a check for channels Discord hides from the bot."
sidebar:
  order: 2
---

Three tools live here. `createCache` remembers what your own code computed or
fetched. `resolve` looks up Discord entities (members, roles, channels) in the
cache discord.js already keeps. `isHiddenChannel` tells a real channel from a
placeholder.

## A first cache

Wrap a slow call in `getOrFetch`. The first call runs the fetcher, the next
ones return the cached value until it expires.

```ts title="features/prices/prices.service.ts"
import { createCache, defineService } from "@ix-xs/djs-bot";

async function fetchPrice(symbol: string): Promise<number> {
  const response = await fetch(`https://api.example.com/price/${symbol}`);
  const body = (await response.json()) as { price: number };
  return body.price;
}

export default defineService("prices", {
  factory: () => {
    const cache = createCache<string, number>({ ttl: "1m", max: 500 });
    return {
      get: (symbol: string) => cache.getOrFetch(symbol, () => fetchPrice(symbol)),
    };
  },
});
```

The cache sits inside a [service](/architecture/services/) so that one instance
is shared by every handler. A cache created inside a handler would start empty
on each interaction.

Concurrent calls for the same key share one in-flight request, so a burst of
interactions hits your API once, not fifty times. If the fetcher throws, every
waiting caller receives the error, nothing is cached, and the next call tries
again.

The other methods are synchronous:

```ts
const prices = createCache<string, number>({ ttl: "1m", max: 500 });

prices.set("BTC", 42);          // manual write, with the cache's TTL
prices.set("ETH", 7, "10s");    // or a TTL for this entry
prices.get("BTC");              // 42, or undefined when missing or expired
prices.has("BTC");              // true
prices.delete("BTC");
prices.clear();
```

## Stale while revalidate

With `staleWhileRevalidate: true`, an expired value is still useful. The next
`getOrFetch` returns it at once and starts one refresh in the background, so
the user never waits for the fetcher after the first call.

```ts
const stats = createCache<string, Stats>({ ttl: "1m", staleWhileRevalidate: true });
```

This suits leaderboards, counters and dashboards. Do not use it for anything
that must be exact, and keep these points in mind:

- The stale value is served however old it is. A key nobody read for an hour is
  returned one more time, an hour old, while the refresh runs.
- If the background refresh fails, the error is swallowed and the stale value
  keeps being served. The next call tries the refresh again.
- `get` and `has` also return expired values in this mode, because expired
  entries are kept in order to be served.
- The very first call for a key has nothing to serve, so it waits for the
  fetcher like a normal cache.

## Cache or store

| | `createCache` | [`KVStore`](/data/store/) |
| --- | --- | --- |
| Reads | Synchronous | Async |
| Survives a restart | No | With `sqliteStore` |
| Shared across shards | No | With a shared backend |
| Bounded, evicts entries | Yes (`max`) | No |
| Use for | Hot data, API responses | Real state: profiles, settings, tickets |

They pair well, with the cache in front and the store behind:

```ts
const profile = await cache.getOrFetch(id, () => store.get(`profile:${id}`));
```

:::tip[Cache what you compute]
Members, roles and channels are already cached by the discord.js client. Cache
the result of your own work (an aggregated leaderboard, an external API
response, a rendered image), not the raw entities.
:::

## Resolving Discord entities

discord.js keeps the entities it has seen in memory. The `resolve` helpers read
that cache and only call the Discord API on a miss, which replaces the
`cache.get(id) ?? (await fetch(id))` pattern everywhere.

```ts
import { resolve } from "@ix-xs/djs-bot";

const member  = await resolve.member(ctx.guild!, userId);     // cache, then fetch
const user    = await resolve.user(ctx.client, userId);
const role    = await resolve.role(ctx.guild!, roleId);
const channel = await resolve.channel(ctx.client, channelId);
const message = await resolve.message(ctx.channel!, messageId);

const fresh = await resolve.member(ctx.guild!, userId, true);  // always fetch
```

Pass `true` as the last argument when you need current data, for instance right
after a role change, where the cache may still show the old state.

`resolve.role` and `resolve.channel` are typed `... | null`, so check the result
before using it. On a miss the helpers call discord.js's own `fetch`, which
rejects when Discord does not know the id: wrap the call in `try`/`catch` when
the id comes from user input.

## Hidden channels

From November 16, 2026, Discord stops sending bots the real data of channels
they lack the `VIEW_CHANNEL` permission on. Over the Gateway such a channel
still arrives, but with the name `"___hidden___"`, its other details blanked
and a dedicated flag. The REST channel list leaves it out. When the bot gains
access, a channel update delivers the full data.

`isHiddenChannel` tells the two apart, so that a channel list, a counter or an
autocomplete never shows a placeholder:

```ts
import { isHiddenChannel } from "@ix-xs/djs-bot";

const names = guild.channels.cache
  .filter((channel) => !isHiddenChannel(channel))
  .map((channel) => channel.name);
```

Channels received through an interaction (a channel option, a channel select)
are never hidden this way.

## Reference

### `createCache(options)`

```ts
createCache<K, V>(options?: TTLCacheOptions): TTLCache<K, V>
```

Creates a `TTLCache`. `K` is the key type and `V` the value type, so keys need
not be strings.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `ttl` | `number \| string` | `"5m"` | Time to live of an entry: milliseconds, or a duration such as `"30s"`, `"5m"`, `"1h"`. |
| `max` | `number` | `1000` | Maximum number of entries. When the cache is full, adding a new key evicts one. |
| `staleWhileRevalidate` | `boolean` | `false` | Serve an expired value immediately and refresh it in the background. |

A duration string that cannot be parsed falls back to the default (`"5m"` in
the options, the cache's TTL in `set` and `getOrFetch`).

### `TTLCache<K, V>`

The class behind `createCache`. `new TTLCache<K, V>(options)` is identical if
you prefer it.

```ts
import { TTLCache } from "@ix-xs/djs-bot";

const perGuild = new TTLCache<string, Settings>({ ttl: "10m" });
```

| Method | Returns | Description |
| --- | --- | --- |
| `get(key)` | `V \| undefined` | The value, or `undefined` when missing or expired. Marks the entry as recently used. |
| `set(key, value, ttl?)` | `void` | Stores a value. `ttl` overrides the cache's TTL for this entry. |
| `has(key)` | `boolean` | Whether `get(key)` would return a value. |
| `delete(key)` | `void` | Removes an entry. |
| `clear()` | `void` | Empties the cache. |
| `getOrFetch(key, fetcher, ttl?)` | `Promise<V>` | The cached value, or runs `fetcher` (sync or async), caches the result and returns it. Concurrent calls for one key share one fetch. |

How entries leave the cache:

- An expired entry is dropped when `get` or `has` reads it (unless
  `staleWhileRevalidate` is on). There is no background sweep: `max` is what
  bounds memory.
- When the cache holds `max` entries and a new key is added, the entry that was
  inserted, or last read with `get`, the longest ago is evicted. A hit in
  `getOrFetch` and overwriting an existing key with `set` do not count as a
  use.

### `resolve`

Each helper reads the discord.js cache and fetches on a miss. `force` defaults
to `false`. With `true`, the cache is skipped.

| Helper | Returns |
| --- | --- |
| `resolve.member(guild, id, force?)` | `Promise<GuildMember>` |
| `resolve.user(client, id, force?)` | `Promise<User>` |
| `resolve.role(guild, id, force?)` | `Promise<Role \| null>` |
| `resolve.channel(client, id, force?)` | `Promise<Channel \| null>` |
| `resolve.message(channel, id, force?)` | `Promise<Message>` |

`channel` in `resolve.message` is a text-based channel, such as `ctx.channel`.

### `isHiddenChannel(channel)`

```ts
isHiddenChannel(channel): boolean
```

`true` when the channel carries Discord's "obfuscated" flag or the placeholder
name `"___hidden___"`. Accepts any channel object, and returns `false` for
`null` or `undefined`.

## See also

- [Store](/data/store/): durable state that survives a restart.
- [Services](/architecture/services/): where a shared cache belongs.
- [Resilience](/production/resilience/): rate limits, retries and circuit breakers for the calls you cache.
- [Options and autocomplete](/commands/options/): channel options, which never deliver hidden channels.
