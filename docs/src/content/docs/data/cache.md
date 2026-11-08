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
and the flag `CHANNEL_OBFUSCATED` (`1 << 17`). The REST channel list,
`GET /guilds/{guild.id}/channels`, leaves it out entirely: from that date
`guild.channels.fetch()` returns only the channels the bot can view. When the
bot gains access, a channel update delivers the full data.

Until then, the temporary **Private Channel Obfuscation** toggle of the
Developer Portal turns this behaviour on early, for testing.

`isHiddenChannel` tells the two apart, so that a channel list, a counter or an
autocomplete never shows a placeholder:

```ts
import { isHiddenChannel } from "@ix-xs/djs-bot";

const names = guild.channels.cache
  .filter((channel) => !isHiddenChannel(channel))
  .map((channel) => channel.name);
```

Interaction payloads are not obfuscated: channels received through an
interaction (a channel option, a channel select) always carry their real data.

## Reference

Every option, property and type, with what it accepts and returns, is in the API reference:

- `createCache()`: Creates a `TTLCache`.
- `TTLCache`: An in-memory TTL + LRU cache with single-flight fetching.
- `resolve`: Cache-first fetch helpers.
- `isHiddenChannel()`: Whether a channel is one the bot cannot view, sent by Discord with its name and details withheld ("obfuscated").

## See also

- [Store](/data/store/): durable state that survives a restart.
- [Services](/architecture/services/): where a shared cache belongs.
- [Resilience](/production/resilience/): rate limits, retries and circuit breakers for the calls you cache.
- [Options and autocomplete](/commands/options/): channel options, which never deliver hidden channels.
