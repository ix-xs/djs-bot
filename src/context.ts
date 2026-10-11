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
  defer(options?: {
    /** Make the eventual reply visible to the invoking user only. */
    ephemeral?: boolean;
  }): Promise<void>;
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
  audit(
    action: string,
    details?: {
      /** The id of what the action was applied to: a user, a message, a channel. */
      targetId?: string;
      /** Anything else worth keeping, e.g. `{ reason }`. */
      metadata?: Record<string, unknown>;
    },
  ): Promise<void>;
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
  /** The text shown in the suggestion list (1 to 100 characters). */
  name: string;
  /** What the option receives when the user picks this suggestion. */
  value: string | number;
}

/** What an autocomplete handler may return (auto-mapped to choices). */
export type AutocompleteResult = AutocompleteChoice[] | string[] | number[];

/**
 * What the user has filled in so far, by option name, as Discord sends it while
 * they type: text, numbers and booleans as such, and the **id** of a user,
 * role, channel, mentionable or attachment. Options left empty are absent.
 */
export type AutocompleteOptions = Readonly<Record<string, string | number | boolean | undefined>>;

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
  /** The id of the guild the user is typing in; `null` in DMs. */
  readonly guildId: string | null;
  /** The id of the channel the user is typing in. */
  readonly channelId: string | null;
  /** Injected services. */
  readonly services: ServiceMap;
  /** Correlation-scoped logger. */
  readonly logger: Logger;
  /** The name of the option currently being focused. */
  readonly focused: string;
  /** The current (partial) value the user has typed, as a string. */
  readonly value: string;
  /**
   * The other options already filled in, to make suggestions depend on them:
   * `ctx.options.category`. See {@link AutocompleteOptions} for what each holds.
   */
  readonly options: AutocompleteOptions;
  /** The user's Discord client locale. */
  readonly locale: string;
  /** Translates a key for this user's locale. */
  t(key: string, vars?: Record<string, unknown>): string;
}

/**
 * An option's autocomplete handler. Return the suggestions for what the user
 * has typed (`ctx.value`): the first 25 are shown. Discord waits 3 seconds at
 * most and the answer cannot be deferred, so keep lookups fast or cached.
 */
export type AutocompleteHandler = (
  ctx: AutocompleteContext,
) => AutocompleteResult | Promise<AutocompleteResult>;

/** The most suggestions Discord shows for one option. */
export const AUTOCOMPLETE_MAX_CHOICES = 25;
/** The longest suggestion name, and the longest text value, Discord accepts. */
export const AUTOCOMPLETE_MAX_LENGTH = 100;

/** What {@link toAutocompleteChoices} produced, and what it had to leave out. */
export interface NormalizedChoices {
  /** The suggestions to send, at most 25. */
  choices: AutocompleteChoice[];
  /** How many suggestions were left out because Discord would refuse them. */
  dropped: number;
}

/**
 * Turns what an autocomplete handler returned into suggestions Discord accepts.
 * One invalid suggestion makes Discord refuse the whole list, so each is made
 * valid or left out:
 *  - plain strings and numbers become `{ name, value }`;
 *  - names longer than 100 characters are cut, empty ones left out;
 *  - the value takes the type of the option (text for `s.string`, a number for
 *    `s.integer` and `s.number`); what cannot be converted is left out, and so
 *    is a text value longer than 100 characters;
 *  - only the first 25 are kept.
 *
 * @param result What the handler returned.
 * @param kind The kind of the option being completed. Default `"string"`.
 */
export function toAutocompleteChoices(
  result: unknown,
  kind: "string" | "integer" | "number" | (string & {}) = "string",
): NormalizedChoices {
  if (!Array.isArray(result)) return { choices: [], dropped: 0 };
  const choices: AutocompleteChoice[] = [];
  let dropped = 0;
  for (const item of result) {
    if (choices.length === AUTOCOMPLETE_MAX_CHOICES) break;
    const pair =
      typeof item === "object" && item !== null
        ? (item as { name?: unknown; value?: unknown })
        : { name: item, value: item };
    if (pair.value === undefined || pair.value === null) {
      dropped++;
      continue;
    }
    const label = String(pair.name ?? pair.value).trim();
    let value: string | number;
    if (kind === "integer" || kind === "number") {
      value = typeof pair.value === "number" ? pair.value : Number(String(pair.value).trim() || Number.NaN);
      if (!Number.isFinite(value) || (kind === "integer" && !Number.isInteger(value))) {
        dropped++;
        continue;
      }
    } else {
      value = String(pair.value);
      if (value.length > AUTOCOMPLETE_MAX_LENGTH) {
        dropped++;
        continue;
      }
    }
    if (label === "") {
      dropped++;
      continue;
    }
    choices.push({
      name: label.length > AUTOCOMPLETE_MAX_LENGTH ? `${label.slice(0, AUTOCOMPLETE_MAX_LENGTH - 3)}...` : label,
      value,
    });
  }
  return { choices, dropped };
}

