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
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  MentionableSelectMenuBuilder,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
  type APISelectMenuOption,
  type SelectMenuComponentOptionData,
  type ChannelType,
  type Client,
  type ClientEvents,
  type Guild,
  type GuildMember,
  type LocalizationMap,
  type Message,
  type ModalBuilder,
  type MessageCreateOptions,
  type MessageReplyOptions,
  type PermissionResolvable,
  type User,
} from "discord.js";
import type { Logger } from "./logger.js";
import type { ServiceDefinition, ServiceMap } from "./container.js";
import type { BotConfig } from "./config.js";
import type { Guard } from "./guards.js";
import type {
  BaseContext,
  ButtonContext,
  CommandContext,
  DeferOption,
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
import { assertModalFields, buildModal } from "./modal.js";
import { parseSchedule } from "./scheduler.js";
import { BotError } from "./errors.js";
import { assertChatName, assertCommandShape, assertComponentId, assertMenuName } from "./validate.js";

/* -------------------------------------------------------------------------- */
/*  Shared app-facing types                                                   */
/* -------------------------------------------------------------------------- */

/** Context passed to gateway event handlers (after the event's own args). */
export interface EventContext {
  /** The connected client. */
  readonly client: Client<true>;
  /** Injected services, typed through `ServiceMap`. */
  readonly services: ServiceMap;
  /** A logger tagged with the event name. */
  readonly logger: Logger;
}

/** Context passed to scheduled jobs. */
export interface JobContext {
  /** The connected client. */
  readonly client: Client<true>;
  /** Injected services, typed through `ServiceMap`. */
  readonly services: ServiceMap;
  /** A logger tagged with the job name and this run's correlation id. */
  readonly logger: Logger;
  /** Aborted when the bot is shutting down; long jobs should observe it. */
  readonly signal: AbortSignal;
  /** A unique id for this run; every line logged through `logger` carries it. */
  readonly correlationId: string;
}

/** Middleware runs around every interaction; call `next()` to continue. */
export type MiddlewareFn = (ctx: BaseContext, next: () => Promise<void>) => Promise<void> | void;

/** Lets plugins register hooks without touching the core. */
export interface HookRegistrar {
  /** Runs before every interaction handler; short-circuit by not calling `next`. */
  beforeInteraction(fn: MiddlewareFn): void;
  /** Runs after a successful interaction handler. `info.durationMs` is how long it took. */
  afterInteraction(fn: (ctx: BaseContext, info: { durationMs: number }) => unknown): void;
  /**
   * Runs when anything the framework runs throws: an interaction handler (then
   * `ctx` is set), an event listener, a trigger or a job.
   */
  onError(fn: (error: unknown, ctx?: BaseContext) => unknown): void;
  /** Runs once the client is ready. */
  onReady(fn: (client: Client<true>) => unknown): void;
  /** Runs during graceful shutdown. */
  onShutdown(fn: () => unknown): void;
}

/** The restricted façade handed to plugins in `setup()`. */
export interface PluginApp {
  /** A logger tagged with the plugin name. */
  readonly logger: Logger;
  /** Registers middleware and lifecycle hooks. */
  readonly hooks: HookRegistrar;
  /** The configuration passed to `defineBot()`, read-only. */
  readonly config: Readonly<BotConfig>;
  /** Registers or reads services in the bot's container. */
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
  /** Marks the object as a subcommand. */
  readonly kind: "subcommand";
  /** The description shown under the subcommand in Discord. */
  readonly description: string;
  /** The option schema; `ctx.options` is typed from it. */
  readonly options: M;
  /** Preconditions, run after the parent command's guards. */
  readonly guards: readonly Guard[];
  /** Translated names, by Discord locale. */
  readonly nameLocalizations?: LocalizationMap;
  /** Translated descriptions, by Discord locale. */
  readonly descriptionLocalizations?: LocalizationMap;
  /** Automatic deferral for this subcommand; falls back to the parent command's. */
  readonly defer?: DeferOption;
  /** The handler. */
  // Method signature (not a property) so a precisely-typed subcommand stays
  // assignable to the erased `SubcommandDefinition` stored on a command.
  run(ctx: CommandContext<InferOptions<M>>): unknown | Promise<unknown>;
}

/** A subcommand group (a folder of subcommands). */
export interface SubcommandGroupDefinition {
  /** The description shown under the group in Discord. */
  readonly description: string;
  /** The subcommands of the group, by name. */
  readonly subcommands: Record<string, SubcommandDefinition>;
}

/** Input accepted by {@link subcommand}. */
export interface SubcommandInput<M extends OptionMap> {
  /** The description shown under the subcommand in Discord (1 to 100 characters). */
  description: string;
  /** Typed options, built with `s.*`. `ctx.options` is inferred from them. */
  options?: M;
  /** Preconditions checked before `run`, after the parent command's guards. */
  guards?: Guard[];
  /** Translated names, by Discord locale. */
  nameLocalizations?: LocalizationMap;
  /** Translated descriptions, by Discord locale. */
  descriptionLocalizations?: LocalizationMap;
  /** Acknowledge the interaction for you. Overrides the parent command's setting. */
  defer?: DeferOption;
  /** The handler. `ctx.options` is typed from `options`. */
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
    defer: input.defer,
    run: input.run,
  };
}

