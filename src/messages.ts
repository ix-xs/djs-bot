/**
 * Every sentence the framework itself can show to a user, in one place.
 *
 * The defaults are English. Override any of them - with a plain string, or a
 * function when you want to translate per user - through
 * `defineBot({ messages: { ... } })`, and the built-in guards, the error
 * boundary and the interactive helpers all pick your wording up.
 *
 * @module messages
 */
import comfort from "@ix-xs/node-comfort";
import type { BaseContext } from "./context.js";

/** The variables each framework message receives. */
export interface MessageVars {
  /** A handler threw and nothing handled the error. */
  error: Record<string, never>;
  /** A slash command reached the bot that is not registered. */
  unknownCommand: {
    /** The name of the command that was received. */
    name: string;
  };
  /** A subcommand reached the bot that is not registered. */
  unknownSubcommand: {
    /** The subcommand that was received, with its group if any. */
    name: string;
  };
  /** A guard failed without giving a reason. */
  guardDenied: Record<string, never>;
  /** `inGuild()` failed. */
  guildOnly: Record<string, never>;
  /** `dmOnly()` failed. */
  dmOnly: Record<string, never>;
  /** `hasPermission()` failed. `permissions` is a readable, comma-separated list. */
  missingPermissions: {
    /** The missing permissions, readable and comma-separated. */
    permissions: string;
  };
  /** `botHasPermission()` failed. */
  botMissingPermissions: {
    /** The permissions the bot lacks, readable and comma-separated. */
    permissions: string;
  };
  /** `inChannel()` failed. */
  wrongChannel: Record<string, never>;
  /** `ownerOnly()` failed. */
  ownerOnly: Record<string, never>;
  /** `guildOwnerOnly()` failed. */
  guildOwnerOnly: Record<string, never>;
  /** `hasRole()` failed. */
  missingRole: Record<string, never>;
  /** A required `s.member()` option was given a user who is not a member of the server. */
  notAMember: {
    /** The name of the option. */
    option: string;
  };
  /** `cooldown()` failed. `seconds` is the remaining wait, rounded up. */
  cooldown: {
    /** The remaining wait, in whole seconds. */
    seconds: number;
  };
  /** `rateLimit()` failed. */
  rateLimited: {
    /** The remaining wait, in whole seconds. */
    seconds: number;
  };
  /** The `antiSpam` plugin refused an interaction. */
  slowDown: {
    /** The remaining wait, in whole seconds. */
    seconds: number;
  };
  /** `featureEnabled()` failed. */
  featureDisabled: {
    /** The name of the flag that is off. */
    feature: string;
  };
  /** Label of the confirm button shown by `confirm()`. */
  confirm: Record<string, never>;
  /** Label of the cancel button shown by `confirm()`. */
  cancel: Record<string, never>;
}

/** The name of a framework message. */
export type MessageKey = keyof MessageVars;

/**
 * One message: a template string with `{placeholders}`, or a function for full
 * control (translation, pluralisation). The function also receives the context
 * when there is one, so `ctx.locale` and `ctx.t` are available.
 */
export type MessageValue<K extends MessageKey = MessageKey> =
  | string
  | ((vars: MessageVars[K], ctx?: BaseContext) => string);

/** The overridable message table accepted by `defineBot({ messages })`. */
export type FrameworkMessages = { [K in MessageKey]?: MessageValue<K> };

/** The built-in English wording. */
export const DEFAULT_MESSAGES: { readonly [K in MessageKey]: string } = {
  error: "Something went wrong. The team has been notified.",
  unknownCommand: "Unknown command.",
  unknownSubcommand: "Unknown subcommand.",
  guardDenied: "You can't do that.",
  guildOnly: "This can only be used in a server.",
  dmOnly: "This can only be used in DMs.",
  missingPermissions: "You need: {permissions}.",
  botMissingPermissions: "I need: {permissions}.",
  wrongChannel: "This can't be used in this channel.",
  ownerOnly: "You can't use this.",
  guildOwnerOnly: "Only the server owner can use this.",
  missingRole: "You don't have the role required for this.",
  cooldown: "Please wait {seconds}s before doing that again.",
  rateLimited: "Rate limit reached. Try again in {seconds}s.",
  slowDown: "You're doing that too fast - please slow down.",
  featureDisabled: "This feature is currently disabled here.",
  notAMember: "That user is not a member of this server.",
  confirm: "Confirm",
  cancel: "Cancel",
};

/** Fills `{name}` placeholders; one that has no value is left as it is written. */
function interpolate(template: string, vars: Record<string, unknown>): string {
  return comfort.str.template(template, vars);
}

/**
 * Renders a framework message from a table of overrides, falling back to the
 * English default for anything left unset.
 */
export function renderMessage<K extends MessageKey>(
  overrides: FrameworkMessages | undefined,
  key: K,
  vars: MessageVars[K],
  ctx?: BaseContext,
): string {
  const custom = overrides?.[key] as MessageValue<K> | undefined;
  if (typeof custom === "function") return custom(vars, ctx);
  return interpolate(custom ?? DEFAULT_MESSAGES[key], vars as Record<string, unknown>);
}

/**
 * Renders a framework message for a context. Works with any context, including
 * a hand-built one in a test, by falling back to the defaults when the context
 * carries no message table.
 */
export function messageFor<K extends MessageKey>(
  ctx: unknown,
  key: K,
  ...args: MessageVars[K] extends Record<string, never> ? [] : [vars: MessageVars[K]]
): string {
  const vars = (args[0] ?? {}) as MessageVars[K];
  const say = (ctx as { say?: BaseContext["say"] } | undefined)?.say;
  return typeof say === "function" ? say(key, vars) : renderMessage(undefined, key, vars);
}

/* -------------------------------------------------------------------------- */
/*  Theme                                                                     */
/* -------------------------------------------------------------------------- */

/** The accent colours of the built-in `ctx.reply.success/error/info/warn` embeds. */
export interface Theme {
  /** `ctx.reply.success`. Default `0x22c55e`. */
  success: number;
  /** `ctx.reply.error`. Default `0xef4444`. */
  error: number;
  /** `ctx.reply.info`. Default `0x3b82f6`. */
  info: number;
  /** `ctx.reply.warn`. Default `0xf59e0b`. */
  warn: number;
}

/** The default palette. */
export const DEFAULT_THEME: Readonly<Theme> = {
  success: 0x22c55e,
  error: 0xef4444,
  info: 0x3b82f6,
  warn: 0xf59e0b,
};
