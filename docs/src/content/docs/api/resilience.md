---
title: "Resilience"
description: "Rate limiters, circuit breakers, retry and timeout — every option explained."
sidebar:
  order: 15
---

Four primitives for the moment your bot depends on something that can be slow,
flaky or abused. They are plain functions — usable inside handlers, services,
jobs or anywhere else.

## Rate limiting

### `rateLimit()` — as a guard

More expressive than [`cooldown`](/djs-bot/api/guards/#cooldown), which is one
use per duration:

```ts
guards: [rateLimit({ limit: 5, window: "1m" })]                    // 5 per minute per user
guards: [rateLimit({ limit: 100, window: "1h", scope: "guild" })]  // 100 per hour per server
```

| Option | Type | Description |
| --- | --- | --- |
| `limit` | `number` | **Required.** Hits allowed per window. |
| `window` | `number \| string` | **Required.** Window length, ms or a duration. |
| `scope` | `"user" \| "guild" \| "channel" \| "global"` | What to count by. Default `"user"`. |

The failure message tells the user exactly how long to wait.

### `createRateLimiter()` — programmatic

```ts
const limiter = createRateLimiter({ limit: 10, window: "1m" });

const result = limiter.consume(userId);      // cost defaults to 1
if (!result.allowed) return ctx.reply.error(`Wait ${Math.ceil(result.resetMs / 1000)}s.`);
```

| Member | Description |
| --- | --- |
| `consume(key, cost?)` | Records a hit and returns a `RateLimitResult`. |
| `reset(key)` | Clears the window for a key. |

`RateLimitResult`: `allowed` (`boolean`), `remaining` (`number`), `resetMs`
(milliseconds until the window resets).

A `cost` above 1 lets expensive operations count for more:

```ts
limiter.consume(userId, isBulkOperation ? 5 : 1);
```

## Circuit breaker

Stops hammering a service that is already failing, and gives it room to recover.

```ts
const breaker = createCircuitBreaker({ failureThreshold: 5, resetTimeout: "30s" });

const data = await breaker.run(() => externalApi.fetch(id));
```

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `failureThreshold` | `number` | `5` | Consecutive failures before the circuit opens. |
| `resetTimeout` | `number \| string` | `"30s"` | How long it stays open before a trial call. |
| `successThreshold` | `number` | `1` | Successful trials needed to fully close. |
| `isFailure` | `(error) => boolean` | all errors | Decide what counts as a failure. |
| `onOpen` | `() => void` | — | Called when the circuit opens. |
| `onClose` | `() => void` | — | Called when it closes. |

### States

| State | Behaviour |
| --- | --- |
| `closed` | Normal. Calls go through; failures are counted. |
| `open` | Calls fail immediately with `CircuitOpenError`, without touching the service. |
| `half-open` | After `resetTimeout`, one trial is allowed. Success closes the circuit; failure reopens it. |

```ts
import { CircuitOpenError } from "@ix-xs/djs-bot";

try {
  const data = await breaker.run(() => api.fetch());
  return ctx.reply.info(data.title);
} catch (error) {
  if (error instanceof CircuitOpenError) {
    return ctx.reply.error("That service is down right now — try again in a minute.");
  }
  throw error;
}
```

Read the current state with `breaker.state`.

Ignore expected errors so they do not trip the breaker:

```ts
createCircuitBreaker({
  isFailure: (error) => !(error instanceof NotFoundError),   // a 404 is not an outage
  onOpen: () => logger.warn("payment API circuit opened"),
})
```

## `retry()`

```ts
retry(fn, options?): Promise<T>
```

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `attempts` | `number` | `3` | Total attempts, including the first. |
| `delay` | `number` | `200` | Base delay in ms. |
| `backoff` | `number` | `2` | Exponential multiplier. |
| `maxDelay` | `number` | — | Cap on the delay. |
| `shouldRetry` | `(error, attempt) => boolean` | retry everything | Decide whether to try again. |
| `onRetry` | `(error, attempt) => void` | — | Called before each retry. |

```ts
const user = await retry(() => api.getUser(id), {
  attempts: 4,
  delay: 250,        // 250ms → 500ms → 1s
  maxDelay: 2000,
  shouldRetry: (error) => isNetworkError(error),
  onRetry: (error, attempt) => logger.warn({ err: error, attempt }, "retrying"),
});
```

:::caution[Retry only idempotent work]
Retrying a read is safe. Retrying "send a message" can post it three times.
Guard non-idempotent calls with `shouldRetry`, or do not retry them.
:::

## `timeout()`

```ts
timeout(promiseOrFactory, ms, message?): Promise<T>
```

Rejects if the promise has not settled in time:

```ts
const data = await timeout(api.slowCall(), 5000, "the API took too long");
const data = await timeout(() => api.slowCall(), 5000);   // a factory works too
```

Essential inside interaction handlers, where Discord itself gives you 3 seconds
before a deferral and 15 minutes afterwards.

## Combining them

The usual production stack, outermost first:

```ts
const result = await breaker.run(() =>
  retry(() => timeout(api.fetch(id), 3000), {
    attempts: 3,
    shouldRetry: (error) => !(error instanceof NotFoundError),
  }),
);
```

- `timeout` bounds a single attempt,
- `retry` handles transient blips,
- the breaker stops trying once the service is genuinely down.

Wrap that in a service so your handlers stay readable:

```ts title="features/api/api.service.ts"
export default defineService("api", {
  factory: () => {
    const breaker = createCircuitBreaker({ failureThreshold: 5 });
    return {
      fetch: (id: string) =>
        breaker.run(() => retry(() => timeout(rawFetch(id), 3000), { attempts: 3 })),
    };
  },
});
```
