/**
 * `ui` - terse factories for discord.js message components, including the
 * Components V2 display components (containers, sections, text, separators,
 * galleries, thumbnails, files). These are thin wrappers: every function returns
 * a real discord.js builder, so you keep full access to its methods.
 *
 * Components V2 requires the `MessageFlags.IsComponentsV2` flag on the message,
 * and such a message may not also use `content` or `embeds`.
 *
 * @module ui
 */
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  FileBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
  ThumbnailBuilder,
  type MessageActionRowComponentBuilder,
} from "discord.js";

/**
 * A display component that can live inside a {@link ui.container}: a text block,
 * separator, section, media gallery, file, or an action row of buttons/selects.
 */
export type ContainerChild =
  | TextDisplayBuilder
  | SeparatorBuilder
  | SectionBuilder
  | MediaGalleryBuilder
  | FileBuilder
  | ActionRowBuilder<MessageActionRowComponentBuilder>;

/** Terse component factories. All return real discord.js builders. */
export const ui = {
  /**
   * An action row holding buttons or a select menu.
   * @example ui.row(Close.build({ id }), ui.linkButton("Docs", "https://..."))
   */
  row<T extends MessageActionRowComponentBuilder>(...components: T[]): ActionRowBuilder<T> {
    return new ActionRowBuilder<T>().addComponents(...components);
  },

  /** A link button (no handler - opens a URL). */
  linkButton(label: string, url: string, emoji?: string): ButtonBuilder {
    const b = new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(label).setURL(url);
    if (emoji) b.setEmoji(emoji);
    return b;
  },

  /* ----------------------------- Components V2 ---------------------------- */

  /** A V2 container that groups display components, with an optional accent colour. */
  container(...components: ContainerChild[]): ContainerBuilder {
    const c = new ContainerBuilder();
    for (const component of components) addToContainer(c, component);
    return c;
  },

  /** A markdown text block (Components V2). */
  text(content: string): TextDisplayBuilder {
    return new TextDisplayBuilder().setContent(content);
  },

  /** A horizontal separator, optionally with a divider line and spacing. */
  separator(options: { divider?: boolean; spacing?: "small" | "large" } = {}): SeparatorBuilder {
    const s = new SeparatorBuilder();
    if (options.divider !== undefined) s.setDivider(options.divider);
    s.setSpacing(options.spacing === "large" ? SeparatorSpacingSize.Large : SeparatorSpacingSize.Small);
    return s;
  },

  /**
   * A section: text on the left with a thumbnail or a button accessory on the right.
   * @example ui.section({ text: "Profile", accessory: ui.thumbnail(url) })
   */
  section(options: {
    text: string | string[];
    accessory: ThumbnailBuilder | ButtonBuilder;
  }): SectionBuilder {
    const s = new SectionBuilder();
    const lines = Array.isArray(options.text) ? options.text : [options.text];
    s.addTextDisplayComponents(...lines.map((l) => new TextDisplayBuilder().setContent(l)));
    if (options.accessory instanceof ButtonBuilder) s.setButtonAccessory(options.accessory);
    else s.setThumbnailAccessory(options.accessory);
    return s;
  },

  /** A thumbnail accessory for a {@link ui.section}. */
  thumbnail(url: string, description?: string): ThumbnailBuilder {
    const t = new ThumbnailBuilder().setURL(url);
    if (description) t.setDescription(description);
    return t;
  },

  /** A media gallery of images/videos, by URL (supports `attachment://name`). */
  gallery(...urls: string[]): MediaGalleryBuilder {
    return new MediaGalleryBuilder().addItems(
      ...urls.map((url) => new MediaGalleryItemBuilder().setURL(url)),
    );
  },

  /** A file display component (references an `attachment://name`). */
  file(attachmentUrl: string): FileBuilder {
    return new FileBuilder().setURL(attachmentUrl);
  },
};

function addToContainer(container: ContainerBuilder, component: ContainerChild): void {
  if (component instanceof TextDisplayBuilder) container.addTextDisplayComponents(component);
  else if (component instanceof SeparatorBuilder) container.addSeparatorComponents(component);
  else if (component instanceof SectionBuilder) container.addSectionComponents(component);
  else if (component instanceof MediaGalleryBuilder) container.addMediaGalleryComponents(component);
  else if (component instanceof FileBuilder) container.addFileComponents(component);
  else if (component instanceof ActionRowBuilder)
    container.addActionRowComponents(component as ActionRowBuilder<MessageActionRowComponentBuilder>);
}
