export = Separator;
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
declare class Separator {
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
    static from(options?: SeparatorOptions): Separator;
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
    constructor(options?: SeparatorOptions);
    /**
     * Returns whether the separator shows a visual divider.
     *
     * @returns {boolean} `true` if the divider is visible, otherwise `false`.
     */
    hasDivider(): boolean;
    /**
     * Returns the separator spacing size.
     *
     * @returns {1 | 2} The spacing size.
     */
    getSpace(): 1 | 2;
    /**
     * Sets whether the separator shows a visual divider.
     *
     * @param {boolean} [divider=true] Whether the divider is visible.
     * @returns {this} The current separator instance.
     *
     * @example
     * separator.setDivider(false);
     */
    setDivider(divider?: boolean): this;
    /**
     * Sets the separator spacing size.
     *
     * @param {1 | 2} space Separator spacing size.
     * @returns {this} The current separator instance.
     *
     * @example
     * separator.setSpace(2);
     */
    setSpace(space: 1 | 2): this;
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
    toJSON(): SeparatorData;
    #private;
}
declare namespace Separator {
    export { SeparatorOptions, SeparatorData };
}
/**
 * Raw options used to create a {@link Separator} instance.
 */
type SeparatorOptions = {
    /**
     * Whether a visible divider should be displayed.
     */
    divider?: boolean | undefined;
    /**
     * Separator spacing size.
     */
    space?: 1 | 2 | undefined;
};
/**
 * Discord-compatible separator payload.
 */
type SeparatorData = {
    /**
     * Discord component type for a separator.
     */
    type: 14;
    /**
     * Whether a visible divider should be displayed.
     */
    divider?: boolean | undefined;
    /**
     * Separator spacing size.
     */
    spacing?: 1 | 2 | undefined;
};
//# sourceMappingURL=Separator.d.ts.map