/** A registered slash command (flat, with subcommands, or with groups). */
export interface CommandDefinition<M extends OptionMap = OptionMap> {
  /** Marks the object as a slash command for the loader. */
  readonly kind: "command";
  /** The command name, as typed after the slash. */
  readonly name: string;
  /** The description shown in Discord's command picker. */
  readonly description: string;
  /** The option schema; `ctx.options` is typed from it. */
  readonly options: M;
  /** Preconditions checked before the handler. */
  readonly guards: readonly Guard[];
  /** Whether the command is age-restricted. */
  readonly nsfw?: boolean;
  /**
   * Whether the command is available in DMs.
   * @deprecated Discord replaced this with `contexts`.
   */
  readonly dmPermission?: boolean;
  /** Permissions a member needs to see the command by default. */
  readonly defaultMemberPermissions?: PermissionResolvable;
  /** Where the command can be installed: on servers, on user accounts, or both. */
  readonly integrationTypes?: readonly InstallContext[];
  /** Where the command can be used: servers, the bot's DMs, other private channels. */
  readonly contexts?: readonly InteractionContext[];
  /** Translated names, by Discord locale. */
  readonly nameLocalizations?: LocalizationMap;
  /** Translated descriptions, by Discord locale. */
  readonly descriptionLocalizations?: LocalizationMap;
  /** Deploy this command only to these guild ids. Omit for a global command. */
  readonly guilds?: readonly string[];
  /** Subcommands, by name. A command with subcommands has no handler of its own. */
  readonly subcommands?: Record<string, SubcommandDefinition>;
  /** Subcommand groups, by name. */
  readonly groups?: Record<string, SubcommandGroupDefinition>;
  /** Automatic deferral for this command. */
  readonly defer?: DeferOption;
  /** The handler. Absent on a command that only holds subcommands. */
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
  /**
   * Allow use in DMs (global commands only).
   * @deprecated Discord replaced this with `contexts`. Use
   * `contexts: ["guild"]` to keep a command out of DMs.
   */
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
  /**
   * Acknowledge the interaction for you, so a slow handler never hits Discord's
   * 3 second limit. `true` defers only if the handler has not answered after
   * 2 s; see {@link DeferOption} for the other forms. Falls back to
   * `defineBot({ defaults: { defer } })`.
   */
  defer?: DeferOption;
  /** The handler. `ctx.options` is fully typed from `options`. Optional when using subcommands. */
  run?: (ctx: CommandContext<InferOptions<M>>) => unknown | Promise<unknown>;
}

