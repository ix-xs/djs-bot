// @ts-check

/**
 * Select menu kind supported by this wrapper.
 *
 * @typedef {"string" | "user" | "role" | "mentionable" | "channel"} SelectMenuType
 */

/**
 * Channel type names accepted by this wrapper.
 *
 * @typedef {(
 *   "GUILD_TEXT" |
 *   "DM" |
 *   "GUILD_VOICE" |
 *   "GROUP_DM" |
 *   "GUILD_CATEGORY" |
 *   "GUILD_ANNOUNCEMENT" |
 *   "ANNOUNCEMENT_THREAD" |
 *   "PUBLIC_THREAD" |
 *   "PRIVATE_THREAD" |
 *   "GUILD_STAGE_VOICE" |
 *   "GUILD_DIRECTORY" |
 *   "GUILD_FORUM" |
 *   "GUILD_MEDIA"
 * )} SelectMenuChannelType
 */

/**
 * Default value type names accepted by this wrapper.
 *
 * @typedef {"user" | "role" | "channel"} SelectMenuDefaultValueType
 */

/**
 * String select option input.
 *
 * @typedef {Object} SelectMenuOptionInput
 * @property {string} label Option label.
 * @property {string} value Option value.
 * @property {string} [description] Option description.
 * @property {import("discord.js").EmojiResolvable} [emoji] Option emoji.
 * @property {boolean} [default] Whether the option is selected by default.
 */

/**
 * Default value input used by auto-populated select menus.
 *
 * @typedef {Object} SelectMenuDefaultValueInput
 * @property {string} id Target snowflake id.
 * @property {SelectMenuDefaultValueType} type Default value type.
 */

/**
 * Raw options used to create a {@link SelectMenu} instance.
 *
 * @typedef {Object} SelectMenuOptions
 * @property {SelectMenuType} type Select menu type.
 * @property {string} custom_id Component custom id.
 * @property {SelectMenuOptionInput[]} [options] String select options.
 * @property {string} [placeholder] Placeholder text.
 * @property {number} [min_values] Minimum selected values.
 * @property {number} [max_values] Maximum selected values.
 * @property {boolean} [required] Whether the select is required.
 * @property {boolean} [disabled] Whether the select is disabled.
 * @property {SelectMenuDefaultValueInput[]} [default_values] Default selected entities.
 * @property {SelectMenuChannelType[]} [channel_types] Allowed channel types.
 */

/**
 * Discord-compatible string select option.
 *
 * @typedef {Object} SelectMenuOptionData
 * @property {string} label Option label.
 * @property {string} value Option value.
 * @property {string} [description] Option description.
 * @property {import("discord.js").EmojiResolvable} [emoji] Option emoji.
 * @property {boolean} [default] Whether the option is selected by default.
 */

/**
 * Discord-compatible default value object.
 *
 * @typedef {Object} SelectMenuDefaultValueData
 * @property {string} id Target snowflake id.
 * @property {"user" | "role" | "channel"} type Default value type.
 */

/**
 * Discord-compatible select menu payload.
 *
 * @typedef {Object} SelectMenuData
 * @property {3 | 5 | 6 | 7 | 8} type Discord component type for select menus.
 * @property {string} custom_id Component custom id.
 * @property {SelectMenuOptionData[]} [options] String select options.
 * @property {string} [placeholder] Placeholder text.
 * @property {number} [min_values] Minimum selected values.
 * @property {number} [max_values] Maximum selected values.
 * @property {boolean} [required] Whether the select is required.
 * @property {boolean} [disabled] Whether the select is disabled.
 * @property {SelectMenuDefaultValueData[]} [default_values] Default selected entities.
 * @property {number[]} [channel_types] Allowed channel type ids.
 */

