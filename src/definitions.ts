/**
 * The `define*` factories - the entire authoring surface of the framework.
 *
 * Every building block is a plain object with a `kind` discriminant. Files are
 * *discovered* by name convention but *routed* by `kind`, so importing a file
 * never has a side effect: the loader simply collects the objects you export.
 *
 * @module definitions
 */
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  MentionableSelectMenuBuilder,
  ModalBuilder,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
  type APISelectMenuOption,
  type ChannelType,
  type Client,
  type ClientEvents,
  type Guild,
  type GuildMember,
  type LocalizationMap,
  type Message,
  type MessageCreateOptions,
  type MessageReplyOptions,
  type PermissionResolvable,
  type User,
} from "discord.js";
import type { Logger } from "./logger.js";
import type { ServiceMap } from "./container.js";
import { type ServiceDefinition } from "./container.js";
import type { Guard } from "./guards.js";
import type {
  BaseContext,
  ButtonContext,
  CommandContext,
  MessageCommandContext,
  ModalContext,
  SelectMenuContext,
  UserCommandContext,
} from "./context.js";
import {
  type FieldMap,
  type InferFields,
  type InferOptions,
  type InferParams,
  type OptionMap,
  type ParamMap,
} from "./schema.js";
import { encodeCustomId } from "./customId.js";

/* -------------------------------------------------------------------------- */
/*  Shared app-facing types                                                   */
/* -------------------------------------------------------------------------- */

/** Context passed to gateway event handlers (after the event's own args). */
export interface EventContext {
  readonly client: Client<true>;
  readonly services: ServiceMap;
  readonly logger: Logger;
}

/** Context passed to scheduled jobs. */
export interface JobContext {
  readonly client: Client<true>;
  readonly services: ServiceMap;
  readonly logger: Logger;
  /** Aborted when the bot is shutting down; long jobs should observe it. */
  readonly signal: AbortSignal;
}

/** Middleware runs around every interaction; call `next()` to continue. */
export type MiddlewareFn = (ctx: BaseContext, next: () => Promise<void>) => Promise<void> | void;

/** Lets plugins register hooks without touching the core. */
export interface HookRegistrar {
  /** Runs before every interaction handler; short-circuit by not calling `next`. */
  beforeInteraction(fn: MiddlewareFn): void;
  /** Runs after a successful interaction handler. */
  afterInteraction(fn: (ctx: BaseContext) => unknown): void;
  /** Runs when any handler throws. */
  onError(fn: (error: unknown, ctx?: BaseContext) => unknown): void;
  /** Runs once the client is ready. */
  onReady(fn: (client: Client<true>) => unknown): void;
  /** Runs during graceful shutdown. */
  onShutdown(fn: () => unknown): void;
}

/** The restricted façade handed to plugins in `setup()`. */
export interface PluginApp {
  readonly logger: Logger;
  readonly hooks: HookRegistrar;
  readonly config: Readonly<Record<string, unknown>>;
  readonly services: {
    /** Registers an already-built value under a token. */
    register(token: string, value: unknown): void;
    /** Whether a token exists. */
    has(token: string): boolean;
  };
}

/* -------------------------------------------------------------------------- */
/*  Commands                                                                  */
/* -------------------------------------------------------------------------- */

/** Where an app command can be installed: on servers, and/or on a user account. */
export type InstallContext = "guild" | "user";
/** Where an app command can be used: in servers, the bot's DMs, or group DMs / other DMs. */
export type InteractionContext = "guild" | "botDm" | "privateChannel";

/** A single subcommand (the leaf that actually runs). Create with {@link subcommand}. */
export interface SubcommandDefinition<M extends OptionMap = OptionMap> {
  readonly kind: "subcommand";
  readonly description: string;
  readonly options: M;
  readonly guards: readonly Guard[];
  readonly nameLocalizations?: LocalizationMap;
  readonly descriptionLocalizations?: LocalizationMap;
  // Method signature (not a property) so a precisely-typed subcommand stays
  // assignable to the erased `SubcommandDefinition` stored on a command.
  run(ctx: CommandContext<InferOptions<M>>): unknown | Promise<unknown>;
}

/** A subcommand group (a folder of subcommands). */
export interface SubcommandGroupDefinition {
  readonly description: string;
  readonly subcommands: Record<string, SubcommandDefinition>;
}

/** Input accepted by {@link subcommand}. */
export interface SubcommandInput<M extends OptionMap> {
  description: string;
  options?: M;
  guards?: Guard[];
  nameLocalizations?: LocalizationMap;
  descriptionLocalizations?: LocalizationMap;
  run: (ctx: CommandContext<InferOptions<M>>) => unknown | Promise<unknown>;
}