/** The shape of one entry of `interaction.options.data`. */
interface RawOption {
  name: string;
  type: number;
  value?: string | number | boolean;
  options?: readonly RawOption[];
}

/**
 * Reads what the user has filled in so far from an autocomplete interaction,
 * looking inside the subcommand (and group) being typed.
 */
export function readAutocompleteOptions(data: readonly RawOption[] | undefined): AutocompleteOptions {
  let level = data ?? [];
  // 1 = subcommand, 2 = subcommand group: the real options are nested inside.
  while (level.length === 1 && (level[0]!.type === 1 || level[0]!.type === 2)) level = level[0]!.options ?? [];
  const filled: Record<string, string | number | boolean | undefined> = {};
  for (const option of level) if (option.value !== undefined) filled[option.name] = option.value;
  return filled;
}

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
  | {
      /** Make the eventual reply visible to the invoking user only. */
      ephemeral?: boolean;
      /** Acknowledge without a loading message, to edit the original message (components). */
      update?: boolean;
      /** How long the handler may run before the deferral is sent. Default `2000` ms. */
      after?: number | string;
    };

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

/** The start of every response queue. Never mutated, so one instance is shared. */
const SETTLED: Promise<unknown> = Promise.resolve();

/**
 * The reply helpers of one interaction.
 *
 * Every response goes through one queue, so the automatic deferral and the
 * handler's own replies can never collide: whichever comes second sees that the
 * interaction was already acknowledged and edits the reply instead.
 *
 * The state lives on the instance and the logic on the prototype; the functions
 * handed to user code (`ctx.reply.*`, `ctx.update.*`, `ctx.showModal`) are thin
 * arrows over it. A responder is built for every interaction, so this keeps its
 * construction cheap.
 */
class InteractionResponder implements Responder {
  public readonly reply: ReplyFn;
  public readonly update?: UpdateFn;
  private queue: Promise<unknown> = SETTLED;
  private timer: NodeJS.Timeout | undefined;

  public constructor(
    private readonly interaction: RepliableInteraction,
    theme: Theme,
  ) {
    const self = this;

    const reply = ((content: ReplyContent) => self.respond(normalize(content))) as ReplyFn;
    reply.success = (message, options) => self.semantic(theme.success, false, message, options);
    reply.info = (message, options) => self.semantic(theme.info, false, message, options);
    reply.warn = (message, options) => self.semantic(theme.warn, false, message, options);
    reply.error = (message, options) => self.semantic(theme.error, true, message, options);
    reply.ephemeral = (content) => self.respond(withEphemeral(normalize(content)));
    reply.defer = (options) => self.defer(options?.ephemeral ?? false);
    reply.followUp = (content) => self.followUp(normalize(content));
    reply.editReply = (content) => self.editReply(normalize(content));
    reply.fetch = () => self.enqueue(() => interaction.fetchReply());
    reply.delete = () => self.enqueue(() => interaction.deleteReply()) as Promise<void>;
    this.reply = reply;

    if (interaction.isMessageComponent()) {
      const update = ((content: ReplyContent) => self.edit(normalize(content))) as UpdateFn;
      update.defer = () => self.deferUpdate();
      update.disable = () => self.disableComponents();
      this.update = update;
    }
  }

  /** Bound, because user code receives it detached as `ctx.showModal`. */
  public readonly showModal: ShowModalFn = (modal, ...args) =>
    this.enqueue(async () => {
      // A modal is only valid as the first response, so the timer must not
      // sneak a deferral in front of it.
      this.disarm();
      await (this.interaction as unknown as { showModal(modal: ModalBuilder): Promise<unknown> }).showModal(
        modal.build(...args),
      );
    });

