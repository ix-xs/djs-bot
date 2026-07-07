// @ts-check

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
class MessageContextCommand {
  /**
   * Guild id used for guild-scoped registration.
   *
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
   * @type {MessageContextCommandData}
   */
  command;

  /**
   * Handler called when the command is executed.
   *
   * @type {MessageContextCommandHandler}
   */
  handler;

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
  constructor(options) {
    if (!options || typeof options !== "object") {
      throw new TypeError("MessageContextCommand: 'options' must be an object.");
    }

    const {
      guild_id,
      name,
      name_localizations,
      default_member_permissions,
      nsfw,
      integration_types,
      contexts,
      handler,
    } = options;

    if (guild_id !== undefined && typeof guild_id !== "string") {
      throw new TypeError("MessageContextCommand: 'guild_id' must be a string when provided.");
    }

    if (typeof name !== "string" || name.length === 0) {
      throw new TypeError("MessageContextCommand: 'name' must be a non-empty string.");
    }

    if (typeof handler !== "function") {
      throw new TypeError("MessageContextCommand: 'handler' must be a function.");
    }

    if (nsfw !== undefined && typeof nsfw !== "boolean") {
      throw new TypeError("MessageContextCommand: 'nsfw' must be a boolean when provided.");
    }

    if (integration_types !== undefined && !Array.isArray(integration_types)) {
      throw new TypeError("MessageContextCommand: 'integration_types' must be an array when provided.");
    }

    if (
      Array.isArray(integration_types) &&
      integration_types.some((value) => value !== "guild_install" && value !== "user_install")
    ) {
      throw new TypeError("MessageContextCommand: 'integration_types' contains an invalid value.");
    }

    if (contexts !== undefined && !Array.isArray(contexts)) {
      throw new TypeError("MessageContextCommand: 'contexts' must be an array when provided.");
    }

    if (
      Array.isArray(contexts) &&
      contexts.some((value) => value !== "guild" && value !== "bot_dm" && value !== "private_channel")
    ) {
      throw new TypeError("MessageContextCommand: 'contexts' contains an invalid value.");
    }

    this.guild_id = guild_id ?? undefined;
    this.id = undefined;
    this.handler = handler;
    this.command = {
      name,
      name_localizations: name_localizations ?? undefined,
      default_member_permissions: default_member_permissions ?? undefined,
      nsfw: nsfw ?? undefined,
      integration_types: integration_types ?? undefined,
      contexts: contexts ?? undefined,
      type: 3,
    };
  }

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
  toJSON() {
    return {
      ...this.command,
    };
  }

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
  static from(options) {
    return new MessageContextCommand(options);
  }
}

module.exports = MessageContextCommand;