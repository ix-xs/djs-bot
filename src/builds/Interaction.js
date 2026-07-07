// @ts-check

/**
 * Supported custom interaction types handled by the bot router.
 *
 * @typedef {"button" | "selectmenu" | "modal"} InteractionKind
 */

/**
 * Any Discord interaction supported by this wrapper.
 *
 * @typedef {import("discord.js").ButtonInteraction | import("discord.js").AnySelectMenuInteraction | import("discord.js").ModalSubmitInteraction} SupportedInteraction
 */

/**
 * Handler executed when a matching interaction is received.
 *
 * @callback InteractionHandler
 * @param {SupportedInteraction} interaction The received Discord interaction.
 * @returns {void | Promise<void>}
 */

/**
 * Raw interaction definition data.
 *
 * @typedef {Object} InteractionData
 * @property {InteractionKind} type Interaction type used by the internal router.
 * @property {string} custom_id Component or modal custom id.
 * @property {InteractionHandler} handler Function called when the interaction is triggered.
 */

/**
 * Lightweight interaction definition container.
 *
 * This class is meant to be used as a plain structured object that can be:
 * - loaded from files,
 * - checked with `instanceof`,
 * - registered inside collections,
 * - executed later by your bot router.
 *
 * It intentionally keeps `type`, `custom_id`, and `handler` as public properties
 * so they can be accessed directly by higher-level classes such as `DJSBot`.
 *
 * @example
 * module.exports = new Interaction({
 *   type: "button",
 *   custom_id: "ticket:create",
 *   handler: async (interaction) => {
 *     await interaction.reply({
 *       content: "Ticket created.",
 *       ephemeral: true,
 *     });
 *   },
 * });
 */
class Interaction {
  /**
   * Interaction type used by the router.
   *
   * @type {InteractionKind}
   */
  type;

  /**
   * Custom id used to match the interaction.
   *
   * Wildcard ids such as `ticket:*` can also be stored and routed externally.
   *
   * @type {string}
   */
  custom_id;

  /**
   * Handler called when the interaction is executed.
   *
   * @type {InteractionHandler}
   */
  handler;

  /**
  * Creates a new interaction definition.
  *
  * @param {InteractionData} interaction Interaction definition.
  * @throws {TypeError} Throws if the interaction definition is invalid.
  *
  * @example
  * const interaction = new Interaction({
  *   type: "button",
  *   custom_id: "ticket:create",
  *   handler: async (interaction) => {
  *     await interaction.reply({
  *       content: "Ticket created.",
  *       ephemeral: true,
  *     });
  *   },
  * });
  */
  constructor(interaction) {
    if (!interaction || typeof interaction !== "object") {
      throw new TypeError("Interaction: 'interaction' must be an object.");
    }

    const { type, custom_id, handler } = interaction;

    if (type !== "button" && type !== "selectmenu" && type !== "modal") {
      throw new TypeError("Interaction: 'type' must be 'button', 'selectmenu', or 'modal'.");
    }

    if (typeof custom_id !== "string" || custom_id.length === 0) {
      throw new TypeError("Interaction: 'custom_id' must be a non-empty string.");
    }

    if (typeof handler !== "function") {
      throw new TypeError("Interaction: 'handler' must be a function.");
    }

    this.type = type;
    this.custom_id = custom_id;
    this.handler = handler;
  }

  /**
  * Returns whether this interaction uses a wildcard custom id.
  *
  * @returns {boolean} `true` if the custom id contains `*`, otherwise `false`.
  *
  * @example
  * const interaction = new Interaction({
  *   type: "button",
  *   custom_id: "ticket:*",
  *   handler: async () => {},
  * });
  *
  * console.log(interaction.isWildcard()); // true
  */
  isWildcard() {
    return this.custom_id.includes("*");
  }

  /**
  * Returns the interaction prefix.
  *
  * For a custom id like `ticket:create`, this returns `ticket`.
  * For a wildcard custom id like `ticket:*`, this also returns `ticket`.
  *
  * @returns {string} The custom id prefix.
  *
  * @example
  * const interaction = new Interaction({
  *   type: "modal",
  *   custom_id: "ticket:close",
  *   handler: async () => {},
  * });
  *
  * console.log(interaction.getPrefix()); // "ticket"
  */
  getPrefix() {
    return this.custom_id.split(":")[0] ?? this.custom_id;
  }

  /**
   * Returns whether the interaction type is a button.
   *
   * @returns {boolean} `true` if the interaction type is `button`, otherwise `false`.
   */
  isButton() {
    return this.type === "button";
  }

  /**
   * Returns whether the interaction type is a select menu.
   *
   * @returns {boolean} `true` if the interaction type is `selectmenu`, otherwise `false`.
   */
  isSelectMenu() {
    return this.type === "selectmenu";
  }

  /**
   * Returns whether the interaction type is a modal.
   *
   * @returns {boolean} `true` if the interaction type is `modal`, otherwise `false`.
   */
  isModal() {
    return this.type === "modal";
  }

  /**
  * Returns the interaction definition as a plain object.
  *
  * @returns {InteractionData} The raw interaction definition.
  *
  * @example
  * const data = interaction.toJSON();
  *
  * console.log(data.custom_id); // "ticket:create"
  */
  toJSON() {
    return {
      type: this.type,
      custom_id: this.custom_id,
      handler: this.handler,
    };
  }

  /**
  * Creates a new interaction instance from raw interaction data.
  *
  * @param {InteractionData} interaction Raw interaction data.
  * @returns {Interaction} A new interaction instance.
  *
  * @example
  * const interaction = Interaction.from({
  *   type: "selectmenu",
  *   custom_id: "roles:select",
  *   handler: async (interaction) => {
  *     await interaction.deferUpdate();
  *   },
  * });
  */
  static from(interaction) {
    return new Interaction(interaction);
  }
}

module.exports = Interaction;