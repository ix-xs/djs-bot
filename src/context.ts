/**
 * Interaction contexts and reply helpers.
 *
 * Handlers receive a single `ctx` object that bundles the raw discord.js
 * interaction (never hidden), the resolved user/guild/channel, injected
 * services, a correlation-scoped logger, and ergonomic reply helpers that
 * always do the right thing whether or not the interaction was deferred.
 *
 * @module context
 */
import {
  ActionRowBuilder,
  EmbedBuilder,
  MessageFlags,
  type AnySelectMenuInteraction,
  type AutocompleteInteraction,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Client,
  type Collection,
  type Guild,
  type GuildBasedChannel,
  type GuildMember,
  type InteractionReplyOptions,
  type Message,
  type MessageContextMenuCommandInteraction,
  type ModalSubmitInteraction,
  type RepliableInteraction,
  type Role,
  type TextBasedChannel,
  type User,
  type UserContextMenuCommandInteraction,
} from "discord.js";
import type { Logger } from "./logger.js";
import type { ServiceMap } from "./container.js";

/** Palette used by the built-in reply helpers. */
const COLOR = { success: 0x22c55e, error: 0xef4444, info: 0x3b82f6 } as const;

/** Content accepted by reply helpers: a plain string or full reply options. */
export type ReplyContent = string | InteractionReplyOptions;

/** Extra options for the semantic reply helpers. */
export interface SemanticReplyOptions {
  /** Send as an ephemeral (only-you) message. Default `false`, except `error` which defaults `true`. */
  ephemeral?: boolean;
  /** Optional title shown above the message. */
  title?: string;
}

/** Callable reply helper with semantic shortcuts. */
export interface ReplyFn {
  /** Replies (or follows up / edits, if already responded) with content. */
  (content: ReplyContent): Promise<void>;
  /** Green success embed. */
  success(message: string, options?: SemanticReplyOptions): Promise<void>;
  /** Red error embed (ephemeral by default). */
  error(message: string, options?: SemanticReplyOptions): Promise<void>;
  /** Blue informational embed. */
  info(message: string, options?: SemanticReplyOptions): Promise<void>;
  /** Defers the reply, showing a loading state (use for slow handlers). */
  defer(options?: { ephemeral?: boolean }): Promise<void>;
  /** Sends an additional follow-up message. */
  followUp(content: ReplyContent): Promise<void>;
  /** Edits the current (deferred or sent) reply. */
  editReply(content: ReplyContent): Promise<void>;
}

/** Callable component-update helper (edits the source message). */
export interface UpdateFn {
  /** Edits the message the component lives on. */
  (content: ReplyContent): Promise<void>;
  /** Disables every component on the source message. */
  disable(): Promise<void>;
  /** Acknowledges the interaction without visibly changing anything. */
  defer(): Promise<void>;
}

/** Fields shared by every interaction context. */
export interface BaseContext<I extends RepliableInteraction = RepliableInteraction> {
  /** The underlying discord.js client. */
  readonly client: Client<true>;
  /** The raw discord.js interaction - always available, never wrapped away. */
  readonly interaction: I;
  /** The user who triggered the interaction. */
  readonly user: User;
  /** The guild, if any. */
  readonly guild: Guild | null;
  /** The guild id, if any. */
  readonly guildId: string | null;
  /** The originating channel, if resolvable. */
  readonly channel: TextBasedChannel | null;
  /** The guild member, if in a guild. */
  readonly member: GuildMember | null;
  /** Injected services (augment {@link ServiceMap} for typing). */
  readonly services: ServiceMap;
  /** A logger bound to this interaction's correlation id. */
  readonly logger: Logger;
  /** A unique id correlating every log line for this interaction. */
  readonly correlationId: string;
  /** The user's Discord client locale (e.g. `"fr"`, `"en-US"`). */
  readonly locale: string;
  /** Bot owner ids from `defineBot({ owners })` - used by `ownerOnly()` when given no ids. */
  readonly owners: readonly string[];
  /** Translates a key for this user's locale (no-op returning the key if i18n is unconfigured). */
  t(key: string, vars?: Record<string, unknown>): string;
  /**
   * Records an audit entry (no-op if audit is unconfigured). `actorId` and
   * `guildId` are filled in from the interaction.
   */
  audit(action: string, details?: { targetId?: string; metadata?: Record<string, unknown> }): Promise<void>;
  /** Ergonomic reply helper. */
  readonly reply: ReplyFn;
}

/** Context passed to slash-command handlers. `options` is typed from the command. */
export interface CommandContext<Options> extends BaseContext<ChatInputCommandInteraction> {
  /** Fully-typed, resolved command options. */
  readonly options: Options;
}

/** Context passed to button handlers. `params` is decoded from the customId. */
export interface ButtonContext<Params> extends BaseContext<ButtonInteraction> {
  /** Typed parameters decoded from the customId. */
  readonly params: Params;
  /** Edit-the-source-message helper. */
  readonly update: UpdateFn;
}

