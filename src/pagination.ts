/**
 * Interactive helpers built on top of an interaction: paginated messages, a
 * yes/no confirmation dialog, and a low-level component waiter. Each one manages
 * its own buttons and collector, so you never wire a global handler for them.
 *
 * Pages can be plain embeds *or* full payloads - including Components V2
 * (`ui.container(...)` with `MessageFlags.IsComponentsV2`) - so a paginated
 * message looks exactly like any other message you build.
 *
 * @module pagination
 */
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  MessageFlags,
  type BaseMessageOptions,
  type ButtonInteraction,
  type InteractionEditReplyOptions,
  type InteractionReplyOptions,
  type InteractionUpdateOptions,
} from "discord.js";
import comfort from "@ix-xs/node-comfort";
import type { BaseContext } from "./context.js";

function ms(duration: string | number | undefined, fallback: number): number {
  if (typeof duration === "number") return duration;
  if (typeof duration === "string") return comfort.time.parseDuration(duration) ?? fallback;
  return fallback;
}

/**
 * A single page. Either an {@link EmbedBuilder} (rendered as `embeds: [page]`), or
 * a full message payload - `content`, `embeds`, `components` (action rows *or*
 * Components V2 builders), `files`, and `flags` (e.g. `MessageFlags.IsComponentsV2`).
 * The navigation row is appended to `components` for you.
 */
export type Page = EmbedBuilder | PagePayload;

/** A full-payload page (see {@link Page}). */
export type PagePayload = Pick<BaseMessageOptions, "content" | "embeds" | "components" | "files"> & {
  /** Message flags, e.g. `MessageFlags.IsComponentsV2` for a Components V2 page. */
  flags?: number;
};

/** Options for {@link paginate}. */
export interface PaginateOptions {
  /** The pages: an array, or a builder called with the page index. */
  pages: Page[] | ((index: number) => Page | Promise<Page>);
  /** Total page count (required when `pages` is a function). */
  count?: number;
  /** Page to start on (default `0`). */
  startPage?: number;
  /** How long the controls stay active (default `"2m"`). */
  timeout?: string | number;
  /** Send as an ephemeral message. */
  ephemeral?: boolean;
  /** Show ⏮ / ⏭ first & last buttons (default `true`). */
  showFirstLast?: boolean;
  /** Show the `page x / y` counter button (default `true`). */
  showCounter?: boolean;
  /** Restrict controls to specific user ids (default: the invoking user only). */
  allowedUsers?: string[];
}

function navRow(nonce: string, page: number, total: number, opts: PaginateOptions): ActionRowBuilder<ButtonBuilder> {
  const btn = (suffix: string, emoji: string, disabled: boolean) =>
    new ButtonBuilder().setCustomId(`${nonce}:${suffix}`).setEmoji(emoji).setStyle(ButtonStyle.Secondary).setDisabled(disabled);

  const row = new ActionRowBuilder<ButtonBuilder>();
  if (opts.showFirstLast !== false) row.addComponents(btn("first", "⏮️", page === 0));
  row.addComponents(btn("prev", "◀️", page === 0));
  if (opts.showCounter !== false) {
    row.addComponents(
      new ButtonBuilder().setCustomId(`${nonce}:count`).setLabel(`${page + 1} / ${total}`).setStyle(ButtonStyle.Primary).setDisabled(true),
    );
  }
  row.addComponents(btn("next", "▶️", page === total - 1));
  if (opts.showFirstLast !== false) row.addComponents(btn("last", "⏭️", page === total - 1));
  return row;
}

/**
 * Merges a page with the nav row into a payload usable for both reply and update.
 * Exported for testing.
 */
export function toPayload(page: Page, nav: ActionRowBuilder<ButtonBuilder> | null, extraFlags: number): InteractionReplyOptions {
  const payload: InteractionReplyOptions =
    page instanceof EmbedBuilder ? { embeds: [page] } : { ...(page as PagePayload) };

  const existing = (payload.components ?? []) as unknown[];
  payload.components = (nav ? [...existing, nav] : existing) as InteractionReplyOptions["components"];

  const pageFlags = (page instanceof EmbedBuilder ? 0 : (page.flags ?? 0)) | extraFlags;
  if (pageFlags) payload.flags = pageFlags as InteractionReplyOptions["flags"];
  return payload;
}