/**
 * Lightweight wrapper around a Discord-compatible select menu payload.
 *
 * Supports:
 * - string selects,
 * - user selects,
 * - role selects,
 * - mentionable selects,
 * - channel selects.
 *
 * @example
 * const select = new SelectMenu({
 *   type: "string",
 *   custom_id: "language:choose",
 *   placeholder: "Choose a language",
 *   options: [
 *     { label: "JavaScript", value: "js" },
 *     { label: "TypeScript", value: "ts", default: true },
 *   ],
 * });
 */
class SelectMenu {
  /**
   * Select menu payload in Discord-compatible format.
   *
   * @type {SelectMenuData}
   */
  #selectMenu;

  /**
   * Creates a new select menu.
   *
   * @param {SelectMenuOptions} options Select menu options.
   * @throws {TypeError} Throws if the provided select menu is invalid.
   *
   * @example
   * const select = new SelectMenu({
   *   type: "string",
   *   custom_id: "language:choose",
   *   placeholder: "Choose a language",
   *   options: [
   *     { label: "JavaScript", value: "js" },
   *     { label: "TypeScript", value: "ts", default: true },
   *   ],
   * });
   *
   * @example
   * const channelSelect = new SelectMenu({
   *   type: "channel",
   *   custom_id: "channel:choose",
   *   placeholder: "Choose a channel",
   *   channel_types: ["GUILD_TEXT", "GUILD_VOICE"],
   * });
   */
  constructor(options) {
    if (!options || typeof options !== "object" || Array.isArray(options)) {
      throw new TypeError("SelectMenu: 'options' must be an object.");
    }

    const {
      type,
      custom_id,
      options: rawOptions,
      placeholder,
      min_values,
      max_values,
      required,
      disabled,
      default_values,
      channel_types,
    } = options;

    const resolvedType = this.#resolveType(type);

    if (resolvedType === undefined) {
      throw new TypeError("SelectMenu: 'type' must be 'string', 'user', 'role', 'mentionable', or 'channel'.");
    }

    if (typeof custom_id !== "string" || custom_id.length === 0) {
      throw new TypeError("SelectMenu: 'custom_id' must be a non-empty string.");
    }

    if (custom_id.length > 100) {
      throw new TypeError("SelectMenu: 'custom_id' must not exceed 100 characters.");
    }

    if (placeholder !== undefined && (typeof placeholder !== "string" || placeholder.length > 150)) {
      throw new TypeError("SelectMenu: 'placeholder' must be a string with a maximum length of 150 characters.");
    }

    if (min_values !== undefined && (!Number.isInteger(min_values) || min_values < 0 || min_values > 25)) {
      throw new TypeError("SelectMenu: 'min_values' must be an integer between 0 and 25.");
    }

    if (max_values !== undefined && (!Number.isInteger(max_values) || max_values < 1 || max_values > 25)) {
      throw new TypeError("SelectMenu: 'max_values' must be an integer between 1 and 25.");
    }

    if (
      min_values !== undefined &&
      max_values !== undefined &&
      min_values > max_values
    ) {
      throw new TypeError("SelectMenu: 'min_values' cannot be greater than 'max_values'.");
    }

    if (required !== undefined && typeof required !== "boolean") {
      throw new TypeError("SelectMenu: 'required' must be a boolean when provided.");
    }

    if (disabled !== undefined && typeof disabled !== "boolean") {
      throw new TypeError("SelectMenu: 'disabled' must be a boolean when provided.");
    }

    /** @type {SelectMenuOptionData[]} */
    const normalizedOptions = resolvedType === 3
      ? this.#normalizeOptions(rawOptions ?? [])
      : [];

    /** @type {SelectMenuDefaultValueData[] | undefined} */
    const normalizedDefaultValues = resolvedType !== 3
      ? this.#normalizeDefaultValues(default_values ?? [])
      : undefined;

    /** @type {number[] | undefined} */
    const normalizedChannelTypes = resolvedType === 8
      ? this.#normalizeChannelTypes(channel_types ?? [])
      : undefined;

    if (resolvedType === 3 && normalizedOptions.length === 0) {
      throw new TypeError("SelectMenu: string select menus require at least one option.");
    }

    this.#selectMenu = {
      type: resolvedType,
      custom_id,
      options: resolvedType === 3 ? normalizedOptions : undefined,
      placeholder: placeholder ?? undefined,
      min_values: min_values ?? undefined,
      max_values: max_values ?? undefined,
      required: required ?? undefined,
      disabled: disabled ?? undefined,
      default_values: normalizedDefaultValues && normalizedDefaultValues.length > 0
        ? normalizedDefaultValues
        : undefined,
      channel_types: normalizedChannelTypes && normalizedChannelTypes.length > 0
        ? normalizedChannelTypes
        : undefined,
    };
  }

  /**
   * Resolves a wrapper select menu type to a Discord component type id.
   *
   * @param {SelectMenuType} type Wrapper type.
   * @returns {3 | 5 | 6 | 7 | 8 | undefined} Discord component type id.
   */
  #resolveType(type) {
    return type === "string"
      ? 3
      : type === "user"
        ? 5
        : type === "role"
          ? 6
          : type === "mentionable"
            ? 7
            : type === "channel"
              ? 8
              : undefined;
  }

  /**
   * Normalizes string select options.
   *
   * @param {SelectMenuOptionInput[]} options Raw options.
   * @returns {SelectMenuOptionData[]} Normalized options.
   * @throws {TypeError} Throws if options are invalid.
   */
  #normalizeOptions(options) {
    if (!Array.isArray(options)) {
      throw new TypeError("SelectMenu: 'options' must be an array.");
    }

    if (options.length > 25) {
      throw new TypeError("SelectMenu: 'options' cannot contain more than 25 entries.");
    }

    return options.map((option) => {
      if (!option || typeof option !== "object" || Array.isArray(option)) {
        throw new TypeError("SelectMenu: each option must be an object.");
      }

      if (typeof option.label !== "string" || option.label.length === 0) {
        throw new TypeError("SelectMenu: each option must have a non-empty 'label'.");
      }

      if (option.label.length > 100) {
        throw new TypeError("SelectMenu: each option label must not exceed 100 characters.");
      }

      if (typeof option.value !== "string" || option.value.length === 0) {
        throw new TypeError("SelectMenu: each option must have a non-empty 'value'.");
      }

      if (option.value.length > 100) {
        throw new TypeError("SelectMenu: each option value must not exceed 100 characters.");
      }

      if (
        option.description !== undefined &&
        (typeof option.description !== "string" || option.description.length > 100)
      ) {
        throw new TypeError("SelectMenu: each option description must be a string with a maximum length of 100 characters.");
      }

      if (option.default !== undefined && typeof option.default !== "boolean") {
        throw new TypeError("SelectMenu: each option default flag must be a boolean when provided.");
      }

      return {
        label: option.label,
        value: option.value,
        description: option.description ?? undefined,
        emoji: option.emoji ?? undefined,
        default: option.default ?? undefined,
      };
    });
  }

  /**
   * Normalizes default selected values.
   *
   * @param {SelectMenuDefaultValueInput[]} values Raw default values.
   * @returns {SelectMenuDefaultValueData[]} Normalized default values.
   * @throws {TypeError} Throws if values are invalid.
   */
  #normalizeDefaultValues(values) {
    if (!Array.isArray(values)) {
      throw new TypeError("SelectMenu: 'default_values' must be an array.");
    }

    if (values.length > 25) {
      throw new TypeError("SelectMenu: 'default_values' cannot contain more than 25 entries.");
    }

    return values.map((value) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new TypeError("SelectMenu: each default value must be an object.");
      }

      if (typeof value.id !== "string" || value.id.length === 0) {
        throw new TypeError("SelectMenu: each default value must have a non-empty 'id'.");
      }

      if (value.type !== "user" && value.type !== "role" && value.type !== "channel") {
        throw new TypeError("SelectMenu: each default value type must be 'user', 'role', or 'channel'.");
      }

      return {
        id: value.id,
        type: value.type,
      };
    });
  }

  /**
   * Normalizes allowed channel types.
   *
   * @param {SelectMenuChannelType[]} channelTypes Raw channel types.
   * @returns {number[]} Normalized channel type ids.
   * @throws {TypeError} Throws if channel types are invalid.
   */
  #normalizeChannelTypes(channelTypes) {
    if (!Array.isArray(channelTypes)) {
      throw new TypeError("SelectMenu: 'channel_types' must be an array.");
    }

    return channelTypes.map((type) => {
      const resolvedType = type === "GUILD_TEXT"
        ? 0
        : type === "DM"
          ? 1
          : type === "GUILD_VOICE"
            ? 2
            : type === "GROUP_DM"
              ? 3
              : type === "GUILD_CATEGORY"
                ? 4
                : type === "GUILD_ANNOUNCEMENT"
                  ? 5
                  : type === "ANNOUNCEMENT_THREAD"
                    ? 10
                    : type === "PUBLIC_THREAD"
                      ? 11
                      : type === "PRIVATE_THREAD"
                        ? 12
                        : type === "GUILD_STAGE_VOICE"
                          ? 13
                          : type === "GUILD_DIRECTORY"
                            ? 14
                            : type === "GUILD_FORUM"
                              ? 15
                              : type === "GUILD_MEDIA"
                                ? 16
                                : undefined;

      if (resolvedType === undefined) {
        throw new TypeError("SelectMenu: 'channel_types' contains an invalid channel type.");
      }

      return resolvedType;
    });
  }

  /**
   * Returns the Discord component type id.
   *
   * @returns {3 | 5 | 6 | 7 | 8} The select menu type id.
   */
  getType() {
    return this.#selectMenu.type;
  }

  /**
   * Returns the select menu custom id.
   *
   * @returns {string} The custom id.
   */
  getCustomId() {
    return this.#selectMenu.custom_id;
  }

  /**
   * Returns the select menu options.
   *
   * @returns {SelectMenuOptionData[]|undefined} The select menu options.
   */
  getOptions() {
    return this.#selectMenu.options?.map((option) => ({ ...option }));
  }

  /**
   * Returns the placeholder.
   *
   * @returns {string|undefined} The placeholder text.
   */
  getPlaceholder() {
    return this.#selectMenu.placeholder;
  }

  /**
   * Returns whether the menu is disabled.
   *
   * @returns {boolean} `true` if disabled, otherwise `false`.
   */
  isDisabled() {
    return Boolean(this.#selectMenu.disabled);
  }

  /**
   * Sets the custom id.
   *
   * @param {string} customId New custom id.
   * @returns {this} The current select menu instance.
   */
  setCustomId(customId) {
    if (typeof customId !== "string" || customId.length === 0 || customId.length > 100) {
      throw new TypeError("SelectMenu.setCustomId(): 'customId' must be a non-empty string with a maximum length of 100 characters.");
    }

    this.#selectMenu.custom_id = customId;
    return this;
  }

  /**
   * Sets the placeholder.
   *
   * @param {string} placeholder Placeholder text.
   * @returns {this} The current select menu instance.
   *
   * @example
   * select.setPlaceholder("Select a value");
   */
  setPlaceholder(placeholder) {
    if (typeof placeholder !== "string" || placeholder.length > 150) {
      throw new TypeError("SelectMenu.setPlaceholder(): 'placeholder' must be a string with a maximum length of 150 characters.");
    }

    this.#selectMenu.placeholder = placeholder;
    return this;
  }

  /**
   * Clears the placeholder.
   *
   * @returns {this} The current select menu instance.
   *
   * @example
   * select.clearPlaceholder();
   */
  clearPlaceholder() {
    delete this.#selectMenu.placeholder;
    return this;
  }

  /**
   * Sets the minimum selected values.
   *
   * @param {number} minValues Minimum selected values.
   * @returns {this} The current select menu instance.
   *
   * @example
   * select.setMinValues(1);
   */
  setMinValues(minValues) {
    if (!Number.isInteger(minValues) || minValues < 0 || minValues > 25) {
      throw new TypeError("SelectMenu.setMinValues(): 'minValues' must be an integer between 0 and 25.");
    }

    if (
      this.#selectMenu.max_values !== undefined &&
      minValues > this.#selectMenu.max_values
    ) {
      throw new TypeError("SelectMenu.setMinValues(): 'minValues' cannot be greater than 'max_values'.");
    }

    this.#selectMenu.min_values = minValues;
    return this;
  }

  /**
   * Sets the maximum selected values.
   *
   * @param {number} maxValues Maximum selected values.
   * @returns {this} The current select menu instance.
   *
   * @example
   * select.setMaxValues(3);
   */
  setMaxValues(maxValues) {
    if (!Number.isInteger(maxValues) || maxValues < 1 || maxValues > 25) {
      throw new TypeError("SelectMenu.setMaxValues(): 'maxValues' must be an integer between 1 and 25.");
    }

    if (
      this.#selectMenu.min_values !== undefined &&
      maxValues < this.#selectMenu.min_values
    ) {
      throw new TypeError("SelectMenu.setMaxValues(): 'maxValues' cannot be lower than 'min_values'.");
    }

    this.#selectMenu.max_values = maxValues;
    return this;
  }

  /**
   * Sets the disabled state.
   *
   * @param {boolean} [disabled=true] Whether the menu is disabled.
   * @returns {this} The current select menu instance.
   *
   * @example
   * select.setDisabled(true);
   */
  setDisabled(disabled = true) {
    if (typeof disabled !== "boolean") {
      throw new TypeError("SelectMenu.setDisabled(): 'disabled' must be a boolean.");
    }

    this.#selectMenu.disabled = disabled;
    return this;
  }

  /**
   * Sets the required state.
   *
   * @param {boolean} [required=true] Whether the menu is required.
   * @returns {this} The current select menu instance.
   *
   * @example
   * select.setRequired(true);
   */
  setRequired(required = true) {
    if (typeof required !== "boolean") {
      throw new TypeError("SelectMenu.setRequired(): 'required' must be a boolean.");
    }

    this.#selectMenu.required = required;
    return this;
  }

  /**
   * Replaces string select options.
   *
   * @param {SelectMenuOptionInput[]} options New options.
   * @returns {this} The current select menu instance.
   *
   * @example
   * select.setOptions([
   *   { label: "Python", value: "py" },
   *   { label: "Rust", value: "rs", default: true },
   * ]);
   */
  setOptions(options) {
    if (this.#selectMenu.type !== 3) {
      throw new TypeError("SelectMenu.setOptions(): options are only available for string select menus.");
    }

    const normalizedOptions = this.#normalizeOptions(options);

    if (normalizedOptions.length === 0) {
      throw new TypeError("SelectMenu.setOptions(): string select menus require at least one option.");
    }

    this.#selectMenu.options = normalizedOptions;
    return this;
  }

  /**
   * Adds a single string select option.
   *
   * @param {SelectMenuOptionInput} option Option to add.
   * @returns {this} The current select menu instance.
   *
   * @example
   * select.addOption({
   *   label: "Go",
   *   value: "go",
   *   description: "Compiled language",
   * });
   */
  addOption(option) {
    if (this.#selectMenu.type !== 3) {
      throw new TypeError("SelectMenu.addOption(): options are only available for string select menus.");
    }

    const currentOptions = this.#selectMenu.options ?? [];
    const nextOptions = this.#normalizeOptions([...currentOptions, option]);

    if (nextOptions.length > 25) {
      throw new TypeError("SelectMenu.addOption(): a string select menu cannot contain more than 25 options.");
    }

    this.#selectMenu.options = nextOptions;
    return this;
  }

  /**
   * Clears all string select options.
   *
   * @returns {this} The current select menu instance.
   *
   * @example
   * select.clearOptions();
   */
  clearOptions() {
    if (this.#selectMenu.type !== 3) {
      throw new TypeError("SelectMenu.clearOptions(): options are only available for string select menus.");
    }

    this.#selectMenu.options = [];
    return this;
  }

  /**
   * Replaces default selected values.
   *
   * @param {SelectMenuDefaultValueInput[]} values New default values.
   * @returns {this} The current select menu instance.
   *
   * @example
   * const userSelect = new SelectMenu({
   *   type: "user",
   *   custom_id: "assignee",
   * });
   *
   * userSelect.setDefaultValues([
   *   { id: "123456789012345678", type: "user" },
   * ]);
   */
  setDefaultValues(values) {
    if (this.#selectMenu.type === 3) {
      throw new TypeError("SelectMenu.setDefaultValues(): default values are not available for string select menus.");
    }

    this.#selectMenu.default_values = this.#normalizeDefaultValues(values);
    return this;
  }

  /**
   * Clears default selected values.
   *
   * @returns {this} The current select menu instance.
   *
   * @example
   * select.clearDefaultValues();
   */
  clearDefaultValues() {
    delete this.#selectMenu.default_values;
    return this;
  }

  /**
   * Replaces allowed channel types.
   *
   * @param {SelectMenuChannelType[]} channelTypes Allowed channel types.
   * @returns {this} The current select menu instance.
   *
   * @example
   * channelSelect.setChannelTypes([
   *   "GUILD_TEXT",
   *   "GUILD_FORUM",
   * ]);
   */
  setChannelTypes(channelTypes) {
    if (this.#selectMenu.type !== 8) {
      throw new TypeError("SelectMenu.setChannelTypes(): channel types are only available for channel select menus.");
    }

    this.#selectMenu.channel_types = this.#normalizeChannelTypes(channelTypes);
    return this;
  }

  /**
   * Clears allowed channel types.
   *
   * @returns {this} The current select menu instance.
   *
   * @example
   * channelSelect.clearChannelTypes();
   */
  clearChannelTypes() {
    delete this.#selectMenu.channel_types;
    return this;
  }

  /**
   * Returns the select menu as a Discord-compatible JSON object.
   *
   * @returns {SelectMenuData} The raw select menu payload.
   *
   * @example
   * const payload = select.toJSON();
   *
   * console.log(payload);
   * // {
   * //   type: 3,
   * //   custom_id: "language:choose",
   * //   placeholder: "Choose a language",
   * //   options: [
   * //     { label: "JavaScript", value: "js" },
   * //     { label: "TypeScript", value: "ts", default: true }
   * //   ]
   * // }
   */
  toJSON() {
    return {
      ...this.#selectMenu,
      options: this.#selectMenu.options?.map((option) => ({ ...option })),
      default_values: this.#selectMenu.default_values?.map((value) => ({ ...value })),
      channel_types: this.#selectMenu.channel_types ? [...this.#selectMenu.channel_types] : undefined,
    };
  }

  /**
   * Creates a new select menu instance from raw options.
   *
   * @param {SelectMenuOptions} options Raw select menu options.
   * @returns {SelectMenu} A new select menu instance.
   *
   * @example
   * const select = SelectMenu.from({
   *   type: "role",
   *   custom_id: "role:assign",
   *   placeholder: "Choose a role",
   *   default_values: [
   *     { id: "123456789012345678", type: "role" },
   *   ],
   * });
   */
  static from(options) {
    return new SelectMenu(options);
  }
}

module.exports = SelectMenu;