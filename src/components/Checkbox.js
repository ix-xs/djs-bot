// @ts-check

/**
 * Raw options used to create a {@link Checkbox} instance.
 *
 * @typedef {Object} CheckboxOptions
 * @property {string} custom_id Component custom id.
 * @property {boolean} [default] Whether the checkbox is checked by default.
 */

/**
 * Discord-compatible checkbox payload.
 *
 * @typedef {Object} CheckboxData
 * @property {23} type Discord component type for a checkbox.
 * @property {string} custom_id Component custom id.
 * @property {boolean} [default] Whether the checkbox is checked by default.
 */

/**
 * Lightweight wrapper around a Discord-compatible checkbox payload.
 *
 * @example
 * const checkbox = new Checkbox({
 *   custom_id: "tos:accept",
 *   default: false,
 * });
 */
class Checkbox {
  /**
   * Checkbox payload in Discord-compatible format.
   *
   * @type {CheckboxData}
   */
  #checkbox;

  /**
   * Creates a new checkbox.
   *
   * @param {CheckboxOptions} options Checkbox options.
   * @throws {TypeError} Throws if the provided checkbox options are invalid.
   *
   * @example
   * const checkbox = new Checkbox({
   *   custom_id: "tos:accept",
   *   default: false,
   * });
   */
  constructor(options) {
    if (!options || typeof options !== "object" || Array.isArray(options)) {
      throw new TypeError("Checkbox: 'options' must be an object.");
    }

    const { custom_id, default: defaultValue } = options;

    if (typeof custom_id !== "string" || custom_id.length === 0) {
      throw new TypeError("Checkbox: 'custom_id' must be a non-empty string.");
    }

    if (custom_id.length > 100) {
      throw new TypeError("Checkbox: 'custom_id' must not exceed 100 characters.");
    }

    if (defaultValue !== undefined && typeof defaultValue !== "boolean") {
      throw new TypeError("Checkbox: 'default' must be a boolean when provided.");
    }

    this.#checkbox = {
      type: 23,
      custom_id,
      default: defaultValue ?? undefined,
    };
  }

  /**
   * Returns the checkbox custom id.
   *
   * @returns {string} The custom id.
   */
  getCustomId() {
    return this.#checkbox.custom_id;
  }

  /**
   * Returns whether the checkbox is checked by default.
   *
   * @returns {boolean} `true` if checked by default, otherwise `false`.
   */
  isDefault() {
    return Boolean(this.#checkbox.default);
  }

  /**
   * Sets the checkbox custom id.
   *
   * @param {string} customId New custom id.
   * @returns {this} The current checkbox instance.
   *
   * @example
   * checkbox.setCustomId("newsletter:subscribe");
   */
  setCustomId(customId) {
    if (typeof customId !== "string" || customId.length === 0) {
      throw new TypeError("Checkbox.setCustomId(): 'customId' must be a non-empty string.");
    }

    if (customId.length > 100) {
      throw new TypeError("Checkbox.setCustomId(): 'customId' must not exceed 100 characters.");
    }

    this.#checkbox.custom_id = customId;
    return this;
  }

  /**
   * Sets whether the checkbox is checked by default.
   *
   * @param {boolean} [value=true] Whether the checkbox should be checked by default.
   * @returns {this} The current checkbox instance.
   *
   * @example
   * checkbox.setDefault(true);
   */
  setDefault(value = true) {
    if (typeof value !== "boolean") {
      throw new TypeError("Checkbox.setDefault(): 'value' must be a boolean.");
    }

    this.#checkbox.default = value;
    return this;
  }

  /**
   * Clears the default checked state.
   *
   * @returns {this} The current checkbox instance.
   *
   * @example
   * checkbox.clearDefault();
   */
  clearDefault() {
    delete this.#checkbox.default;
    return this;
  }

  /**
   * Returns the checkbox as a Discord-compatible JSON object.
   *
   * @returns {CheckboxData} The raw checkbox payload.
   *
   * @example
   * const payload = checkbox.toJSON();
   *
   * console.log(payload);
   * // {
   * //   type: 23,
   * //   custom_id: "tos:accept",
   * //   default: false
   * // }
   */
  toJSON() {
    return {
      ...this.#checkbox,
    };
  }

  /**
   * Creates a new checkbox instance from raw options.
   *
   * @param {CheckboxOptions} options Raw checkbox options.
   * @returns {Checkbox} A new checkbox instance.
   *
   * @example
   * const checkbox = Checkbox.from({
   *   custom_id: "rules:read",
   *   default: true,
   * });
   */
  static from(options) {
    return new Checkbox(options);
  }
}

module.exports = Checkbox;