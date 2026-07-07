// @ts-check

/**
 * A single radio group option.
 *
 * @typedef {Object} RadioGroupOptionInput
 * @property {string} label Option label.
 * @property {string} value Option value.
 * @property {string} [description] Option description.
 * @property {boolean} [default] Whether the option is selected by default.
 */

/**
 * Raw options used to create a {@link RadioGroup} instance.
 *
 * @typedef {Object} RadioGroupOptions
 * @property {string} custom_id Component custom id.
 * @property {RadioGroupOptionInput[]} options Radio group options.
 * @property {boolean} [required] Whether this component is required.
 */

/**
 * Discord-compatible radio group option.
 *
 * @typedef {Object} RadioGroupOptionData
 * @property {string} label Option label.
 * @property {string} value Option value.
 * @property {string} [description] Option description.
 * @property {boolean} [default] Whether the option is selected by default.
 */

/**
 * Discord-compatible radio group payload.
 *
 * @typedef {Object} RadioGroupData
 * @property {21} type Discord component type for a radio group.
 * @property {string} custom_id Component custom id.
 * @property {RadioGroupOptionData[]} options Radio group options.
 * @property {boolean} [required] Whether this component is required.
 */

/**
 * Lightweight wrapper around a Discord-compatible radio group payload.
 *
 * @example
 * const radioGroup = new RadioGroup({
 *   custom_id: "theme",
 *   options: [
 *     { label: "Light", value: "light" },
 *     { label: "Dark", value: "dark", default: true },
 *   ],
 *   required: true,
 * });
 */
class RadioGroup {
  /**
   * Radio group payload in Discord-compatible format.
   *
   * @type {RadioGroupData}
   */
  #radioGroup;

