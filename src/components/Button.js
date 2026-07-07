// @ts-check

/**
 * Button styles supported by this wrapper.
 *
 * @typedef {"blue" | "gray" | "green" | "red" | "link"} ButtonStyle
 */

/**
 * Raw options used to create a {@link Button} instance.
 *
 * @typedef {Object} ButtonOptions
 * @property {ButtonStyle} [style="blue"] Button style.
 * @property {string} [label] Button label.
 * @property {import("discord.js").ComponentEmojiResolvable} [emoji] Button emoji.
 * @property {string} [custom_id] Button custom id.
 * @property {string} [url] Button URL, only used for link buttons.
 * @property {boolean} [disabled] Whether the button is disabled.
 */

/**
 * Discord-compatible button payload.
 *
 * @typedef {Object} ButtonData
 * @property {2} type Discord component type for buttons.
 * @property {1 | 2 | 3 | 4 | 5} style Discord button style.
 * @property {string} [label] Button label.
 * @property {import("discord.js").ComponentEmojiResolvable} [emoji] Button emoji.
 * @property {string} [custom_id] Button custom id.
 * @property {string} [url] Button URL.
 * @property {boolean} [disabled] Whether the button is disabled.
 */

/**
 * Lightweight wrapper around a Discord-compatible button payload.
 *
 * Supports:
 * - primary blue buttons,
 * - secondary gray buttons,
 * - success green buttons,
 * - danger red buttons,
 * - link buttons.
 *
 * @example
 * const button = new Button({
 *   style: "blue",
 *   label: "Créer",
 *   custom_id: "ticket:create",
 * });
 *
 * @example
 * const linkButton = new Button({
 *   style: "link",
 *   label: "Documentation",
 *   url: "https://discord.js.org",
 * });
 */
class Button {
  /**
   * Button payload in Discord-compatible format.
   *
   * @type {ButtonData}
   */
  #button;

