// @ts-check

/**
 * A single checkbox group option.
 *
 * @typedef {Object} CheckboxGroupOptionInput
 * @property {string} label Option label.
 * @property {string} value Option value.
 * @property {string} [description] Option description.
 * @property {boolean} [default] Whether the option is selected by default.
 */

/**
 * Raw options used to create a {@link CheckboxGroup} instance.
 *
 * @typedef {Object} CheckboxGroupOptions
 * @property {string} custom_id Component custom id.
 * @property {CheckboxGroupOptionInput[]} options Checkbox group options.
 * @property {number} [min_values] Minimum number of selected options.
 * @property {number} [max_values] Maximum number of selected options.
 * @property {boolean} [required] Whether this component is required.
 */

/**
 * Discord-compatible checkbox group option.
 *
 * @typedef {Object} CheckboxGroupOptionData
 * @property {string} label Option label.
 * @property {string} value Option value.
 * @property {string} [description] Option description.
 * @property {boolean} [default] Whether the option is selected by default.
 */

/**
 * Discord-compatible checkbox group payload.
 *
 * @typedef {Object} CheckboxGroupData
 * @property {22} type Discord component type for a checkbox group.
 * @property {string} custom_id Component custom id.
 * @property {CheckboxGroupOptionData[]} options Checkbox group options.
 * @property {number} [min_values] Minimum number of selected options.
 * @property {number} [max_values] Maximum number of selected options.
 * @property {boolean} [required] Whether this component is required.
 */

/**
 * Lightweight wrapper around a Discord-compatible checkbox group payload.
 *
 * @example
 * const checkboxGroup = new CheckboxGroup({
 *   custom_id: "roles:select",
 *   options: [
 *     { label: "JavaScript", value: "js" },
 *     { label: "TypeScript", value: "ts", default: true },
 *   ],
 *   min_values: 1,
 *   max_values: 2,
 *   required: true,
 * });
 */
class CheckboxGroup {
  /**
   * Checkbox group payload in Discord-compatible format.
   *
   * @type {CheckboxGroupData}
   */
  #checkboxGroup;

