export = SlashCommand;
/**
 * Lightweight wrapper around a Discord slash command definition.
 *
 * This class is intended to work as a plain structured container that can be:
 * - loaded from files,
 * - checked with `instanceof`,
 * - registered by a higher-level bot manager,
 * - executed later through public handlers.
 *
 * Public properties are intentionally exposed so classes such as `DJSBot`
 * can directly access `guild_id`, `id`, `command`, `handler`, and `autocomplete`.
 *
 * @example
 * const SlashCommand = require("./SlashCommand");
 *
 * module.exports = new SlashCommand({
 *   name: "ping",
 *   description: "Replies with pong.",
 *   handler: async (interaction) => {
 *     await interaction.reply("Pong!");
 *   },
 * });
 */
declare class SlashCommand {
    /**
    * Creates a new slash command instance from raw options.
    * @param {SlashCommandOptions} command Raw slash command options.
    * @returns {SlashCommand} A new slash command instance.
    *
    * @example
    * const command = SlashCommand.from({
    *   name: "ping",
    *   description: "Replies with pong.",
    *   handler: async (interaction) => {
    *     await interaction.reply("Pong!");
    *   },
    * });
    */
    static from(command: SlashCommandOptions): SlashCommand;
    /**
    * Creates a new slash command definition.
    * @param {SlashCommandOptions} command Slash command options.
    * @throws {TypeError} Throws if the provided command definition is invalid.
    *
    * @example
    * const command = new SlashCommand({
    *   name: "ban",
    *   description: "Ban a member from the server.",
    *   options: [
    *     SlashCommand.UserOption({
    *       name: "user",
    *       description: "Member to ban",
    *       required: true,
    *     }),
    *     SlashCommand.StringOption({
    *       name: "reason",
    *       description: "Reason for the ban",
    *       required: false,
    *       max_length: 200,
    *     }),
    *   ],
    *   handler: async (interaction) => {
    *     const user = interaction.options.getUser("user", true);
    *     const reason = interaction.options.getString("reason") ?? "No reason provided";
    *
    *     await interaction.reply(`Would ban ${user.tag} for: ${reason}`);
    *   },
    * });
    */
    constructor(command: SlashCommandOptions);
    /**
     * Guild id used for guild-scoped registration.
     * If omitted, the command is registered globally.
     * @type {string|undefined}
     */
    guild_id: string | undefined;
    /**
     * Discord command id assigned after registration.
     * @type {string|undefined}
     */
    id: string | undefined;
    /**
     * Command payload sent to Discord during registration.
     * @type {SlashCommandData}
     */
    command: SlashCommandData;
    /**
     * Handler called when the slash command is executed.
     * @type {SlashCommandHandler}
     */
    handler: SlashCommandHandler;
    /**
     * Optional handler called for autocomplete interactions.
     * @type {SlashCommandAutocompleteHandler|undefined}
     */
    autocomplete: SlashCommandAutocompleteHandler | undefined;
    /**
     * Returns whether the command is guild-scoped.
     * @returns {boolean} `true` if the command targets a specific guild, otherwise `false`.
     */
    isGuildOnly(): boolean;
    /**
     * Returns the command name.
     * @returns {string} The command name.
     */
    getName(): string;
    /**
    * Returns whether the command has autocomplete support.
    * @returns {boolean} `true` if an autocomplete handler exists, otherwise `false`.
    *
    * @example
    * const command = new SlashCommand({
    *   name: "search",
    *   description: "Search for a language.",
    *   options: [
    *     SlashCommand.StringOption({
    *       name: "query",
    *       description: "Search term",
    *       autocomplete: true,
    *       required: true,
    *     }),
    *   ],
    *   autocomplete: async (interaction) => {
    *     const focused = interaction.options.getFocused();
    *     await interaction.respond(
    *       ["JavaScript", "TypeScript", "Rust"]
    *         .filter((value) => value.toLowerCase().includes(focused.toLowerCase()))
    *         .map((value) => ({ name: value, value })),
    *     );
    *   },
    *   handler: async (interaction) => {
    *     await interaction.reply("Recherche envoyée.");
    *   },
    * });
    *
    * console.log(command.hasAutocomplete()); // true
    */
    hasAutocomplete(): boolean;
    /**
    * Returns the raw command payload used for Discord registration.
    * @returns {SlashCommandData} The command payload.
    *
    * @example
    * const payload = command.toJSON();
    *
    * console.log(payload.name); // "ban"
    * console.log(payload.type); // 1
    */
    toJSON(): SlashCommandData;
}
declare namespace SlashCommand {
    export { createAttachmentOption as AttachmentOption, createBooleanOption as BooleanOption, createChannelOption as ChannelOption, createIntegerOption as IntegerOption, createMentionableOption as MentionableOption, createNumberOption as NumberOption, createRoleOption as RoleOption, createStringOption as StringOption, createSubCommandOption as SubCommandOption, createSubCommandGroupOption as SubCommandGroupOption, createUserOption as UserOption, CommandIntegrationType, CommandContext, SlashCommandAutocompleteHandler, SlashCommandHandler, ChannelTypeName, SlashCommandAttachmentOption, SlashCommandBooleanOption, SlashCommandChannelOption, SlashCommandIntegerChoice, SlashCommandIntegerOption, SlashCommandMentionableOption, SlashCommandNumberChoice, SlashCommandNumberOption, SlashCommandRoleOption, SlashCommandStringChoice, SlashCommandStringOption, SlashCommandUserOption, SlashCommandLeafOption, SlashCommandSubCommandOption, SlashCommandSubCommandGroupOption, SlashCommandOption, SlashCommandData, SlashCommandOptions };
}
/**
 * Supported installation targets for an application command.
 * @typedef {"guild_install" | "user_install"} CommandIntegrationType
 */