/**
 * Defines one subcommand with its own typed options. Options are inferred per
 * subcommand, so each handler's `ctx.options` is precise.
 * @example
 * subcommands: {
 *   view: subcommand({ description: "View config", run: (ctx) => ctx.reply("...") }),
 *   set:  subcommand({ description: "Set a key", options: { key: s.string({ required: true }) },
 *                      run: (ctx) => ctx.reply(ctx.options.key) }),
 * }
 */
export function subcommand<M extends OptionMap = Record<string, never>>(
  input: SubcommandInput<M>,
): SubcommandDefinition<M> {
  return {
    kind: "subcommand",
    description: input.description,
    options: (input.options ?? {}) as M,
    guards: input.guards ?? [],
    nameLocalizations: input.nameLocalizations,
    descriptionLocalizations: input.descriptionLocalizations,
    run: input.run,
  };
}

/** A registered slash command (flat, with subcommands, or with groups). */
export interface CommandDefinition<M extends OptionMap = OptionMap> {
  readonly kind: "command";
  readonly name: string;
  readonly description: string;
  readonly options: M;
  readonly guards: readonly Guard[];
  readonly nsfw?: boolean;
  readonly dmPermission?: boolean;
  readonly defaultMemberPermissions?: PermissionResolvable;
  readonly integrationTypes?: readonly InstallContext[];
  readonly contexts?: readonly InteractionContext[];
  readonly nameLocalizations?: LocalizationMap;
  readonly descriptionLocalizations?: LocalizationMap;
  /** Deploy this command only to these guild ids. Omit for a global command. */
  readonly guilds?: readonly string[];
  readonly subcommands?: Record<string, SubcommandDefinition>;
  readonly groups?: Record<string, SubcommandGroupDefinition>;
  run?(ctx: CommandContext<InferOptions<M>>): unknown | Promise<unknown>;
}

/** Input accepted by {@link defineCommand}. */
export interface CommandInput<M extends OptionMap> {
  /** Lowercase command name (what users type after `/`). */
  name: string;
  /** Shown in the command picker. */
  description: string;
  /** Typed option map; drives `ctx.options`. Omit when using subcommands. */
  options?: M;
  /** Preconditions that must pass before `run` (and before any subcommand). */
  guards?: Guard[];
  /** Mark the command NSFW. */
  nsfw?: boolean;
  /** Allow use in DMs (global commands only). */
  dmPermission?: boolean;
  /** Default member permissions required to see/use the command. */
  defaultMemberPermissions?: PermissionResolvable;
  /** Where the command can be installed: `["guild"]`, `["user"]`, or both. */
  integrationTypes?: InstallContext[];
  /** Where the command can be used: `"guild"`, `"botDm"`, `"privateChannel"`. */
  contexts?: InteractionContext[];
  /** Per-locale translations of the command name (e.g. `{ "fr": "aide" }`). */
  nameLocalizations?: LocalizationMap;
  /** Per-locale translations of the command description. */
  descriptionLocalizations?: LocalizationMap;
  /**
   * Deploy this command only to these guild ids (a "guild command"). Omit to make
   * it global. Lets you mix global commands with server-specific ones.
   */
  guilds?: string[];
  /** Subcommands, keyed by name. Mutually exclusive with a top-level `options`/`run`. */
  subcommands?: Record<string, SubcommandDefinition>;
  /** Subcommand groups, keyed by name. */
  groups?: Record<string, SubcommandGroupDefinition>;
  /** The handler. `ctx.options` is fully typed from `options`. Optional when using subcommands. */
  run?: (ctx: CommandContext<InferOptions<M>>) => unknown | Promise<unknown>;
}

/**
 * Defines a slash command with typed options, or with subcommands/groups.
 * @example
 * export default defineCommand({
 *   name: "echo",
 *   description: "Repeat a message",
 *   options: { text: s.string({ required: true }) },
 *   run: (ctx) => ctx.reply(ctx.options.text),
 * });
 */
export function defineCommand<M extends OptionMap = Record<string, never>>(
  input: CommandInput<M>,
): CommandDefinition<M> {
  return {
    kind: "command",
    name: input.name,
    description: input.description,
    options: (input.options ?? {}) as M,
    guards: input.guards ?? [],
    nsfw: input.nsfw,
    dmPermission: input.dmPermission,
    defaultMemberPermissions: input.defaultMemberPermissions,
    integrationTypes: input.integrationTypes,
    contexts: input.contexts,
    nameLocalizations: input.nameLocalizations,
    descriptionLocalizations: input.descriptionLocalizations,
    guilds: input.guilds,
    subcommands: input.subcommands,
    groups: input.groups,
    run: input.run,
  };
}

