/**
 * Production resilience primitives: rate limiting, circuit breaking, retry and
 * timeout. Reach for these in services that call databases or third-party APIs.
 *
 * `retry` and `timeout` are thin, typed wrappers over `@ix-xs/node-comfort`.
 *
 * @module resilience
 */
import comfort from "@ix-xs/node-comfort";
import { guard, pass, fail, type Guard, type CooldownScope } from "./guards.js";

function toMs(value: number | string, fallback = 0): number {
  if (typeof value === "number") return value;
  return comfort.time.parseDuration(value) ?? fallback;
}

/* ------------------------------ Rate limiter ----------------------------- */

/** Options for {@link createRateLimiter}. */
export interface RateLimiterOptions {
  /** Max number of allowed hits per window. */
  limit: number;
  /** The window length: ms, or a duration like `"1m"`. */
  window: number | string;
}

/** The outcome of a {@link RateLimiter.consume} call. */
export interface RateLimitResult {
  /** Whether this hit is within the limit. */
  allowed: boolean;
  /** Remaining hits in the current window. */
  remaining: number;
  /** Milliseconds until the window resets. */
  resetMs: number;
}

/** A fixed-window rate limiter, keyed by an arbitrary string. */
export class RateLimiter {
  private readonly windows = new Map<string, { count: number; resetAt: number }>();
  private readonly limit: number;
  private readonly windowMs: number;

  public constructor(options: RateLimiterOptions) {
    this.limit = options.limit;
    this.windowMs = toMs(options.window, 60_000);
  }

  /** Records a hit for `key` (cost defaults to 1) and reports whether it's allowed. */
  public consume(key: string, cost = 1): RateLimitResult {
    const now = Date.now();
    let entry = this.windows.get(key);
    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + this.windowMs };
      this.windows.set(key, entry);
    }
    const resetMs = entry.resetAt - now;
    if (entry.count + cost > this.limit) {
      return { allowed: false, remaining: Math.max(0, this.limit - entry.count), resetMs };
    }
    entry.count += cost;
    return { allowed: true, remaining: this.limit - entry.count, resetMs };
  }

  /** Clears the window for a key. */
  public reset(key: string): void {
    this.windows.delete(key);
  }
}

/** Creates a {@link RateLimiter}. */
export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  return new RateLimiter(options);
}

/**
 * A guard that allows `limit` uses per `window`, per scope (default `"user"`).
 * More expressive than {@link cooldown} (which is 1 use per duration).
 *
 * @example guards: [rateLimit({ limit: 5, window: "1m" })]
 */
export function rateLimit(
  options: RateLimiterOptions & { scope?: CooldownScope },
): Guard {
  const limiter = new RateLimiter(options);
  const scope = options.scope ?? "user";
  return guard("rateLimit", (ctx) => {
    const id =
      scope === "user"
        ? ctx.user.id
        : scope === "guild"
          ? (ctx.guildId ?? ctx.user.id)
          : scope === "channel"
            ? (ctx.channel?.id ?? ctx.user.id)
            : "global";
    const result = limiter.consume(id);
    return result.allowed
      ? pass()
      : fail(`Rate limit reached. Try again in ${Math.ceil(result.resetMs / 1000)}s.`);
  });
}

/* ----------------------------- Circuit breaker --------------------------- */

/** The state of a {@link CircuitBreaker}. */
export type CircuitState = "closed" | "open" | "half-open";

/** Options for {@link createCircuitBreaker}. */
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

/** Error thrown when calls are rejected because the circuit is open. */
export class CircuitOpenError extends Error {
  public constructor() {
    super("Circuit is open — call rejected.");
    this.name = "CircuitOpenError";
  }
}

/**
 * A circuit breaker: after too many failures it "opens" and fails fast for a
 * cool-off period, then tries again ("half-open") before fully recovering.
 * Protects you (and the dependency) from hammering a failing service.
 */
export class CircuitBreaker {
  private state: CircuitState = "closed";
  private failures = 0;
  private successes = 0;
  private openedAt = 0;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly successThreshold: number;
  private readonly isFailure: (error: unknown) => boolean;

  public constructor(private readonly options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetTimeoutMs = toMs(options.resetTimeout ?? "30s", 30_000);
    this.successThreshold = options.successThreshold ?? 1;
    this.isFailure = options.isFailure ?? (() => true);
  }

  /** The current state. */
  public get status(): CircuitState {
    return this.state;
  }

  /** Runs `fn` through the breaker. Throws {@link CircuitOpenError} when open. */
  public async execute<T>(fn: () => Promise<T> | T): Promise<T> {
    if (this.state === "open") {
      if (Date.now() - this.openedAt < this.resetTimeoutMs) throw new CircuitOpenError();
      this.state = "half-open";
      this.successes = 0;
    }
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      if (this.isFailure(error)) this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === "half-open") {
      this.successes++;
      if (this.successes >= this.successThreshold) this.close();
    } else {
      this.failures = 0;
    }
  }

  private onFailure(): void {
    this.failures++;
    if (this.state === "half-open" || this.failures >= this.failureThreshold) this.open();
  }

  private open(): void {
    if (this.state !== "open") this.options.onOpen?.();
    this.state = "open";
    this.openedAt = Date.now();
  }

  private close(): void {
    if (this.state !== "closed") this.options.onClose?.();
    this.state = "closed";
    this.failures = 0;
    this.successes = 0;
  }
}

/** Creates a {@link CircuitBreaker}. */
export function createCircuitBreaker(options?: CircuitBreakerOptions): CircuitBreaker {
  return new CircuitBreaker(options);
}

/* -------------------------------- Retry / timeout ------------------------ */

/** Options for {@link retry}. */
export interface RetryOptions {
  /** Max attempts (including the first). Default `3`. */
  attempts?: number;
  /** Base delay between attempts in ms. Default `200`. */
  delay?: number;
  /** Exponential backoff multiplier. Default `2`. */
  backoff?: number;
  /** Max delay cap in ms. */
  maxDelay?: number;
  /** Decide whether to retry after an error. */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  /** Called before each retry. */
  onRetry?: (error: unknown, attempt: number) => void;
}

/**
 * Retries an async function with exponential backoff + jitter.
 * @example await retry(() => fetchFromApi(), { attempts: 5, delay: 300 });
 */
export function retry<T>(fn: () => T | Promise<T>, options?: RetryOptions): Promise<T> {
  return comfort.func.retry(fn, options);
}

/**
 * Rejects if `promise` doesn't settle within `ms`.
 * @example await timeout(fetchFromApi(), 5000, "API too slow");
 */
export function timeout<T>(promise: Promise<T> | (() => Promise<T>), ms: number, message?: string): Promise<T> {
  return comfort.func.timeout(promise, ms, message);
}
