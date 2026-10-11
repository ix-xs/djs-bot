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
  type ModalBuilder,
  type ModalSubmitInteraction,
  type RepliableInteraction,
  type Role,
  type TextBasedChannel,
  type User,
  type UserContextMenuCommandInteraction,
} from "discord.js";
import comfort from "@ix-xs/node-comfort";
import type { Logger } from "./logger.js";
import type { ServiceMap } from "./container.js";
import { DEFAULT_THEME, type MessageKey, type MessageVars, type Theme } from "./messages.js";

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
  /** Amber warning embed. */
  warn(message: string, options?: SemanticReplyOptions): Promise<void>;
  /** Replies with content only the invoking user can see. */
  ephemeral(content: ReplyContent): Promise<void>;
  /** Defers the reply, showing a loading state (use for slow handlers). */
  defer(options?: { ephemeral?: boolean }): Promise<void>;
  /** Sends an additional follow-up message. */
  followUp(content: ReplyContent): Promise<void>;
  /** Edits the current (deferred or sent) reply. */
  editReply(content: ReplyContent): Promise<void>;
  /** Fetches the message that was sent as the reply. */
  fetch(): Promise<Message>;
  /** Deletes the reply. */
  delete(): Promise<void>;
}

/** Callable component-update helper (edits the source message). */
export interface UpdateFn {
  /** Edits the message the component lives on. Works before or after a defer. */
  (content: ReplyContent): Promise<void>;
  /** Disables every component on the source message. */
  disable(): Promise<void>;
  /** Acknowledges the interaction without visibly changing anything. */
  defer(): Promise<void>;
}

/**
 * Opens a modal as the response to an interaction. Accepts a
 * {@link defineModal} definition (with its typed params) or any object exposing
 * a compatible `build()`.
 *
 * A modal has to be the **first** response, so call this before any reply or
 * defer - which is also why it is unavailable on modal contexts.
 */
export type ShowModalFn = <Args extends unknown[]>(
  modal: { build(...args: Args): ModalBuilder },
  ...args: Args
) => Promise<void>;

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
  /** The originating channel id, if any. */
  readonly channelId: string | null;
  /** The guild member, if in a guild the bot is in. */
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
   * Renders one of the framework's own messages (the ones guards and the error
   * boundary show), honouring `defineBot({ messages })`. Handy in a custom
   * guard that wants to reuse the built-in wording.
   */
  say<K extends MessageKey>(key: K, vars?: MessageVars[K]): string;
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
  /** Opens a modal as the response. */
  readonly showModal: ShowModalFn;
}

/** Context passed to button handlers. `params` is decoded from the customId. */
export interface ButtonContext<Params> extends BaseContext<ButtonInteraction> {
  /** Typed parameters decoded from the customId. */
  readonly params: Params;
  /** Edit-the-source-message helper. */
  readonly update: UpdateFn;
  /** Opens a modal as the response. */
  readonly showModal: ShowModalFn;
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
  /** Opens a modal as the response. */
  readonly showModal: ShowModalFn;
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
  /** The user's Discord client locale. */
  readonly locale: string;
  /** Translates a key for this user's locale. */
  t(key: string, vars?: Record<string, unknown>): string;
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
  /** Opens a modal as the response. */
  readonly showModal: ShowModalFn;
}

/** Context passed to message context-menu command handlers. */
export interface MessageCommandContext extends BaseContext<MessageContextMenuCommandInteraction> {
  /** The message the command was invoked on. */
  readonly targetMessage: Message;
  /** Opens a modal as the response. */
  readonly showModal: ShowModalFn;
}

/* -------------------------------------------------------------------------- */
/*  Automatic deferral                                                        */
/* -------------------------------------------------------------------------- */

/**
 * When and how an interaction is acknowledged for you.
 *
 * - `true` - defer publicly, but only if the handler has not answered after 2 s.
 * - `"ephemeral"` - the same, with an only-you loading state.
 * - `"update"` - for components: acknowledge without a loading message, so the
 *   handler can then edit the source message with `ctx.update(...)`.
 * - an object - choose the visibility and the delay yourself. `after: 0` defers
 *   immediately; any duration string (`"1s"`) or number of milliseconds works.
 * - `false` - never defer automatically.
 */
export type DeferOption =
  | boolean
  | "ephemeral"
  | "update"
  | { ephemeral?: boolean; update?: boolean; after?: number | string };

/** A {@link DeferOption} resolved to concrete values. */
export interface ResolvedDefer {
  readonly ephemeral: boolean;
  readonly update: boolean;
  /** Milliseconds to wait before deferring. */
  readonly afterMs: number;
}