/**
 * Supported interaction contexts for an application command.
 * @typedef {"guild" | "bot_dm" | "private_channel"} CommandContext
 */
/**
 * Slash command autocomplete handler.
 * @callback SlashCommandAutocompleteHandler
 * @param {import("discord.js").AutocompleteInteraction} interaction The received autocomplete interaction.
 * @returns {void | Promise<void>}
 */
/**
 * Slash command execution handler.
 * @callback SlashCommandHandler
 * @param {import("discord.js").ChatInputCommandInteraction} interaction The received slash command interaction.
 * @returns {void | Promise<void>}
 */
/**
 * Supported channel type names that can be mapped to discord.js `ChannelType`.
 * @typedef {"GuildText"|"DM"|"GuildVoice"|"GroupDM"|"GuildCategory"|"GuildAnnouncement"|"AnnouncementThread"|"PublicThread"|"PrivateThread"|"GuildStageVoice"|"GuildDirectory"|"GuildForum"|"GuildMedia"} ChannelTypeName
 */
/**
 * @typedef {Object} SlashCommandAttachmentOption
 * @property {11} type
 * @property {string} name
 * @property {string} description
 * @property {boolean} [required]
 * @property {import("discord.js").LocalizationMap} [name_localizations]
 * @property {import("discord.js").LocalizationMap} [description_localizations]
 */
/**
 * @typedef {Object} SlashCommandBooleanOption
 * @property {5} type
 * @property {string} name
 * @property {string} description
 * @property {boolean} [required]
 * @property {import("discord.js").LocalizationMap} [name_localizations]
 * @property {import("discord.js").LocalizationMap} [description_localizations]
 */
/**
 * @typedef {Object} SlashCommandChannelOption
 * @property {7} type
 * @property {string} name
 * @property {string} description
 * @property {boolean} [required]
 * @property {number[]} [channel_types]
 * @property {import("discord.js").LocalizationMap} [name_localizations]
 * @property {import("discord.js").LocalizationMap} [description_localizations]
 */
/**
 * @typedef {Object} SlashCommandIntegerChoice
 * @property {string} name
 * @property {number} value
 * @property {import("discord.js").LocalizationMap} [name_localizations]
 */
/**
 * @typedef {Object} SlashCommandIntegerOption
 * @property {4} type
 * @property {string} name
 * @property {string} description
 * @property {boolean} [required]
 * @property {boolean} [autocomplete]
 * @property {SlashCommandIntegerChoice[]} [choices]
 * @property {number} [min_value]
 * @property {number} [max_value]
 * @property {import("discord.js").LocalizationMap} [name_localizations]
 * @property {import("discord.js").LocalizationMap} [description_localizations]
 */
/**
 * @typedef {Object} SlashCommandMentionableOption
 * @property {9} type
 * @property {string} name
 * @property {string} description
 * @property {boolean} [required]
 * @property {import("discord.js").LocalizationMap} [name_localizations]
 * @property {import("discord.js").LocalizationMap} [description_localizations]
 */
/**
 * @typedef {Object} SlashCommandNumberChoice
 * @property {string} name
 * @property {number} value
 * @property {import("discord.js").LocalizationMap} [name_localizations]
 */