/** Context passed to select-menu handlers (string and native selects). */
export interface SelectMenuContext<Params> extends BaseContext<AnySelectMenuInteraction> {
  /** Typed parameters decoded from the customId. */
  readonly params: Params;
  /** The selected raw values (ids for native selects, option values for string selects). */
  readonly values: string[];
  /** Selected users (user & mentionable selects). */
  readonly users?: Collection<string, User>;
  /** Selected members (user & mentionable selects, in a guild). */
  readonly members?: Collection<string, GuildMember>;
  /** Selected roles (role & mentionable selects). */
  readonly roles?: Collection<string, Role>;
  /** Selected channels (channel selects). */
  readonly channels?: Collection<string, GuildBasedChannel>;
  /** Edit-the-source-message helper. */
  readonly update: UpdateFn;
}

/* -------------------------------------------------------------------------- */
/*  Autocomplete                                                              */
/* -------------------------------------------------------------------------- */

/** One autocomplete suggestion. */
export interface AutocompleteChoice {
  name: string;
  value: string | number;
}

/** What an autocomplete handler may return (auto-mapped to choices). */
export type AutocompleteResult = AutocompleteChoice[] | string[] | number[];

/** Context passed to an option's autocomplete handler. */
export interface AutocompleteContext {
  /** The raw autocomplete interaction. */
  readonly interaction: AutocompleteInteraction;
  /** The connected client. */
  readonly client: Client<true>;
  /** The user typing. */
  readonly user: User;
  /** The guild, if any. */
  readonly guild: Guild | null;
  /** Injected services. */
  readonly services: ServiceMap;
  /** Correlation-scoped logger. */
  readonly logger: Logger;
  /** The name of the option currently being focused. */
  readonly focused: string;
  /** The current (partial) value the user has typed, as a string. */
  readonly value: string;
}

/** An option's autocomplete handler. Return up to 25 choices. */
export type AutocompleteHandler = (
  ctx: AutocompleteContext,
) => AutocompleteResult | Promise<AutocompleteResult>;

/** Context passed to modal handlers. `fields` holds the submitted values. */
export interface ModalContext<Fields> extends BaseContext<ModalSubmitInteraction> {
  /** Typed submitted field values, keyed by field name. */
  readonly fields: Fields;
}

/** Context passed to user context-menu command handlers. */
export interface UserCommandContext extends BaseContext<UserContextMenuCommandInteraction> {
  /** The user the command was invoked on. */
  readonly targetUser: User;
  /** The target as a guild member, if in a guild. */
  readonly targetMember: GuildMember | null;
}

/** Context passed to message context-menu command handlers. */
export interface MessageCommandContext extends BaseContext<MessageContextMenuCommandInteraction> {
  /** The message the command was invoked on. */
  readonly targetMessage: Message;
}

/* -------------------------------------------------------------------------- */
/*  Responder factories (runtime)                                             */
/* -------------------------------------------------------------------------- */

function normalize(content: ReplyContent): InteractionReplyOptions {
  return typeof content === "string" ? { content } : content;
}

function embed(color: number, title: string | undefined, message: string): EmbedBuilder {
  const e = new EmbedBuilder().setColor(color).setDescription(message);
  if (title) e.setTitle(title);
  return e;
}

async function respond(interaction: RepliableInteraction, options: InteractionReplyOptions): Promise<void> {
  if (interaction.deferred && !interaction.replied) {
    await interaction.editReply(options as never);
  } else if (interaction.replied) {
    await interaction.followUp(options);
  } else {
    await interaction.reply(options);
  }
}

/** Builds the {@link ReplyFn} bound to a repliable interaction. */
export function createReply(interaction: RepliableInteraction): ReplyFn {
  const fn = ((content: ReplyContent) => respond(interaction, normalize(content))) as ReplyFn;

  const semantic = (color: number) => (message: string, options: SemanticReplyOptions = {}) => {
    const payload: InteractionReplyOptions = { embeds: [embed(color, options.title, message)] };
    if (options.ephemeral) payload.flags = MessageFlags.Ephemeral;
    return respond(interaction, payload);
  };

  fn.success = semantic(COLOR.success);
  fn.info = semantic(COLOR.info);
  fn.error = (message, options = {}) => {
    const payload: InteractionReplyOptions = { embeds: [embed(COLOR.error, options.title, message)] };
    if (options.ephemeral !== false) payload.flags = MessageFlags.Ephemeral;
    return respond(interaction, payload);
  };
  fn.defer = async (options = {}) => {
    await interaction.deferReply(options.ephemeral ? { flags: MessageFlags.Ephemeral } : {});
  };
  fn.followUp = async (content) => {
    await interaction.followUp(normalize(content));
  };
  fn.editReply = async (content) => {
    await interaction.editReply(normalize(content) as never);
  };
  return fn;
}

/** Builds the {@link UpdateFn} for component interactions. */
export function createUpdate(interaction: ButtonInteraction | AnySelectMenuInteraction): UpdateFn {
  const fn = (async (content: ReplyContent) => {
    await interaction.update(normalize(content) as never);
  }) as UpdateFn;

  fn.defer = async () => {
    await interaction.deferUpdate();
  };
  fn.disable = async () => {
    const rows = interaction.message.components.map((row) => {
      const builder = ActionRowBuilder.from(row as never) as ActionRowBuilder;
      for (const component of builder.components as Array<{ setDisabled?: (v: boolean) => unknown }>) {
        component.setDisabled?.(true);
      }
      return builder;
    });
    await interaction.update({ components: rows as never });
  };
  return fn;
}