  /**
   * Creates a new radio group.
   *
   * @param {RadioGroupOptions} options Radio group options.
   * @throws {TypeError} Throws if the provided radio group options are invalid.
   *
   * @example
   * const radioGroup = new RadioGroup({
   *   custom_id: "theme",
   *   options: [
   *     { label: "Light", value: "light" },
   *     { label: "Dark", value: "dark", default: true },
   *   ],
   *   required: true,
   * });
   */
  constructor(options) {
    if (!options || typeof options !== "object" || Array.isArray(options)) {
      throw new TypeError("RadioGroup: 'options' must be an object.");
    }

    const {
      custom_id,
      options: rawOptions,
      required,
    } = options;

    if (typeof custom_id !== "string" || custom_id.length === 0) {
      throw new TypeError("RadioGroup: 'custom_id' must be a non-empty string.");
    }

    if (custom_id.length > 100) {
      throw new TypeError("RadioGroup: 'custom_id' must not exceed 100 characters.");
    }

    const normalizedOptions = this.#normalizeOptions(rawOptions);

    if (normalizedOptions.length === 0) {
      throw new TypeError("RadioGroup: 'options' must contain at least one option.");
    }

    if (required !== undefined && typeof required !== "boolean") {
      throw new TypeError("RadioGroup: 'required' must be a boolean when provided.");
    }

    this.#radioGroup = {
      type: 21,
      custom_id,
      options: normalizedOptions,
      required: required ?? undefined,
    };
  }

  /**
   * Normalizes radio group options.
   *
   * @param {RadioGroupOptionInput[]} options Raw options.
   * @returns {RadioGroupOptionData[]} Normalized options.
   * @throws {TypeError} Throws if options are invalid.
   */
  #normalizeOptions(options) {
    if (!Array.isArray(options)) {
      throw new TypeError("RadioGroup: 'options' must be an array.");
    }

    if (options.length > 10) {
      throw new TypeError("RadioGroup: 'options' cannot contain more than 10 entries.");
    }

    let defaultCount = 0;

    const normalizedOptions = options.map((option) => {
      if (!option || typeof option !== "object" || Array.isArray(option)) {
        throw new TypeError("RadioGroup: each option must be an object.");
      }

      if (typeof option.label !== "string" || option.label.length === 0) {
        throw new TypeError("RadioGroup: each option must have a non-empty 'label'.");
      }

      if (option.label.length > 45) {
        throw new TypeError("RadioGroup: each option label must not exceed 45 characters.");
      }

      if (typeof option.value !== "string" || option.value.length === 0) {
        throw new TypeError("RadioGroup: each option must have a non-empty 'value'.");
      }

      if (option.value.length > 100) {
        throw new TypeError("RadioGroup: each option value must not exceed 100 characters.");
      }

      if (
        option.description !== undefined &&
        (typeof option.description !== "string" || option.description.length > 100)
      ) {
        throw new TypeError("RadioGroup: each option description must be a string with a maximum length of 100 characters.");
      }

      if (option.default !== undefined && typeof option.default !== "boolean") {
        throw new TypeError("RadioGroup: each option default flag must be a boolean when provided.");
      }

      if (option.default === true) {
        defaultCount += 1;
      }

      return {
        label: option.label,
        value: option.value,
        description: option.description ?? undefined,
        default: option.default ?? undefined,
      };
    });

    if (defaultCount > 1) {
      throw new TypeError("RadioGroup: only one option can be selected by default.");
    }

    return normalizedOptions;
  }

  /**
   * Returns the radio group custom id.
   *
   * @returns {string} The custom id.
   */
  getCustomId() {
    return this.#radioGroup.custom_id;
  }

  /**
   * Returns the radio group options.
   *
   * @returns {RadioGroupOptionData[]} The radio group options.
   */
  getOptions() {
    return this.#radioGroup.options.map((option) => ({ ...option }));
  }

  /**
   * Returns whether the radio group is required.
   *
   * @returns {boolean} `true` if required, otherwise `false`.
   */
  isRequired() {
    return Boolean(this.#radioGroup.required);
  }

  /**
   * Sets the radio group custom id.
   *
   * @param {string} customId New custom id.
   * @returns {this} The current radio group instance.
   */
  setCustomId(customId) {
    if (typeof customId !== "string" || customId.length === 0) {
      throw new TypeError("RadioGroup.setCustomId(): 'customId' must be a non-empty string.");
    }

    if (customId.length > 100) {
      throw new TypeError("RadioGroup.setCustomId(): 'customId' must not exceed 100 characters.");
    }

    this.#radioGroup.custom_id = customId;
    return this;
  }

  /**
   * Replaces all radio group options.
   *
   * @param {RadioGroupOptionInput[]} options New options.
   * @returns {this} The current radio group instance.
   *
   * @example
   * radioGroup.setOptions([
   *   { label: "Blue", value: "blue" },
   *   { label: "Green", value: "green", default: true },
   *   { label: "Red", value: "red" },
   * ]);
   */
  setOptions(options) {
    const normalizedOptions = this.#normalizeOptions(options);

    if (normalizedOptions.length === 0) {
      throw new TypeError("RadioGroup.setOptions(): the radio group must contain at least one option.");
    }

    this.#radioGroup.options = normalizedOptions;
    return this;
  }

  /**
   * Adds one radio group option.
   *
   * @param {RadioGroupOptionInput} option Option to add.
   * @returns {this} The current radio group instance.
   *
   * @example
   * radioGroup.addOption({
   *   label: "System",
   *   value: "system",
   *   description: "Use the system theme",
   * });
   */
  addOption(option) {
    const nextOptions = this.#normalizeOptions([
      ...this.#radioGroup.options.map((radioOption) => ({
        label: radioOption.label,
        value: radioOption.value,
        description: radioOption.description,
        default: radioOption.default,
      })),
      option,
    ]);

    this.#radioGroup.options = nextOptions;
    return this;
  }

  /**
   * Sets whether the radio group is required.
   *
   * @param {boolean} [required=true] Whether the radio group is required.
   * @returns {this} The current radio group instance.
   *
   * @example
   * radioGroup.setRequired(true);
   */
  setRequired(required = true) {
    if (typeof required !== "boolean") {
      throw new TypeError("RadioGroup.setRequired(): 'required' must be a boolean.");
    }

    this.#radioGroup.required = required;
    return this;
  }

  /**
   * Returns the radio group as a Discord-compatible JSON object.
   *
   * @returns {RadioGroupData} The raw radio group payload.
   *
   * @example
   * const payload = radioGroup.toJSON();
   *
   * console.log(payload);
   * // {
   * //   type: 21,
   * //   custom_id: "theme",
   * //   options: [
   * //     { label: "Light", value: "light" },
   * //     { label: "Dark", value: "dark", default: true }
   * //   ],
   * //   required: true
   * // }
   */
  toJSON() {
    return {
      ...this.#radioGroup,
      options: this.#radioGroup.options.map((option) => ({ ...option })),
    };
  }

  /**
   * Creates a new radio group instance from raw options.
   *
   * @param {RadioGroupOptions} options Raw radio group options.
   * @returns {RadioGroup} A new radio group instance.
   *
   * @example
   * const radioGroup = RadioGroup.from({
   *   custom_id: "notifications",
   *   options: [
   *     { label: "All", value: "all" },
   *     { label: "Mentions only", value: "mentions", default: true },
   *   ],
   * });
   */
  static from(options) {
    return new RadioGroup(options);
  }
}

module.exports = RadioGroup;