/** Validates every option name in an options map against Discord's rules. */
function validateOptionNames(options: OptionMap | undefined): void {
  for (const name of Object.keys(options ?? {})) assertChatName("option name", name);
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
  assertChatName("command name", input.name);
  validateOptionNames(input.options);
  for (const [subName, sub] of Object.entries(input.subcommands ?? {})) {
    assertChatName("subcommand name", subName);
    validateOptionNames(sub.options);
  }
  for (const [groupName, group] of Object.entries(input.groups ?? {})) {
    assertChatName("group name", groupName);
    for (const [subName, sub] of Object.entries(group.subcommands ?? {})) {
      assertChatName("subcommand name", subName);
      validateOptionNames(sub.options);
    }
  }
  // Lengths, counts and ranges: everything Discord would otherwise reject at
  // deploy time with an opaque "Invalid Form Body".
  assertCommandShape({
    name: input.name,
    description: input.description,
    descriptionLocalizations: input.descriptionLocalizations as Record<string, string | null> | undefined,
    options: input.options ?? {},
    subcommands: input.subcommands as never,
    groups: input.groups as never,
  });
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
    defer: input.defer,
    run: input.run,
  };
}

/* -------------------------------------------------------------------------- */
/*  Context menu commands (user & message)                                    */
/* -------------------------------------------------------------------------- */

/** A registered user context-menu command (right-click a user → Apps). */
export interface UserCommandDefinition {
  /** Marks the object as a user context-menu command for the loader. */
  readonly kind: "userCommand";
  /** The label shown in the Apps menu of a user. */
  readonly name: string;
  /** Preconditions checked before the handler. */
  readonly guards: readonly Guard[];
  /**
   * Whether the command is available in DMs.
   * @deprecated Discord replaced this with `contexts`.
   */
  readonly dmPermission?: boolean;
  /** Permissions a member needs to see the command by default. */
  readonly defaultMemberPermissions?: PermissionResolvable;
  /** Where the command can be installed: on servers, on user accounts, or both. */
  readonly integrationTypes?: readonly InstallContext[];
  /** Where the command can be used: servers, the bot's DMs, other private channels. */
  readonly contexts?: readonly InteractionContext[];
  /** Translated names, by Discord locale. */
  readonly nameLocalizations?: LocalizationMap;
  /** Guild ids the command is deployed to, instead of globally. */
  readonly guilds?: readonly string[];
  /** Automatic deferral for this command. */
  readonly defer?: DeferOption;
  /** The handler. `ctx.targetUser` is the user that was right-clicked. */
  run(ctx: UserCommandContext): unknown | Promise<unknown>;
}

/** A registered message context-menu command (right-click a message → Apps). */
export interface MessageCommandDefinition {
  /** Marks the object as a message context-menu command for the loader. */
  readonly kind: "messageCommand";
  /** The label shown in the Apps menu of a message. */
  readonly name: string;
  /** Preconditions checked before the handler. */
  readonly guards: readonly Guard[];
  /**
   * Whether the command is available in DMs.
   * @deprecated Discord replaced this with `contexts`.
   */
  readonly dmPermission?: boolean;
  /** Permissions a member needs to see the command by default. */
  readonly defaultMemberPermissions?: PermissionResolvable;
  /** Where the command can be installed: on servers, on user accounts, or both. */
  readonly integrationTypes?: readonly InstallContext[];
  /** Where the command can be used: servers, the bot's DMs, other private channels. */
  readonly contexts?: readonly InteractionContext[];
  /** Translated names, by Discord locale. */
  readonly nameLocalizations?: LocalizationMap;
  /** Guild ids the command is deployed to, instead of globally. */
  readonly guilds?: readonly string[];
  /** Automatic deferral for this command. */
  readonly defer?: DeferOption;
  /** The handler. `ctx.targetMessage` is the message that was right-clicked. */
  run(ctx: MessageCommandContext): unknown | Promise<unknown>;
}

