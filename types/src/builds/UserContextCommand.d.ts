export = UserContextCommand;
declare class UserContextCommand {
    /**
    * Creates a new user context command instance from raw options.
    *
    * @param {UserContextCommandOptions} options Raw command options.
    * @returns {UserContextCommand} A new user context command instance.
    *
    * @example
    * const command = UserContextCommand.from({
    *   name: "User Info",
    *   handler: async (interaction) => {
    *     await interaction.reply({
    *       content: `Selected user: ${interaction.targetUser.tag}`,
    *       ephemeral: true,
    *     });
    *   },
    * });
    */
    static from(options: UserContextCommandOptions): UserContextCommand;
    /**
    * Creates a new user context command definition.
    *
    * @param {UserContextCommandOptions} options Command options.
    * @throws {TypeError} Throws if the provided command definition is invalid.
    *
    * @example
    * const command = new UserContextCommand({
    *   name: "Avatar",
    *   integration_types: ["guild_install", "user_install"],
    *   contexts: ["guild", "bot_dm", "private_channel"],
    *   handler: async (interaction) => {
    *     const user = interaction.targetUser;
    *
    *     await interaction.reply({
    *       content: user.displayAvatarURL({ size: 1024 }),
    *       ephemeral: true,
    *     });
    *   },
    * });
    */
    constructor(options: UserContextCommandOptions);
    /**
     * Guild id used for guild-scoped registration.
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
     * @type {UserContextCommandData}
     */
    command: UserContextCommandData;
    /**
     * Handler called when the user context command is executed.
     *
     * @type {UserContextCommandHandler}
     */
    handler: UserContextCommandHandler;
    /**
    * Returns whether the command is guild-scoped.
    *
    * @returns {boolean} `true` if the command targets a specific guild, otherwise `false`.
    *
    * @example
    * const command = new UserContextCommand({
    *   guild_id: "123456789012345678",
    *   name: "Avatar",
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
    * Returns the raw command payload used for Discord registration.
    *
    * @returns {UserContextCommandData} The command payload.
    *
    * @example
    * const payload = command.toJSON();
    *
    * console.log(payload);
    * // {
    * //   type: 2,
    * //   name: "Avatar",
    * //   integration_types: [0, 1],
    * //   contexts: [0, 1, 2],
    * //   nsfw: false
    * // }
    */
    toJSON(): UserContextCommandData;
}
declare namespace UserContextCommand {
    export { ContextCommandIntegrationType, ContextCommandContext, UserContextCommandHandler, UserContextCommandData, UserContextCommandOptions };
}
/**
 * Supported installation targets for an application command.
 */
type ContextCommandIntegrationType = "guild_install" | "user_install";
/**
 * Supported interaction contexts for an application command.
 *
 * Note: `private_channel` only makes sense when `user_install`
 * is also enabled for the command.
 */
type ContextCommandContext = "guild" | "bot_dm" | "private_channel";
/**
 * Handler executed when the user context command is triggered.
 */
type UserContextCommandHandler = (interaction: import("discord.js").UserContextMenuCommandInteraction) => void | Promise<void>;
/**
 * Raw command payload sent to Discord.
 */
type UserContextCommandData = {
    /**
     * Command type for user context menu commands.
     */
    type: 2;
    /**
     * Command name.
     */
    name: string;
    /**
     * Localized command names.
     */
    name_localizations?: Partial<Record<import("discord.js").Locale, string | null>> | undefined;
    /**
     * Permission bitset as a string.
     */
    default_member_permissions?: string | undefined;
    /**
     * Whether the command is age-restricted.
     */
    nsfw: boolean;
    /**
     * Supported installation targets.
     */
    integration_types?: number[] | undefined;
    /**
     * Supported interaction contexts.
     */
    contexts?: number[] | undefined;
};
/**
 * Raw options used to create a {@link UserContextCommand} instance.
 */
type UserContextCommandOptions = {
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
     * Supported installation targets.
     */
    integration_types?: ContextCommandIntegrationType[] | undefined;
    /**
     * Supported interaction contexts.
     */
    contexts?: ContextCommandContext[] | undefined;
    /**
     * Function called when the command is triggered.
     */
    handler: UserContextCommandHandler;
};
//# sourceMappingURL=UserContextCommand.d.ts.map