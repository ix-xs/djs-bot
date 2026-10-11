/**
 * Typed configuration and environment helpers.
 *
 * @module config
 */
import comfort from "@ix-xs/node-comfort";
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
    /** Where entries are written. Default: an in-memory sink. */
    sink?: AuditSink;
    /** Several destinations at once; each entry goes to all of them. */
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
 * Reads a numeric variable. Throws when it is missing without a fallback, or
 * when its value is not a number - so a typo fails at startup.
 * @example const port = env.number("PORT", 3000);
 */
env.number = function number(name: string, fallback?: number): number {
  const raw = env.optional(name);
  if (raw === undefined) {
    if (fallback !== undefined) return fallback;
    return Number(env(name)); // throws the standard "missing variable" error
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
 * @example const debug = env.boolean("DEBUG");
 */
env.boolean = function boolean(name: string, fallback = false): boolean {
  const raw = env.optional(name)?.trim().toLowerCase();
  if (raw === undefined) return fallback;
  if (["true", "1", "yes", "on"].includes(raw)) return true;
  if (["false", "0", "no", "off"].includes(raw)) return false;
  throw new Error(`Environment variable "${name}" must be a boolean, got "${raw}".`);
};

/**
 * Reads a comma-separated variable as a list, trimming each entry and dropping
 * empty ones. Unset resolves to an empty list.
 * @example owners: env.list("OWNER_IDS")
 */
env.list = function list(name: string): string[] {
  return (env.optional(name) ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
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
