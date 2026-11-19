/**
 * Production resilience primitives: rate limiting, circuit breaking, retry and
 * timeout. Reach for these in services that call databases or third-party APIs.
 *
 * Only the `rateLimit()` guard is the framework's own. The rest is deprecated
 * in favour of `@ix-xs/node-comfort`, which it now wraps: `nc.quota` for the rate
 * limiter, `nc.circuit` for the circuit breaker, `nc.async.retry` and
 * `nc.async.timeout`.
 *
 * @module resilience
 */
import comfort from "@ix-xs/node-comfort";
import { deprecated } from "./deprecate.js";
import { guard, pass, fail, scopeKey, type Guard, type CooldownScope } from "./guards.js";
import { messageFor } from "./messages.js";

/* ------------------------------ Rate limiter ----------------------------- */

/**
 * Options for {@link createRateLimiter}.
 * @deprecated Use `QuotaOptions`, the options of `nc.quota.create()`: the same
 * names. It will be removed in 2.0.
 */
export interface RateLimiterOptions {
  /** Max number of allowed hits per window. */
  limit: number;
  /** The window length: ms, or a duration like `"1m"`. */
  window: number | string;
}

/**
 * The outcome of a {@link RateLimiter.consume} call.
 * @deprecated Use `QuotaResult`, what `nc.quota.create().consume()` returns:
 * the same fields. It will be removed in 2.0.
 */
export interface RateLimitResult {
  /** Whether this hit is within the limit. */
  allowed: boolean;
  /** Remaining hits in the current window. */
  remaining: number;
  /** Milliseconds until the window resets. */
  resetMs: number;
}

/**
 * A fixed-window rate limiter, keyed by an arbitrary string.
 *
 * It is node-comfort's `Quota` (`nc.quota.Quota`), under its old name.
 *
 * @deprecated Use `nc.quota.create({ limit, window })`, or `new nc.quota.Quota()`.
 * The same counting, with these differences: a `limit`, a `window` or a cost
 * that is not valid throws instead of falling back on a default (a window of
 * one minute), keys may be numbers too, and `reset()` says whether the key had
 * a window. It will be removed in 2.0.
 */
export class RateLimiter extends comfort.quota.Quota {
  public constructor(options: RateLimiterOptions) {
    deprecated("DJS_BOT_DEP_RATE_LIMITER", "RateLimiter", "nc.quota.create()");
    super(options);
  }
}

/**
 * Creates a {@link RateLimiter}.
 * @deprecated Use `nc.quota.create({ limit, window })`. See {@link RateLimiter}
 * for the differences. It will be removed in 2.0.
 */
export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  deprecated("DJS_BOT_DEP_RATE_LIMITER", "createRateLimiter()", "nc.quota.create()");
  return new RateLimiter(options);
}

/**
 * A guard that allows `limit` uses per `window`, per scope (default `"user"`).
 * More expressive than {@link cooldown} (which is 1 use per duration).
 *
 * A `limit` or a `window` that is not valid throws when the guard is created.
 *
 * @example guards: [rateLimit({ limit: 5, window: "1m" })]
 */
export function rateLimit(
  options: RateLimiterOptions & {
    /** What shares one budget: each user, each guild, each channel or everyone. Default `"user"`. */
    scope?: CooldownScope;
  },
): Guard {
  const quota = comfort.quota.create({ limit: options.limit, window: options.window });
  const scope = options.scope ?? "user";
  return guard("rateLimit", (ctx) => {
    const result = quota.consume(scopeKey(ctx, scope));
    return result.allowed
      ? pass()
      : fail(messageFor(ctx, "rateLimited", { seconds: Math.ceil(result.resetMs / 1000) }));
  });
}

/* ----------------------------- Circuit breaker --------------------------- */

/**
 * The state of a {@link CircuitBreaker}.
 * @deprecated Use `CircuitStatus`, the same three states, from node-comfort.
 * It will be removed in 2.0.
 */
export type CircuitState = "closed" | "open" | "half-open";

/**
 * Options for {@link createCircuitBreaker}.
 * @deprecated Use `CircuitOptions`, the options of `nc.circuit.create()`: the
 * same names. It will be removed in 2.0.
 */
export interface CircuitBreakerOptions {
  /** Consecutive failures before the circuit opens. Default `5`. */
  failureThreshold?: number;
  /** How long the circuit stays open before a trial. ms or duration. Default `"30s"`. */
  resetTimeout?: number | string;
  /** Successful trials needed to fully close from half-open. Default `1`. */
  successThreshold?: number;
  /** Decide whether an error counts as a failure (default: all errors do). */
  isFailure?: (error: unknown) => boolean;
  /** Called when the circuit opens. */
  onOpen?: () => void;
  /** Called when the circuit closes. */
  onClose?: () => void;
}

/**
 * Error thrown when calls are rejected because the circuit is open.
 *
 * It is node-comfort's `CircuitOpenError` under its old name: `instanceof`
 * matches every error a circuit rejects a call with, those of
 * `nc.circuit.create()` included.
 *
 * @deprecated Use `nc.errors.CircuitOpenError`. Its message is now "The
 * circuit is open: the call was rejected", and it has `code:
 * "ERR_CIRCUIT_OPEN"`. It will be removed in 2.0.
 */
