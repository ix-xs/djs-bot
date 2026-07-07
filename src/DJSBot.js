// @ts-check

const nodeComfort = require("@ix-xs/node-comfort");
const { Client, IntentsBitField, Partials, Collection, REST, Routes } = require("discord.js");
const { EventEmitter } = require("node:events");
const builds = require("./builds/$");

/**
 * Allowed mentions configuration.
 *
 * @typedef {Object} DJSBotAllowedMentionsOptions
 * @property {boolean} [everyone] Whether `@everyone` and `@here` mentions are allowed.
 * @property {boolean} [users] Whether user mentions are allowed.
 * @property {boolean} [roles] Whether role mentions are allowed.
 * @property {boolean} [onReply] Whether replying to a message pings the replied user.
 * @property {string[]} [usersList] Explicit list of user IDs that may be mentioned.
 * @property {string[]} [rolesList] Explicit list of role IDs that may be mentioned.
 */

/**
 * Bot construction options.
 *
 * @typedef {Object} DJSBotOptions
 * @property {string} token Bot token.
 * @property {string} id Discord application ID.
 * @property {DJSBotAllowedMentionsOptions} [canMention] Allowed mentions configuration.
 * @property {"all"|import("discord.js").BitFieldResolvable<keyof typeof IntentsBitField.Flags, number>} [intents]
 * Gateway intents to enable, or `"all"` to enable every available intent.
 * @property {string} [events_folder] Path to the folder that contains runtime event modules.
 * @property {string} [commands_folder] Path to the folder that contains command definition modules.
 * @property {string} [interactions_folder] Path to the folder that contains interaction definition modules.
 */

/**
 * Normalized internal bot configuration.
 *
 * @typedef {Object} DJSBotConfig
 * @property {string} token Bot token.
 * @property {string} id Discord application ID.
 * @property {DJSBotAllowedMentionsOptions} canMention Allowed mentions configuration.
 * @property {"all"|import("discord.js").BitFieldResolvable<keyof typeof IntentsBitField.Flags, number>|undefined} intents
 * Gateway intents configuration.
 * @property {string|undefined} events_folder Events folder path.
 * @property {string|undefined} commands_folder Commands folder path.
 * @property {string|undefined} interactions_folder Interactions folder path.
 */

/**
 * Runtime event module shape loaded from the events folder.
 *
 * @typedef {Object} DJSBotFileEvent
 * @property {string} eventName Discord client event name.
 * @property {(...args: any[]) => (void|Promise<void>)} handler Event handler.
 */

/**
 * Slash command instance type.
 *
 * @typedef {InstanceType<typeof builds.SlashCommand>} SlashCommandInstance
 */

/**
 * User context command instance type.
 *
 * @typedef {InstanceType<typeof builds.UserContextCommand>} UserContextCommandInstance
 */

/**
 * Message context command instance type.
 *
 * @typedef {InstanceType<typeof builds.MessageContextCommand>} MessageContextCommandInstance
 */

/**
 * Generic interaction instance type.
 *
 * @typedef {InstanceType<typeof builds.Interaction>} InteractionInstance
 */

/**
 * Supported command instance types.
 *
 * @typedef {SlashCommandInstance|UserContextCommandInstance|MessageContextCommandInstance} CommandInstance
 */

/**
 * Command registry buckets.
 *
 * @typedef {Object} DJSBotCommandRegistry
 * @property {Collection<string, SlashCommandInstance>} slash Registered slash commands.
 * @property {Collection<string, UserContextCommandInstance>} context_user Registered user context commands.
 * @property {Collection<string, MessageContextCommandInstance>} context_message Registered message context commands.
 */

/**
 * Interaction registry buckets.
 *
 * @typedef {Object} DJSBotInteractionRegistry
 * @property {Collection<string, InteractionInstance>} buttons Registered button interactions.
 * @property {Collection<string, InteractionInstance>} selectmenus Registered select menu interactions.
 * @property {Collection<string, InteractionInstance>} modals Registered modal interactions.
 */

