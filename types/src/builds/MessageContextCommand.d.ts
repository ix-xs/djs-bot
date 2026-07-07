export = MessageContextCommand;
/**
 * Handler executed when the message context command is triggered.
 *
 * @callback MessageContextCommandHandler
 * @param {import("discord.js").MessageContextMenuCommandInteraction} interaction The received message context menu interaction.
 * @returns {void | Promise<void>}
 */
/**
 * Installation contexts supported by Discord application commands.
 *
 * @typedef {"guild_install" | "user_install"} ApplicationIntegrationType
 */
/**
 * Interaction contexts supported by Discord application commands.
 *
 * @typedef {"guild" | "bot_dm" | "private_channel"} InteractionContextType
 */
/**
 * Message context command data sent to Discord.
 *
 * @typedef {Object} MessageContextCommandData
 * @property {string} name Command name.
 * @property {import("discord.js").LocalizationMap} [name_localizations] Localized command names.
 * @property {import("discord.js").PermissionResolvable} [default_member_permissions] Default member permissions required to use the command.
 * @property {boolean} [nsfw] Whether the command is age-restricted.
 * @property {ApplicationIntegrationType[]} [integration_types] Supported installation contexts.
 * @property {InteractionContextType[]} [contexts] Contexts where the command can be used.
 * @property {3} type Discord application command type for message context commands.
 */
/**
 * Raw options used to create a {@link MessageContextCommand} instance.
 *
 * @typedef {Object} MessageContextCommandOptions
 * @property {string} [guild_id] Guild id used for guild-scoped registration.
 * @property {string} name Command name.
 * @property {import("discord.js").LocalizationMap} [name_localizations] Localized command names.
 * @property {import("discord.js").PermissionResolvable} [default_member_permissions] Default member permissions required to use the command.
 * @property {boolean} [nsfw] Whether the command is age-restricted.
 * @property {ApplicationIntegrationType[]} [integration_types] Supported installation contexts.
 * @property {InteractionContextType[]} [contexts] Contexts where the command can be used.
 * @property {MessageContextCommandHandler} handler Function called when the command is triggered.
 */
/**
 * Lightweight wrapper around a Discord message context menu command definition.
 *
 * This class is designed to work as a plain structured container that can be:
 * - exported from command files,
 * - checked with `instanceof`,
 * - registered by a higher-level bot manager,
 * - executed later through its public `handler`.
 *
 * It intentionally exposes `guild_id`, `command`, `handler`, and `id` as public properties
 * so it integrates cleanly with collection-based command routers.
 *
 * @example
 * module.exports = new MessageContextCommand({
 *   name: "Quote message",
 *   handler: async (interaction) => {
 *     const targetMessage = interaction.targetMessage;
 *
 *     await interaction.reply({
 *       content: `> ${targetMessage.content}`,
 *       ephemeral: true,
 *     });
 *   },
 * });
 */
