/**
 * Typed configuration and environment helpers.
 *
 * @module config
 */
import comfort from "@ix-xs/node-comfort";
import type { GatewayIntentBits, Partials, PresenceData } from "discord.js";
import type { LogLevel } from "./logger.js";
import type { Registrable } from "./registry.js";
import type { PluginDefinition } from "./definitions.js";
import type { BaseContext } from "./context.js";
import type { ShardingOptions } from "./sharding.js";
import type { I18nOptions } from "./i18n.js";
import type { KVStore } from "./store.js";
import type { AuditSink } from "./audit.js";
import type { FeatureFlagsOptions } from "./flags.js";
import type { HealthOptions } from "./health.js";

/** Where features come from: a directory to auto-discover, or explicit definitions. */
export type FeatureSource = string | Registrable | Registrable[];

/** Deployment configuration. */
export interface DeployConfig {
  /** Deploy commands per-guild (instant) or globally (propagates in up to ~1h). */
  mode?: "guild" | "global";
  /** Guild used for instant deploys in development. */
  devGuildId?: string;
  /** Automatically deploy on startup in development. Default `true` in dev. */
  autoDeploy?: boolean;
}

/** The full bot configuration object. */
export interface BotConfig {
  /** Bot token. Falls back to `DISCORD_TOKEN`. */
  token?: string;
  /** Application (client) id. Falls back to `DISCORD_CLIENT_ID`. Needed to deploy. */
  clientId?: string;
  /** Feature sources — a directory path and/or explicit definitions. */
  features?: FeatureSource | FeatureSource[];
  /** `"auto"` to derive intents from your events, or an explicit list. */
  intents?: "auto" | GatewayIntentBits[];
  /** Explicit partials (merged with auto-derived ones). */
  partials?: Partials[];
  /** Cross-cutting plugins. */
  plugins?: PluginDefinition[];
  /** Bot owner user ids (used by the `ownerOnly` guard helper if you wire it). */
  owners?: string[];
  /** Command deployment settings. */
  deploy?: DeployConfig;
  /** Logger settings. */
  logger?: { level?: LogLevel; pretty?: boolean };
  /** Initial gateway presence. */
  presence?: PresenceData;
  /** Rotate the presence on an interval (e.g. cycling status messages). */
  presenceRotation?: { interval: string | number; items: PresenceData[] };
  /** Enable sharding: `true`/`"auto"`, or fine-grained {@link ShardingOptions}. */
  sharding?: boolean | "auto" | ShardingOptions;
  /** Runtime translations for the messages the bot sends (`ctx.t`). */
  i18n?: I18nOptions;
  /** A key-value store, registered as the `store` service (`ctx.services.store`). */
  store?: KVStore;
  /** Audit trail. Enables `ctx.audit(...)` and the `audit` service. */
  audit?: {
    sink?: AuditSink;
    sinks?: AuditSink[];
    /** Automatically record every command use as `command:<name>`. */
    autoRecordCommands?: boolean;
  };
  /** Feature flags. Enables the `featureEnabled()` guard and the `flags` service. */
  flags?: FeatureFlagsOptions;
  /** Expose an HTTP health server: a port number, or {@link HealthOptions}. */
  health?: number | HealthOptions;
  /** Global error handler for interactions. Return a value to mark it handled. */
  onError?: (error: unknown, ctx?: BaseContext) => unknown | Promise<unknown>;
  /** Entry file, used by the CLI when it cannot infer it. */
  entry?: string;
}

/**
 * Identity helper that gives you full type-checking and autocompletion on a
 * `djs-bot.config.ts` file.
 * @example export default defineConfig({ token: env("DISCORD_TOKEN"), features: "./features" });
 */
export function defineConfig(config: BotConfig): BotConfig {
  return config;
}

/**
 * Reads an environment variable (also consulting a `.env` file), with an
 * optional fallback. Throws a clear error when a required variable is missing.
 *
 * @example const token = env("DISCORD_TOKEN");
 * @example const level = env("LOG_LEVEL", "info");
 */
export function env(name: string, fallback?: string): string {
  const value = process.env[name] ?? comfort.fs.getEnv(name);
  if (value !== undefined && value !== "") return value;
  if (fallback !== undefined) return fallback;
  throw new Error(
    `Missing required environment variable "${name}". Add it to your environment or a .env file.`,
  );
}

/** Like {@link env} but returns `undefined` instead of throwing when unset. */
env.optional = function optional(name: string): string | undefined {
  const value = process.env[name] ?? comfort.fs.getEnv(name);
  return value === "" ? undefined : value;
};

/**
 * Loads a `.env` file into `process.env` (without overwriting existing vars).
 * Called automatically by the CLI. Safe to call when the file is absent.
 */
export function loadEnvFile(path = ".env"): void {
  const content = comfort.fs.readFile(path);
  if (!content) return;
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
