export = DJSBot;
declare class DJSBot {
    /**
    * Creates a new bot instance.
    *
    * @param {DJSBotOptions} config Bot configuration.
    * @throws {TypeError} Throws if the provided configuration is invalid.
    *
    * @example
    * const bot = new DJSBot({
    *   token: process.env.DISCORD_TOKEN,
    *   id: process.env.DISCORD_CLIENT_ID,
    *   intents: ["Guilds", "GuildMessages"],
    *   commands_folder: "./commands",
    *   interactions_folder: "./interactions",
    *   events_folder: "./events",
    * });
    *
    * @example
    * const minimalBot = new DJSBot({
    *   token: process.env.DISCORD_TOKEN,
    *   id: process.env.DISCORD_CLIENT_ID,
    *   intents: ["Guilds"],
    *   canMention: {
    *     everyone: false,
    *     users: true,
    *     roles: false,
    *     onReply: false,
    *   },
    * });
    */
    constructor(config: DJSBotOptions);
    /**
     * Discord.js client instance used by the bot.
     * @type {Client}
     */
    client: Client;
    /**
    * Registers a client event listener through the public event bridge.
    *
    * Listeners should be attached before `start()` so they can be bridged to the
    * underlying Discord client when runtime events are initialized.
    *
    * @template {keyof import("discord.js").ClientEvents} E
    * @param {E} event Discord client event name.
    * @param {(...args: import("discord.js").ClientEvents[E]) => (void|Promise<void>)} handler Event handler.
    * @returns {this} The current bot instance.
    *
    * @example
    * bot.on("ready", (client) => {
    *   console.log(`${client.user.tag} connected`);
    * });
    */
    on<E extends keyof import("discord.js").ClientEvents>(event: E, handler: (...args: import("discord.js").ClientEvents[E]) => (void | Promise<void>)): this;
    /**
    * Registers a one-time client event listener through the public event bridge.
    *
    * Listeners should be attached before `start()` so they can be bridged to the
    * underlying Discord client when runtime events are initialized.
    *
    * @template {keyof import("discord.js").ClientEvents} E
    * @param {E} event Discord client event name.
    * @param {(...args: import("discord.js").ClientEvents[E]) => (void|Promise<void>)} handler Event handler.
    * @returns {this} The current bot instance.
    *
    * @example
    * bot.once("ready", (client) => {
    *   console.log(`First ready event for ${client.user.tag}`);
    * });
    */
    once<E extends keyof import("discord.js").ClientEvents>(event: E, handler: (...args: import("discord.js").ClientEvents[E]) => (void | Promise<void>)): this;
    /**
    * Manually registers a command instance.
    *
    * This method is useful when `commands_folder` is not provided or when a
    * command must be registered programmatically instead of being loaded from
    * the filesystem.
    *
    * Registered commands are still included in the REST registration phase
    * performed during `start()`.
    *
    * If another command with the same name already exists in the same registry
    * bucket, it is replaced by the new instance.
    *
    * @param {CommandInstance} command Command instance to register.
    * @returns {this} The current bot instance.
    * @throws {TypeError} Throws if the provided value is not a supported command instance.
    *
    * @example
    * const pingCommand = require("./commands/ping");
    *
    * bot.addCommand(pingCommand);
    */
    addCommand(command: CommandInstance): this;
    /**
    * Manually registers an interaction instance.
    *
    * This method is useful when `interactions_folder` is not provided or when an
    * interaction must be registered programmatically instead of being loaded from
    * the filesystem.
    *
    * Supported interaction categories:
    * - buttons
    * - select menus
    * - modals
    *
    * Wildcard `custom_id` patterns such as `profile:*` are supported through the
    * internal prefix registry used during interaction dispatch.
    *
    * @param {InteractionInstance} interaction Interaction instance to register.
    * @returns {this} The current bot instance.
    * @throws {TypeError} Throws if the provided value is not a valid interaction instance.
    *
    * @example
    * const profileInteraction = require("./interactions/profile");
    *
    * bot.addInteraction(profileInteraction);
    */
    addInteraction(interaction: InteractionInstance): this;
    /**
    * Loads commands, interactions, and events, registers application commands
    * through the REST API, then logs the client in to Discord.
    *
    * Folder-based loading is optional:
    * - if `commands_folder` is provided, command modules are loaded automatically,
    * - if `interactions_folder` is provided, interaction modules are loaded automatically,
    * - if those folders are omitted, only manually registered commands and
    *   interactions are used.
    *
    * Event modules from `events_folder`, when provided, are also loaded before
    * login.
    *
    * @returns {Promise<void>}
    *
    * @example
    * await bot.start();
    *
    * @example
    * const bot = new DJSBot({
    *   token: process.env.DISCORD_TOKEN,
    *   id: process.env.DISCORD_CLIENT_ID,
    *   intents: ["Guilds"],
    * });
    *
    * bot
    *   .addCommand(require("./commands/ping"))
    *   .addInteraction(require("./interactions/profile"))
    *   .on("ready", (client) => {
    *     console.log(`${client.user.tag} connected`);
    *   });
    *
    * await bot.start();
    */
    start(): Promise<void>;
    /**
    * Gracefully stops the bot by destroying the underlying Discord client.
    *
    * @returns {Promise<void>}
    *
    * @example
    * await bot.stop();
    */
    stop(): Promise<void>;
    #private;
}
declare namespace DJSBot {
    export { DJSBotAllowedMentionsOptions, DJSBotOptions, DJSBotConfig, DJSBotFileEvent, SlashCommandInstance, UserContextCommandInstance, MessageContextCommandInstance, InteractionInstance, CommandInstance, DJSBotCommandRegistry, DJSBotInteractionRegistry, DJSBotCommandKeyOptions };
}
import { Client } from "discord.js";
/**
 * Allowed mentions configuration.
 */