export class CircuitOpenError extends comfort.errors.CircuitOpenError {
  public constructor() {
    deprecated("DJS_BOT_DEP_CIRCUIT_BREAKER", "CircuitOpenError", "nc.errors.CircuitOpenError");
    super();
  }

  /** Any `CircuitOpenError` of node-comfort is one. */
  public static override [Symbol.hasInstance](value: unknown): boolean {
    return value instanceof comfort.errors.CircuitOpenError;
  }
}

/**
 * A circuit breaker: after too many failures it "opens" and fails fast for a
 * cool-off period, then tries again ("half-open") before fully recovering.
 * Protects you (and the dependency) from hammering a failing service.
 *
 * It is node-comfort's `Circuit` (`nc.circuit.Circuit`), under its old name.
 *
 * @deprecated Use `nc.circuit.create(options)`, or `new nc.circuit.Circuit()`.
 * The same states and options, with these differences: a threshold or a
 * `resetTimeout` that is not valid throws instead of falling back on a
 * default; `onOpen` and `onClose` run after the status has changed; a throw in
 * `onClose` rejects that call but no longer counts as a failure; and the
 * {@link CircuitOpenError} has a new message and a code. It will be removed in 2.0.
 */
export class CircuitBreaker extends comfort.circuit.Circuit {
  public constructor(options: CircuitBreakerOptions = {}) {
    deprecated("DJS_BOT_DEP_CIRCUIT_BREAKER", "CircuitBreaker", "nc.circuit.create()");
    super(options);
  }
}

/**
 * Creates a {@link CircuitBreaker}.
 * @deprecated Use `nc.circuit.create(options)`. See {@link CircuitBreaker} for
 * the differences. It will be removed in 2.0.
 */
export function createCircuitBreaker(options?: CircuitBreakerOptions): CircuitBreaker {
  deprecated("DJS_BOT_DEP_CIRCUIT_BREAKER", "createCircuitBreaker()", "nc.circuit.create()");
  return new CircuitBreaker(options);
}

/* -------------------------------- Retry / timeout ------------------------ */

/**
 * Options for {@link retry}.
 * @deprecated Use the options of `nc.async.retry()`: the same names. It will be removed in 2.0.
 */
export interface RetryOptions {
  /** Max attempts (including the first). Default `3`. */
  attempts?: number;
  /** Base delay between attempts, in ms or as text (`"1s"`). Default `200`. */
  delay?: number | string;
  /** Exponential backoff multiplier. Default `2`. */
  backoff?: number;
  /** Max delay cap, in ms or as text (`"30s"`). */
  maxDelay?: number | string;
  /**
   * Randomises each delay so that many callers do not retry in step: `0` for
   * none, up to `1` for anywhere between zero and twice the delay. Default `0.2`.
   */
  jitter?: number;
  /** Decide whether to retry after an error. */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  /** Called before each retry. */
  onRetry?: (error: unknown, attempt: number) => void;
  /**
   * Stops retrying once aborted, for example the `ctx.signal` of a job. The
   * attempt in progress is not interrupted.
   */
  signal?: AbortSignal;
}

/**
 * Retries an async function with exponential backoff + jitter. An attempt that
 * fails because it was aborted (an `AbortError`) is not tried again.
 *
 * @deprecated Use `nc.async.retry(fn, options)`. The options have the same
 * names, but not the same defaults: there they are `delay: 0`, `backoff: 1`
 * and `jitter: 0`, so pass `{ delay: 200, backoff: 2, jitter: 0.2 }` to keep
 * what this one does. It will be removed in 2.0.
 * @example await retry(() => fetchFromApi(), { attempts: 5, delay: 300 });
 */
export function retry<T>(fn: () => T | Promise<T>, options: RetryOptions = {}): Promise<T> {
  deprecated("DJS_BOT_DEP_RETRY_TIMEOUT", "retry()", "nc.async.retry()");
  return comfort.async.retry(fn, {
    ...options,
    // The documented defaults. Without them the retries would fire back to back.
    delay: options.delay ?? 200,
    backoff: options.backoff ?? 2,
    jitter: options.jitter ?? 0.2,
  }) as Promise<T>;
}

/**
 * Rejects if `promise` doesn't settle within `ms` (milliseconds, or text such
 * as `"5s"`). Given a function, it passes it a signal that aborts when the
 * time is up, so the work can stop too.
 *
 * @deprecated Use `nc.async.timeout(promise, ms, message)`, the same
 * function. It will be removed in 2.0.
 * @example await timeout(fetchFromApi(), 5000, "API too slow");
 * @example await timeout((signal) => fetch(url, { signal }), "5s");
 */
export function timeout<T>(
  promise: Promise<T> | ((signal: AbortSignal) => Promise<T>),
  ms: number | string,
  message?: string,
): Promise<T> {
  deprecated("DJS_BOT_DEP_RETRY_TIMEOUT", "timeout()", "nc.async.timeout()");
  return comfort.async.timeout(promise, ms, message) as Promise<T>;
}