/**
 * Helper shape used to build a stable command registry key.
 *
 * @typedef {Object} DJSBotCommandKeyOptions
 * @property {"global"|"guild"} scope Command scope.
 * @property {string|null} [guildId] Guild ID when the scope is `"guild"`.
 * @property {string|number} type Application command type.
 * @property {string} name Command name.
 */

/**
 * High-level wrapper around a Discord.js client, command registry,
 * interaction registry, and runtime auto-loader system.
 *
 * Features:
 * - creates and configures a Discord client,
 * - optionally loads commands, interactions, and events from folders,
 * - supports manual command and interaction registration,
 * - registers application commands through Discord's REST API,
 * - dispatches incoming interactions to the matching handler.
 *
 * Folder-based loading is optional. If `commands_folder` or
 * `interactions_folder` is omitted, commands and interactions can still be
 * registered manually through `addCommand()` and `addInteraction()` before
 * `start()` is called.
 *
 * Event listeners registered through `on()` and `once()` should also be added
 * before calling `start()`.
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
 * bot.on("ready", async (client) => {
 *   console.log(`${client.user.tag} connected`);
 * });
 *
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
module.exports = class DJSBot {
  /**
   * Normalized bot configuration.
   * @type {DJSBotConfig}
   */
  #config;

  /**
   * Internal event bridge used to expose a lightweight `on()` / `once()` API
   * on top of the Discord.js client event system.
   * @type {EventEmitter}
   */
  #events = new EventEmitter();

  /**
   * Registered command collections grouped by command category.
   * @type {DJSBotCommandRegistry}
   */
  #commands = {
    slash: new Collection(),
    context_user: new Collection(),
    context_message: new Collection(),
  };

  /**
   * Registered interaction collections grouped by interaction category.
   * @type {DJSBotInteractionRegistry}
   */
  #interactions = {
    buttons: new Collection(),
    selectmenus: new Collection(),
    modals: new Collection(),
  };

  /**
   * Wildcard interaction registry indexed by custom ID prefix.
   *
   * Example keys:
   * - `profile`
   * - `ticket`
   * - `support`
   *
   * Stored values contain entries such as:
   * - `buttons:profile:*`
   * - `selectmenus:ticket:*`
   * - `modals:support:*`
   *
   * @type {Map<string, Collection<string, InteractionInstance>>}
   */
  #wildcardInteractions = new Map();

  /**
   * REST client used to register global and guild application commands.
   * @type {REST}
   */
  #rest;

  /**
   * Discord.js client instance used by the bot.
   * @type {Client}
   */
  client;

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
  constructor(config) {
    if (!config || typeof config !== "object") {
      throw new TypeError("DJSBot: 'config' must be an object.");
    }

    if (typeof config.token !== "string" || config.token.length === 0) {
      throw new TypeError("DJSBot: 'config.token' must be a non-empty string.");
    }

    if (typeof config.id !== "string" || config.id.length === 0) {
      throw new TypeError("DJSBot: 'config.id' must be a non-empty string.");
    }

    if (
      config.canMention !== undefined
      && (!config.canMention || typeof config.canMention !== "object" || Array.isArray(config.canMention))
    ) {
      throw new TypeError("DJSBot: 'config.canMention' must be an object when provided.");
    }

    if (config.events_folder !== undefined && typeof config.events_folder !== "string") {
      throw new TypeError("DJSBot: 'config.events_folder' must be a string when provided.");
    }

    if (config.commands_folder !== undefined && typeof config.commands_folder !== "string") {
      throw new TypeError("DJSBot: 'config.commands_folder' must be a string when provided.");
    }

    if (config.interactions_folder !== undefined && typeof config.interactions_folder !== "string") {
      throw new TypeError("DJSBot: 'config.interactions_folder' must be a string when provided.");
    }

    this.#config = {
      token: config.token,
      id: config.id,
      canMention: config.canMention ?? {},
      intents: config.intents,
      events_folder: config.events_folder,
      commands_folder: config.commands_folder,
      interactions_folder: config.interactions_folder,
    };

    this.#rest = new REST().setToken(config.token);

    /** @type {import("discord.js").MessageMentionTypes[]} */
    const parse = [];

    /** @type {string[]} */
    const roles = [];

    /** @type {string[]} */
    const users = [];

    let repliedUser = true;

    for (const [key, value] of Object.entries(this.#config.canMention)) {
      if (typeof value === "boolean") {
        if (key === "onReply") {
          repliedUser = value;
        }
        else if (key === "everyone" || key === "users" || key === "roles") {
          parse.push(/** @type {import("discord.js").MessageMentionTypes} */ (key));
        }
      }
      else if (Array.isArray(value)) {
        if (key === "usersList") {
          users.push(...value);
        }
        else if (key === "rolesList") {
          roles.push(...value);
        }
      }
    }

    /** @type {import("discord.js").BitFieldResolvable<keyof typeof IntentsBitField.Flags, number>} */
    let intents = new IntentsBitField();

    if (config.intents === "all") {
      intents = /** @type {number[]} */ (Object.values(IntentsBitField.Flags));
    }
    else if (config.intents !== undefined) {
      intents = config.intents;
    }

    /** @type {import("discord.js").ClientOptions} */
    const clientOptions = {
      allowedMentions: { parse, repliedUser, roles, users },
      failIfNotExists: true,
      intents,
      partials: /** @type {import("discord.js").Partials[]} */ (Object.values(Partials)),
    };

    this.client = new Client(clientOptions);
    this.client.setMaxListeners(0);
  }

  /**
   * Registers a command instance in the appropriate command registry.
   *
   * Supported command classes:
   * - `SlashCommand`
   * - `MessageContextCommand`
   * - `UserContextCommand`
   *
   * If another command with the same name already exists in the same registry
   * bucket, it is replaced by the new instance.
   *
   * @param {CommandInstance} command Command instance to register.
   * @returns {void}
   * @throws {TypeError} Throws if the provided value is not a supported command instance.
   */
  #registerCommand(command) {
    if (
      !command
      || !(command instanceof builds.SlashCommand
        || command instanceof builds.MessageContextCommand
        || command instanceof builds.UserContextCommand)
    ) {
      throw new TypeError(
        "Command must be an instance of: \"SlashCommand\", \"MessageContextCommand\", or \"UserContextCommand\".",
      );
    }

    if (command instanceof builds.MessageContextCommand) {
      this.#commands.context_message.set(command.command.name, command);
    }
    else if (command instanceof builds.UserContextCommand) {
      this.#commands.context_user.set(command.command.name, command);
    }
    else {
      this.#commands.slash.set(command.command.name, command);
    }
  }

  /**
   * Loads command modules from the configured commands folder and registers them.
   *
   * @returns {Promise<void>}
   * @throws {TypeError} Throws if a loaded module is not a valid command instance.
   */
  async #setupCommands() {
    for (const file of nodeComfort.getFilesIn(this.#config.commands_folder ?? "*") ?? []) {
      const command = require(file);
      this.#registerCommand(command);
    }
  }

  /**
  * Resolves an interaction registry bucket from a public interaction type.
  *
  * @param {"button"|"selectmenu"|"modal"} type Public interaction type.
  * @returns {"buttons"|"selectmenus"|"modals"} Registry bucket name.
  */
  #resolveInteractionBucket(type) {
    return type === "button"
      ? "buttons"
      : type === "selectmenu"
        ? "selectmenus"
        : "modals";
  }

  /**
   * Loads interaction modules from the configured interactions folder and
   * registers them in the internal interaction registries.
   *
   * @returns {Promise<void>}
   * @throws {TypeError} Throws if a loaded module is not a valid interaction instance.
   */
  async #setupInteractions() {
    for (const file of nodeComfort.getFilesIn(this.#config.interactions_folder ?? "*") ?? []) {
      const interaction = require(file);

      if (!interaction || !(interaction instanceof builds.Interaction)) {
        throw new TypeError("Interaction must be an instance of: \"Interaction\".");
      }

      const interactionType = this.#resolveInteractionBucket(interaction.type);
      this.#registerInteraction(interactionType, interaction.custom_id, interaction);
    }
  }

  /**
   * Registers built-in interaction dispatching and runtime event modules.
   *
   * This method wires:
   * - slash commands,
   * - message context commands,
   * - user context commands,
   * - button interactions,
   * - select menu interactions,
   * - modal interactions,
   * - autocomplete interactions,
   * - file-based client events,
   * - listeners registered through `on()` and `once()`.
   *
   * @returns {Promise<void>}
   * @throws {Error} Throws if an event module has an invalid shape.
   */
  async #setupEvents() {
    this.client.on("interactionCreate", async (interaction) => {
      if (interaction.isChatInputCommand()) {
        const command = this.#commands.slash.get(interaction.commandName);
        if (command) await command.handler(interaction);
      }
      else if (interaction.isMessageContextMenuCommand()) {
        const command = this.#commands.context_message.get(interaction.commandName);
        if (command) await command.handler(interaction);
      }
      else if (interaction.isUserContextMenuCommand()) {
        const command = this.#commands.context_user.get(interaction.commandName);
        if (command) await command.handler(interaction);
      }
      else if (interaction.isButton()) {
        let button = this.#interactions.buttons.get(interaction.customId);

        if (!button) {
          const parts = interaction.customId.split(":");

          if (parts.length > 1) {
            const prefix = this.#wildcardInteractions.get(parts[0]);
            if (prefix) {
              button = prefix.get(`buttons:${parts[0]}:*`);
            }
          }
        }

        if (button) await button.handler(interaction);
      }
      else if (interaction.isAnySelectMenu()) {
        let selectmenu = this.#interactions.selectmenus.get(interaction.customId);

        if (!selectmenu) {
          const parts = interaction.customId.split(":");

          if (parts.length > 1) {
            const prefix = this.#wildcardInteractions.get(parts[0]);
            if (prefix) {
              selectmenu = prefix.get(`selectmenus:${parts[0]}:*`);
            }
          }
        }

        if (selectmenu) await selectmenu.handler(interaction);
      }
      else if (interaction.isModalSubmit()) {
        let modal = this.#interactions.modals.get(interaction.customId);

        if (!modal) {
          const parts = interaction.customId.split(":");

          if (parts.length > 1) {
            const prefix = this.#wildcardInteractions.get(parts[0]);
            if (prefix) {
              modal = prefix.get(`modals:${parts[0]}:*`);
            }
          }
        }

        if (modal) await modal.handler(interaction);
      }
      else if (interaction.isAutocomplete()) {
        const command = this.#commands.slash.get(interaction.commandName);
        if (command?.autocomplete) await command.autocomplete(interaction);
      }
    });

    if (this.#config.events_folder) {
      for (const file of nodeComfort.getFilesIn(this.#config.events_folder ?? "*") ?? []) {
        const event = /** @type {DJSBotFileEvent} */ (require(file));

        if (
          !event
          || typeof event !== "object"
          || typeof event.eventName !== "string"
          || typeof event.handler !== "function"
        ) {
          throw new Error("Event must match the shape: { eventName: string, handler: function }");
        }

        this.client.on(event.eventName, async (...args) => {
          await event.handler(...args);
        });
      }
    }

    for (const eventName of this.#events.eventNames()) {
      this.client.on(eventName, async (...args) => {
        this.#events.emit(eventName, ...args);
      });
    }
  }

  /**
   * Builds a stable registry key for a command instance or API command payload.
   *
   * The key includes the command scope, command type, and command name.
   * Guild-scoped commands also include the guild ID.
   *
   * @param {DJSBotCommandKeyOptions} options Command key options.
   * @returns {string} Stable registry key.
   */
  #commandKey({ scope, guildId = null, type, name }) {
    return scope === "guild"
      ? `guild:${guildId}:${type}:${name}`
      : `global:${type}:${name}`;
  }

  /**
   * Registers all loaded application commands through Discord's REST API.
   *
   * Global commands are registered through the global application commands
   * route. Guild commands are grouped by `guild_id` and registered through
   * the corresponding guild route.
   *
   * Returned API command IDs are written back to their matching command
   * instances.
   *
   * @returns {Promise<void>}
   */
  async #registerCommands() {
    /** @type {Map<string, CommandInstance>} */
    const commandMap = new Map();

    /** @type {CommandInstance[]} */
    const allCommands = [
      ...this.#commands.slash.values(),
      ...this.#commands.context_message.values(),
      ...this.#commands.context_user.values(),
    ];

    for (const command of allCommands) {
      const scope = command.guild_id ? "guild" : "global";
      const key = this.#commandKey({
        scope,
        guildId: command.guild_id ?? null,
        type: command.command.type ?? 1,
        name: command.command.name,
      });

      commandMap.set(key, command);
    }

    const globalCommands = allCommands
      .filter((command) => !command.guild_id)
      .map((command) => command.command);

    if (globalCommands.length > 0) {
      const global =
        /** @type {{ id: string, name: string, type?: string|number }[]} */
        (await this.#rest.put(
          Routes.applicationCommands(this.#config.id),
          { body: globalCommands },
        ));

      for (const cmd of global) {
        const key = this.#commandKey({
          scope: "global",
          type: cmd.type ?? 1,
          name: cmd.name,
        });

        const command = commandMap.get(key);
        if (command) {
          command.id = cmd.id;
        }
      }
    }

    /** @type {Map<string, Array<Record<string, any>>>} */
    const guildMap = new Map();

    for (const command of allCommands) {
      if (!command.guild_id) continue;

      let guildCommands = guildMap.get(command.guild_id);

      if (!guildCommands) {
        guildCommands = [];
        guildMap.set(command.guild_id, guildCommands);
      }

      guildCommands.push(command.command);
    }

    for (const [guildId, commands] of guildMap) {
      const guild =
        /** @type {{ id: string, name: string, type?: string|number }[]} */
        (await this.#rest.put(
          Routes.applicationGuildCommands(this.#config.id, guildId),
          { body: commands },
        ));

      for (const cmd of guild) {
        const key = this.#commandKey({
          scope: "guild",
          guildId,
          type: cmd.type ?? 1,
          name: cmd.name,
        });

        const command = commandMap.get(key);
        if (command) {
          command.id = cmd.id;
        }
      }
    }
  }

  /**
   * Registers an interaction in its registry bucket and, when relevant,
   * in the wildcard prefix registry.
   *
   * Wildcard interactions are indexed by the first `custom_id` segment.
   * For example, an interaction ID such as `profile:123` can match a
   * registered wildcard interaction such as `profile:*`.
   *
   * @param {"buttons"|"selectmenus"|"modals"} type Registry bucket name.
   * @param {string} custom_id Interaction custom ID.
   * @param {InteractionInstance} interaction Interaction instance.
   * @returns {void}
   */
  #registerInteraction(type, custom_id, interaction) {
    const key = `${type}:${custom_id}`;

    this.#interactions[type].set(interaction.custom_id, interaction);

    if (custom_id.includes("*")) {
      const prefix = custom_id.split(":")[0];

      let bucket = this.#wildcardInteractions.get(prefix);

      if (!bucket) {
        bucket = new Collection();
        this.#wildcardInteractions.set(prefix, bucket);
      }

      bucket.set(key, interaction);
    }
  }

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
  on(event, handler) {
    this.#events.on(event, handler);
    return this;
  }

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
  once(event, handler) {
    this.#events.once(event, handler);
    return this;
  }

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
  addCommand(command) {
    this.#registerCommand(command);
    return this;
  }

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
  addInteraction(interaction) {
    if (!interaction || !(interaction instanceof builds.Interaction)) {
      throw new TypeError("Interaction must be an instance of: \"Interaction\".");
    }

    const interactionType = this.#resolveInteractionBucket(interaction.type);

    this.#registerInteraction(interactionType, interaction.custom_id, interaction);
    return this;
  }

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
  async start() {
    if (this.#config.commands_folder) {
      await this.#setupCommands();
    }

    if (this.#config.interactions_folder) {
      await this.#setupInteractions();
    }

    await this.#setupEvents();
    await this.#registerCommands();
    await this.client.login(this.#config.token);
  }

  /**
  * Gracefully stops the bot by destroying the underlying Discord client.
  *
  * @returns {Promise<void>}
  *
  * @example
  * await bot.stop();
  */
  async stop() {
    await this.client.destroy();
  }
};
