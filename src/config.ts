/**
 * Typed configuration and environment helpers.
 *
 * @module config
 */
import comfort from "@ix-xs/node-comfort";
import { deprecated } from "./deprecate.js";
import type { ClientOptions, GatewayIntentBits, Partials, PresenceData } from "discord.js";
import type { LogLevel } from "./logger.js";
import type { Registrable } from "./registry.js";
import type { PluginDefinition } from "./definitions.js";
import type { BaseContext, DeferOption } from "./context.js";
import type { IntentAdjustments } from "./intents.js";
import type { FrameworkMessages, Theme } from "./messages.js";
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
  /**
   * A guild to mirror **all** commands to during development, so they appear
   * instantly (global commands otherwise take up to ~1h to propagate). In
   * production the real plan is used instead (global commands go global, and
   * commands with a `guilds` field go to those guilds). Falls back to the
   * `DISCORD_DEV_GUILD` env var.
   */
  devGuildId?: string;
  /** Automatically deploy commands on startup. Defaults to `true` in development. */
  autoDeploy?: boolean;
}

/** The full bot configuration object. */
export interface BotConfig {
  /** Bot token. Falls back to `DISCORD_TOKEN`. */
  token?: string;
  /** Application (client) id. Falls back to `DISCORD_CLIENT_ID`. Needed to deploy. */
  clientId?: string;
  /** Feature sources - a directory path and/or explicit definitions. */
  features?: FeatureSource | FeatureSource[];
  /**
   * Gateway intents. `"auto"` (the default) derives them from the events and
   * triggers you registered. Pass `{ add, remove }` to keep the automatic
   * selection but adjust it, or an explicit list to take full control.
   *
   * @example intents: { add: [GatewayIntentBits.DirectMessages] }
   * @example intents: { remove: [GatewayIntentBits.MessageContent] }
   */
  intents?: "auto" | GatewayIntentBits[] | IntentAdjustments;
  /** Explicit partials (merged with auto-derived ones). */
  partials?: Partials[];
  /** Cross-cutting plugins. */
  plugins?: PluginDefinition[];
  /** Bot owner user ids, read back as `ctx.owners` and used by `ownerOnly()`. */
  owners?: string[];
  /**
   * Extra options for the discord.js `Client`: cache limits, sweepers, default
   * `allowedMentions`, REST settings... Intents are computed for you, so they
   * are set through `intents` rather than here.
   *
   * @example
   * client: {
   *   allowedMentions: { parse: ["users"], repliedUser: true },
   *   sweepers: { messages: { interval: 3600, lifetime: 1800 } },
   * }
   */
  client?: Omit<ClientOptions, "intents">;
  /** Behaviour applied to every definition that does not set its own. */
  defaults?: {
    /**
     * Acknowledge interactions for you so a slow handler never hits Discord's
     * 3 second limit. `true` defers only when a handler has not answered after
     * 2 s. Each definition can override it with its own `defer`.
     */
    defer?: DeferOption;
  };
  /**
   * Rewords (or translates) the sentences the framework itself shows: guard
   * refusals, the generic error, the confirm dialog buttons.
   *
   * @example
   * messages: {
   *   cooldown: "Patiente {seconds}s avant de recommencer.",
   *   error: (_vars, ctx) => ctx?.t("errors.generic") ?? "Oups.",
   * }
   */
  messages?: FrameworkMessages;
  /** Accent colours of the `ctx.reply.success/error/info/warn` embeds. */
  theme?: Partial<Theme>;
  /** Command deployment settings. */
  deploy?: DeployConfig;
  /** Logger settings. */
  logger?: {
    /** The least severe level that is written. Default `"info"`. */
    level?: LogLevel;
    /** Human-readable, coloured lines instead of JSON. Default: on outside production. */
    pretty?: boolean;
  };
  /** Initial gateway presence. */
  presence?: PresenceData;
  /** Rotate the presence on an interval (e.g. cycling status messages). */
  presenceRotation?: {
    /** How long each presence stays, e.g. `"30s"` or milliseconds. */
    interval: string | number;
    /** The presences to cycle through, in order. */
    items: PresenceData[];
  };
  /** Enable sharding: `true`/`"auto"`, or fine-grained {@link ShardingOptions}. */
  sharding?: boolean | "auto" | ShardingOptions;
  /** Runtime translations for the messages the bot sends (`ctx.t`). */
  i18n?: I18nOptions;
  /** A key-value store, registered as the `store` service (`ctx.services.store`). */
  store?: KVStore;
  /** Audit trail. Enables `ctx.audit(...)` and the `audit` service. */
  audit?: {
    /**
     * One destination.
     * @deprecated Use `sinks: [sink]`. It will be removed in 2.0.
     */
    sink?: AuditSink;
    /** Where entries are written; each entry goes to all of them. Default: an in-memory sink. */
    sinks?: AuditSink[];
    /** Automatically record every command use as `command:<name>`. */
    autoRecordCommands?: boolean;
  };
  /** Feature flags. Enables the `featureEnabled()` guard and the `flags` service. */
  flags?: FeatureFlagsOptions;
  /** Expose an HTTP health server: a port number, or {@link HealthOptions}. */
  health?: number | HealthOptions;
  /**
   * Global error handler. Receives the `ctx` for an interaction error, and no
   * `ctx` when an event listener, a trigger or a job threw. Return a value from
   * an interaction error to mark it handled and suppress the default reply.
   */
  onError?: (error: unknown, ctx?: BaseContext) => unknown | Promise<unknown>;
}

