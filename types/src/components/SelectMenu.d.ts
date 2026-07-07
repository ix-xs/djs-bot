export = SelectMenu;
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
declare class SelectMenu {
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
    static from(options: SelectMenuOptions): SelectMenu;
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
    constructor(options: SelectMenuOptions);
    /**
     * Returns the Discord component type id.
     *
     * @returns {3 | 5 | 6 | 7 | 8} The select menu type id.
     */
    getType(): 3 | 5 | 6 | 7 | 8;
    /**
     * Returns the select menu custom id.
     *
     * @returns {string} The custom id.
     */
    getCustomId(): string;
    /**
     * Returns the select menu options.
     *
     * @returns {SelectMenuOptionData[]|undefined} The select menu options.
     */
    getOptions(): SelectMenuOptionData[] | undefined;
    /**
     * Returns the placeholder.
     *
     * @returns {string|undefined} The placeholder text.
     */
    getPlaceholder(): string | undefined;
    /**
     * Returns whether the menu is disabled.
     *
     * @returns {boolean} `true` if disabled, otherwise `false`.
     */
    isDisabled(): boolean;
    /**
     * Sets the custom id.
     *
     * @param {string} customId New custom id.
     * @returns {this} The current select menu instance.
     */
    setCustomId(customId: string): this;
    /**
     * Sets the placeholder.
     *
     * @param {string} placeholder Placeholder text.
     * @returns {this} The current select menu instance.
     *
     * @example
     * select.setPlaceholder("Select a value");
     */
    setPlaceholder(placeholder: string): this;
    /**
     * Clears the placeholder.
     *
     * @returns {this} The current select menu instance.
     *
     * @example
     * select.clearPlaceholder();
     */
    clearPlaceholder(): this;
    /**
     * Sets the minimum selected values.
     *
     * @param {number} minValues Minimum selected values.
     * @returns {this} The current select menu instance.
     *
     * @example
     * select.setMinValues(1);
     */
    setMinValues(minValues: number): this;
    /**
     * Sets the maximum selected values.
     *
     * @param {number} maxValues Maximum selected values.
     * @returns {this} The current select menu instance.
     *
     * @example
     * select.setMaxValues(3);
     */
    setMaxValues(maxValues: number): this;
    /**
     * Sets the disabled state.
     *
     * @param {boolean} [disabled=true] Whether the menu is disabled.
     * @returns {this} The current select menu instance.
     *
     * @example
     * select.setDisabled(true);
     */
    setDisabled(disabled?: boolean): this;
    /**
     * Sets the required state.
     *
     * @param {boolean} [required=true] Whether the menu is required.
     * @returns {this} The current select menu instance.
     *
     * @example
     * select.setRequired(true);
     */
    setRequired(required?: boolean): this;
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
    setOptions(options: SelectMenuOptionInput[]): this;
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
    addOption(option: SelectMenuOptionInput): this;
    /**
     * Clears all string select options.
     *
     * @returns {this} The current select menu instance.
     *
     * @example
     * select.clearOptions();
     */
    clearOptions(): this;
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
    setDefaultValues(values: SelectMenuDefaultValueInput[]): this;
    /**
     * Clears default selected values.
     *
     * @returns {this} The current select menu instance.
     *
     * @example
     * select.clearDefaultValues();
     */
    clearDefaultValues(): this;
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
    setChannelTypes(channelTypes: SelectMenuChannelType[]): this;
    /**
     * Clears allowed channel types.
     *
     * @returns {this} The current select menu instance.
     *
     * @example
     * channelSelect.clearChannelTypes();
     */
    clearChannelTypes(): this;
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
    toJSON(): SelectMenuData;
    #private;
}
declare namespace SelectMenu {
    export { SelectMenuType, SelectMenuChannelType, SelectMenuDefaultValueType, SelectMenuOptionInput, SelectMenuDefaultValueInput, SelectMenuOptions, SelectMenuOptionData, SelectMenuDefaultValueData, SelectMenuData };
}
/**
 * Select menu kind supported by this wrapper.
 */