/**
 * @typedef {Object} SlashCommandNumberOption
 * @property {10} type
 * @property {string} name
 * @property {string} description
 * @property {boolean} [required]
 * @property {boolean} [autocomplete]
 * @property {SlashCommandNumberChoice[]} [choices]
 * @property {number} [min_value]
 * @property {number} [max_value]
 * @property {import("discord.js").LocalizationMap} [name_localizations]
 * @property {import("discord.js").LocalizationMap} [description_localizations]
 */
/**
 * @typedef {Object} SlashCommandRoleOption
 * @property {8} type
 * @property {string} name
 * @property {string} description
 * @property {boolean} [required]
 * @property {import("discord.js").LocalizationMap} [name_localizations]
 * @property {import("discord.js").LocalizationMap} [description_localizations]
 */
/**
 * @typedef {Object} SlashCommandStringChoice
 * @property {string} name
 * @property {string} value
 * @property {import("discord.js").LocalizationMap} [name_localizations]
 */
/**
 * @typedef {Object} SlashCommandStringOption
 * @property {3} type
 * @property {string} name
 * @property {string} description
 * @property {boolean} [required]
 * @property {boolean} [autocomplete]
 * @property {SlashCommandStringChoice[]} [choices]
 * @property {number} [min_length]
 * @property {number} [max_length]
 * @property {import("discord.js").LocalizationMap} [name_localizations]
 * @property {import("discord.js").LocalizationMap} [description_localizations]
 */
/**
 * @typedef {Object} SlashCommandUserOption
 * @property {6} type
 * @property {string} name
 * @property {string} description
 * @property {boolean} [required]
 * @property {import("discord.js").LocalizationMap} [name_localizations]
 * @property {import("discord.js").LocalizationMap} [description_localizations]
 */
/**
 * Any non-subcommand slash command option.
 * @typedef {SlashCommandAttachmentOption | SlashCommandBooleanOption | SlashCommandChannelOption | SlashCommandIntegerOption | SlashCommandMentionableOption | SlashCommandNumberOption | SlashCommandRoleOption | SlashCommandStringOption | SlashCommandUserOption} SlashCommandLeafOption
 */
/**
 * @typedef {Object} SlashCommandSubCommandOption
 * @property {1} type
 * @property {string} name
 * @property {string} description
 * @property {import("discord.js").LocalizationMap} [name_localizations]
 * @property {import("discord.js").LocalizationMap} [description_localizations]
 * @property {SlashCommandLeafOption[]} [options]
 */
/**
 * @typedef {Object} SlashCommandSubCommandGroupOption
 * @property {2} type
 * @property {string} name
 * @property {string} description
 * @property {import("discord.js").LocalizationMap} [name_localizations]
 * @property {import("discord.js").LocalizationMap} [description_localizations]
 * @property {SlashCommandSubCommandOption[]} [options]
 */
/**
 * Any slash command option supported by this wrapper.
 * @typedef {SlashCommandLeafOption | SlashCommandSubCommandOption | SlashCommandSubCommandGroupOption} SlashCommandOption
 */
/**
 * Raw command payload sent to Discord.
 * @typedef {Object} SlashCommandData
 * @property {1} type Command type for chat input commands.
 * @property {string} name Command name.
 * @property {string} description Command description.
 * @property {number[]} contexts Interaction contexts.
 * @property {number[]} integration_types Installation contexts.
 * @property {string} [default_member_permissions] Permission bitset as a string.
 * @property {import("discord.js").LocalizationMap} [name_localizations] Localized command names.
 * @property {import("discord.js").LocalizationMap} [description_localizations] Localized command descriptions.
 * @property {SlashCommandOption[]} [options] Command options.
 * @property {boolean} nsfw Whether the command is age-restricted.
 */
/**
 * Raw options used to create a {@link SlashCommand} instance.
 * @typedef {Object} SlashCommandOptions
 * @property {string} name Command name, max 32 characters.
 * @property {string} description Command description, max 100 characters.
 * @property {string} [guild_id] Guild id used for guild-scoped registration.
 * @property {CommandIntegrationType[]} [integration_types] Supported installation targets.
 * @property {CommandContext[]} [contexts] Contexts where the command can be used.
 * @property {import("discord.js").PermissionResolvable} [default_member_permissions] Default member permissions required to use the command.
 * @property {import("discord.js").LocalizationMap} [name_localizations] Localized command names.
 * @property {import("discord.js").LocalizationMap} [description_localizations] Localized command descriptions.
 * @property {SlashCommandOption[]} [options] Command options.
 * @property {boolean} [nsfw=false] Whether the command is age-restricted.
 * @property {SlashCommandAutocompleteHandler} [autocomplete] Optional autocomplete handler.
 * @property {SlashCommandHandler} handler Slash command execution handler.
 */