declare class MessageContextCommand {
    /**
    * Creates a new message context command instance from raw options.
    *
    * @param {MessageContextCommandOptions} options Raw command options.
    * @returns {MessageContextCommand} A new message context command instance.
    *
    * @example
    * const command = MessageContextCommand.from({
    *   name: "Pin message",
    *   handler: async (interaction) => {
    *     await interaction.targetMessage.pin();
    *     await interaction.reply({
    *       content: "Message pinned.",
    *       ephemeral: true,
    *     });
    *   },
    * });
    */
    static from(options: MessageContextCommandOptions): MessageContextCommand;
    /**
    * Creates a new message context command definition.
    *
    * @param {MessageContextCommandOptions} options Command options.
    * @throws {TypeError} Throws if the provided command options are invalid.
    *
    * @example
    * const command = new MessageContextCommand({
    *   name: "Quote message",
    *   contexts: ["guild", "bot_dm"],
    *   integration_types: ["guild_install"],
    *   handler: async (interaction) => {
    *     const targetMessage = interaction.targetMessage;
    *
    *     await interaction.reply({
    *       content: `> ${targetMessage.content}`,
    *       ephemeral: true,
    *     });
    *   },
    * });
    */
    constructor(options: MessageContextCommandOptions);
    /**
     * Guild id used for guild-scoped registration.
     *
     * If omitted, the command is registered globally.
     *
     * @type {string|undefined}
     */
    guild_id: string | undefined;
    /**
     * Discord command id assigned after registration.
     *
     * @type {string|undefined}
     */
    id: string | undefined;
    /**
     * Command payload sent to Discord during registration.
     *
     * @type {MessageContextCommandData}
     */
    command: MessageContextCommandData;
    /**
     * Handler called when the command is executed.
     *
     * @type {MessageContextCommandHandler}
     */
    handler: MessageContextCommandHandler;
    /**
    * Returns whether the command is guild-scoped.
    *
    * @returns {boolean} `true` if the command targets a specific guild, otherwise `false`.
    *
    * @example
    * const command = new MessageContextCommand({
    *   guild_id: "123456789012345678",
    *   name: "Quote message",
    *   handler: async () => {},
    * });
    *
    * console.log(command.isGuildOnly()); // true
    */
    isGuildOnly(): boolean;
    /**
     * Returns the command name.
     *
     * @returns {string} The command name.
     */
    getName(): string;
    /**
    * Returns the command payload used for Discord registration.
    *
    * @returns {MessageContextCommandData} The raw command payload.
    *
    * @example
    * const payload = command.toJSON();
    *
    * console.log(payload);
    * // {
    * //   name: "Quote message",
    * //   type: 3,
    * //   contexts: ["guild"],
    * //   integration_types: ["guild_install"]
    * // }
    */
    toJSON(): MessageContextCommandData;
}
declare namespace MessageContextCommand {
    export { MessageContextCommandHandler, ApplicationIntegrationType, InteractionContextType, MessageContextCommandData, MessageContextCommandOptions };
}
/**
 * Handler executed when the message context command is triggered.
 */
type MessageContextCommandHandler = (interaction: import("discord.js").MessageContextMenuCommandInteraction) => void | Promise<void>;
/**
 * Installation contexts supported by Discord application commands.
 */
type ApplicationIntegrationType = "guild_install" | "user_install";
/**
 * Interaction contexts supported by Discord application commands.
 */
type InteractionContextType = "guild" | "bot_dm" | "private_channel";
/**
 * Message context command data sent to Discord.
 */
type MessageContextCommandData = {
    /**
     * Command name.
     */
    name: string;
    /**
     * Localized command names.
     */
    name_localizations?: Partial<Record<import("discord.js").Locale, string | null>> | undefined;
    /**
     * Default member permissions required to use the command.
     */
    default_member_permissions?: import("discord.js").PermissionResolvable | undefined;
    /**
     * Whether the command is age-restricted.
     */
    nsfw?: boolean | undefined;
    /**
     * Supported installation contexts.
     */
    integration_types?: ApplicationIntegrationType[] | undefined;
    /**
     * Contexts where the command can be used.
     */
    contexts?: InteractionContextType[] | undefined;
    /**
     * Discord application command type for message context commands.
     */
    type: 3;
};
/**
 * Raw options used to create a {@link MessageContextCommand} instance.
 */
type MessageContextCommandOptions = {
    /**
     * Guild id used for guild-scoped registration.
     */
    guild_id?: string | undefined;
    /**
     * Command name.
     */
    name: string;
    /**
     * Localized command names.
     */
    name_localizations?: Partial<Record<import("discord.js").Locale, string | null>> | undefined;
    /**
     * Default member permissions required to use the command.
     */
    default_member_permissions?: import("discord.js").PermissionResolvable | undefined;
    /**
     * Whether the command is age-restricted.
     */
    nsfw?: boolean | undefined;
    /**
     * Supported installation contexts.
     */
    integration_types?: ApplicationIntegrationType[] | undefined;
    /**
     * Contexts where the command can be used.
     */
    contexts?: InteractionContextType[] | undefined;
    /**
     * Function called when the command is triggered.
     */
    handler: MessageContextCommandHandler;
};
//# sourceMappingURL=MessageContextCommand.d.ts.map