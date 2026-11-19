/**
 * Formatting helpers: mentions, emojis, timestamps and allowed-mentions.
 *
 * These wrap discord.js/formatters with an ergonomic, discoverable surface so
 * you rarely have to remember the exact markup for a channel mention, a relative
 * timestamp, or a custom emoji.
 *
 * @module format
 */
import {
  TimestampStyles,
  channelMention,
  roleMention,
  userMention,
  type Guild,
  type GuildEmoji,
  type TimestampStylesString,
} from "discord.js";
import { deprecated } from "./deprecate.js";

/** Mention builders - return the exact markup Discord renders as a mention. */
export const mention = {
  /** `<@id>` - mentions a user. */
  user: (id: string): string => userMention(id),
  /** `<#id>` - mentions a channel. */
  channel: (id: string): string => channelMention(id),
  /** `<@&id>` - mentions a role. */
  role: (id: string): string => roleMention(id),
  /** `@everyone`. */
  everyone: "@everyone" as const,
  /** `@here`. */
  here: "@here" as const,
  /**
   * `</name:id>` - a clickable slash-command mention (optionally with a
   * subcommand, e.g. `mention.command("config", id, "set")`).
   */
  command: (name: string, id: string, subcommand?: string): string =>
    subcommand ? `</${name} ${subcommand}:${id}>` : `</${name}:${id}>`,
};

/** Timestamp styles re-exported for convenience. */
export { TimestampStyles };

/**
 * Renders a Discord timestamp (auto-localised in each user's client).
 * @param date  A Date, unix ms, or unix seconds.
 * @param style One of {@link TimestampStyles} (default: short date-time).
 * @example timestamp(new Date(), TimestampStyles.RelativeTime) // "in 2 hours"
 */
export function timestamp(date: Date | number, style?: TimestampStylesString): string {
  const seconds = typeof date === "number" ? Math.floor(date > 1e12 ? date / 1000 : date) : Math.floor(date.getTime() / 1000);
  return style ? `<t:${seconds}:${style}>` : `<t:${seconds}>`;
}

const EMOJI_RE = /^<(a)?:(\w{2,32}):(\d{2,20})>$/;

/** Custom emoji helpers: build the markup, and read it back. */
export const emoji = {
  /**
   * Builds custom-emoji markup: `<:name:id>` or `<a:name:id>` when animated.
   * @deprecated Use `emoji.format({ name, id, animated })`. It will be removed in 2.0.
   */
  custom: (name: string, id: string, animated = false): string => {
    deprecated("DJS_BOT_DEP_EMOJI_CUSTOM", "emoji.custom()", "emoji.format({ name, id, animated })");
    return emoji.format({ name, id, animated });
  },
  /**
   * Builds custom-emoji markup from a partial emoji object: `<:name:id>`, or
   * `<a:name:id>` when animated.
   * @example emoji.format({ name: "wave", id: "123456789012345678" }) // "<:wave:123456789012345678>"
   */
  format: (e: { name: string; id: string; animated?: boolean }): string =>
    `<${e.animated ? "a" : ""}:${e.name}:${e.id}>`,
  /**
   * Parses custom-emoji markup back into its parts.
   * @returns `{ animated, name, id }` or `null` if the string is not a custom emoji.
   */
  parse: (input: string): { animated: boolean; name: string; id: string } | null => {
    const m = EMOJI_RE.exec(input.trim());
    return m ? { animated: Boolean(m[1]), name: m[2]!, id: m[3]! } : null;
  },
  /** Finds a guild custom emoji by name (from cache). */
  find: (guild: Guild, name: string): GuildEmoji | undefined =>
    guild.emojis.cache.find((e) => e.name === name),
};

/** Builders for `allowed_mentions`, controlling who a message may ping. */
export const allowedMentions = {
  /** Ping nobody (safe default for user-generated content). */
  none: () => ({ parse: [] as never[] }),
  /** Ping everyone/here/all users/all roles. */
  all: () => ({ parse: ["everyone", "users", "roles"] as Array<"everyone" | "users" | "roles"> }),
  /** Ping only the listed user ids. */
  users: (...ids: string[]) => ({ users: ids }),
  /** Ping only the listed role ids. */
  roles: (...ids: string[]) => ({ roles: ids }),
  /** Control whether replying pings the replied-to author. */
  repliedUser: (ping: boolean) => ({ repliedUser: ping }),
};