/** Shared input fields for context-menu commands. */
interface ContextCommandCommon {
  /** The label shown in the right-click Apps menu (spaces & capitals allowed). */
  name: string;
  /** Preconditions checked before `run`, e.g. `[guildOnly(), hasPermission("KickMembers")]`. */
  guards?: Guard[];
  /**
   * Allow use in DMs (global commands only).
   * @deprecated Discord replaced this with `contexts`. Use
   * `contexts: ["guild"]` to keep a command out of DMs.
   */
  dmPermission?: boolean;
  /** Permissions a member needs to see the command by default, e.g. `"ManageMessages"`. */
  defaultMemberPermissions?: PermissionResolvable;
  /** Where the command can be installed: `["guild"]`, `["user"]`, or both. */
  integrationTypes?: InstallContext[];
  /** Where the command can be used. */
  contexts?: InteractionContext[];
  /** Per-locale translations of the command name. */
  nameLocalizations?: LocalizationMap;
  /** Deploy only to these guild ids. Omit for a global command. */
  guilds?: string[];
  /** Acknowledge the interaction for you. See {@link DeferOption}. */
  defer?: DeferOption;
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
  assertMenuName(input.name);
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
    defer: input.defer,
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
  assertMenuName(input.name);
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
    defer: input.defer,
    run: input.run,
  };
}

/* -------------------------------------------------------------------------- */
/*  Events                                                                    */
/* -------------------------------------------------------------------------- */

/** A registered gateway event listener. */
export interface EventDefinition<E extends keyof ClientEvents = keyof ClientEvents> {
  /** Marks the object as an event listener for the loader. */
  readonly kind: "event";
  /** The discord.js event name, e.g. `"guildMemberAdd"`. */
  readonly event: E;
  /** Whether the listener is removed after its first call. */
  readonly once: boolean;
  /** The listener. Receives the event's own arguments, then the context. */
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
  options: {
    /** Run the listener for the first occurrence only. Default `false`. */
    once?: boolean;
  } = {},
): EventDefinition<E> {
  return { kind: "event", event, once: options.once ?? false, run };
}

/* -------------------------------------------------------------------------- */
/*  Triggers (message auto-responders)                                        */
/* -------------------------------------------------------------------------- */

/** Context passed to a message trigger handler. */
export interface TriggerContext {
  /** The message that matched. */
  readonly message: Message;
  /** The connected client. */
  readonly client: Client<true>;
  /** Who sent the message. */
  readonly author: User;
  /** The author as a guild member; `null` in DMs or when not cached. */
  readonly member: GuildMember | null;
  /** The guild the message was sent in; `null` in DMs. */
  readonly guild: Guild | null;
  /** The channel the message was sent in. */
  readonly channel: Message["channel"];
  /** Injected services, typed through `ServiceMap`. */
  readonly services: ServiceMap;
  /** A logger tagged with the trigger name and this run's correlation id. */
  readonly logger: Logger;
  /** A unique id for this run; every line logged through `logger` carries it. */
  readonly correlationId: string;
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
  /** Marks the object as a message trigger for the loader. */
  readonly kind: "trigger";
  /** A unique name, used in logs. */
  readonly name: string;
  /** What a message must match: a string, a RegExp or a predicate. */
  readonly pattern: TriggerPattern;
  /** How a string pattern is compared with the message content. */
  readonly mode: TriggerMode;
  /** Whether a string pattern ignores case. */
  readonly caseInsensitive: boolean;
  /** Whether messages sent by bots are skipped. */
  readonly ignoreBots: boolean;
  /** Minimum delay between two runs for the same user, e.g. `"10s"`. */
  readonly cooldown?: string | number;
  /** The handler. */
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
  /** The text on the button (up to 80 characters). */
  label?: string;
  /** An emoji shown before the label: a unicode emoji or `<:name:id>`. */
  emoji?: string;
  /** The colour of the button. Default `ButtonStyle.Primary`. */
  style?: ButtonStyle;
  /** Whether the button is greyed out and cannot be clicked. */
  disabled?: boolean;
}