type DJSBotAllowedMentionsOptions = {
    /**
     * Whether `@everyone` and `@here` mentions are allowed.
     */
    everyone?: boolean | undefined;
    /**
     * Whether user mentions are allowed.
     */
    users?: boolean | undefined;
    /**
     * Whether role mentions are allowed.
     */
    roles?: boolean | undefined;
    /**
     * Whether replying to a message pings the replied user.
     */
    onReply?: boolean | undefined;
    /**
     * Explicit list of user IDs that may be mentioned.
     */
    usersList?: string[] | undefined;
    /**
     * Explicit list of role IDs that may be mentioned.
     */
    rolesList?: string[] | undefined;
};
/**
 * Bot construction options.
 */
type DJSBotOptions = {
    /**
     * Bot token.
     */
    token: string;
    /**
     * Discord application ID.
     */
    id: string;
    /**
     * Allowed mentions configuration.
     */
    canMention?: DJSBotAllowedMentionsOptions | undefined;
    /**
     * Gateway intents to enable, or `"all"` to enable every available intent.
     */
    intents?: import("discord.js").BitFieldResolvable<"Guilds" | "GuildMembers" | "GuildModeration" | "GuildBans" | "GuildExpressions" | "GuildEmojisAndStickers" | "GuildIntegrations" | "GuildWebhooks" | "GuildInvites" | "GuildVoiceStates" | "GuildPresences" | "GuildMessages" | "GuildMessageReactions" | "GuildMessageTyping" | "DirectMessages" | "DirectMessageReactions" | "DirectMessageTyping" | "MessageContent" | "GuildScheduledEvents" | "AutoModerationConfiguration" | "AutoModerationExecution" | "GuildMessagePolls" | "DirectMessagePolls", number> | "all" | undefined;
    /**
     * Path to the folder that contains runtime event modules.
     */
    events_folder?: string | undefined;
    /**
     * Path to the folder that contains command definition modules.
     */
    commands_folder?: string | undefined;
    /**
     * Path to the folder that contains interaction definition modules.
     */
    interactions_folder?: string | undefined;
};
/**
 * Normalized internal bot configuration.
 */
type DJSBotConfig = {
    /**
     * Bot token.
     */
    token: string;
    /**
     * Discord application ID.
     */
    id: string;
    /**
     * Allowed mentions configuration.
     */
    canMention: DJSBotAllowedMentionsOptions;
    /**
     * Gateway intents configuration.
     */
    intents: "all" | import("discord.js").BitFieldResolvable<keyof typeof IntentsBitField.Flags, number> | undefined;
    /**
     * Events folder path.
     */
    events_folder: string | undefined;
    /**
     * Commands folder path.
     */
    commands_folder: string | undefined;
    /**
     * Interactions folder path.
     */
    interactions_folder: string | undefined;
};
/**
 * Runtime event module shape loaded from the events folder.
 */
type DJSBotFileEvent = {
    /**
     * Discord client event name.
     */
    eventName: string;
    /**
     * Event handler.
     */
    handler: (...args: any[]) => (void | Promise<void>);
};
/**
 * Slash command instance type.
 */
type SlashCommandInstance = InstanceType<typeof builds.SlashCommand>;
/**
 * User context command instance type.
 */
type UserContextCommandInstance = InstanceType<typeof builds.UserContextCommand>;
/**
 * Message context command instance type.
 */
type MessageContextCommandInstance = InstanceType<typeof builds.MessageContextCommand>;
/**
 * Generic interaction instance type.
 */
type InteractionInstance = InstanceType<typeof builds.Interaction>;
/**
 * Supported command instance types.
 */
type CommandInstance = SlashCommandInstance | UserContextCommandInstance | MessageContextCommandInstance;
/**
 * Command registry buckets.
 */
type DJSBotCommandRegistry = {
    /**
     * Registered slash commands.
     */
    slash: Collection<string, SlashCommandInstance>;
    /**
     * Registered user context commands.
     */
    context_user: Collection<string, UserContextCommandInstance>;
    /**
     * Registered message context commands.
     */
    context_message: Collection<string, MessageContextCommandInstance>;
};
/**
 * Interaction registry buckets.
 */
type DJSBotInteractionRegistry = {
    /**
     * Registered button interactions.
     */
    buttons: Collection<string, InteractionInstance>;
    /**
     * Registered select menu interactions.
     */
    selectmenus: Collection<string, InteractionInstance>;
    /**
     * Registered modal interactions.
     */
    modals: Collection<string, InteractionInstance>;
};
/**
 * Helper shape used to build a stable command registry key.
 */
type DJSBotCommandKeyOptions = {
    /**
     * Command scope.
     */
    scope: "global" | "guild";
    /**
     * Guild ID when the scope is `"guild"`.
     */
    guildId?: string | null | undefined;
    /**
     * Application command type.
     */
    type: string | number;
    /**
     * Command name.
     */
    name: string;
};
import { IntentsBitField } from "discord.js";
import builds = require("./builds/$");
import { Collection } from "discord.js";
//# sourceMappingURL=DJSBot.d.ts.map