/** A short, log-friendly identity for an interaction. */
export interface InteractionSummary {
  /** What kind of interaction it is. */
  kind: "command" | "userCommand" | "messageCommand" | "button" | "select" | "modal" | "other";
  /**
   * The command name (with its subcommand, e.g. `"config set"`), or the routing
   * id of a component or modal (without its encoded params).
   */
  name: string;
}

/**
 * Summarises an interaction as a kind plus a readable name - what a logging or
 * metrics plugin wants to tag its records with.
 * @example describeInteraction(ctx.interaction) // { kind: "command", name: "config set" }
 */
export function describeInteraction(interaction: RepliableInteraction): InteractionSummary {
  // Tolerate a hand-built interaction (tests, custom gateways): never throw
  // from what is only a labelling helper.
  if (typeof interaction?.isChatInputCommand !== "function") return { kind: "other", name: "unknown" };
  if (interaction.isChatInputCommand()) {
    const parts = [
      interaction.commandName,
      interaction.options.getSubcommandGroup(false),
      interaction.options.getSubcommand(false),
    ];
    return { kind: "command", name: parts.filter(Boolean).join(" ") };
  }
  if (interaction.isUserContextMenuCommand()) return { kind: "userCommand", name: interaction.commandName };
  if (interaction.isMessageContextMenuCommand()) return { kind: "messageCommand", name: interaction.commandName };

  const routingId = (customId: string): string => customId.split("$")[0] ?? customId;
  if (interaction.isButton()) return { kind: "button", name: routingId(interaction.customId) };
  if (interaction.isAnySelectMenu()) return { kind: "select", name: routingId(interaction.customId) };
  if (interaction.isModalSubmit()) return { kind: "modal", name: routingId(interaction.customId) };
  return { kind: "other", name: "unknown" };
}

/** How long a handler gets before `defer: true` acknowledges for it. */
export const DEFAULT_DEFER_AFTER_MS = 2000;

/** Resolves a {@link DeferOption} to concrete values, or `undefined` when off. */
export function resolveDefer(option: DeferOption | undefined): ResolvedDefer | undefined {
  if (option === undefined || option === false) return undefined;
  if (option === true) return { ephemeral: false, update: false, afterMs: DEFAULT_DEFER_AFTER_MS };
  if (option === "ephemeral") return { ephemeral: true, update: false, afterMs: DEFAULT_DEFER_AFTER_MS };
  if (option === "update") return { ephemeral: false, update: true, afterMs: DEFAULT_DEFER_AFTER_MS };
  const after = option.after;
  const afterMs =
    typeof after === "number"
      ? after
      : typeof after === "string"
        ? (comfort.time.parseDuration(after) ?? DEFAULT_DEFER_AFTER_MS)
        : DEFAULT_DEFER_AFTER_MS;
  return { ephemeral: option.ephemeral ?? false, update: option.update ?? false, afterMs };
}

/* -------------------------------------------------------------------------- */
/*  Responder (runtime)                                                       */
/* -------------------------------------------------------------------------- */

function normalize(content: ReplyContent): InteractionReplyOptions {
  return typeof content === "string" ? { content } : content;
}

function embed(color: number, title: string | undefined, message: string): EmbedBuilder {
  const e = new EmbedBuilder().setColor(color).setDescription(message);
  if (title) e.setTitle(title);
  return e;
}

/** Adds the ephemeral bit to whatever flags a payload already carries. */
function withEphemeral(options: InteractionReplyOptions): InteractionReplyOptions {
  const current = typeof options.flags === "number" ? options.flags : 0;
  return { ...options, flags: (current | MessageFlags.Ephemeral) as InteractionReplyOptions["flags"] };
}

type ComponentInteraction = ButtonInteraction | AnySelectMenuInteraction;

/** The reply helpers bound to one interaction, plus the hooks the router uses. */
export interface Responder {
  readonly reply: ReplyFn;
  /** Only present for component interactions. */
  readonly update?: UpdateFn;
  readonly showModal: ShowModalFn;
  /** Arms the automatic deferral. Safe to call once per interaction. */
  armDefer(defer: ResolvedDefer): void;
  /** Disarms the automatic deferral (handler finished, or a modal was shown). */
  disarm(): void;
}

/**
 * Builds the reply helpers for an interaction.
 *
 * Every response goes through one queue, so the automatic deferral and the
 * handler's own replies can never collide: whichever comes second sees that the
 * interaction was already acknowledged and edits the reply instead.
 */
