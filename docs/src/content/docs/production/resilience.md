---
title: "Resilience"
description: "Four small tools for the day your bot depends on something that can be slow, flaky or abused: a rate limiter, a circuit breaker, retry and timeout."
sidebar:
  order: 4
---

A bot that calls a database or a third-party API inherits its bad days. These
four tools are plain functions with no setup, usable in a handler, a service or
a job. Each one answers a different question: how often may this be used, should
I still try, should I try again, and how long do I wait.

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
guard once and reuse the same value in each of them.

The refusal reads "Rate limit reached. Try again in 12s." by default. Reword or
translate it with the `rateLimited` message, described in
[Wording and theme](/basics/wording-and-theme/).

:::note[Counters live in memory]
The limiter keeps its counts in the process. They start again from zero when the
bot restarts, and on a [sharded](/production/sharding/) bot each shard counts on
its own. The same holds for the circuit breaker.
:::

## Rate limiting in code

Outside a guard, use the limiter directly. The key is any string: a user id, a
guild id, an API key.

```ts title="src/features/export/exports.service.ts"
import { createRateLimiter, defineService } from "@ix-xs/djs-bot";

export default defineService("exports", {
  factory: () => {
    const limiter = createRateLimiter({ limit: 10, window: "1h" });
    return {
      /** Counts one export for a guild. A full export weighs five. */
      take: (guildId: string, full = false) => limiter.consume(guildId, full ? 5 : 1),
    };
  },
});
```

`consume` records the hit and tells you where the key stands:

```ts
const { allowed, remaining, resetMs } = limiter.consume(userId);
if (!allowed) return ctx.reply.error(`Wait ${Math.ceil(resetMs / 1000)}s.`);
```

The second argument is a cost, `1` by default, so an expensive operation can
count for more. A hit that does not fit is refused and consumes nothing.

The window is fixed: it opens at the first hit of a key and closes after
`window`, whatever happens in between. Closed windows are swept as the limiter
is used, so keys that never come back (one-off users, guilds the bot left) do
not pile up.

## Circuit breakers

A circuit breaker stops calling a service that is already failing. That keeps
your handlers fast while it is down, and gives it room to recover.

```ts title="src/features/weather/weather.command.ts"
import { CircuitOpenError, createCircuitBreaker, defineCommand, s } from "@ix-xs/djs-bot";
import { fetchWeather } from "./weather.api.js";

const breaker = createCircuitBreaker({ failureThreshold: 5, resetTimeout: "30s" });

export default defineCommand({
  name: "weather",
  description: "Current weather",
  options: { city: s.string({ description: "City name", required: true }) },
  run: async (ctx) => {
    try {
      const report = await breaker.execute(() => fetchWeather(ctx.options.city));
      await ctx.reply.info(report.summary);
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        await ctx.reply.error("The weather service is down right now. Try again in a minute.");
        return;
      }
      throw error;
    }
  },
});
```

The breaker is always in one of three states, readable as `breaker.status`:

| State | Behaviour |
| --- | --- |
| `closed` | Normal. Calls go through. Failures are counted, and a success resets the count. |
| `open` | Calls fail at once with `CircuitOpenError`, without touching the service. |
| `half-open` | Once `resetTimeout` has passed, calls go through again as trials. `successThreshold` successes close the circuit. One failure opens it again. |

It opens after `failureThreshold` failures in a row. The error of a failed call
is always thrown back to you, whether it counts or not.

Not every error is an outage. `isFailure` decides what counts, and `onOpen` and
`onClose` tell you when the state changes:

```ts
const breaker = createCircuitBreaker({
  isFailure: (error) => !(error instanceof NotFoundError),   // a 404 is not an outage
  onOpen: () => logger.warn({}, "Payment API circuit opened"),
  onClose: () => logger.info({}, "Payment API circuit closed"),
});
```

Create one breaker per dependency and keep it for the life of the process (in a
module or a service). A breaker created inside a handler forgets everything at
each call.

## Retrying a call

`retry` runs a function again when it throws, and gives up with the last error
once the attempts are used.

```ts
const user = await retry(() => api.getUser(id), {
  attempts: 4,
  delay: 250,        // waits about 250 ms, then 500 ms, then 1 s
  backoff: 2,
  maxDelay: 2000,
  shouldRetry: (error) => isNetworkError(error),
  onRetry: (error, attempt) => logger.warn({ err: error, attempt }, "Retrying"),
});
```

With no options, `retry` makes three attempts, waiting about 200 ms and then
about 400 ms: `delay` defaults to `200`, `backoff` to `2` and `jitter` to
`0.2`. The jitter moves each wait by a random amount, so that many callers
hitting the same failure do not all come back at the same instant. `delay` and
`maxDelay` take milliseconds or text such as `"1s"`.