/* -------------------------------------------------------------------------- */
/*  Context menu commands (user & message)                                    */
/* -------------------------------------------------------------------------- */

/** A registered user context-menu command (right-click a user → Apps). */
export interface UserCommandDefinition {
  readonly kind: "userCommand";
  readonly name: string;
  readonly guards: readonly Guard[];
  readonly dmPermission?: boolean;
  readonly defaultMemberPermissions?: PermissionResolvable;
  readonly integrationTypes?: readonly InstallContext[];
  readonly contexts?: readonly InteractionContext[];
  readonly nameLocalizations?: LocalizationMap;
  readonly guilds?: readonly string[];
  run(ctx: UserCommandContext): unknown | Promise<unknown>;
}

/** A registered message context-menu command (right-click a message → Apps). */
export interface MessageCommandDefinition {
  readonly kind: "messageCommand";
  readonly name: string;
  readonly guards: readonly Guard[];
  readonly dmPermission?: boolean;
  readonly defaultMemberPermissions?: PermissionResolvable;
  readonly integrationTypes?: readonly InstallContext[];
  readonly contexts?: readonly InteractionContext[];
  readonly nameLocalizations?: LocalizationMap;
  readonly guilds?: readonly string[];
  run(ctx: MessageCommandContext): unknown | Promise<unknown>;
}

/** Shared input fields for context-menu commands. */
interface ContextCommandCommon {
  /** The label shown in the right-click Apps menu (spaces & capitals allowed). */
  name: string;
  guards?: Guard[];
  dmPermission?: boolean;
  defaultMemberPermissions?: PermissionResolvable;
  /** Where the command can be installed: `["guild"]`, `["user"]`, or both. */
  integrationTypes?: InstallContext[];
  /** Where the command can be used. */
  contexts?: InteractionContext[];
  /** Per-locale translations of the command name. */
  nameLocalizations?: LocalizationMap;
  /** Deploy only to these guild ids. Omit for a global command. */
  guilds?: string[];
}

/** Input accepted by {@link defineUserCommand}. */
export interface UserCommandInput extends ContextCommandCommon {
  /** Handler. `ctx.targetUser` / `ctx.targetMember` are the clicked user. */
  run(ctx: UserCommandContext): unknown | Promise<unknown>;
}

/** Input accepted by {@link defineMessageCommand}. */
export interface MessageCommandInput extends ContextCommandCommon {
  /** Handler. `ctx.targetMessage` is the clicked message. */
  run(ctx: MessageCommandContext): unknown | Promise<unknown>;
}

/**
 * Defines a user context-menu command.
 * @example
 * export default defineUserCommand({
 *   name: "User info",
 *   integrationTypes: ["guild", "user"],
 *   run: (ctx) => ctx.reply.info(`Joined: ${ctx.targetMember?.joinedAt}`),
 * });
 */
export function defineUserCommand(input: UserCommandInput): UserCommandDefinition {
  return {
    kind: "userCommand",
    name: input.name,
    guards: input.guards ?? [],
    dmPermission: input.dmPermission,
    defaultMemberPermissions: input.defaultMemberPermissions,
    integrationTypes: input.integrationTypes,
    contexts: input.contexts,
    nameLocalizations: input.nameLocalizations,
    guilds: input.guilds,
    run: input.run,
  };
}

/**
 * Defines a message context-menu command.
 * @example
 * export default defineMessageCommand({
 *   name: "Report message",
 *   run: (ctx) => ctx.reply.success(`Reported: ${ctx.targetMessage.id}`),
 * });
 */
export function defineMessageCommand(input: MessageCommandInput): MessageCommandDefinition {
  return {
    kind: "messageCommand",
    name: input.name,
    guards: input.guards ?? [],
    dmPermission: input.dmPermission,
    defaultMemberPermissions: input.defaultMemberPermissions,
    integrationTypes: input.integrationTypes,
    contexts: input.contexts,
    nameLocalizations: input.nameLocalizations,
    guilds: input.guilds,
    run: input.run,
  };
}

/* -------------------------------------------------------------------------- */
/*  Events                                                                    */
/* -------------------------------------------------------------------------- */

/** A registered gateway event listener. */
export interface EventDefinition<E extends keyof ClientEvents = keyof ClientEvents> {
  readonly kind: "event";
  readonly event: E;
  readonly once: boolean;
  run(...args: [...ClientEvents[E], EventContext]): unknown | Promise<unknown>;
}

/**
 * Defines a gateway event listener. The needed gateway intent is derived
 * automatically when `intents: "auto"` (see intent autopilot).
 * @example
 * export default defineEvent("guildMemberAdd", (member, ctx) =>
 *   ctx.logger.info({ id: member.id }, "joined"));
 */
