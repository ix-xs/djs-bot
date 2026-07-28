/**
 * Feature flags — turn features/commands on or off globally or per guild, at
 * runtime, backed by a {@link KVStore} (so toggles survive restarts).
 *
 * Resolution order for `isEnabled(name, { guildId })`:
 *   guild override → global override → declared default → `false`.
 *
 * @module flags
 */
import { guard, pass, fail, type Guard } from "./guards.js";
import { memoryStore, type KVStore } from "./store.js";

/** A scope for reading/writing a flag. */
export interface FlagScope {
  guildId?: string | null;
  userId?: string;
}

/** A runtime feature-flag service. */
export interface FeatureFlags {
  /** Whether a flag is on for the given scope. */
  isEnabled(name: string, scope?: FlagScope): Promise<boolean>;
  /** Turns a flag on (globally, or for one guild). */
  enable(name: string, scope?: { guildId?: string }): Promise<void>;
  /** Turns a flag off (globally, or for one guild). */
  disable(name: string, scope?: { guildId?: string }): Promise<void>;
  /** Removes an override so it falls back to the next level. */
  clear(name: string, scope?: { guildId?: string }): Promise<void>;
  /** Sets the default used when there's no override. */
  setDefault(name: string, enabled: boolean): void;
  /** Effective flags for a guild (defaults merged with overrides). */
  list(guildId?: string): Promise<Record<string, boolean>>;
}

/** Options for {@link createFeatureFlags}. */
export interface FeatureFlagsOptions {
  /** Where overrides are persisted. Defaults to an in-memory store. */
  store?: KVStore;
  /** Default state per flag when no override exists. */
  defaults?: Record<string, boolean>;
}

const globalKey = (name: string) => `flag:${name}:global`;
const guildKey = (name: string, guildId: string) => `flag:${name}:guild:${guildId}`;

/**
 * Creates a {@link FeatureFlags} service.
 * @example
 * const flags = createFeatureFlags({ store, defaults: { economy: true } });
 * await flags.disable("economy", { guildId });   // off in this guild only
 */
export function createFeatureFlags(options: FeatureFlagsOptions = {}): FeatureFlags {
  const store = (options.store ?? memoryStore()) as KVStore<boolean>;
  const defaults: Record<string, boolean> = { ...options.defaults };

  return {
    async isEnabled(name, scope = {}) {
      if (scope.guildId) {
        const override = await store.get(guildKey(name, scope.guildId));
        if (override !== undefined) return override;
      }
      const global = await store.get(globalKey(name));
      if (global !== undefined) return global;
      return defaults[name] ?? false;
    },
    async enable(name, scope = {}) {
      await store.set(scope.guildId ? guildKey(name, scope.guildId) : globalKey(name), true);
    },
    async disable(name, scope = {}) {
      await store.set(scope.guildId ? guildKey(name, scope.guildId) : globalKey(name), false);
    },
    async clear(name, scope = {}) {
      await store.delete(scope.guildId ? guildKey(name, scope.guildId) : globalKey(name));
    },
    setDefault(name, enabled) {
      defaults[name] = enabled;
    },
    async list(guildId) {
      const result: Record<string, boolean> = { ...defaults };
      for (const key of await store.keys()) {
        const m = /^flag:(.+):(global|guild:(.+))$/.exec(key);
        if (!m) continue;
        const [, name, kind] = m;
        const value = await store.get(key);
        if (value === undefined || name === undefined) continue;
        if (kind === "global") result[name] = value;
        else if (guildId && kind === `guild:${guildId}`) result[name] = value;
      }
      return result;
    },
  };
}

/**
 * A guard that blocks a command/component when a feature flag is off for the
 * guild. Requires `flags` to be configured on the bot (registered as a service).
 * If flags aren't configured, the guard passes (fail-open).
 *
 * @example guards: [featureEnabled("economy")]
 */
export function featureEnabled(name: string): Guard {
  return guard("featureEnabled", async (ctx) => {
    if (!("flags" in ctx.services)) return pass();
    const flags = ctx.services.flags as FeatureFlags;
    const ok = await flags.isEnabled(name, { guildId: ctx.guildId });
    return ok ? pass() : fail("This feature is currently disabled here.");
  });
}
