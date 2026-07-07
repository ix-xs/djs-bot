export = RadioGroup;
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
declare class RadioGroup {
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
    static from(options: RadioGroupOptions): RadioGroup;
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
    constructor(options: RadioGroupOptions);
    /**
     * Returns the radio group custom id.
     *
     * @returns {string} The custom id.
     */
    getCustomId(): string;
    /**
     * Returns the radio group options.
     *
     * @returns {RadioGroupOptionData[]} The radio group options.
     */
    getOptions(): RadioGroupOptionData[];
    /**
     * Returns whether the radio group is required.
     *
     * @returns {boolean} `true` if required, otherwise `false`.
     */
    isRequired(): boolean;
    /**
     * Sets the radio group custom id.
     *
     * @param {string} customId New custom id.
     * @returns {this} The current radio group instance.
     */
    setCustomId(customId: string): this;
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
    setOptions(options: RadioGroupOptionInput[]): this;
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
    addOption(option: RadioGroupOptionInput): this;
    /**
     * Sets whether the radio group is required.
     *
     * @param {boolean} [required=true] Whether the radio group is required.
     * @returns {this} The current radio group instance.
     *
     * @example
     * radioGroup.setRequired(true);
     */
    setRequired(required?: boolean): this;
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
    toJSON(): RadioGroupData;
    #private;
}
declare namespace RadioGroup {
    export { RadioGroupOptionInput, RadioGroupOptions, RadioGroupOptionData, RadioGroupData };
}
/**
 * A single radio group option.
 */
type RadioGroupOptionInput = {
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
     * Whether the option is selected by default.
     */
    default?: boolean | undefined;
};
/**
 * Raw options used to create a {@link RadioGroup} instance.
 */
type RadioGroupOptions = {
    /**
     * Component custom id.
     */
    custom_id: string;
    /**
     * Radio group options.
     */
    options: RadioGroupOptionInput[];
    /**
     * Whether this component is required.
     */
    required?: boolean | undefined;
};
/**
 * Discord-compatible radio group option.
 */
type RadioGroupOptionData = {
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
     * Whether the option is selected by default.
     */
    default?: boolean | undefined;
};
/**
 * Discord-compatible radio group payload.
 */
type RadioGroupData = {
    /**
     * Discord component type for a radio group.
     */
    type: 21;
    /**
     * Component custom id.
     */
    custom_id: string;
    /**
     * Radio group options.
     */
    options: RadioGroupOptionData[];
    /**
     * Whether this component is required.
     */
    required?: boolean | undefined;
};
//# sourceMappingURL=RadioGroup.d.ts.map