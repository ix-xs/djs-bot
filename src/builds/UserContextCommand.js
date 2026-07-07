// @ts-check

const { PermissionsBitField } = require("discord.js");

/**
 * Supported installation targets for an application command.
 *
 * @typedef {"guild_install" | "user_install"} ContextCommandIntegrationType
 */

/**
 * Supported interaction contexts for an application command.
 *
 * Note: `private_channel` only makes sense when `user_install`
 * is also enabled for the command.
 *
 * @typedef {"guild" | "bot_dm" | "private_channel"} ContextCommandContext
 */

/**
 * Handler executed when the user context command is triggered.
 *
 * @callback UserContextCommandHandler
 * @param {import("discord.js").UserContextMenuCommandInteraction} interaction The received user context menu interaction.
 * @returns {void | Promise<void>}
 */

/**
 * Raw command payload sent to Discord.
 *
 * @typedef {Object} UserContextCommandData
 * @property {2} type Command type for user context menu commands.
 * @property {string} name Command name.
 * @property {import("discord.js").LocalizationMap} [name_localizations] Localized command names.
 * @property {string} [default_member_permissions] Permission bitset as a string.
 * @property {boolean} nsfw Whether the command is age-restricted.
 * @property {number[]} [integration_types] Supported installation targets.
 * @property {number[]} [contexts] Supported interaction contexts.
 */

/**
 * Raw options used to create a {@link UserContextCommand} instance.
 *
 * @typedef {Object} UserContextCommandOptions
 * @property {string} [guild_id] Guild id used for guild-scoped registration.
 * @property {string} name Command name.
 * @property {import("discord.js").LocalizationMap} [name_localizations] Localized command names.
 * @property {import("discord.js").PermissionResolvable} [default_member_permissions] Default member permissions required to use the command.
 * @property {boolean} [nsfw=false] Whether the command is age-restricted.
 * @property {ContextCommandIntegrationType[]} [integration_types] Supported installation targets.
 * @property {ContextCommandContext[]} [contexts] Supported interaction contexts.
 * @property {UserContextCommandHandler} handler Function called when the command is triggered.
 */

/**
 * Lightweight wrapper around a Discord user context menu command definition.
 *
 * This class is designed to work as a plain structured container that can be:
 * - loaded from files,
 * - checked with `instanceof`,
 * - registered by a higher-level bot manager,
 * - executed later through its public `handler`.
 *
 * Public properties are intentionally exposed so classes such as `DJSBot`
 * can directly access `guild_id`, `id`, `command`, and `handler`.
 *
 * @example
 * const UserContextCommand = require("./UserContextCommand");
 *
 * module.exports = new UserContextCommand({
 *   name: "Avatar",
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
module.exports = class UserContextCommand {
  /**
   * Guild id used for guild-scoped registration.
   * If omitted, the command is registered globally.
   *
   * @type {string|undefined}
   */
  guild_id;

  /**
   * Discord command id assigned after registration.
   *
   * @type {string|undefined}
   */
  id;

  /**
   * Command payload sent to Discord during registration.
   *
   * @type {UserContextCommandData}
   */
  command;

  /**
   * Handler called when the user context command is executed.
   *
   * @type {UserContextCommandHandler}
   */
  handler;

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
  constructor(options) {
    if (!options || typeof options !== "object") {
      throw new TypeError("UserContextCommand: 'options' must be an object.");
    }

    if (typeof options.name !== "string" || options.name.length === 0) {
      throw new TypeError("UserContextCommand: 'name' must be a non-empty string.");
    }

    if (typeof options.handler !== "function") {
      throw new TypeError("UserContextCommand: 'handler' must be a function.");
    }

    this.guild_id = options.guild_id ?? undefined;
    this.id = undefined;
    this.handler = options.handler;

    this.command = {
      type: 2,
      name: options.name,
      name_localizations: options.name_localizations ?? undefined,
      default_member_permissions: options.default_member_permissions
        ? new PermissionsBitField(options.default_member_permissions).bitfield.toString()
        : undefined,
      nsfw: options.nsfw ?? false,
      integration_types: options.integration_types
        ? options.integration_types.map((integration) => integration === "user_install" ? 1 : 0)
        : undefined,
      contexts: options.contexts
        ? options.contexts.map((context) =>
          context === "bot_dm" ? 1 : context === "private_channel" ? 2 : 0,
        )
        : undefined,
    };
  }

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
  isGuildOnly() {
    return typeof this.guild_id === "string" && this.guild_id.length > 0;
  }

  /**
   * Returns the command name.
   *
   * @returns {string} The command name.
   */
  getName() {
    return this.command.name;
  }

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
  toJSON() {
    return {
      ...this.command,
    };
  }

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
  static from(options) {
    return new UserContextCommand(options);
  }
};