export function defineEvent<E extends keyof ClientEvents>(
  event: E,
  run: (...args: [...ClientEvents[E], EventContext]) => unknown | Promise<unknown>,
  options: { once?: boolean } = {},
): EventDefinition<E> {
  return { kind: "event", event, once: options.once ?? false, run };
}

/* -------------------------------------------------------------------------- */
/*  Triggers (message auto-responders)                                        */
/* -------------------------------------------------------------------------- */

/** Context passed to a message trigger handler. */
export interface TriggerContext {
  readonly message: Message;
  readonly client: Client<true>;
  readonly author: User;
  readonly member: GuildMember | null;
  readonly guild: Guild | null;
  readonly channel: Message["channel"];
  readonly services: ServiceMap;
  readonly logger: Logger;
  /** The regex match array when the trigger's pattern was a RegExp, else `null`. */
  readonly match: RegExpMatchArray | null;
  /** Reply to the triggering message. */
  reply(content: string | MessageReplyOptions): Promise<Message>;
  /** Send a new message to the same channel. */
  send(content: string | MessageCreateOptions): Promise<Message>;
}

/** How a string pattern is compared against message content. */
export type TriggerMode = "includes" | "equals" | "startsWith" | "endsWith";

/** A pattern: a substring/keyword, a RegExp, or a custom predicate. */
export type TriggerPattern = string | RegExp | ((message: Message) => boolean);

/** A registered message trigger (auto-responder). */
export interface TriggerDefinition {
  readonly kind: "trigger";
  readonly name: string;
  readonly pattern: TriggerPattern;
  readonly mode: TriggerMode;
  readonly caseInsensitive: boolean;
  readonly ignoreBots: boolean;
  readonly cooldown?: string | number;
  run(ctx: TriggerContext): unknown | Promise<unknown>;
}

/** Input accepted by {@link defineTrigger}. */
export interface TriggerInput {
  /** A unique name (for logs & diagnostics). */
  name: string;
  /** What to match: a keyword, a RegExp, or a `(message) => boolean` predicate. */
  pattern: TriggerPattern;
  /** For string patterns, how to compare. Default `"includes"`. */
  mode?: TriggerMode;
  /** For string patterns, ignore case. Default `true`. */
  caseInsensitive?: boolean;
  /** Ignore messages from bots (and itself). Default `true`. */
  ignoreBots?: boolean;
  /** Per-author cooldown, e.g. `"5s"`. */
  cooldown?: string | number;
  /** The handler. */
  run(ctx: TriggerContext): unknown | Promise<unknown>;
}

/**
 * Defines a message trigger - an auto-responder that fires on `messageCreate`.
 * Registering any trigger auto-enables the `GuildMessages` + `MessageContent`
 * intents (MessageContent is privileged - enable it in the Developer Portal).
 *
 * @example
 * export default defineTrigger({
 *   pattern: "ping",
 *   name: "ping-pong",
 *   run: (ctx) => ctx.reply("pong 🏓"),
 * });
 * @example
 * export const gm = defineTrigger({
 *   name: "greet",
 *   pattern: /\bgood (morning|night)\b/i,
 *   run: (ctx) => ctx.reply(`${ctx.match?.[1] === "morning" ? "☀️" : "🌙"}`),
 * });
 */
export function defineTrigger(input: TriggerInput): TriggerDefinition {
  return {
    kind: "trigger",
    name: input.name,
    pattern: input.pattern,
    mode: input.mode ?? "includes",
    caseInsensitive: input.caseInsensitive ?? true,
    ignoreBots: input.ignoreBots ?? true,
    cooldown: input.cooldown,
    run: input.run,
  };
}

/* -------------------------------------------------------------------------- */
/*  Buttons                                                                   */
/* -------------------------------------------------------------------------- */

/** Visual configuration for a built button. */
export interface ButtonVisualOptions {
  label?: string;
  emoji?: string;
  style?: ButtonStyle;
  disabled?: boolean;
}

/** A registered button with typed customId params. */
export interface ButtonDefinition<P extends ParamMap = ParamMap> {
  readonly kind: "button";
  readonly id: string;
  readonly params: P;
  readonly guards: readonly Guard[];
  run(ctx: ButtonContext<InferParams<P>>): unknown | Promise<unknown>;
  /** Builds a discord.js button whose customId encodes the given params. */
  build(params?: InferParams<P>, visual?: ButtonVisualOptions): ButtonBuilder;
}

