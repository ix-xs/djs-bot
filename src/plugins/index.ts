/**
 * Official, first-party plugins.
 *
 * Import from the `@ix-xs/djs-bot/plugins` subpath and pass them to
 * `defineBot({ plugins: [...] })`. Each is a small, production-minded example of
 * the plugin API (hooks + middleware) - and useful on its own.
 *
 * @example
 * import { defineBot } from "@ix-xs/djs-bot";
 * import { antiSpam, commandLogger, errorReporter } from "@ix-xs/djs-bot/plugins";
 *
 * export default defineBot({
 *   token: process.env.DISCORD_TOKEN!,
 *   plugins: [antiSpam({ max: 5, window: "10s" }), commandLogger(), errorReporter({ report: sendToSentry })],
 * });
 *
 * @module plugins
 */
import { definePlugin, type PluginDefinition } from "../definitions.js";
import { describeInteraction, type BaseContext } from "../context.js";
import { createRateLimiter } from "../resilience.js";
import { messageFor } from "../messages.js";

/** Options for {@link antiSpam}. */
export interface AntiSpamOptions {
  /** Max interactions allowed per window, per user. Default `5`. */
  max?: number;
  /** The window: ms or a duration like `"10s"`. Default `"10s"`. */
  window?: number | string;
  /** Message shown when a user is rate-limited. Defaults to the `slowDown` framework message. */
  message?: string;
  /** User ids that are never limited (owners, staff). */
  allow?: string[];
}

/**
 * Rejects interactions from users who exceed a per-window rate limit - a simple
 * guard against interaction spam, applied globally to every interaction.
 */
export function antiSpam(options: AntiSpamOptions = {}): PluginDefinition {
  const limiter = createRateLimiter({ limit: options.max ?? 5, window: options.window ?? "10s" });
  const allow = new Set(options.allow ?? []);
  return definePlugin({
    name: "anti-spam",
    version: "1.0.0",
    setup(app) {
      app.hooks.beforeInteraction(async (ctx, next) => {
        if (allow.has(ctx.user.id)) return next();
        const result = limiter.consume(ctx.user.id);
        if (!result.allowed) {
          await ctx.reply.error(
            options.message ?? messageFor(ctx, "slowDown", { seconds: Math.ceil(result.resetMs / 1000) }),
          );
          return;
        }
        await next();
      });
    },
  });
}

/** Options for {@link commandLogger}. */
export interface CommandLoggerOptions {
  /** Also log the duration of each interaction. Default `true`. */
  timing?: boolean;
}

/**
 * Logs a structured line for every interaction (with duration), using the
 * per-interaction correlation logger.
 */
export function commandLogger(options: CommandLoggerOptions = {}): PluginDefinition {
  const timing = options.timing ?? true;
  return definePlugin({
    name: "command-logger",
    version: "1.0.0",
    setup(app) {
      app.hooks.beforeInteraction(async (ctx, next) => {
        const started = performance.now();
        await next();
        const { kind, name } = describeInteraction(ctx.interaction);
        const fields: Record<string, unknown> = { kind, name, guildId: ctx.guildId };
        if (timing) fields.ms = Math.round(performance.now() - started);
        ctx.logger.info(fields, "interaction handled");
      });
    },
  });
}

/** Options for {@link errorReporter}. */
export interface ErrorReporterOptions {
  /** Forward the error somewhere (Sentry, a webhook, your logger, …). */
  report: (error: unknown, ctx?: BaseContext) => void | Promise<void>;
}

/**
 * Forwards every unhandled interaction error to your reporter (e.g. Sentry).
 * Runs alongside the framework's own error boundary - the user still gets a
 * friendly reply.
 */
export function errorReporter(options: ErrorReporterOptions): PluginDefinition {
  return definePlugin({
    name: "error-reporter",
    version: "1.0.0",
    setup(app) {
      app.hooks.onError(async (error, ctx) => {
        try {
          await options.report(error, ctx);
        } catch {
          /* never let the reporter throw */
        }
      });
    },
  });
}

/** Options for {@link maintenance}. */
export interface MaintenanceOptions {
  /** Whether maintenance mode is on. A function is re-evaluated per interaction. */
  enabled?: boolean | (() => boolean);
  /** Message shown to blocked users. */
  message?: string;
  /** User ids allowed to bypass maintenance (e.g. owners/admins). */
  allow?: string[];
}

/**
 * Blocks all interactions with a maintenance notice, except for allow-listed
 * users. Toggle it live by passing a function for `enabled`.
 *
 * @example maintenance({ enabled: () => flags.maintenance, allow: ownerIds })
 */
export function maintenance(options: MaintenanceOptions = {}): PluginDefinition {
  const allow = new Set(options.allow ?? []);
  const message = options.message ?? "🔧 The bot is under maintenance - please try again soon.";
  const isEnabled = () => (typeof options.enabled === "function" ? options.enabled() : (options.enabled ?? true));
  return definePlugin({
    name: "maintenance",
    version: "1.0.0",
    setup(app) {
      app.hooks.beforeInteraction(async (ctx, next) => {
        if (isEnabled() && !allow.has(ctx.user.id)) {
          await ctx.reply.error(message);
          return;
        }
        await next();
      });
    },
  });
}