/**
 * Creates an attachment option.
 * @param {Omit<SlashCommandAttachmentOption, "type">} options Attachment option data.
 * @returns {SlashCommandAttachmentOption}
 */
declare function createAttachmentOption(options: Omit<SlashCommandAttachmentOption, "type">): SlashCommandAttachmentOption;
/**
 * Creates a boolean option.
 * @param {Omit<SlashCommandBooleanOption, "type">} options Boolean option data.
 * @returns {SlashCommandBooleanOption}
 */
declare function createBooleanOption(options: Omit<SlashCommandBooleanOption, "type">): SlashCommandBooleanOption;
/**
 * Creates a channel option.
 * @param {Omit<SlashCommandChannelOption, "type" | "channel_types"> & { channel_types?: ChannelTypeName[] | number[] }} options Channel option data.
 * @returns {SlashCommandChannelOption}
 *
 * @example
 * const option = SlashCommand.ChannelOption({
 *   name: "channel",
 *   description: "Target channel",
 *   required: true,
 *   channel_types: ["GuildText", "GuildAnnouncement"],
 * });
 */
declare function createChannelOption(options: Omit<SlashCommandChannelOption, "type" | "channel_types"> & {
    channel_types?: ChannelTypeName[] | number[];
}): SlashCommandChannelOption;
/**
 * Creates an integer option.
 * @param {Omit<SlashCommandIntegerOption, "type">} option Integer option data.
 * @returns {SlashCommandIntegerOption}
 */
declare function createIntegerOption(option: Omit<SlashCommandIntegerOption, "type">): SlashCommandIntegerOption;
/**
 * Creates a mentionable option.
 * @param {Omit<SlashCommandMentionableOption, "type">} option Mentionable option data.
 * @returns {SlashCommandMentionableOption}
 */
declare function createMentionableOption(option: Omit<SlashCommandMentionableOption, "type">): SlashCommandMentionableOption;
/**
 * Creates a number option.
 * @param {Omit<SlashCommandNumberOption, "type">} option Number option data.
 * @returns {SlashCommandNumberOption}
 */
declare function createNumberOption(option: Omit<SlashCommandNumberOption, "type">): SlashCommandNumberOption;
/**
 * Creates a role option.
 * @param {Omit<SlashCommandRoleOption, "type">} option Role option data.
 * @returns {SlashCommandRoleOption}
 */
declare function createRoleOption(option: Omit<SlashCommandRoleOption, "type">): SlashCommandRoleOption;
/**
 * Creates a string option.
 * @param {Omit<SlashCommandStringOption, "type">} option String option data.
 * @returns {SlashCommandStringOption}
 *
 * @example
 * const option = SlashCommand.StringOption({
 *   name: "query",
 *   description: "Search term",
 *   required: true,
 *   min_length: 2,
 *   max_length: 50,
 * });
 */
declare function createStringOption(option: Omit<SlashCommandStringOption, "type">): SlashCommandStringOption;
/**
 * Creates a subcommand option.
 * @param {Omit<SlashCommandSubCommandOption, "type">} option Subcommand option data.
 * @returns {SlashCommandSubCommandOption}
 *
 * @example
 * const option = SlashCommand.SubCommandOption({
 *   name: "add",
 *   description: "Add a tag",
 *   options: [
 *     SlashCommand.StringOption({
 *       name: "name",
 *       description: "Tag name",
 *       required: true,
 *     }),
 *   ],
 * });
 */
declare function createSubCommandOption(option: Omit<SlashCommandSubCommandOption, "type">): SlashCommandSubCommandOption;
/**
 * Creates a subcommand group option.
 * @param {Omit<SlashCommandSubCommandGroupOption, "type">} option Subcommand group option data.
 * @returns {SlashCommandSubCommandGroupOption}
 *
 * @example
 * const option = SlashCommand.SubCommandGroupOption({
 *   name: "admin",
 *   description: "Administrative tag commands",
 *   options: [
 *     SlashCommand.SubCommandOption({
 *       name: "create",
 *       description: "Create a tag",
 *       options: [
 *         SlashCommand.StringOption({
 *           name: "name",
 *           description: "Tag name",
 *           required: true,
 *         }),
 *       ],
 *     }),
 *   ],
 * });
 */
