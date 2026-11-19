---
title: "Upgrading"
description: "What changes from one minor version to the next. The old names keep working until 2.0 and warn once each: every old name, its warning code, and what to write instead."
---

| | |
| --- | --- |
| Old names | Keep working, print one `DeprecationWarning` each with its code, removed in 2.0 |
| Node.js | Unchanged since 1.4: 22.23.4, 24.22.1, 26.12.1 or later |
| discord.js | 14.27 or later on 14 |
| node-comfort | 3.1 or later since 1.7 (3.0 before), installed with the package |

```bash
npm install @ix-xs/djs-bot@latest
```

## Finding the old names

The first use of an old name prints one `DeprecationWarning` with its code, for example `DJS_BOT_DEP_ENV`, and the name to use instead.

```bash
# where each old name is used
node --trace-deprecation dist/index.js

# make the tests fail on the first old name
NODE_OPTIONS=--throw-deprecation npm test
```

```ts
// collect them in a running bot
process.on("warning", (warning) => {
  if ((warning as { code?: string }).code?.startsWith("DJS_BOT_DEP_")) console.warn(warning.message);
});
```

A warning only appears for code that runs. To find every use, search the code for the names below.

## Version 1.7

node-comfort 3.1 takes over the rate limiter and the circuit breaker, which were ported to it from djs-bot. The old names are now node-comfort's objects and behave like them. The `rateLimit()` guard and the `antiSpam()` plugin stay.

### Replaced by node-comfort

| 1.6 | 1.7 | Warning code |
| --- | --- | --- |
| `createRateLimiter(options)` | `nc.quota.create(options)` | `DJS_BOT_DEP_RATE_LIMITER` |
| `RateLimiter` | `Quota` (`nc.quota.Quota`) | `DJS_BOT_DEP_RATE_LIMITER` |
| `RateLimiterOptions`, `RateLimitResult` | `QuotaOptions`, `QuotaResult` | `DJS_BOT_DEP_RATE_LIMITER` |
| `createCircuitBreaker(options)` | `nc.circuit.create(options)` | `DJS_BOT_DEP_CIRCUIT_BREAKER` |
| `CircuitBreaker` | `Circuit` (`nc.circuit.Circuit`) | `DJS_BOT_DEP_CIRCUIT_BREAKER` |
| `CircuitOpenError` | `nc.errors.CircuitOpenError`. Only `new CircuitOpenError()` warns: `instanceof` still matches | `DJS_BOT_DEP_CIRCUIT_BREAKER` |
| `CircuitBreakerOptions`, `CircuitState` | `CircuitOptions`, `CircuitStatus` | `DJS_BOT_DEP_CIRCUIT_BREAKER` |

| Behaviour | 1.6 | 1.7 |
| --- | --- | --- |
| Invalid `limit`, `window`, cost, threshold or `resetTimeout` | Fell back on a default | Throws when created, `rateLimit()` and `antiSpam()` included |
| `reset(key)` of a quota | | Returns `true` when the key had a window |
| Keys of a quota | Strings | Strings or numbers |
| `onOpen`, `onClose` | | Run after the status has changed. A throw in `onClose` rejects that call but is not counted as a failure |
| Rejected call | djs-bot's `CircuitOpenError` | node-comfort's, message `The circuit is open: the call was rejected`, `code: "ERR_CIRCUIT_OPEN"` |

node-comfort's pages: [quota](https://ix-xs.github.io/node-comfort/flow/quota/), [circuit](https://ix-xs.github.io/node-comfort/flow/circuit/). Node.js versions are unchanged.

## Version 1.6

djs-bot stops offering its own copies of what node-comfort does: environment variables, retries, timeouts and the cache. `nc` is `import nc from "@ix-xs/node-comfort"`, already installed with djs-bot.

### Replaced by node-comfort

| 1.5 | 1.6 | Warning code |
| --- | --- | --- |
| `env(name)` | `nc.env.required(name)` | `DJS_BOT_DEP_ENV` |
| `env(name, fallback)` | `nc.env.string(name, { default: fallback })` | `DJS_BOT_DEP_ENV` |
| `env.optional(name)` | `nc.env.string(name, { optional: true })`. `nc.env.get(name)` gives an empty value as `""` | `DJS_BOT_DEP_ENV` |
| `env.number(name, fallback)` | `nc.env.number(name, { default: fallback })`, which also refuses `Infinity` | `DJS_BOT_DEP_ENV` |
| `env.boolean(name)` | `nc.env.boolean(name, { default: false })`. Without `default` it is required | `DJS_BOT_DEP_ENV` |
| `env.list(name)` | `nc.env.list(name, { default: [] })`. Without `default` it is required | `DJS_BOT_DEP_ENV` |
| `loadEnvFile(path)` | `nc.env.load(path)` | `DJS_BOT_DEP_LOAD_ENV_FILE` |
| `retry(fn, options)` | `nc.async.retry(fn, { delay: 200, backoff: 2, jitter: 0.2, ...options })`, to keep the waits | `DJS_BOT_DEP_RETRY_TIMEOUT` |
| `timeout(promise, ms, message)` | `nc.async.timeout(promise, ms, message)` | `DJS_BOT_DEP_RETRY_TIMEOUT` |
| `RetryOptions` | The options of `nc.async.retry()`, same names | `DJS_BOT_DEP_RETRY_TIMEOUT` |
| `createCache(options)`, `new TTLCache(options)` | `nc.cache.create({ ttl: "5m", max: 1000, ...options })`, to keep the defaults | `DJS_BOT_DEP_CACHE` |
| `cache.getOrFetch(key, load)` | `cache.getOrSet(key, load)` | `DJS_BOT_DEP_CACHE` |
| `cache.set(key, value, ttl)` | `cache.set(key, value, { ttl })` | `DJS_BOT_DEP_CACHE` |
| `TTLCacheOptions` | The options of `nc.cache.create()` | `DJS_BOT_DEP_CACHE` |