export function createResponder(interaction: RepliableInteraction, theme: Theme = DEFAULT_THEME): Responder {
  let queue: Promise<unknown> = Promise.resolve();
  let timer: NodeJS.Timeout | undefined;

  const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(task);
    queue = run.catch(() => undefined);
    return run;
  };
  const acknowledged = (): boolean => interaction.deferred || interaction.replied;
  const disarm = (): void => {
    if (timer) clearTimeout(timer);
    timer = undefined;
  };

  const respond = (options: InteractionReplyOptions): Promise<void> =>
    enqueue(async () => {
      disarm();
      if (interaction.deferred && !interaction.replied) await interaction.editReply(options as never);
      else if (interaction.replied) await interaction.followUp(options);
      else await interaction.reply(options);
    });

  const reply = ((content: ReplyContent) => respond(normalize(content))) as ReplyFn;

  const semantic =
    (color: number, ephemeralByDefault: boolean) =>
    (message: string, options: SemanticReplyOptions = {}): Promise<void> => {
      const payload: InteractionReplyOptions = { embeds: [embed(color, options.title, message)] };
      return respond((options.ephemeral ?? ephemeralByDefault) ? withEphemeral(payload) : payload);
    };

  reply.success = semantic(theme.success, false);
  reply.info = semantic(theme.info, false);
  reply.warn = semantic(theme.warn, false);
  reply.error = semantic(theme.error, true);
  reply.ephemeral = (content) => respond(withEphemeral(normalize(content)));
  reply.defer = (options = {}) =>
    enqueue(async () => {
      disarm();
      if (acknowledged()) return;
      await interaction.deferReply(options.ephemeral ? { flags: MessageFlags.Ephemeral } : {});
    });
  reply.followUp = (content) =>
    enqueue(async () => {
      disarm();
      await interaction.followUp(normalize(content));
    });
  reply.editReply = (content) =>
    enqueue(async () => {
      disarm();
      await interaction.editReply(normalize(content) as never);
    });
  reply.fetch = () => enqueue(() => interaction.fetchReply());
  reply.delete = () =>
    enqueue(async () => {
      await interaction.deleteReply();
    });

  const showModal: ShowModalFn = (modal, ...args) =>
    enqueue(async () => {
      // A modal is only valid as the first response, so the timer must not
      // sneak a deferral in front of it.
      disarm();
      await (interaction as unknown as { showModal(modal: ModalBuilder): Promise<unknown> }).showModal(
        modal.build(...args),
      );
    });

  let update: UpdateFn | undefined;
  if (interaction.isMessageComponent()) {
    const component = interaction as ComponentInteraction;
    update = ((content: ReplyContent) =>
      enqueue(async () => {
        disarm();
        const payload = normalize(content) as never;
        // After a defer, `update()` is no longer valid: edit the reply instead.
        if (acknowledged()) await component.editReply(payload);
        else await component.update(payload);
      })) as UpdateFn;
    update.defer = () =>
      enqueue(async () => {
        disarm();
        if (!acknowledged()) await component.deferUpdate();
      });
    update.disable = () =>
      enqueue(async () => {
        disarm();
        const rows = component.message.components.map((row) => {
          const builder = ActionRowBuilder.from(row as never) as ActionRowBuilder;
          for (const child of builder.components as Array<{ setDisabled?: (v: boolean) => unknown }>) {
            child.setDisabled?.(true);
          }
          return builder;
        });
        const payload = { components: rows } as never;
        if (acknowledged()) await component.editReply(payload);
        else await component.update(payload);
      });
  }

  const armDefer = (defer: ResolvedDefer): void => {
    disarm();
    const fire = (): void => {
      timer = undefined;
      void enqueue(async () => {
        if (acknowledged()) return;
        if (defer.update && interaction.isMessageComponent()) {
          await (interaction as ComponentInteraction).deferUpdate();
        } else {
          await interaction.deferReply(defer.ephemeral ? { flags: MessageFlags.Ephemeral } : {});
        }
      }).catch(() => undefined); // the interaction may already be gone
    };
    if (defer.afterMs <= 0) fire();
    else {
      timer = setTimeout(fire, defer.afterMs);
      timer.unref?.();
    }
  };

  return { reply, update, showModal, armDefer, disarm };
}

/** Builds the {@link ReplyFn} bound to a repliable interaction. */
export function createReply(interaction: RepliableInteraction, theme?: Theme): ReplyFn {
  return createResponder(interaction, theme).reply;
}

/** Builds the {@link UpdateFn} for component interactions. */
export function createUpdate(interaction: ButtonInteraction | AnySelectMenuInteraction, theme?: Theme): UpdateFn {
  return createResponder(interaction, theme).update!;
}