/** A registered button with typed customId params. */
export interface ButtonDefinition<P extends ParamMap = ParamMap> {
  /** Marks the object as a button for the loader. */
  readonly kind: "button";
  /** The routing key, the first part of the customId. */
  readonly id: string;
  /** The schema of the params encoded in the customId. */
  readonly params: P;
  /** Preconditions checked before the handler. */
  readonly guards: readonly Guard[];
  /** Automatic deferral for this button. */
  readonly defer?: DeferOption;
  /** The handler. `ctx.params` is decoded and typed. */
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
  /** Default text used by `build()` when not overridden. */
  label?: string;
  /** Default emoji used by `build()` when not overridden. */
  emoji?: string;
  /**
   * Acknowledge the click for you. `"update"` is usually what a button wants:
   * no loading message, and the handler then edits the message with `ctx.update`.
   */
  defer?: DeferOption;
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
  assertComponentId("button", input.id);
  const params = (input.params ?? {}) as P;
  return {
    kind: "button",
    id: input.id,
    params,
    guards: input.guards ?? [],
    defer: input.defer,
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
  /** Marks the object as a select menu for the loader. */
  readonly kind: "select";
  /** Which of the five kinds of select menu this is. */
  readonly selectType: SelectType;
  /** The routing key, the first part of the customId. */
  readonly id: string;
  /** The schema of the params encoded in the customId. */
  readonly params: P;
  /** Preconditions checked before the handler. */
  readonly guards: readonly Guard[];
  /** Automatic deferral for this menu. */
  readonly defer?: DeferOption;
  /** The handler. `ctx.values` holds what was picked, `ctx.params` the decoded params. */
  run(ctx: SelectMenuContext<InferParams<P>>): unknown | Promise<unknown>;
}

/** Input accepted by every `define*Select` factory. */
export interface SelectMenuInput<P extends ParamMap> {
  /** Stable routing key, e.g. `"settings:language"`. */
  id: string;
  /** Typed params encoded into the customId, built with `p.*`. */
  params?: P;
  /** Preconditions checked before `run`. */
  guards?: Guard[];
  /** Acknowledge the selection for you. See {@link DeferOption}. */
  defer?: DeferOption;
  /** The handler. `ctx.values` holds what was picked, `ctx.params` the decoded params. */
  run: (ctx: SelectMenuContext<InferParams<P>>) => unknown | Promise<unknown>;
}

/** Visual configuration for a built string select menu. */
export interface SelectVisualOptions {
  /** Greyed text shown while nothing is picked (up to 150 characters). */
  placeholder?: string;
  /** Fewest options the user must pick. Default `1`. */
  minValues?: number;
  /** Most options the user may pick. Default `1`. */
  maxValues?: number;
  /** Whether the menu is greyed out and cannot be opened. */
  disabled?: boolean;
  /**
   * The choices offered, 1 to 25: `{ label, value, description?, emoji?, default? }`.
   * `emoji` is a unicode emoji, custom-emoji markup or an `{ id, name }` object.
   */
  options: Array<SelectMenuComponentOptionData | APISelectMenuOption>;
}

/** Visual configuration for a native (user/role/channel/mentionable) select. */
export interface NativeSelectVisualOptions {
  /** Greyed text shown while nothing is picked (up to 150 characters). */
  placeholder?: string;
  /** Fewest entries the user must pick. Default `1`. */
  minValues?: number;
  /** Most entries the user may pick. Default `1`. */
  maxValues?: number;
  /** Whether the menu is greyed out and cannot be opened. */
  disabled?: boolean;
  /** Pre-selected default ids (users, roles, or channels depending on the type). */
  defaultValues?: string[];
  /** Restrict a channel select to these channel types. */
  channelTypes?: ChannelType[];
}

/** A registered string select menu. */
export interface SelectMenuDefinition<P extends ParamMap = ParamMap> extends SelectRoutable<P> {
  /** Builds the discord.js menu. The customId encodes `params`; `visual.options` are the choices. */
  build(params: InferParams<P> | undefined, visual: SelectVisualOptions): StringSelectMenuBuilder;
}
/** A registered user select menu. */
export interface UserSelectDefinition<P extends ParamMap = ParamMap> extends SelectRoutable<P> {
  /** Builds the discord.js user menu. The customId encodes `params`. */
  build(params?: InferParams<P>, visual?: NativeSelectVisualOptions): UserSelectMenuBuilder;
}
/** A registered role select menu. */
export interface RoleSelectDefinition<P extends ParamMap = ParamMap> extends SelectRoutable<P> {
  /** Builds the discord.js role menu. The customId encodes `params`. */
  build(params?: InferParams<P>, visual?: NativeSelectVisualOptions): RoleSelectMenuBuilder;
}
/** A registered channel select menu. */
export interface ChannelSelectDefinition<P extends ParamMap = ParamMap> extends SelectRoutable<P> {
  /** Builds the discord.js channel menu. The customId encodes `params`. */
  build(params?: InferParams<P>, visual?: NativeSelectVisualOptions): ChannelSelectMenuBuilder;
}
/** A registered mentionable (users + roles) select menu. */
export interface MentionableSelectDefinition<P extends ParamMap = ParamMap> extends SelectRoutable<P> {
  /** Builds the discord.js mentionable menu. The customId encodes `params`. */
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
  assertComponentId("select menu", input.id);
  const params = (input.params ?? {}) as P;
  return {
    kind: "select",
    selectType: "string",
    id: input.id,
    params,
    guards: input.guards ?? [],
    defer: input.defer,
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
  assertComponentId("user select", input.id);
  const params = (input.params ?? {}) as P;
  return {
    kind: "select",
    selectType: "user",
    id: input.id,
    params,
    guards: input.guards ?? [],
    defer: input.defer,
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
  assertComponentId("role select", input.id);
  const params = (input.params ?? {}) as P;
  return {
    kind: "select",
    selectType: "role",
    id: input.id,
    params,
    guards: input.guards ?? [],
    defer: input.defer,
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
  assertComponentId("channel select", input.id);
  const params = (input.params ?? {}) as P;
  return {
    kind: "select",
    selectType: "channel",
    id: input.id,
    params,
    guards: input.guards ?? [],
    defer: input.defer,
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
  assertComponentId("mentionable select", input.id);
  const params = (input.params ?? {}) as P;
  return {
    kind: "select",
    selectType: "mentionable",
    id: input.id,
    params,
    guards: input.guards ?? [],
    defer: input.defer,
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
  /** Marks the object as a modal for the loader. */
  readonly kind: "modal";
  /** The routing key, the first part of the customId. */
  readonly id: string;
  /** The title shown at the top of the dialog. */
  readonly title: string;
  /** The components of the dialog; `ctx.fields` is typed from them. */
  readonly fields: F;
  /** The schema of the params encoded in the customId. */
  readonly params: P;
  /** Preconditions checked before the handler. */
  readonly guards: readonly Guard[];
  /** Automatic deferral for the submission. */
  readonly defer?: DeferOption;
  /** The handler, called when the user submits the dialog. */
  run(ctx: ModalContext<InferFields<F>> & { params: InferParams<P> }): unknown | Promise<unknown>;
  /** Builds a discord.js modal from the declared fields. */
  build(params?: InferParams<P>): ModalBuilder;
}

/** Input accepted by {@link defineModal}. */
export interface ModalInput<F extends FieldMap, P extends ParamMap> {
  /** Stable routing key, e.g. `"feedback"`. */
  id: string;
  /** The title shown at the top of the dialog (up to 45 characters). */
  title: string;
  /** Up to 5 components, built with `field.*`. */
  fields: F;
  /** Typed params encoded into the customId, built with `p.*`. */
  params?: P;
  /** Preconditions checked before `run`. */
  guards?: Guard[];
  /** Acknowledge the submission for you. See {@link DeferOption}. */
  defer?: DeferOption;
  /** The handler, called on submit. `ctx.fields` and `ctx.params` are typed. */
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
  assertComponentId("modal", input.id);
  assertModalFields(input.id, input.fields, input.title);
  const params = (input.params ?? {}) as P;
  return {
    kind: "modal",
    id: input.id,
    title: input.title,
    fields: input.fields,
    params,
    guards: input.guards ?? [],
    defer: input.defer,
    run: input.run,
    build(values) {
      return buildModal(
        encodeCustomId(input.id, params, values as Record<string, unknown>),
        input.title,
        input.fields,
      );
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
export function defineService<T, const D extends readonly string[] = readonly string[]>(
  name: string,
  input: {
    /** Tokens of the services this one needs. They are resolved first. */
    deps?: D;
    /**
     * Builds the instance. Receives the resolved dependencies, typed from your
     * {@link ServiceMap} augmentation (`unknown` for tokens you did not declare).
     */
    factory: (deps: { [K in D[number]]: ServiceMap[K] }) => T | Promise<T>;
    /**
     * Called with the instance during graceful shutdown, after the services
     * that depend on it. The place to close a connection pool.
     */
    dispose?: (instance: T) => unknown | Promise<unknown>;
  },
): ServiceDefinition<T> {
  return {
    kind: "service",
    name,
    deps: [...(input.deps ?? [])],
    factory: input.factory as ServiceDefinition<T>["factory"],
    dispose: input.dispose as ServiceDefinition<T>["dispose"],
  };
}

/* -------------------------------------------------------------------------- */
/*  Jobs                                                                      */
/* -------------------------------------------------------------------------- */

/** A scheduled job. */
export interface JobDefinition {
  /** Marks the object as a scheduled job for the loader. */
  readonly kind: "job";
  /** A unique name, used in logs. */
  readonly name: string;
  /** A cron expression (`"0 3 * * *"`) or a duration (`"30s"`, `"1h"`). */
  readonly schedule: string;
  /** IANA timezone for cron evaluation (default local). */
  readonly timezone?: string;
  /** Max overlapping runs. Default `1` (no overlap). */
  readonly concurrency: number;
  /** Run once immediately on boot in addition to the schedule. */
  readonly runOnStart: boolean;
  /** Which shards run the job when the bot is sharded. */
  readonly shard: "all" | "first";
  /** The work to do on each run. */
  readonly run: (ctx: JobContext) => unknown | Promise<unknown>;
}

/** Input accepted by {@link defineJob}. */
export interface JobInput {
  /** A unique name, used in logs. */
  name: string;
  /**
   * When to run: a duration (`"30s"`, `"1h"`), a 5-field cron expression
   * (`"0 3 * * *"`, with names like `MON` or `JAN`) or a macro (`"@hourly"`,
   * `"@daily"`, `"@weekly"`, `"@monthly"`, `"@yearly"`).
   */
  schedule: string;
  /** IANA timezone a cron expression is evaluated in. Default: the server's. */
  timezone?: string;
  /** How many runs may overlap. Default `1`: a run is skipped while one is active. */
  concurrency?: number;
  /** Also run once at startup. Default `false`. */
  runOnStart?: boolean;
  /**
   * Which shards run the job on a sharded bot. `"all"` (default) suits work
   * that walks each shard's own guilds; `"first"` runs it once, on shard 0,
   * for things like a daily announcement.
   */
  shard?: "all" | "first";
  /** The work to do on each run. Observe `ctx.signal` in long jobs. */
  run: (ctx: JobContext) => unknown | Promise<unknown>;
}

/**
 * Defines a scheduled job.
 * @example
 * export default defineJob({ name: "purge", schedule: "0 3 * * *", run: (ctx) => ctx.services.db.purge() });
 */
export function defineJob(input: JobInput): JobDefinition {
  // Fail when the job is defined, not minutes later when the scheduler starts.
  try {
    parseSchedule(input.schedule);
  } catch (cause) {
    throw new BotError("DJSBOT_E080", { detail: `job "${input.name}": "${input.schedule}"`, cause });
  }
  return {
    kind: "job",
    name: input.name,
    schedule: input.schedule,
    timezone: input.timezone,
    concurrency: input.concurrency ?? 1,
    runOnStart: input.runOnStart ?? false,
    shard: input.shard ?? "all",
    run: input.run,
  };
}

/* -------------------------------------------------------------------------- */
/*  Plugins & features                                                        */
/* -------------------------------------------------------------------------- */

/** A cross-cutting plugin. */
export interface PluginDefinition {
  /** Marks the object as a plugin for the loader. */
  readonly kind: "plugin";
  /** A unique name, used in logs and in error messages. */
  readonly name: string;
  /** The plugin's own version, shown by `djs-bot explain`. */
  readonly version?: string;
  /** Capabilities that another plugin or feature must provide. */
  readonly requires: readonly string[];
  /** Capabilities this plugin provides to others. */
  readonly provides: readonly string[];
  /** Capabilities that nothing else may provide while this plugin is loaded. */
  readonly conflicts: readonly string[];
  /** Called once at startup, before the client logs in. */
  readonly setup: (app: PluginApp) => unknown | Promise<unknown>;
  /** Called during graceful shutdown. */
  readonly teardown?: (app: PluginApp) => unknown | Promise<unknown>;
}

/** Input accepted by {@link definePlugin}. */
export interface PluginInput {
  /** A unique name, used in logs and in error messages. */
  name: string;
  /** The plugin's own version, shown by `djs-bot explain`. */
  version?: string;
  /** Capabilities that another plugin or feature must provide; startup fails with E040 otherwise. */
  requires?: string[];
  /** Capabilities this plugin provides, which others can list in `requires`. */
  provides?: string[];
  /** Capabilities that nothing else may provide while this plugin is loaded; startup fails with E041 otherwise. */
  conflicts?: string[];
  /** Called once at startup, before the client logs in. Register hooks and services here. */
  setup: (app: PluginApp) => unknown | Promise<unknown>;
  /** Called during graceful shutdown. Release what `setup` opened. */
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
  /** Marks the object as a feature for the loader. */
  readonly kind: "feature";
  /** A unique name, used in logs and in error messages. */
  readonly name: string;
  /** Service tokens this feature needs the host (or other features) to provide. */
  readonly requires: readonly string[];
  /** Capabilities this feature provides. */
  readonly provides: readonly string[];
  /** Feature-scoped default configuration. */
  readonly config: Readonly<Record<string, unknown>>;
  /** Slash commands of the feature. */
  readonly commands: readonly CommandDefinition[];
  /** User context-menu commands of the feature. */
  readonly userCommands: readonly UserCommandDefinition[];
  /** Message context-menu commands of the feature. */
  readonly messageCommands: readonly MessageCommandDefinition[];
  /** Event listeners of the feature. */
  readonly events: readonly EventDefinition[];
  /** Message triggers of the feature. */
  readonly triggers: readonly TriggerDefinition[];
  /** Buttons of the feature. */
  readonly buttons: readonly ButtonDefinition[];
  /** Select menus of the feature, of any kind. */
  readonly selectMenus: readonly AnySelectDefinition[];
  /** Modals of the feature. */
  readonly modals: readonly ModalDefinition[];
  /** Services of the feature. */
  readonly services: readonly ServiceDefinition[];
  /** Scheduled jobs of the feature. */
  readonly jobs: readonly JobDefinition[];
  /** Plugins of the feature. */
  readonly plugins: readonly PluginDefinition[];
}

/** Input accepted by {@link defineFeature}. */
export interface FeatureInput {
  /** A unique name, used in logs and in error messages. */
  name: string;
  /** Capabilities the host bot (or another feature) must provide; startup fails with E040 otherwise. */
  requires?: string[];
  /** Capabilities this feature provides, which others can list in `requires`. */
  provides?: string[];
  /** Default configuration scoped to the feature. */
  config?: Record<string, unknown>;
  /** Slash commands to register. */
  commands?: CommandDefinition[];
  /** User context-menu commands to register. */
  userCommands?: UserCommandDefinition[];
  /** Message context-menu commands to register. */
  messageCommands?: MessageCommandDefinition[];
  /** Event listeners to register. */
  events?: EventDefinition[];
  /** Message triggers to register. */
  triggers?: TriggerDefinition[];
  /** Buttons to register. */
  buttons?: ButtonDefinition[];
  /** Select menus to register, of any kind. */
  selectMenus?: AnySelectDefinition[];
  /** Modals to register. */
  modals?: ModalDefinition[];
  /** Services to register. */
  services?: ServiceDefinition[];
  /** Scheduled jobs to register. */
  jobs?: JobDefinition[];
  /** Plugins to register. */
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