  /**
   * Creates a new button.
   *
   * @param {ButtonOptions} [options={}] Button options.
   * @throws {TypeError} Throws if the provided button options are invalid.
   *
   * @example
   * const confirmButton = new Button({
   *   style: "green",
   *   label: "Confirm",
   *   custom_id: "confirm:action",
   * });
   *
   * @example
   * const docsButton = new Button({
   *   style: "link",
   *   label: "Documentation",
   *   url: "https://discord.js.org",
   * });
   */
  constructor(options = {}) {
    if (!options || typeof options !== "object" || Array.isArray(options)) {
      throw new TypeError("Button: 'options' must be an object.");
    }

    const {
      style = "blue",
      label,
      emoji,
      custom_id,
      url,
      disabled,
    } = options;

    const resolvedStyle = this.#resolveStyle(style);

    if (resolvedStyle === undefined) {
      throw new TypeError("Button: 'style' must be 'blue', 'gray', 'green', 'red', or 'link'.");
    }

    if (label !== undefined && (typeof label !== "string" || label.length === 0)) {
      throw new TypeError("Button: 'label' must be a non-empty string when provided.");
    }

    if (label !== undefined && label.length > 80) {
      throw new TypeError("Button: 'label' must not exceed 80 characters.");
    }

    if (disabled !== undefined && typeof disabled !== "boolean") {
      throw new TypeError("Button: 'disabled' must be a boolean when provided.");
    }

    if (resolvedStyle === 5) {
      if (typeof url !== "string" || url.length === 0) {
        throw new TypeError("Button: link buttons require a non-empty 'url'.");
      }

      if (custom_id !== undefined) {
        throw new TypeError("Button: link buttons cannot use 'custom_id'.");
      }
    }
    else {
      if (typeof custom_id !== "string" || custom_id.length === 0) {
        throw new TypeError("Button: non-link buttons require a non-empty 'custom_id'.");
      }

      if (custom_id.length > 100) {
        throw new TypeError("Button: 'custom_id' must not exceed 100 characters.");
      }

      if (url !== undefined) {
        throw new TypeError("Button: non-link buttons cannot use 'url'.");
      }
    }

    if (label === undefined && emoji === undefined) {
      throw new TypeError("Button: a button must define at least a 'label' or an 'emoji'.");
    }

    this.#button = {
      type: 2,
      style: resolvedStyle,
      label: label ?? undefined,
      emoji: emoji ?? undefined,
      custom_id: resolvedStyle === 5 ? undefined : custom_id,
      url: resolvedStyle === 5 ? url : undefined,
      disabled: disabled ?? undefined,
    };
  }

  /**
   * Resolves a wrapper button style to a Discord button style id.
   *
   * @param {ButtonStyle} style Wrapper style.
   * @returns {1 | 2 | 3 | 4 | 5 | undefined} Discord button style id.
   */
  #resolveStyle(style) {
    return style === "blue"
      ? 1
      : style === "gray"
        ? 2
        : style === "green"
          ? 3
          : style === "red"
            ? 4
            : style === "link"
              ? 5
              : undefined;
  }

  /**
   * Returns the button style id.
   *
   * @returns {1 | 2 | 3 | 4 | 5} The button style id.
   */
  getStyle() {
    return this.#button.style;
  }

  /**
   * Returns the button label.
   *
   * @returns {string|undefined} The button label.
   */
  getLabel() {
    return this.#button.label;
  }

  /**
   * Returns the button emoji.
   *
   * @returns {import("discord.js").ComponentEmojiResolvable|undefined} The button emoji.
   */
  getEmoji() {
    return this.#button.emoji;
  }

  /**
   * Returns the button custom id.
   *
   * @returns {string|undefined} The custom id.
   */
  getCustomId() {
    return this.#button.custom_id;
  }

  /**
   * Returns the button URL.
   *
   * @returns {string|undefined} The button URL.
   */
  getURL() {
    return this.#button.url;
  }

  /**
   * Returns whether the button is disabled.
   *
   * @returns {boolean} `true` if the button is disabled, otherwise `false`.
   */
  isDisabled() {
    return Boolean(this.#button.disabled);
  }

  /**
   * Returns whether the button is a link button.
   *
   * @returns {boolean} `true` if the button is a link button, otherwise `false`.
   *
   * @example
   * const button = new Button({
   *   style: "link",
   *   label: "Open docs",
   *   url: "https://discord.js.org",
   * });
   *
   * console.log(button.isLink()); // true
   */
  isLink() {
    return this.#button.style === 5;
  }

  /**
   * Sets the button label.
   *
   * @param {string} label Button label.
   * @returns {this} The current button instance.
   */
  setLabel(label) {
    if (typeof label !== "string" || label.length === 0) {
      throw new TypeError("Button.setLabel(): 'label' must be a non-empty string.");
    }

    if (label.length > 80) {
      throw new TypeError("Button.setLabel(): 'label' must not exceed 80 characters.");
    }

    this.#button.label = label;
    return this;
  }

  /**
   * Clears the button label.
   *
   * @returns {this} The current button instance.
   *
   * @example
   * const button = new Button({
   *   custom_id: "refresh",
   *   label: "Refresh",
   *   emoji: "🔄",
   * });
   *
   * button.clearLabel();
   */
  clearLabel() {
    delete this.#button.label;

    if (this.#button.emoji === undefined) {
      throw new TypeError("Button.clearLabel(): a button must keep at least a label or an emoji.");
    }

    return this;
  }

  /**
   * Sets the button emoji.
   *
   * @param {import("discord.js").ComponentEmojiResolvable} emoji Button emoji.
   * @returns {this} The current button instance.
   */
  setEmoji(emoji) {
    this.#button.emoji = emoji;
    return this;
  }

  /**
   * Clears the button emoji.
   *
   * @returns {this} The current button instance.
   */
  clearEmoji() {
    delete this.#button.emoji;

    if (this.#button.label === undefined) {
      throw new TypeError("Button.clearEmoji(): a button must keep at least a label or an emoji.");
    }

    return this;
  }

  /**
   * Sets the custom id for non-link buttons.
   *
   * @param {string} customId Button custom id.
   * @returns {this} The current button instance.
   *
   * @example
   * const button = new Button({
   *   style: "blue",
   *   label: "Create ticket",
   *   custom_id: "ticket:create",
   * });
   *
   * button.setCustomId("ticket:open");
   */
  setCustomId(customId) {
    if (this.#button.style === 5) {
      throw new TypeError("Button.setCustomId(): link buttons cannot use 'custom_id'.");
    }

    if (typeof customId !== "string" || customId.length === 0 || customId.length > 100) {
      throw new TypeError("Button.setCustomId(): 'customId' must be a non-empty string with a maximum length of 100 characters.");
    }

    this.#button.custom_id = customId;
    return this;
  }

  /**
   * Sets the URL for link buttons.
   *
   * @param {string} url Button URL.
   * @returns {this} The current button instance.
   *
   * @example
   * const button = new Button({
   *   style: "link",
   *   label: "Guide",
   *   url: "https://example.com",
   * });
   *
   * button.setURL("https://discord.js.org");
   */
  setURL(url) {
    if (this.#button.style !== 5) {
      throw new TypeError("Button.setURL(): only link buttons can use 'url'.");
    }

    if (typeof url !== "string" || url.length === 0) {
      throw new TypeError("Button.setURL(): 'url' must be a non-empty string.");
    }

    this.#button.url = url;
    return this;
  }

  /**
   * Sets the disabled state.
   *
   * @param {boolean} [disabled=true] Whether the button is disabled.
   * @returns {this} The current button instance.
   *
   * @example
   * button.setDisabled(true);
   */
  setDisabled(disabled = true) {
    this.#button.disabled = Boolean(disabled);
    return this;
  }

  /**
   * Returns the button as a Discord-compatible JSON object.
   *
   * @returns {ButtonData} The raw button payload.
   *
   * @example
   * const payload = button.toJSON();
   *
   * console.log(payload);
   * // {
   * //   type: 2,
   * //   style: 3,
   * //   label: "Confirm",
   * //   custom_id: "confirm:action"
   * // }
   */
  toJSON() {
    return {
      ...this.#button,
    };
  }

  /**
   * Creates a new button instance from raw options.
   *
   * @param {ButtonOptions} [options={}] Raw button options.
   * @returns {Button} A new button instance.
   *
   * @example
   * const button = Button.from({
   *   style: "red",
   *   label: "Delete",
   *   custom_id: "message:delete",
   * });
   */
  static from(options = {}) {
    return new Button(options);
  }
}

module.exports = Button;