  /**
   * Creates a new checkbox group.
   *
   * @param {CheckboxGroupOptions} options Checkbox group options.
   * @throws {TypeError} Throws if the provided checkbox group options are invalid.
   *
   * @example
   * const checkboxGroup = new CheckboxGroup({
   *   custom_id: "roles:select",
   *   options: [
   *     { label: "JavaScript", value: "js" },
   *     { label: "TypeScript", value: "ts", default: true },
   *     { label: "Rust", value: "rust" },
   *   ],
   *   min_values: 1,
   *   max_values: 2,
   *   required: true,
   * });
   */
  constructor(options) {
    if (!options || typeof options !== "object" || Array.isArray(options)) {
      throw new TypeError("CheckboxGroup: 'options' must be an object.");
    }

    const {
      custom_id,
      options: rawOptions,
      min_values,
      max_values,
      required,
    } = options;

    if (typeof custom_id !== "string" || custom_id.length === 0) {
      throw new TypeError("CheckboxGroup: 'custom_id' must be a non-empty string.");
    }

    if (custom_id.length > 100) {
      throw new TypeError("CheckboxGroup: 'custom_id' must not exceed 100 characters.");
    }

    const normalizedOptions = this.#normalizeOptions(rawOptions);

    if (normalizedOptions.length === 0) {
      throw new TypeError("CheckboxGroup: 'options' must contain at least one option.");
    }

    if (min_values !== undefined && (!Number.isInteger(min_values) || min_values < 0 || min_values > 10)) {
      throw new TypeError("CheckboxGroup: 'min_values' must be an integer between 0 and 10.");
    }

    if (max_values !== undefined && (!Number.isInteger(max_values) || max_values < 1 || max_values > 10)) {
      throw new TypeError("CheckboxGroup: 'max_values' must be an integer between 1 and 10.");
    }

    if (
      min_values !== undefined &&
      max_values !== undefined &&
      min_values > max_values
    ) {
      throw new TypeError("CheckboxGroup: 'min_values' cannot be greater than 'max_values'.");
    }

    if (max_values !== undefined && max_values > normalizedOptions.length) {
      throw new TypeError("CheckboxGroup: 'max_values' cannot exceed the number of available options.");
    }

    if (required !== undefined && typeof required !== "boolean") {
      throw new TypeError("CheckboxGroup: 'required' must be a boolean when provided.");
    }

    this.#checkboxGroup = {
      type: 22,
      custom_id,
      options: normalizedOptions,
      min_values: min_values ?? undefined,
      max_values: max_values ?? undefined,
      required: required ?? undefined,
    };
  }

  /**
   * Normalizes checkbox group options.
   *
   * @param {CheckboxGroupOptionInput[]} options Raw options.
   * @returns {CheckboxGroupOptionData[]} Normalized options.
   * @throws {TypeError} Throws if options are invalid.
   */
  #normalizeOptions(options) {
    if (!Array.isArray(options)) {
      throw new TypeError("CheckboxGroup: 'options' must be an array.");
    }

    if (options.length > 10) {
      throw new TypeError("CheckboxGroup: 'options' cannot contain more than 10 entries.");
    }

    return options.map((option) => {
      if (!option || typeof option !== "object" || Array.isArray(option)) {
        throw new TypeError("CheckboxGroup: each option must be an object.");
      }

      if (typeof option.label !== "string" || option.label.length === 0) {
        throw new TypeError("CheckboxGroup: each option must have a non-empty 'label'.");
      }

      if (option.label.length > 45) {
        throw new TypeError("CheckboxGroup: each option label must not exceed 45 characters.");
      }

      if (typeof option.value !== "string" || option.value.length === 0) {
        throw new TypeError("CheckboxGroup: each option must have a non-empty 'value'.");
      }

      if (option.value.length > 100) {
        throw new TypeError("CheckboxGroup: each option value must not exceed 100 characters.");
      }

      if (
        option.description !== undefined &&
        (typeof option.description !== "string" || option.description.length > 100)
      ) {
        throw new TypeError("CheckboxGroup: each option description must be a string with a maximum length of 100 characters.");
      }

      if (option.default !== undefined && typeof option.default !== "boolean") {
        throw new TypeError("CheckboxGroup: each option default flag must be a boolean when provided.");
      }

      return {
        label: option.label,
        value: option.value,
        description: option.description ?? undefined,
        default: option.default ?? undefined,
      };
    });
  }

  /**
   * Returns the checkbox group custom id.
   *
   * @returns {string} The custom id.
   */
  getCustomId() {
    return this.#checkboxGroup.custom_id;
  }

  /**
   * Returns the checkbox group options.
   *
   * @returns {CheckboxGroupOptionData[]} The checkbox group options.
   */
  getOptions() {
    return this.#checkboxGroup.options.map((option) => ({ ...option }));
  }

  /**
   * Returns the minimum number of selected options.
   *
   * @returns {number|undefined} The minimum selected value count.
   */
  getMinValues() {
    return this.#checkboxGroup.min_values;
  }

  /**
   * Returns the maximum number of selected options.
   *
   * @returns {number|undefined} The maximum selected value count.
   */
  getMaxValues() {
    return this.#checkboxGroup.max_values;
  }

  /**
   * Returns whether the checkbox group is required.
   *
   * @returns {boolean} `true` if required, otherwise `false`.
   */
  isRequired() {
    return Boolean(this.#checkboxGroup.required);
  }

  /**
   * Sets the checkbox group custom id.
   *
   * @param {string} customId New custom id.
   * @returns {this} The current checkbox group instance.
   */
  setCustomId(customId) {
    if (typeof customId !== "string" || customId.length === 0) {
      throw new TypeError("CheckboxGroup.setCustomId(): 'customId' must be a non-empty string.");
    }

    if (customId.length > 100) {
      throw new TypeError("CheckboxGroup.setCustomId(): 'customId' must not exceed 100 characters.");
    }

    this.#checkboxGroup.custom_id = customId;
    return this;
  }

  /**
   * Replaces all checkbox group options.
   *
   * @param {CheckboxGroupOptionInput[]} options New options.
   * @returns {this} The current checkbox group instance.
   *
   * @example
   * checkboxGroup.setOptions([
   *   { label: "Frontend", value: "frontend" },
   *   { label: "Backend", value: "backend", default: true },
   *   { label: "DevOps", value: "devops" },
   * ]);
   */
  setOptions(options) {
    const normalizedOptions = this.#normalizeOptions(options);

    if (normalizedOptions.length === 0) {
      throw new TypeError("CheckboxGroup.setOptions(): the checkbox group must contain at least one option.");
    }

    if (
      this.#checkboxGroup.max_values !== undefined &&
      this.#checkboxGroup.max_values > normalizedOptions.length
    ) {
      throw new TypeError("CheckboxGroup.setOptions(): the current 'max_values' cannot exceed the number of available options.");
    }

    this.#checkboxGroup.options = normalizedOptions;
    return this;
  }

  /**
   * Adds one checkbox group option.
   *
   * @param {CheckboxGroupOptionInput} option Option to add.
   * @returns {this} The current checkbox group instance.
   *
   * @example
   * checkboxGroup.addOption({
   *   label: "Go",
   *   value: "go",
   *   description: "Add Go to the selectable roles",
   * });
   */
  addOption(option) {
    const nextOptions = this.#normalizeOptions([...this.#checkboxGroup.options, option]);
    this.#checkboxGroup.options = nextOptions;
    return this;
  }

  /**
   * Sets the minimum number of selected options.
   *
   * @param {number} minValues Minimum selected values.
   * @returns {this} The current checkbox group instance.
   *
   * @example
   * checkboxGroup.setMinValues(1);
   */
  setMinValues(minValues) {
    if (!Number.isInteger(minValues) || minValues < 0 || minValues > 10) {
      throw new TypeError("CheckboxGroup.setMinValues(): 'minValues' must be an integer between 0 and 10.");
    }

    if (
      this.#checkboxGroup.max_values !== undefined &&
      minValues > this.#checkboxGroup.max_values
    ) {
      throw new TypeError("CheckboxGroup.setMinValues(): 'minValues' cannot be greater than 'max_values'.");
    }

    this.#checkboxGroup.min_values = minValues;
    return this;
  }

  /**
   * Sets the maximum number of selected options.
   *
   * @param {number} maxValues Maximum selected values.
   * @returns {this} The current checkbox group instance.
   *
   * @example
   * checkboxGroup.setMaxValues(3);
   */
  setMaxValues(maxValues) {
    if (!Number.isInteger(maxValues) || maxValues < 1 || maxValues > 10) {
      throw new TypeError("CheckboxGroup.setMaxValues(): 'maxValues' must be an integer between 1 and 10.");
    }

    if (maxValues > this.#checkboxGroup.options.length) {
      throw new TypeError("CheckboxGroup.setMaxValues(): 'maxValues' cannot exceed the number of available options.");
    }

    if (
      this.#checkboxGroup.min_values !== undefined &&
      maxValues < this.#checkboxGroup.min_values
    ) {
      throw new TypeError("CheckboxGroup.setMaxValues(): 'maxValues' cannot be lower than 'min_values'.");
    }

    this.#checkboxGroup.max_values = maxValues;
    return this;
  }

  /**
   * Sets whether the checkbox group is required.
   *
   * @param {boolean} [required=true] Whether the checkbox group is required.
   * @returns {this} The current checkbox group instance.
   *
   * @example
   * checkboxGroup.setRequired(true);
   */
  setRequired(required = true) {
    if (typeof required !== "boolean") {
      throw new TypeError("CheckboxGroup.setRequired(): 'required' must be a boolean.");
    }

    this.#checkboxGroup.required = required;
    return this;
  }

  /**
   * Returns the checkbox group as a Discord-compatible JSON object.
   *
   * @returns {CheckboxGroupData} The raw checkbox group payload.
   *
   * @example
   * const payload = checkboxGroup.toJSON();
   *
   * console.log(payload);
   * // {
   * //   type: 22,
   * //   custom_id: "roles:select",
   * //   options: [
   * //     { label: "JavaScript", value: "js" },
   * //     { label: "TypeScript", value: "ts", default: true }
   * //   ],
   * //   min_values: 1,
   * //   max_values: 2,
   * //   required: true
   * // }
   */
  toJSON() {
    return {
      ...this.#checkboxGroup,
      options: this.#checkboxGroup.options.map((option) => ({ ...option })),
    };
  }

  /**
   * Creates a new checkbox group instance from raw options.
   *
   * @param {CheckboxGroupOptions} options Raw checkbox group options.
   * @returns {CheckboxGroup} A new checkbox group instance.
   *
   * @example
   * const checkboxGroup = CheckboxGroup.from({
   *   custom_id: "interests:select",
   *   options: [
   *     { label: "Music", value: "music" },
   *     { label: "Gaming", value: "gaming" },
   *   ],
   *   max_values: 2,
   * });
   */
  static from(options) {
    return new CheckboxGroup(options);
  }
}

module.exports = CheckboxGroup;