declare function createSubCommandGroupOption(option: Omit<SlashCommandSubCommandGroupOption, "type">): SlashCommandSubCommandGroupOption;
/**
 * Creates a user option.
 * @param {Omit<SlashCommandUserOption, "type">} option User option data.
 * @returns {SlashCommandUserOption}
 */
declare function createUserOption(option: Omit<SlashCommandUserOption, "type">): SlashCommandUserOption;
/**
 * Supported installation targets for an application command.
 */
type CommandIntegrationType = "guild_install" | "user_install";
/**
 * Supported interaction contexts for an application command.
 */
type CommandContext = "guild" | "bot_dm" | "private_channel";
/**
 * Slash command autocomplete handler.
 */
type SlashCommandAutocompleteHandler = (interaction: import("discord.js").AutocompleteInteraction) => void | Promise<void>;
/**
 * Slash command execution handler.
 */
type SlashCommandHandler = (interaction: import("discord.js").ChatInputCommandInteraction) => void | Promise<void>;
/**
 * Supported channel type names that can be mapped to discord.js `ChannelType`.
 */
type ChannelTypeName = "GuildText" | "DM" | "GuildVoice" | "GroupDM" | "GuildCategory" | "GuildAnnouncement" | "AnnouncementThread" | "PublicThread" | "PrivateThread" | "GuildStageVoice" | "GuildDirectory" | "GuildForum" | "GuildMedia";
type SlashCommandAttachmentOption = {
    type: 11;
    name: string;
    description: string;
    required?: boolean | undefined;
    name_localizations?: Partial<Record<import("discord.js").Locale, string | null>> | undefined;
    description_localizations?: Partial<Record<import("discord.js").Locale, string | null>> | undefined;
};
type SlashCommandBooleanOption = {
    type: 5;
    name: string;
    description: string;
    required?: boolean | undefined;
    name_localizations?: Partial<Record<import("discord.js").Locale, string | null>> | undefined;
    description_localizations?: Partial<Record<import("discord.js").Locale, string | null>> | undefined;
};
type SlashCommandChannelOption = {
    type: 7;
    name: string;
    description: string;
    required?: boolean | undefined;
    channel_types?: number[] | undefined;
    name_localizations?: Partial<Record<import("discord.js").Locale, string | null>> | undefined;
    description_localizations?: Partial<Record<import("discord.js").Locale, string | null>> | undefined;
};
type SlashCommandIntegerChoice = {
    name: string;
    value: number;
    name_localizations?: Partial<Record<import("discord.js").Locale, string | null>> | undefined;
};
type SlashCommandIntegerOption = {
    type: 4;
    name: string;
    description: string;
    required?: boolean | undefined;
    autocomplete?: boolean | undefined;
    choices?: SlashCommandIntegerChoice[] | undefined;
    min_value?: number | undefined;
    max_value?: number | undefined;
    name_localizations?: Partial<Record<import("discord.js").Locale, string | null>> | undefined;
    description_localizations?: Partial<Record<import("discord.js").Locale, string | null>> | undefined;
};
type SlashCommandMentionableOption = {
    type: 9;
    name: string;
    description: string;
    required?: boolean | undefined;
    name_localizations?: Partial<Record<import("discord.js").Locale, string | null>> | undefined;
    description_localizations?: Partial<Record<import("discord.js").Locale, string | null>> | undefined;
};
type SlashCommandNumberChoice = {
    name: string;
    value: number;
    name_localizations?: Partial<Record<import("discord.js").Locale, string | null>> | undefined;
};
type SlashCommandNumberOption = {
    type: 10;
    name: string;
    description: string;
    required?: boolean | undefined;
    autocomplete?: boolean | undefined;
    choices?: SlashCommandNumberChoice[] | undefined;
    min_value?: number | undefined;
    max_value?: number | undefined;
    name_localizations?: Partial<Record<import("discord.js").Locale, string | null>> | undefined;
    description_localizations?: Partial<Record<import("discord.js").Locale, string | null>> | undefined;
};
type SlashCommandRoleOption = {
    type: 8;
    name: string;
    description: string;
    required?: boolean | undefined;
    name_localizations?: Partial<Record<import("discord.js").Locale, string | null>> | undefined;
    description_localizations?: Partial<Record<import("discord.js").Locale, string | null>> | undefined;
};
type SlashCommandStringChoice = {
    name: string;
    value: string;
    name_localizations?: Partial<Record<import("discord.js").Locale, string | null>> | undefined;
};
type SlashCommandStringOption = {
    type: 3;
    name: string;
    description: string;
    required?: boolean | undefined;
    autocomplete?: boolean | undefined;
    choices?: SlashCommandStringChoice[] | undefined;
    min_length?: number | undefined;
    max_length?: number | undefined;
    name_localizations?: Partial<Record<import("discord.js").Locale, string | null>> | undefined;
    description_localizations?: Partial<Record<import("discord.js").Locale, string | null>> | undefined;
};
type SlashCommandUserOption = {
    type: 6;
    name: string;
    description: string;
    required?: boolean | undefined;
    name_localizations?: Partial<Record<import("discord.js").Locale, string | null>> | undefined;
    description_localizations?: Partial<Record<import("discord.js").Locale, string | null>> | undefined;
};
/**
 * Any non-subcommand slash command option.
 */
