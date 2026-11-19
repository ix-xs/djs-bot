---
title: "Cache and entity resolution"
description: "Helpers that read discord.js's cache before calling the API, a check for channels Discord hides from the bot, and where the results of your own work go."
sidebar:
  order: 2
---

Two tools live here. `resolve` looks up Discord entities (members, roles,
channels) in the cache discord.js already keeps. `isHiddenChannel` tells a real
channel from a placeholder. The results of your own work go in node-comfort's cache.

## Caching your own results

Use `nc.cache.create({ ttl, max })` from node-comfort ([its page](https://ix-xs.github.io/node-comfort/flow/cache/)), with
`getOrSet` to load on a miss, and create it in a [service](/architecture/services/)
so that every handler shares it.

## Cache or store

| | `nc.cache` | [`KVStore`](/data/store/) |
| --- | --- | --- |
| Reads | Synchronous | Async |
| Survives a restart | No | With `sqliteStore` |
| Shared across shards | No | With a shared backend |
| Bounded, evicts entries | With `max` | No |
| Use for | Hot data, API responses | Real state: profiles, settings, tickets |

They pair well, with the cache in front and the store behind:

```ts
const profile = await cache.getOrSet(id, () => store.get(`profile:${id}`));
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

- `resolve`: Cache-first fetch helpers.
- `isHiddenChannel()`: Whether a channel is one the bot cannot view, sent by Discord with its name and details withheld ("obfuscated").

## See also

- [Store](/data/store/): durable state that survives a restart.
- [Services](/architecture/services/): where a shared cache belongs.
- [Resilience](/production/resilience/): rate limits, retries and circuit breakers for the calls you cache.
- [Options and autocomplete](/commands/options/): channel options, which never deliver hidden channels.