Two things end the retries before the attempts are used:

- **A signal.** Pass an `AbortSignal` as `signal`: once it is aborted, no
  further attempt is made and `retry` rejects with an `AbortError`. The attempt
  in progress is not interrupted. The `ctx.signal` of a
  [job](/events/jobs/) fits well, so a job that is being stopped does not keep
  retrying.
- **An aborted attempt.** An attempt that fails with an error named
  `AbortError`, such as a `fetch` you aborted yourself, is not tried again. A
  `TimeoutError` from `timeout()` is still retried.

```ts
// In a job: stop retrying as soon as the job is asked to stop.
await retry(() => syncLeaderboard(), { attempts: 5, delay: "1s", signal: ctx.signal });
```

:::caution[Retry only what is safe to repeat]
Retrying a read is harmless. Retrying "send a message" can post it three times.
Filter such calls with `shouldRetry`, or do not retry them.
:::

## Bounding a call

`timeout` rejects when a promise has not settled in time, so one slow
dependency cannot hold a handler forever.

```ts
const data = await timeout(api.slowCall(), 5000, "The API took too long");
const same = await timeout(() => api.slowCall(), "5s");   // a function works too, and so does "5s"
const page = await timeout((signal) => fetch(url, { signal }), "5s");   // aborted when the time is up
```

The rejection is an error named `TimeoutError`. Its message is the third
argument, or `Operation timed out after 5000ms` without one.

A promise you pass is not cancelled: `timeout` stops waiting for it, nothing
more. To stop the work too, pass a function. It receives an `AbortSignal` that
aborts when the time is up, and you hand that signal to whatever does the work,
as the `fetch` above does.

This matters most in interaction handlers, where Discord gives you 3 seconds to
answer or defer, and 15 minutes after that. See
[Automatic deferral](/basics/automatic-deferral/).

## Combining them

The usual stack for an external call, outermost first:

```ts
const result = await breaker.execute(() =>
  retry(() => timeout(api.fetch(id), 3000), {
    attempts: 3,
    delay: 300,
    backoff: 2,
    shouldRetry: (error) => !(error instanceof NotFoundError),
  }),
);
```

- `timeout` bounds one attempt. Its `TimeoutError` is retried like any other
  failure.
- `retry` absorbs a passing failure.
- The breaker stops trying once the service is really down, and sees one
  failure per exhausted retry, not one per attempt.

To cap the total time instead of each attempt, swap the two inner calls:
`timeout(retry(() => api.fetch(id), { attempts: 3 }), 4000)`.

Put the stack in a [service](/architecture/services/) so the handlers stay
readable and the breaker is shared:

```ts title="src/features/weather/weather.service.ts"
import { createCircuitBreaker, defineService, retry, timeout } from "@ix-xs/djs-bot";
import { fetchWeather } from "./weather.api.js";

export default defineService("weather", {
  factory: () => {
    const breaker = createCircuitBreaker({ failureThreshold: 3, resetTimeout: "1m" });
    return {
      get: (city: string) =>
        breaker.execute(() =>
          retry(() => timeout(fetchWeather(city), 3000), { attempts: 3, delay: 300, backoff: 2 }),
        ),
    };
  },
});
```

## Reference

Every option, property and type, with what it accepts and returns, is in the API reference:

- `rateLimit()`: A guard that allows `limit` uses per `window`, per scope (default `"user"`).
- `createRateLimiter()`: Creates a `RateLimiter`.
- `RateLimiter`: A fixed-window rate limiter, keyed by an arbitrary string.
- `RateLimitResult`: The outcome of a `RateLimiter.consume` call.
- `createCircuitBreaker()`: Creates a `CircuitBreaker`.
- `CircuitBreaker`: A circuit breaker: after too many failures it "opens" and fails fast for a cool-off period, then tries again ("half-open") before fully recovering.
- `CircuitOpenError`: Error thrown when calls are rejected because the circuit is open.
- `CircuitState`: The state of a `CircuitBreaker`.
- `retry()`: Retries an async function with exponential backoff + jitter.
- `RetryOptions`: Options for `retry`.
- `timeout()`: Rejects if `promise` doesn't settle within `ms` (milliseconds, or text such as `"5s"`).

## See also

- [Guards](/commands/guards/): `cooldown` and the other preconditions.
- [Services](/architecture/services/): where a breaker or a limiter should live.
- [Automatic deferral](/basics/automatic-deferral/): staying inside Discord's 3 seconds.
- [Health and metrics](/production/health/): seeing errors and slow handlers add up.
- [Errors](/api/errors/): what happens when a handler throws.