type SlashCommandLeafOption = SlashCommandAttachmentOption | SlashCommandBooleanOption | SlashCommandChannelOption | SlashCommandIntegerOption | SlashCommandMentionableOption | SlashCommandNumberOption | SlashCommandRoleOption | SlashCommandStringOption | SlashCommandUserOption;
type SlashCommandSubCommandOption = {
    type: 1;
    name: string;
    description: string;
    name_localizations?: Partial<Record<import("discord.js").Locale, string | null>> | undefined;
    description_localizations?: Partial<Record<import("discord.js").Locale, string | null>> | undefined;
    options?: SlashCommandLeafOption[] | undefined;
};
type SlashCommandSubCommandGroupOption = {
    type: 2;
    name: string;
    description: string;
    name_localizations?: Partial<Record<import("discord.js").Locale, string | null>> | undefined;
    description_localizations?: Partial<Record<import("discord.js").Locale, string | null>> | undefined;
    options?: SlashCommandSubCommandOption[] | undefined;
};
/**
 * Any slash command option supported by this wrapper.
 */
type SlashCommandOption = SlashCommandLeafOption | SlashCommandSubCommandOption | SlashCommandSubCommandGroupOption;
/**
 * Raw command payload sent to Discord.
 */
type SlashCommandData = {
    /**
     * Command type for chat input commands.
     */
    type: 1;
    /**
     * Command name.
     */
    name: string;
    /**
     * Command description.
     */
    description: string;
    /**
     * Interaction contexts.
     */
    contexts: number[];
    /**
     * Installation contexts.
     */
    integration_types: number[];
    /**
     * Permission bitset as a string.
     */
    default_member_permissions?: string | undefined;
    /**
     * Localized command names.
     */
    name_localizations?: Partial<Record<import("discord.js").Locale, string | null>> | undefined;
    /**
     * Localized command descriptions.
     */
    description_localizations?: Partial<Record<import("discord.js").Locale, string | null>> | undefined;
    /**
     * Command options.
     */
    options?: SlashCommandOption[] | undefined;
    /**
     * Whether the command is age-restricted.
     */
    nsfw: boolean;
};
/**
 * Raw options used to create a {@link SlashCommand} instance.
 */
type SlashCommandOptions = {
    /**
     * Command name, max 32 characters.
     */
    name: string;
    /**
     * Command description, max 100 characters.
     */
    description: string;
    /**
     * Guild id used for guild-scoped registration.
     */
    guild_id?: string | undefined;
    /**
     * Supported installation targets.
     */
    integration_types?: CommandIntegrationType[] | undefined;
    /**
     * Contexts where the command can be used.
     */
    contexts?: CommandContext[] | undefined;
    /**
     * Default member permissions required to use the command.
     */
    default_member_permissions?: import("discord.js").PermissionResolvable | undefined;
    /**
     * Localized command names.
     */
    name_localizations?: Partial<Record<import("discord.js").Locale, string | null>> | undefined;
    /**
     * Localized command descriptions.
     */
    description_localizations?: Partial<Record<import("discord.js").Locale, string | null>> | undefined;
    /**
     * Command options.
     */
    options?: SlashCommandOption[] | undefined;
    /**
     * Whether the command is age-restricted.
     */
    nsfw?: boolean | undefined;
    /**
     * Optional autocomplete handler.
     */
    autocomplete?: SlashCommandAutocompleteHandler | undefined;
    /**
     * Slash command execution handler.
     */
    handler: SlashCommandHandler;
};
//# sourceMappingURL=SlashCommand.d.ts.map