export = Checkbox;
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
declare class Checkbox {
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
    static from(options: CheckboxOptions): Checkbox;
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
    constructor(options: CheckboxOptions);
    /**
     * Returns the checkbox custom id.
     *
     * @returns {string} The custom id.
     */
    getCustomId(): string;
    /**
     * Returns whether the checkbox is checked by default.
     *
     * @returns {boolean} `true` if checked by default, otherwise `false`.
     */
    isDefault(): boolean;
    /**
     * Sets the checkbox custom id.
     *
     * @param {string} customId New custom id.
     * @returns {this} The current checkbox instance.
     *
     * @example
     * checkbox.setCustomId("newsletter:subscribe");
     */
    setCustomId(customId: string): this;
    /**
     * Sets whether the checkbox is checked by default.
     *
     * @param {boolean} [value=true] Whether the checkbox should be checked by default.
     * @returns {this} The current checkbox instance.
     *
     * @example
     * checkbox.setDefault(true);
     */
    setDefault(value?: boolean): this;
    /**
     * Clears the default checked state.
     *
     * @returns {this} The current checkbox instance.
     *
     * @example
     * checkbox.clearDefault();
     */
    clearDefault(): this;
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
    toJSON(): CheckboxData;
    #private;
}
declare namespace Checkbox {
    export { CheckboxOptions, CheckboxData };
}
/**
 * Raw options used to create a {@link Checkbox} instance.
 */
type CheckboxOptions = {
    /**
     * Component custom id.
     */
    custom_id: string;
    /**
     * Whether the checkbox is checked by default.
     */
    default?: boolean | undefined;
};
/**
 * Discord-compatible checkbox payload.
 */
type CheckboxData = {
    /**
     * Discord component type for a checkbox.
     */
    type: 23;
    /**
     * Component custom id.
     */
    custom_id: string;
    /**
     * Whether the checkbox is checked by default.
     */
    default?: boolean | undefined;
};
//# sourceMappingURL=Checkbox.d.ts.map