/**
 * An environment variable, or `undefined` when it is unset or empty. What the
 * framework reads `DISCORD_TOKEN`, `DISCORD_CLIENT_ID` and `DISCORD_DEV_GUILD`
 * with.
 * @internal
 */
export function envVar(name: string): string | undefined {
  return comfort.env.get(name) || undefined;
}

/**
 * Reads an environment variable, with an optional fallback. Throws a clear
 * error when a required variable is missing. The `.env` file of the working
 * directory is already in the environment by then: it is read when the package
 * is imported.
 *
 * @deprecated Use node-comfort's `env`: `nc.env.required(name)` for
 * `env(name)`, and `nc.env.string(name, { default: fallback })` for
 * `env(name, fallback)`. Both treat an empty value as unset, as this one does;
 * a missing variable is a `ValidationError` instead of an `Error`. It will be
 * removed in 2.0.
 * @example const token = env("DISCORD_TOKEN");
 * @example const level = env("LOG_LEVEL", "info");
 */
export function env(name: string, fallback?: string): string {
  deprecated("DJS_BOT_DEP_ENV", "env()", "nc.env.required() or nc.env.string(name, { default })");
  return requiredEnv(name, fallback);
}

function requiredEnv(name: string, fallback?: string): string {
  const value = envVar(name);
  if (value !== undefined) return value;
  if (fallback !== undefined) return fallback;
  throw new Error(
    `Missing required environment variable "${name}". Add it to your environment or a .env file.`,
  );
}

/**
 * Like {@link env} but returns `undefined` instead of throwing when unset.
 *
 * @deprecated Use `nc.env.string(name, { optional: true })`, which also gives
 * `undefined` for an empty value. `nc.env.get(name)` is close, but returns an
 * empty value as `""`. It will be removed in 2.0.
 */
env.optional = function optional(name: string): string | undefined {
  deprecated("DJS_BOT_DEP_ENV", "env.optional()", "nc.env.string(name, { optional: true })");
  return envVar(name);
};

/**
 * Reads a numeric variable. Throws when it is missing without a fallback, or
 * when its value is not a number - so a typo fails at startup.
 *
 * @deprecated Use `nc.env.number(name)`, or `nc.env.number(name, { default: fallback })`.
 * It also refuses `Infinity`, and takes `min`, `max` and `integer`. It will be
 * removed in 2.0.
 * @example const port = env.number("PORT", 3000);
 */
env.number = function number(name: string, fallback?: number): number {
  deprecated("DJS_BOT_DEP_ENV", "env.number()", "nc.env.number(name, { default })");
  const raw = envVar(name);
  if (raw === undefined) {
    if (fallback !== undefined) return fallback;
    return Number(requiredEnv(name)); // throws the standard "missing variable" error
  }
  const value = Number(raw);
  if (Number.isNaN(value)) {
    throw new Error(`Environment variable "${name}" must be a number, got "${raw}".`);
  }
  return value;
};

/**
 * Reads a boolean variable: `true`/`1`/`yes`/`on` and `false`/`0`/`no`/`off`
 * (any case). Unset resolves to `fallback` (default `false`).
 *
 * @deprecated Use `nc.env.boolean(name, { default: false })`, which reads the
 * same spellings. Without `default` it is required, where this one gave
 * `false`. It will be removed in 2.0.
 * @example const debug = env.boolean("DEBUG");
 */
env.boolean = function boolean(name: string, fallback = false): boolean {
  deprecated("DJS_BOT_DEP_ENV", "env.boolean()", "nc.env.boolean(name, { default: false })");
  const raw = envVar(name)?.trim().toLowerCase();
  if (raw === undefined) return fallback;
  if (["true", "1", "yes", "on"].includes(raw)) return true;
  if (["false", "0", "no", "off"].includes(raw)) return false;
  throw new Error(`Environment variable "${name}" must be a boolean, got "${raw}".`);
};

/**
 * Reads a comma-separated variable as a list, trimming each entry and dropping
 * empty ones. Unset resolves to an empty list.
 *
 * @deprecated Use `nc.env.list(name, { default: [] })`, which trims and drops
 * empty entries too. Without `default` it is required, where this one gave
 * `[]`. It will be removed in 2.0.
 * @example owners: env.list("OWNER_IDS")
 */
env.list = function list(name: string): string[] {
  deprecated("DJS_BOT_DEP_ENV", "env.list()", "nc.env.list(name, { default: [] })");
  return (envVar(name) ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
};

/**
 * Loads a `.env` file into `process.env`. Safe to call when the file is absent.
 *
 * You rarely need it: the `.env` of the working directory is read as soon as
 * the package is imported. Call it for another file (`.env.local`, a path of
 * your own). What the real environment already defines is never replaced; a
 * file loaded here wins over the `.env` read at import.
 *
 * Unlike the read at import, it loads every variable of the file, those that
 * can run code included (`NODE_OPTIONS`, `NODE_TLS_REJECT_UNAUTHORIZED`...):
 * call it only on a file you trust.
 *
 * @deprecated Use `nc.env.load(path)`, which this calls. It will be removed in 2.0.
 * @example loadEnvFile(".env.local");
 */
export function loadEnvFile(path = ".env"): void {
  deprecated("DJS_BOT_DEP_LOAD_ENV_FILE", "loadEnvFile()", "nc.env.load(path)");
  comfort.env.load(path);
}
