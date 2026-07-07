// @ts-check

const nodeComfort = require("@ix-xs/node-comfort");
const { PermissionsBitField, ChannelType } = require("discord.js");

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
function createAttachmentOption(options) {
  return {
    ...options,
    type: 11,
  };
}

/**
 * Creates a boolean option.
 * @param {Omit<SlashCommandBooleanOption, "type">} options Boolean option data.
 * @returns {SlashCommandBooleanOption}
 */
function createBooleanOption(options) {
  return {
    ...options,
    type: 5,
  };
}

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
function createChannelOption(options) {
  const channelTypes = options.channel_types;

  return {
    ...options,
    channel_types: Array.isArray(channelTypes)
      ? channelTypes.map((type) => typeof type === "string" ? ChannelType[type] : type)
      : undefined,
    type: 7,
  };
}

/**
 * Creates an integer option.
 * @param {Omit<SlashCommandIntegerOption, "type">} option Integer option data.
 * @returns {SlashCommandIntegerOption}
 */
function createIntegerOption(option) {
  return {
    ...option,
    type: 4,
  };
}

/**
 * Creates a mentionable option.
 * @param {Omit<SlashCommandMentionableOption, "type">} option Mentionable option data.
 * @returns {SlashCommandMentionableOption}
 */
function createMentionableOption(option) {
  return {
    ...option,
    type: 9,
  };
}

/**
 * Creates a number option.
 * @param {Omit<SlashCommandNumberOption, "type">} option Number option data.
 * @returns {SlashCommandNumberOption}
 */
function createNumberOption(option) {
  return {
    ...option,
    type: 10,
  };
}

/**
 * Creates a role option.
 * @param {Omit<SlashCommandRoleOption, "type">} option Role option data.
 * @returns {SlashCommandRoleOption}
 */
function createRoleOption(option) {
  return {
    ...option,
    type: 8,
  };
}

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
function createStringOption(option) {
  return {
    ...option,
    type: 3,
  };
}

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
function createSubCommandOption(option) {
  return {
    ...option,
    type: 1,
  };
}

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
function createSubCommandGroupOption(option) {
  return {
    ...option,
    type: 2,
  };
}

/**
 * Creates a user option.
 * @param {Omit<SlashCommandUserOption, "type">} option User option data.
 * @returns {SlashCommandUserOption}
 */
function createUserOption(option) {
  return {
    ...option,
    type: 6,
  };
}

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
class SlashCommand {
  /**
   * Guild id used for guild-scoped registration.
   * If omitted, the command is registered globally.
   * @type {string|undefined}
   */
  guild_id;

  /**
   * Discord command id assigned after registration.
   * @type {string|undefined}
   */
  id;

  /**
   * Command payload sent to Discord during registration.
   * @type {SlashCommandData}
   */
  command;

  /**
   * Handler called when the slash command is executed.
   * @type {SlashCommandHandler}
   */
  handler;

  /**
   * Optional handler called for autocomplete interactions.
   * @type {SlashCommandAutocompleteHandler|undefined}
   */
  autocomplete;

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
  constructor(command) {
    if (!command || typeof command !== "object") {
      throw new TypeError("SlashCommand: 'command' must be an object.");
    }

    if (typeof command.name !== "string" || command.name.length === 0) {
      throw new TypeError("SlashCommand: 'name' must be a non-empty string.");
    }

    if (typeof command.description !== "string" || command.description.length === 0) {
      throw new TypeError("SlashCommand: 'description' must be a non-empty string.");
    }

    if (typeof command.handler !== "function") {
      throw new TypeError("SlashCommand: 'handler' must be a function.");
    }

    this.guild_id = command.guild_id ?? undefined;
    this.id = undefined;
    this.handler = command.handler;
    this.autocomplete = command.autocomplete ?? undefined;

    this.command = {
      type: 1,
      name: command.name,
      description: command.description,
      name_localizations: command.name_localizations ?? undefined,
      description_localizations: command.description_localizations ?? undefined,
      options: command.options ?? undefined,
      nsfw: command.nsfw ?? false,
      contexts: (command.contexts ?? ["guild"]).map((context) =>
        context === "bot_dm" ? 1 : context === "private_channel" ? 2 : 0,
      ),
      integration_types: (command.integration_types ?? ["guild_install"]).map((integration) =>
        integration === "user_install" ? 1 : 0,
      ),
      default_member_permissions: command.default_member_permissions
        ? new PermissionsBitField(command.default_member_permissions).bitfield.toString()
        : undefined,
    };
  }

  /**
   * Returns whether the command is guild-scoped.
   * @returns {boolean} `true` if the command targets a specific guild, otherwise `false`.
   */
  isGuildOnly() {
    return typeof this.guild_id === "string" && this.guild_id.length > 0;
  }

  /**
   * Returns the command name.
   * @returns {string} The command name.
   */
  getName() {
    return this.command.name;
  }

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
  hasAutocomplete() {
    return typeof this.autocomplete === "function";
  }

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
  toJSON() {
    return {
      ...this.command,
    };
  }

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
  static from(command) {
    return new SlashCommand(command);
  }
}

SlashCommand.AttachmentOption = createAttachmentOption;
SlashCommand.BooleanOption = createBooleanOption;
SlashCommand.ChannelOption = createChannelOption;
SlashCommand.IntegerOption = createIntegerOption;
SlashCommand.MentionableOption = createMentionableOption;
SlashCommand.NumberOption = createNumberOption;
SlashCommand.RoleOption = createRoleOption;
SlashCommand.StringOption = createStringOption;
SlashCommand.SubCommandOption = createSubCommandOption;
SlashCommand.SubCommandGroupOption = createSubCommandGroupOption;
SlashCommand.UserOption = createUserOption;

module.exports = SlashCommand;