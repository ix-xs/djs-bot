export = CheckboxGroup;
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
declare class CheckboxGroup {
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
    static from(options: CheckboxGroupOptions): CheckboxGroup;
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
    constructor(options: CheckboxGroupOptions);
    /**
     * Returns the checkbox group custom id.
     *
     * @returns {string} The custom id.
     */
    getCustomId(): string;
    /**
     * Returns the checkbox group options.
     *
     * @returns {CheckboxGroupOptionData[]} The checkbox group options.
     */
    getOptions(): CheckboxGroupOptionData[];
    /**
     * Returns the minimum number of selected options.
     *
     * @returns {number|undefined} The minimum selected value count.
     */
    getMinValues(): number | undefined;
    /**
     * Returns the maximum number of selected options.
     *
     * @returns {number|undefined} The maximum selected value count.
     */
    getMaxValues(): number | undefined;
    /**
     * Returns whether the checkbox group is required.
     *
     * @returns {boolean} `true` if required, otherwise `false`.
     */
    isRequired(): boolean;
    /**
     * Sets the checkbox group custom id.
     *
     * @param {string} customId New custom id.
     * @returns {this} The current checkbox group instance.
     */
    setCustomId(customId: string): this;
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
    setOptions(options: CheckboxGroupOptionInput[]): this;
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
    addOption(option: CheckboxGroupOptionInput): this;
    /**
     * Sets the minimum number of selected options.
     *
     * @param {number} minValues Minimum selected values.
     * @returns {this} The current checkbox group instance.
     *
     * @example
     * checkboxGroup.setMinValues(1);
     */
    setMinValues(minValues: number): this;
    /**
     * Sets the maximum number of selected options.
     *
     * @param {number} maxValues Maximum selected values.
     * @returns {this} The current checkbox group instance.
     *
     * @example
     * checkboxGroup.setMaxValues(3);
     */
    setMaxValues(maxValues: number): this;
    /**
     * Sets whether the checkbox group is required.
     *
     * @param {boolean} [required=true] Whether the checkbox group is required.
     * @returns {this} The current checkbox group instance.
     *
     * @example
     * checkboxGroup.setRequired(true);
     */
    setRequired(required?: boolean): this;
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
    toJSON(): CheckboxGroupData;
    #private;
}
declare namespace CheckboxGroup {
    export { CheckboxGroupOptionInput, CheckboxGroupOptions, CheckboxGroupOptionData, CheckboxGroupData };
}
/**
 * A single checkbox group option.
 */
type CheckboxGroupOptionInput = {
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
 * Raw options used to create a {@link CheckboxGroup} instance.
 */
type CheckboxGroupOptions = {
    /**
     * Component custom id.
     */
    custom_id: string;
    /**
     * Checkbox group options.
     */
    options: CheckboxGroupOptionInput[];
    /**
     * Minimum number of selected options.
     */
    min_values?: number | undefined;
    /**
     * Maximum number of selected options.
     */
    max_values?: number | undefined;
    /**
     * Whether this component is required.
     */
    required?: boolean | undefined;
};
/**
 * Discord-compatible checkbox group option.
 */
type CheckboxGroupOptionData = {
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
 * Discord-compatible checkbox group payload.
 */
type CheckboxGroupData = {
    /**
     * Discord component type for a checkbox group.
     */
    type: 22;
    /**
     * Component custom id.
     */
    custom_id: string;
    /**
     * Checkbox group options.
     */
    options: CheckboxGroupOptionData[];
    /**
     * Minimum number of selected options.
     */
    min_values?: number | undefined;
    /**
     * Maximum number of selected options.
     */
    max_values?: number | undefined;
    /**
     * Whether this component is required.
     */
    required?: boolean | undefined;
};
//# sourceMappingURL=CheckboxGroup.d.ts.map