type SelectMenuType = "string" | "user" | "role" | "mentionable" | "channel";
/**
 * Channel type names accepted by this wrapper.
 */
type SelectMenuChannelType = ("GUILD_TEXT" | "DM" | "GUILD_VOICE" | "GROUP_DM" | "GUILD_CATEGORY" | "GUILD_ANNOUNCEMENT" | "ANNOUNCEMENT_THREAD" | "PUBLIC_THREAD" | "PRIVATE_THREAD" | "GUILD_STAGE_VOICE" | "GUILD_DIRECTORY" | "GUILD_FORUM" | "GUILD_MEDIA");
/**
 * Default value type names accepted by this wrapper.
 */
type SelectMenuDefaultValueType = "user" | "role" | "channel";
/**
 * String select option input.
 */
type SelectMenuOptionInput = {
    /**
     * Option label.
     */
    label: string;
    /**
     * Option value.
     */
    value: string;
    /**
     * Option description.
     */
    description?: string | undefined;
    /**
     * Option emoji.
     */
    emoji?: import("discord.js").EmojiResolvable | undefined;
    /**
     * Whether the option is selected by default.
     */
    default?: boolean | undefined;
};
/**
 * Default value input used by auto-populated select menus.
 */
type SelectMenuDefaultValueInput = {
    /**
     * Target snowflake id.
     */
    id: string;
    /**
     * Default value type.
     */
    type: SelectMenuDefaultValueType;
};
/**
 * Raw options used to create a {@link SelectMenu} instance.
 */
type SelectMenuOptions = {
    /**
     * Select menu type.
     */
    type: SelectMenuType;
    /**
     * Component custom id.
     */
    custom_id: string;
    /**
     * String select options.
     */
    options?: SelectMenuOptionInput[] | undefined;
    /**
     * Placeholder text.
     */
    placeholder?: string | undefined;
    /**
     * Minimum selected values.
     */
    min_values?: number | undefined;
    /**
     * Maximum selected values.
     */
    max_values?: number | undefined;
    /**
     * Whether the select is required.
     */
    required?: boolean | undefined;
    /**
     * Whether the select is disabled.
     */
    disabled?: boolean | undefined;
    /**
     * Default selected entities.
     */
    default_values?: SelectMenuDefaultValueInput[] | undefined;
    /**
     * Allowed channel types.
     */
    channel_types?: SelectMenuChannelType[] | undefined;
};
/**
 * Discord-compatible string select option.
 */
type SelectMenuOptionData = {
    /**
     * Option label.
     */
    label: string;
    /**
     * Option value.
     */
    value: string;
    /**
     * Option description.
     */
    description?: string | undefined;
    /**
     * Option emoji.
     */
    emoji?: import("discord.js").EmojiResolvable | undefined;
    /**
     * Whether the option is selected by default.
     */
    default?: boolean | undefined;
};
/**
 * Discord-compatible default value object.
 */
type SelectMenuDefaultValueData = {
    /**
     * Target snowflake id.
     */
    id: string;
    /**
     * Default value type.
     */
    type: "user" | "role" | "channel";
};
/**
 * Discord-compatible select menu payload.
 */
type SelectMenuData = {
    /**
     * Discord component type for select menus.
     */
    type: 3 | 5 | 6 | 7 | 8;
    /**
     * Component custom id.
     */
    custom_id: string;
    /**
     * String select options.
     */
    options?: SelectMenuOptionData[] | undefined;
    /**
     * Placeholder text.
     */
    placeholder?: string | undefined;
    /**
     * Minimum selected values.
     */
    min_values?: number | undefined;
    /**
     * Maximum selected values.
     */
    max_values?: number | undefined;
    /**
     * Whether the select is required.
     */
    required?: boolean | undefined;
    /**
     * Whether the select is disabled.
     */
    disabled?: boolean | undefined;
    /**
     * Default selected entities.
     */
    default_values?: SelectMenuDefaultValueData[] | undefined;
    /**
     * Allowed channel type ids.
     */
    channel_types?: number[] | undefined;
};
//# sourceMappingURL=SelectMenu.d.ts.map