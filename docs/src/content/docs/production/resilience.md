---
title: "Resilience"
description: "The rateLimit() guard for the day your bot is abused, and the quotas, circuits, retries and timeouts of node-comfort for the services it depends on."
sidebar:
  order: 4
---

A bot that calls a database or a third-party API inherits its bad days. The
`rateLimit()` guard decides how often a command may be used. Quotas, circuit
breakers, retries and timeouts come from node-comfort, usable in a handler, a
service or a job.

## A first rate limit

`rateLimit` is a guard: it allows a number of uses per time window, and refuses
the rest with a message that says how long to wait.

```ts title="src/features/search/search.command.ts"
import { defineCommand, rateLimit, s } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "search",
  description: "Search the catalogue",
  options: { query: s.string({ description: "What to look for", required: true }) },
  // Five searches per minute, for each user.
  guards: [rateLimit({ limit: 5, window: "1m" })],
  run: (ctx) => ctx.reply.info(`Searching for ${ctx.options.query}...`),
});
```

It is more expressive than `cooldown`, which allows one use per duration (see
[Guards](/commands/guards/)). `scope` chooses who shares the budget:

```ts
guards: [rateLimit({ limit: 100, window: "1h", scope: "guild" })]   // 100 per hour for a whole server
```

Each call to `rateLimit()` creates its own counters, so a guard written inline
limits that one command. To make several commands share a budget, create the
guard once and reuse the same value in each of them. A `limit` or a `window`
that is not valid throws when the guard is created.

The refusal reads "Rate limit reached. Try again in 12s." by default. Reword or
translate it with the `rateLimited` message, described in
[Wording and theme](/basics/wording-and-theme/).

:::note[Counters live in memory]
The limiter keeps its counts in the process. They start again from zero when the
bot restarts, and on a [sharded](/production/sharding/) bot each shard counts on
its own. The same holds for a circuit.
:::

## Rate limiting in code

Outside a guard, count with `nc.quota.create({ limit, window })` and
`consume(key, cost)` from node-comfort ([its page](https://ix-xs.github.io/node-comfort/flow/quota/)). djs-bot's
`createRateLimiter()` is deprecated.

## Circuit breakers

To stop calling a service that is already failing, use `nc.circuit.create()`,
`execute()` and `nc.errors.CircuitOpenError` from node-comfort
([its page](https://ix-xs.github.io/node-comfort/flow/circuit/)). Create one circuit per dependency and keep it for the
life of the process, in a module or a service. djs-bot's `createCircuitBreaker()`
is deprecated.

## Retrying and bounding a call

Retries and timeouts come from node-comfort: `nc.async.retry()` and
`nc.async.timeout()` ([their page](https://ix-xs.github.io/node-comfort/flow/async/#retry)). With no options,
`nc.async.retry()` tries again at once; pass `{ delay: 200, backoff: 2, jitter: 0.2 }`
for the waits of djs-bot's own `retry()`, which is deprecated.

## Combining them

The usual stack for an external call, outermost first:

```ts
const result = await breaker.execute(() =>
  nc.async.retry(() => nc.async.timeout(api.fetch(id), 3000), {
    attempts: 3,
    delay: 300,
    backoff: 2,
    shouldRetry: (error) => !(error instanceof NotFoundError),
  }),
);
```

- `nc.async.timeout` bounds one attempt. Its `TimeoutError` is retried like
  any other failure.
- `nc.async.retry` absorbs a passing failure.
- The breaker stops trying once the service is really down, and sees one
  failure per exhausted retry, not one per attempt.

To cap the total time instead of each attempt, swap the two inner calls:
`nc.async.timeout(nc.async.retry(() => api.fetch(id), { attempts: 3 }), 4000)`.

Put the stack in a [service](/architecture/services/) so the handlers stay
readable and the breaker is shared:

```ts title="src/features/weather/weather.service.ts"
import { defineService } from "@ix-xs/djs-bot";
import nc from "@ix-xs/node-comfort";
import { fetchWeather } from "./weather.api.js";

export default defineService("weather", {
  factory: () => {
    const breaker = nc.circuit.create({ failureThreshold: 3, resetTimeout: "1m" });
    return {
      get: (city: string) =>
        breaker.execute(() =>
          nc.async.retry(() => nc.async.timeout(fetchWeather(city), 3000), { attempts: 3, delay: 300, backoff: 2 }),
        ),
    };
  },
});
```

## Reference

Every option, property and type, with what it accepts and returns, is in the API reference:

- `rateLimit()`: A guard that allows `limit` uses per `window`, per scope (default `"user"`).

## See also

- [Guards](/commands/guards/): `cooldown` and the other preconditions.
- [Services](/architecture/services/): where a breaker or a limiter should live.
- [Automatic deferral](/basics/automatic-deferral/): staying inside Discord's 3 seconds.
- [Health and metrics](/production/health/): seeing errors and slow handlers add up.
- [Errors](/api/errors/): what happens when a handler throws.