/** Input accepted by {@link defineButton}. */
export interface ButtonInput<P extends ParamMap> {
  /** Stable routing key, e.g. `"ticket:close"`. */
  id: string;
  /** Typed params encoded into the customId. */
  params?: P;
  /** Preconditions before `run`. */
  guards?: Guard[];
  /** Default visuals used by `build()` when not overridden. */
  style?: ButtonStyle;
  label?: string;
  emoji?: string;
  /** The handler. `ctx.params` is decoded and typed. */
  run: (ctx: ButtonContext<InferParams<P>>) => unknown | Promise<unknown>;
}

/**
 * Defines a button. `Button.build(params)` is fully typed and encodes the
 * params into the customId; `ctx.params` decodes them back.
 * @example
 * export const Close = defineButton({
 *   id: "ticket:close",
 *   params: { ticketId: p.string },
 *   label: "Close", style: ButtonStyle.Danger,
 *   run: (ctx) => ctx.reply.success(`Closing ${ctx.params.ticketId}`),
 * });
 */
export function defineButton<P extends ParamMap = Record<string, never>>(
  input: ButtonInput<P>,
): ButtonDefinition<P> {
  const params = (input.params ?? {}) as P;
  return {
    kind: "button",
    id: input.id,
    params,
    guards: input.guards ?? [],
    run: input.run,
    build(values, visual = {}) {
      const button = new ButtonBuilder()
        .setCustomId(encodeCustomId(input.id, params, values as Record<string, unknown>))
        .setStyle(visual.style ?? input.style ?? ButtonStyle.Primary);
      const label = visual.label ?? input.label;
      const emoji = visual.emoji ?? input.emoji;
      if (label) button.setLabel(label);
      if (emoji) button.setEmoji(emoji);
      if (visual.disabled) button.setDisabled(true);
      if (!label && !emoji) button.setLabel(input.id);
      return button;
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  Select menus                                                              */
/* -------------------------------------------------------------------------- */

/** The five kinds of select menu Discord supports. */
export type SelectType = "string" | "user" | "role" | "channel" | "mentionable";

/** The routable shape shared by every select menu (used by the registry/router). */
export interface SelectRoutable<P extends ParamMap = ParamMap> {
  readonly kind: "select";
  readonly selectType: SelectType;
  readonly id: string;
  readonly params: P;
  readonly guards: readonly Guard[];
  run(ctx: SelectMenuContext<InferParams<P>>): unknown | Promise<unknown>;
}

/** Input accepted by every `define*Select` factory. */
export interface SelectMenuInput<P extends ParamMap> {
  id: string;
  params?: P;
  guards?: Guard[];
  run: (ctx: SelectMenuContext<InferParams<P>>) => unknown | Promise<unknown>;
}

/** Visual configuration for a built string select menu. */
export interface SelectVisualOptions {
  placeholder?: string;
  minValues?: number;
  maxValues?: number;
  disabled?: boolean;
  options: APISelectMenuOption[];
}

/** Visual configuration for a native (user/role/channel/mentionable) select. */
export interface NativeSelectVisualOptions {
  placeholder?: string;
  minValues?: number;
  maxValues?: number;
  disabled?: boolean;
  /** Pre-selected default ids (users, roles, or channels depending on the type). */
  defaultValues?: string[];
  /** Restrict a channel select to these channel types. */
  channelTypes?: ChannelType[];
}

/** A registered string select menu. */
export interface SelectMenuDefinition<P extends ParamMap = ParamMap> extends SelectRoutable<P> {
  build(params: InferParams<P> | undefined, visual: SelectVisualOptions): StringSelectMenuBuilder;
}
/** A registered user select menu. */
export interface UserSelectDefinition<P extends ParamMap = ParamMap> extends SelectRoutable<P> {
  build(params?: InferParams<P>, visual?: NativeSelectVisualOptions): UserSelectMenuBuilder;
}
/** A registered role select menu. */
export interface RoleSelectDefinition<P extends ParamMap = ParamMap> extends SelectRoutable<P> {
  build(params?: InferParams<P>, visual?: NativeSelectVisualOptions): RoleSelectMenuBuilder;
}
/** A registered channel select menu. */
export interface ChannelSelectDefinition<P extends ParamMap = ParamMap> extends SelectRoutable<P> {
  build(params?: InferParams<P>, visual?: NativeSelectVisualOptions): ChannelSelectMenuBuilder;
}
/** A registered mentionable (users + roles) select menu. */
export interface MentionableSelectDefinition<P extends ParamMap = ParamMap> extends SelectRoutable<P> {
  build(params?: InferParams<P>, visual?: NativeSelectVisualOptions): MentionableSelectMenuBuilder;
}

/** Any select-menu definition. */
export type AnySelectDefinition =
  | SelectMenuDefinition
  | UserSelectDefinition
  | RoleSelectDefinition
  | ChannelSelectDefinition
  | MentionableSelectDefinition;

function applyNativeVisual(
  menu: UserSelectMenuBuilder | RoleSelectMenuBuilder | ChannelSelectMenuBuilder | MentionableSelectMenuBuilder,
  visual: NativeSelectVisualOptions,
): void {
  if (visual.placeholder) menu.setPlaceholder(visual.placeholder);
  if (visual.minValues !== undefined) menu.setMinValues(visual.minValues);
  if (visual.maxValues !== undefined) menu.setMaxValues(visual.maxValues);
  if (visual.disabled) menu.setDisabled(true);
}

/**
 * Defines a string select menu (a custom list of options).
 * @example
 * export const Roles = defineSelectMenu({ id: "roles:pick", run: (ctx) => ctx.reply(ctx.values.join(",")) });
 */
export function defineSelectMenu<P extends ParamMap = Record<string, never>>(
  input: SelectMenuInput<P>,
): SelectMenuDefinition<P> {
  const params = (input.params ?? {}) as P;
  return {
    kind: "select",
    selectType: "string",
    id: input.id,
    params,
    guards: input.guards ?? [],
    run: input.run,
    build(values, visual) {
      const menu = new StringSelectMenuBuilder()
        .setCustomId(encodeCustomId(input.id, params, values as Record<string, unknown>))
        .addOptions(visual.options);
      if (visual.placeholder) menu.setPlaceholder(visual.placeholder);
      if (visual.minValues !== undefined) menu.setMinValues(visual.minValues);
      if (visual.maxValues !== undefined) menu.setMaxValues(visual.maxValues);
      if (visual.disabled) menu.setDisabled(true);
      return menu;
    },
  };
}

/** Defines a native user select menu. `ctx.users` / `ctx.members` hold the picks. */
export function defineUserSelect<P extends ParamMap = Record<string, never>>(
  input: SelectMenuInput<P>,
): UserSelectDefinition<P> {
  const params = (input.params ?? {}) as P;
  return {
    kind: "select",
    selectType: "user",
    id: input.id,
    params,
    guards: input.guards ?? [],
    run: input.run,
    build(values, visual = {}) {
      const menu = new UserSelectMenuBuilder().setCustomId(
        encodeCustomId(input.id, params, values as Record<string, unknown>),
      );
      applyNativeVisual(menu, visual);
      if (visual.defaultValues) menu.setDefaultUsers(visual.defaultValues);
      return menu;
    },
  };
}

/** Defines a native role select menu. `ctx.roles` holds the picks. */
export function defineRoleSelect<P extends ParamMap = Record<string, never>>(
  input: SelectMenuInput<P>,
): RoleSelectDefinition<P> {
  const params = (input.params ?? {}) as P;
  return {
    kind: "select",
    selectType: "role",
    id: input.id,
    params,
    guards: input.guards ?? [],
    run: input.run,
    build(values, visual = {}) {
      const menu = new RoleSelectMenuBuilder().setCustomId(
        encodeCustomId(input.id, params, values as Record<string, unknown>),
      );
      applyNativeVisual(menu, visual);
      if (visual.defaultValues) menu.setDefaultRoles(visual.defaultValues);
      return menu;
    },
  };
}

/** Defines a native channel select menu. `ctx.channels` holds the picks. */
export function defineChannelSelect<P extends ParamMap = Record<string, never>>(
  input: SelectMenuInput<P>,
): ChannelSelectDefinition<P> {
  const params = (input.params ?? {}) as P;
  return {
    kind: "select",
    selectType: "channel",
    id: input.id,
    params,
    guards: input.guards ?? [],
    run: input.run,
    build(values, visual = {}) {
      const menu = new ChannelSelectMenuBuilder().setCustomId(
        encodeCustomId(input.id, params, values as Record<string, unknown>),
      );
      applyNativeVisual(menu, visual);
      if (visual.channelTypes) menu.setChannelTypes(visual.channelTypes);
      if (visual.defaultValues) menu.setDefaultChannels(visual.defaultValues);
      return menu;
    },
  };
}

/** Defines a native mentionable (users + roles) select menu. */
export function defineMentionableSelect<P extends ParamMap = Record<string, never>>(
  input: SelectMenuInput<P>,
): MentionableSelectDefinition<P> {
  const params = (input.params ?? {}) as P;
  return {
    kind: "select",
    selectType: "mentionable",
    id: input.id,
    params,
    guards: input.guards ?? [],
    run: input.run,
    build(values, visual = {}) {
      const menu = new MentionableSelectMenuBuilder().setCustomId(
        encodeCustomId(input.id, params, values as Record<string, unknown>),
      );
      applyNativeVisual(menu, visual);
      return menu;
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  Modals                                                                    */
/* -------------------------------------------------------------------------- */

/** A registered modal with typed fields and optional customId params. */
export interface ModalDefinition<F extends FieldMap = FieldMap, P extends ParamMap = ParamMap> {
  readonly kind: "modal";
  readonly id: string;
  readonly title: string;
  readonly fields: F;
  readonly params: P;
  readonly guards: readonly Guard[];
  run(ctx: ModalContext<InferFields<F>> & { params: InferParams<P> }): unknown | Promise<unknown>;
  /** Builds a discord.js modal from the declared fields. */
  build(params?: InferParams<P>): ModalBuilder;
}

/** Input accepted by {@link defineModal}. */
export interface ModalInput<F extends FieldMap, P extends ParamMap> {
  id: string;
  title: string;
  fields: F;
  params?: P;
  guards?: Guard[];
  run: (ctx: ModalContext<InferFields<F>> & { params: InferParams<P> }) => unknown | Promise<unknown>;
}

/**
 * Defines a modal. `Modal.build()` renders the declared fields; `ctx.fields`
 * gives you the typed submitted values.
 * @example
 * export const Feedback = defineModal({
 *   id: "feedback:submit",
 *   title: "Feedback",
 *   fields: { body: field.paragraph({ label: "Your feedback", required: true }) },
 *   run: (ctx) => ctx.reply.success(`Thanks: ${ctx.fields.body}`),
 * });
 */
export function defineModal<F extends FieldMap, P extends ParamMap = Record<string, never>>(
  input: ModalInput<F, P>,
): ModalDefinition<F, P> {
  const params = (input.params ?? {}) as P;
  return {
    kind: "modal",
    id: input.id,
    title: input.title,
    fields: input.fields,
    params,
    guards: input.guards ?? [],
    run: input.run,
    build(values) {
      const modal = new ModalBuilder()
        .setCustomId(encodeCustomId(input.id, params, values as Record<string, unknown>))
        .setTitle(input.title);
      const rows = Object.entries(input.fields).map(([name, fieldDef]) => {
        const cfg = fieldDef.config as {
          placeholder?: string;
          minLength?: number;
          maxLength?: number;
          value?: string;
        };
        const textInput = new TextInputBuilder()
          .setCustomId(name)
          .setLabel(fieldDef.label)
          .setStyle(fieldDef.style === "paragraph" ? TextInputStyle.Paragraph : TextInputStyle.Short)
          .setRequired(fieldDef.required);
        if (cfg.placeholder) textInput.setPlaceholder(cfg.placeholder);
        if (cfg.minLength !== undefined) textInput.setMinLength(cfg.minLength);
        if (cfg.maxLength !== undefined) textInput.setMaxLength(cfg.maxLength);
        if (cfg.value !== undefined) textInput.setValue(cfg.value);
        return new ActionRowBuilder<TextInputBuilder>().addComponents(textInput);
      });
      modal.addComponents(...rows);
      return modal;
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  Services                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Defines an injectable service with explicit dependencies.
 * @example
 * export const Db = defineService("db", { factory: () => createDb() });
 * export const Tickets = defineService("tickets", {
 *   deps: ["db"],
 *   factory: ({ db }) => new TicketsService(db),
 * });
 */
export function defineService<T>(
  name: string,
  input: { deps?: string[]; factory: (deps: Record<string, unknown>) => T | Promise<T> },
): ServiceDefinition<T> {
  return { kind: "service", name, deps: input.deps ?? [], factory: input.factory };
}

/* -------------------------------------------------------------------------- */
/*  Jobs                                                                      */
/* -------------------------------------------------------------------------- */

/** A scheduled job. */
export interface JobDefinition {
  readonly kind: "job";
  readonly name: string;
  /** A cron expression (`"0 3 * * *"`) or a duration (`"30s"`, `"1h"`). */
  readonly schedule: string;
  /** IANA timezone for cron evaluation (default local). */
  readonly timezone?: string;
  /** Max overlapping runs. Default `1` (no overlap). */
  readonly concurrency: number;
  /** Run once immediately on boot in addition to the schedule. */
  readonly runOnStart: boolean;
  readonly run: (ctx: JobContext) => unknown | Promise<unknown>;
}

/** Input accepted by {@link defineJob}. */
export interface JobInput {
  name: string;
  schedule: string;
  timezone?: string;
  concurrency?: number;
  runOnStart?: boolean;
  run: (ctx: JobContext) => unknown | Promise<unknown>;
}

/**
 * Defines a scheduled job.
 * @example
 * export default defineJob({ name: "purge", schedule: "0 3 * * *", run: (ctx) => ctx.services.db.purge() });
 */
export function defineJob(input: JobInput): JobDefinition {
  return {
    kind: "job",
    name: input.name,
    schedule: input.schedule,
    timezone: input.timezone,
    concurrency: input.concurrency ?? 1,
    runOnStart: input.runOnStart ?? false,
    run: input.run,
  };
}

/* -------------------------------------------------------------------------- */
/*  Plugins & features                                                        */
/* -------------------------------------------------------------------------- */

/** A cross-cutting plugin. */
export interface PluginDefinition {
  readonly kind: "plugin";
  readonly name: string;
  readonly version?: string;
  readonly requires: readonly string[];
  readonly provides: readonly string[];
  readonly conflicts: readonly string[];
  readonly setup: (app: PluginApp) => unknown | Promise<unknown>;
  readonly teardown?: (app: PluginApp) => unknown | Promise<unknown>;
}

/** Input accepted by {@link definePlugin}. */
export interface PluginInput {
  name: string;
  version?: string;
  requires?: string[];
  provides?: string[];
  conflicts?: string[];
  setup: (app: PluginApp) => unknown | Promise<unknown>;
  teardown?: (app: PluginApp) => unknown | Promise<unknown>;
}

/** Defines a cross-cutting plugin (hooks, middleware, capabilities). */
export function definePlugin(input: PluginInput): PluginDefinition {
  return {
    kind: "plugin",
    name: input.name,
    version: input.version,
    requires: input.requires ?? [],
    provides: input.provides ?? [],
    conflicts: input.conflicts ?? [],
    setup: input.setup,
    teardown: input.teardown,
  };
}

/** Any definition that a feature can bundle. */
export type AnyDefinition =
  | CommandDefinition
  | UserCommandDefinition
  | MessageCommandDefinition
  | EventDefinition
  | TriggerDefinition
  | ButtonDefinition
  | AnySelectDefinition
  | ModalDefinition
  | ServiceDefinition
  | JobDefinition
  | PluginDefinition;

/** A self-contained feature: commands, events, components, services, jobs. */
export interface FeatureDefinition {
  readonly kind: "feature";
  readonly name: string;
  /** Service tokens this feature needs the host (or other features) to provide. */
  readonly requires: readonly string[];
  /** Capabilities this feature provides. */
  readonly provides: readonly string[];
  /** Feature-scoped default configuration. */
  readonly config: Readonly<Record<string, unknown>>;
  readonly commands: readonly CommandDefinition[];
  readonly userCommands: readonly UserCommandDefinition[];
  readonly messageCommands: readonly MessageCommandDefinition[];
  readonly events: readonly EventDefinition[];
  readonly triggers: readonly TriggerDefinition[];
  readonly buttons: readonly ButtonDefinition[];
  readonly selectMenus: readonly AnySelectDefinition[];
  readonly modals: readonly ModalDefinition[];
  readonly services: readonly ServiceDefinition[];
  readonly jobs: readonly JobDefinition[];
  readonly plugins: readonly PluginDefinition[];
}

/** Input accepted by {@link defineFeature}. */
export interface FeatureInput {
  name: string;
  requires?: string[];
  provides?: string[];
  config?: Record<string, unknown>;
  commands?: CommandDefinition[];
  userCommands?: UserCommandDefinition[];
  messageCommands?: MessageCommandDefinition[];
  events?: EventDefinition[];
  triggers?: TriggerDefinition[];
  buttons?: ButtonDefinition[];
  selectMenus?: AnySelectDefinition[];
  modals?: ModalDefinition[];
  services?: ServiceDefinition[];
  jobs?: JobDefinition[];
  plugins?: PluginDefinition[];
}

/**
 * Bundles a set of definitions into a reusable, publishable feature.
 * @example
 * export default defineFeature({ name: "tickets", requires: ["db"], commands: [Open, Close] });
 */
export function defineFeature(input: FeatureInput): FeatureDefinition {
  return {
    kind: "feature",
    name: input.name,
    requires: input.requires ?? [],
    provides: input.provides ?? [],
    config: input.config ?? {},
    commands: input.commands ?? [],
    userCommands: input.userCommands ?? [],
    messageCommands: input.messageCommands ?? [],
    events: input.events ?? [],
    triggers: input.triggers ?? [],
    buttons: input.buttons ?? [],
    selectMenus: input.selectMenus ?? [],
    modals: input.modals ?? [],
    services: input.services ?? [],
    jobs: input.jobs ?? [],
    plugins: input.plugins ?? [],
  };
}