/**
 * Sends a paginated message with prev/next (and first/last) controls, updating in
 * place as the user navigates and disabling the controls on timeout.
 *
 * @example
 * // Embeds
 * await paginate(ctx, { pages: [embed1, embed2, embed3], timeout: "5m" });
 * @example
 * // Components V2
 * await paginate(ctx, {
 *   pages: cards.map((c) => ({ flags: MessageFlags.IsComponentsV2, components: [c] })),
 * });
 */
export async function paginate(ctx: BaseContext, options: PaginateOptions): Promise<void> {
  const total = Array.isArray(options.pages) ? options.pages.length : (options.count ?? 0);
  if (total === 0) throw new Error("paginate() needs at least one page.");

  const getPage = async (i: number): Promise<Page> =>
    Array.isArray(options.pages) ? options.pages[i]! : options.pages(i);

  const nonce = comfort.id.nano(8);
  let page = Math.min(Math.max(options.startPage ?? 0, 0), total - 1);
  const extraFlags = options.ephemeral ? MessageFlags.Ephemeral : 0;

  await ctx.reply(toPayload(await getPage(page), total > 1 ? navRow(nonce, page, total, options) : null, extraFlags));
  if (total <= 1) return;

  const message = await ctx.interaction.fetchReply();
  const allowed = new Set(options.allowedUsers ?? [ctx.user.id]);

  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: ms(options.timeout, 120_000),
    filter: (i) => i.customId.startsWith(`${nonce}:`) && allowed.has(i.user.id),
  });

  collector.on("collect", async (i: ButtonInteraction) => {
    const action = i.customId.slice(nonce.length + 1);
    if (action === "first") page = 0;
    else if (action === "prev") page = Math.max(0, page - 1);
    else if (action === "next") page = Math.min(total - 1, page + 1);
    else if (action === "last") page = total - 1;
    // No ephemeral flag on update - the message's flags are already established.
    await i.update(toPayload(await getPage(page), navRow(nonce, page, total, options), 0) as InteractionUpdateOptions);
  });

  collector.on("end", async () => {
    const disabled = navRow(nonce, page, total, options);
    for (const b of disabled.components) b.setDisabled(true);
    const payload = toPayload(await getPage(page), disabled, 0) as InteractionEditReplyOptions;
    await ctx.interaction.editReply(payload).catch(() => undefined);
  });
}

/** Options for {@link confirm}. */
export interface ConfirmOptions {
  /** The question text. */
  content?: string;
  /** Or an embed to show instead of/with the text. */
  embed?: EmbedBuilder;
  /** Confirm button label (default `"Confirm"`). */
  confirmLabel?: string;
  /** Cancel button label (default `"Cancel"`). */
  cancelLabel?: string;
  /** How long to wait (default `"1m"`). */
  timeout?: string | number;
  /** Send as ephemeral (default `true`). */
  ephemeral?: boolean;
}

/**
 * Shows a yes/no dialog and resolves to the user's choice (or `false` on timeout).
 *
 * @example
 * if (await confirm(ctx, { content: "Delete everything?" })) await wipe();
 */
export async function confirm(ctx: BaseContext, options: ConfirmOptions = {}): Promise<boolean> {
  const nonce = comfort.id.nano(8);
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`${nonce}:y`).setStyle(ButtonStyle.Success).setLabel(options.confirmLabel ?? "Confirm"),
    new ButtonBuilder().setCustomId(`${nonce}:n`).setStyle(ButtonStyle.Danger).setLabel(options.cancelLabel ?? "Cancel"),
  );

  const payload: InteractionReplyOptions = { components: [row] };
  if (options.content) payload.content = options.content;
  if (options.embed) payload.embeds = [options.embed];
  if (options.ephemeral !== false) payload.flags = MessageFlags.Ephemeral;
  await ctx.reply(payload);

  const message = await ctx.interaction.fetchReply();
  try {
    const picked = await message.awaitMessageComponent({
      componentType: ComponentType.Button,
      time: ms(options.timeout, 60_000),
      filter: (i) => i.customId.startsWith(`${nonce}:`) && i.user.id === ctx.user.id,
    });
    for (const b of row.components) b.setDisabled(true);
    await picked.update({ components: [row] });
    return picked.customId.endsWith(":y");
  } catch {
    for (const b of row.components) b.setDisabled(true);
    await ctx.interaction.editReply({ components: [row] }).catch(() => undefined);
    return false;
  }
}