  public armDefer(defer: ResolvedDefer): void {
    this.disarm();
    if (defer.afterMs <= 0) {
      this.autoDefer(defer);
      return;
    }
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.autoDefer(defer);
    }, defer.afterMs);
    this.timer.unref?.();
  }

  public disarm(): void {
    if (this.timer === undefined) return;
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task);
    this.queue = run.catch(noop);
    return run;
  }

  private get acknowledged(): boolean {
    return this.interaction.deferred || this.interaction.replied;
  }

  private respond(options: InteractionReplyOptions): Promise<void> {
    return this.enqueue(async () => {
      this.disarm();
      const { interaction } = this;
      if (interaction.deferred && !interaction.replied) await interaction.editReply(options as never);
      else if (interaction.replied) await interaction.followUp(options);
      else await interaction.reply(options);
    });
  }

  private semantic(
    color: number,
    ephemeralByDefault: boolean,
    message: string,
    options: SemanticReplyOptions = {},
  ): Promise<void> {
    const payload: InteractionReplyOptions = { embeds: [embed(color, options.title, message)] };
    return this.respond((options.ephemeral ?? ephemeralByDefault) ? withEphemeral(payload) : payload);
  }

  private defer(ephemeral: boolean): Promise<void> {
    return this.enqueue(async () => {
      this.disarm();
      if (this.acknowledged) return;
      await this.interaction.deferReply(ephemeral ? { flags: MessageFlags.Ephemeral } : {});
    });
  }

  private followUp(options: InteractionReplyOptions): Promise<void> {
    return this.enqueue(async () => {
      this.disarm();
      await this.interaction.followUp(options);
    });
  }

  private editReply(options: InteractionReplyOptions): Promise<void> {
    return this.enqueue(async () => {
      this.disarm();
      await this.interaction.editReply(options as never);
    });
  }

  /** Edits the source message of a component, before or after a defer. */
  private edit(payload: InteractionReplyOptions): Promise<void> {
    return this.enqueue(async () => {
      this.disarm();
      const component = this.interaction as ComponentInteraction;
      // After a defer, `update()` is no longer valid: edit the reply instead.
      if (this.acknowledged) await component.editReply(payload as never);
      else await component.update(payload as never);
    });
  }

  private deferUpdate(): Promise<void> {
    return this.enqueue(async () => {
      this.disarm();
      if (!this.acknowledged) await (this.interaction as ComponentInteraction).deferUpdate();
    });
  }

  private disableComponents(): Promise<void> {
    const component = this.interaction as ComponentInteraction;
    const rows = component.message.components.map((row) => {
      const builder = ActionRowBuilder.from(row as never) as ActionRowBuilder;
      for (const child of builder.components as Array<{ setDisabled?: (v: boolean) => unknown }>) {
        child.setDisabled?.(true);
      }
      return builder;
    });
    return this.edit({ components: rows } as never);
  }

  /** Acknowledges on the handler's behalf, unless it answered in the meantime. */
  private autoDefer(defer: ResolvedDefer): void {
    void this.enqueue(async () => {
      if (this.acknowledged) return;
      const { interaction } = this;
      if (defer.update && interaction.isMessageComponent()) {
        await (interaction as ComponentInteraction).deferUpdate();
      } else {
        await interaction.deferReply(defer.ephemeral ? { flags: MessageFlags.Ephemeral } : {});
      }
    }).catch(noop); // the interaction may already be gone
  }
}

function noop(): void {
  /* intentionally empty */
}

/** Builds the reply helpers for an interaction. */
export function createResponder(interaction: RepliableInteraction, theme: Theme = DEFAULT_THEME): Responder {
  return new InteractionResponder(interaction, theme);
}

/** Builds the {@link ReplyFn} bound to a repliable interaction. */
export function createReply(interaction: RepliableInteraction, theme?: Theme): ReplyFn {
  return createResponder(interaction, theme).reply;
}

/** Builds the {@link UpdateFn} for component interactions. */
export function createUpdate(interaction: ButtonInteraction | AnySelectMenuInteraction, theme?: Theme): UpdateFn {
  return createResponder(interaction, theme).update!;
}