| Behaviour | 1.5 | 1.6 with node-comfort |
| --- | --- | --- |
| Missing or invalid variable | `Error` | `ValidationError` |
| Retry defaults | `delay: 200`, `backoff: 2`, `jitter: 0.2` | `delay: 0`, `backoff: 1`, `jitter: 0` |
| Cache defaults | `ttl: "5m"`, `max: 1000` | Entries kept forever, no size limit |
| `staleWhileRevalidate` | `true`: expired values served by `getOrFetch`, `get()` and `has()` | A time window, served by `getOrSet` only. `get()` and `has()` no longer return expired values |

The details are on node-comfort's pages: [environment variables](https://ix-xs.github.io/node-comfort/essentials/env/), [retry and timeout](https://ix-xs.github.io/node-comfort/flow/async/#retry), [cache](https://ix-xs.github.io/node-comfort/flow/cache/). `resolve` and `isHiddenChannel`, which are about Discord, stay in djs-bot.

### The entry file

The bot reads `DISCORD_TOKEN`, `DISCORD_CLIENT_ID` and `DISCORD_DEV_GUILD` by itself, and node-comfort loads `.env` at import. `djs-bot init` no longer writes them in the starter, and the lines that only read them can go:

```ts
// 1.5
const bot = defineBot({
  token: env("DISCORD_TOKEN"),
  clientId: env.optional("DISCORD_CLIENT_ID"),
  features: `${import.meta.dirname}/features`,
  deploy: { devGuildId: env.optional("DISCORD_DEV_GUILD") },
});
```

```ts
// 1.6
const bot = defineBot({
  features: `${import.meta.dirname}/features`,
});
```

## Version 1.5

### Renamed

| 1.4 | 1.5 | Warning code |
| --- | --- | --- |
| `oneOf("a", "b")`, imported from the root | `p.oneOf("a", "b")` | `DJS_BOT_DEP_ONEOF` |
| `audit: { sink: x }` | `audit: { sinks: [x] }` | `DJS_BOT_DEP_AUDIT_SINK` |
| `emoji.custom(name, id, animated)` | `emoji.format({ name, id, animated })` | `DJS_BOT_DEP_EMOJI_CUSTOM` |
| `defineSelectMenu({ ... })` | `defineStringSelect({ ... })`, same options | `DJS_BOT_DEP_DEFINE_SELECT_MENU` |
| `normalizeSharding()`, `launchShardManager()` | None: internal now. Use the `sharding` option of `defineBot()` | `DJS_BOT_DEP_SHARDING_INTERNALS` |

```ts
// 1.4
import { defineSelectMenu, emoji, oneOf, p } from "@ix-xs/djs-bot";
const params = { action: oneOf("approve", "reject"), id: p.string };
emoji.custom("blob", "1234567890", true);
```

```ts
// 1.5
import { defineStringSelect, emoji, p } from "@ix-xs/djs-bot";
const params = { action: p.oneOf("approve", "reject"), id: p.string };
emoji.format({ name: "blob", id: "1234567890", animated: true });
```

### New exports

| Export | For |
| --- | --- |
| `CronField` | The type of one parsed field of a cron schedule. See [Scheduled jobs](/events/jobs/) |

### node-comfort 3.0

djs-bot 1.5 depends on `@ix-xs/node-comfort` 3.0. npm installs it with the package.

| Your bot | What to do |
| --- | --- |
| Does not import `@ix-xs/node-comfort` | Nothing |
| Imports it, at 2.x | It gets its own copy, as before. Upgrading it to 3.0 shares one copy with djs-bot |
| Imports it, at 3.x | Nothing |

node-comfort 3.0 keeps the 2.x names until 4.0, with a warning each: see [its upgrade page](https://ix-xs.github.io/node-comfort/help/upgrade-3-0/). The `.env` file is still read at import, with the same rules ([Configuration](/basics/configuration/#environment-variables)).
