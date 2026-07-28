/**
 * Asset URL helpers: avatars, banners, guild icons/banners/splashes, and emoji
 * images — with size/format options. Banners aren't cached by discord.js, so
 * {@link assets.banner} fetches the user first.
 *
 * @module assets
 */
import type { Guild, GuildMember, ImageExtension, ImageSize, User } from "discord.js";

/** Options for image URLs. */
export interface ImageOptions {
  /** Power-of-two size between 16 and 4096. */
  size?: ImageSize;
  /** `"webp"` | `"png"` | `"jpg"` | `"jpeg"` | `"gif"`. */
  extension?: ImageExtension;
  /** Force a static (non-animated) image even for animated assets. */
  forceStatic?: boolean;
}

/** Asset URL helpers. */
export const assets = {
  /**
   * The best avatar URL for a user or member (server avatar wins for members).
   */
  avatar(userOrMember: User | GuildMember, options: ImageOptions = {}): string {
    return userOrMember.displayAvatarURL(options);
  },

  /**
   * A user's banner URL, or `null` if they have none. Fetches the user because
   * banners are not cached.
   */
  async banner(user: User, options: ImageOptions = {}): Promise<string | null> {
    if (user.banner === undefined) await user.fetch();
    return user.bannerURL(options) ?? null;
  },

  /** A guild's icon URL, or `null`. */
  guildIcon(guild: Guild, options: ImageOptions = {}): string | null {
    return guild.iconURL(options) ?? null;
  },

  /** A guild's banner URL, or `null`. */
  guildBanner(guild: Guild, options: ImageOptions = {}): string | null {
    return guild.bannerURL(options) ?? null;
  },

  /** A guild's invite splash URL, or `null`. */
  guildSplash(guild: Guild, options: ImageOptions = {}): string | null {
    return guild.splashURL(options) ?? null;
  },

  /** A custom emoji's image URL from its id. */
  emoji(id: string, options: { animated?: boolean; size?: ImageSize } = {}): string {
    const ext = options.animated ? "gif" : "png";
    const size = options.size ? `?size=${options.size}` : "";
    return `https://cdn.discordapp.com/emojis/${id}.${ext}${size}`;
  },
};
