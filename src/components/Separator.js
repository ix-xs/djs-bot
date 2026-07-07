// @ts-check

/**
 * Raw options used to create a {@link Separator} instance.
 *
 * @typedef {Object} SeparatorOptions
 * @property {boolean} [divider=true] Whether a visible divider should be displayed.
 * @property {1 | 2} [space=1] Separator spacing size.
 */

/**
 * Discord-compatible separator payload.
 *
 * @typedef {Object} SeparatorData
 * @property {14} type Discord component type for a separator.
 * @property {boolean} [divider] Whether a visible divider should be displayed.
 * @property {1 | 2} [spacing] Separator spacing size.
 */

/**
 * Lightweight wrapper around a Discord-compatible separator payload.
 *
 * @example
 * const separator = new Separator();
 *
 * @example
 * const largeSeparator = new Separator({
 *   divider: false,
 *   space: 2,
 * });
 */
class Separator {
  /**
   * Separator payload in Discord-compatible format.
   *
   * @type {SeparatorData}
   */
  #separator;

  /**
   * Creates a new separator.
   *
   * @param {SeparatorOptions} [options={}] Separator options.
   * @throws {TypeError} Throws if the provided separator options are invalid.
   *
   * @example
   * const separator = new Separator();
   *
   * @example
   * const largeSeparator = new Separator({
   *   divider: false,
   *   space: 2,
   * });
   */
  constructor(options = {}) {
    if (!options || typeof options !== "object" || Array.isArray(options)) {
      throw new TypeError("Separator: 'options' must be an object.");
    }

    const {
      divider = true,
      space = 1,
    } = options;

    if (typeof divider !== "boolean") {
      throw new TypeError("Separator: 'divider' must be a boolean.");
    }

    if (space !== 1 && space !== 2) {
      throw new TypeError("Separator: 'space' must be 1 or 2.");
    }

    this.#separator = {
      type: 14,
      divider,
      spacing: space,
    };
  }

  /**
   * Returns whether the separator shows a visual divider.
   *
   * @returns {boolean} `true` if the divider is visible, otherwise `false`.
   */
  hasDivider() {
    return this.#separator.divider ?? true;
  }

  /**
   * Returns the separator spacing size.
   *
   * @returns {1 | 2} The spacing size.
   */
  getSpace() {
    return this.#separator.spacing ?? 1;
  }

  /**
   * Sets whether the separator shows a visual divider.
   *
   * @param {boolean} [divider=true] Whether the divider is visible.
   * @returns {this} The current separator instance.
   *
   * @example
   * separator.setDivider(false);
   */
  setDivider(divider = true) {
    if (typeof divider !== "boolean") {
      throw new TypeError("Separator.setDivider(): 'divider' must be a boolean.");
    }

    this.#separator.divider = divider;
    return this;
  }

  /**
   * Sets the separator spacing size.
   *
   * @param {1 | 2} space Separator spacing size.
   * @returns {this} The current separator instance.
   *
   * @example
   * separator.setSpace(2);
   */
  setSpace(space) {
    if (space !== 1 && space !== 2) {
      throw new TypeError("Separator.setSpace(): 'space' must be 1 or 2.");
    }

    this.#separator.spacing = space;
    return this;
  }

  /**
   * Returns the separator as a Discord-compatible JSON object.
   *
   * @returns {SeparatorData} The raw separator payload.
   *
   * @example
   * const payload = separator.toJSON();
   *
   * console.log(payload);
   * // {
   * //   type: 14,
   * //   divider: true,
   * //   spacing: 1
   * // }
   */
  toJSON() {
    return {
      ...this.#separator,
    };
  }

  /**
   * Creates a new separator instance from raw options.
   *
   * @param {SeparatorOptions} [options={}] Raw separator options.
   * @returns {Separator} A new separator instance.
   *
   * @example
   * const separator = Separator.from({
   *   divider: true,
   *   space: 2,
   * });
   */
  static from(options = {}) {
    return new Separator(options);
  }
}

module.exports = Separator;