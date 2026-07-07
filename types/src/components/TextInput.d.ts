export = TextInput;
/**
 * Text input styles supported by this wrapper.
 *
 * @typedef {"Short" | "Paragraph"} TextInputStyleName
 */
/**
 * Raw options used to create a {@link TextInput} instance.
 *
 * @typedef {Object} TextInputOptions
 * @property {string} custom_id Component custom id.
 * @property {TextInputStyleName} style Text input style.
 * @property {number} [min_length] Minimum input length.
 * @property {number} [max_length] Maximum input length.
 * @property {boolean} [required=true] Whether the input is required.
 * @property {string} [value] Prefilled value.
 * @property {string} [placeholder] Placeholder text.
 */
/**
 * Discord-compatible text input payload.
 *
 * @typedef {Object} TextInputData
 * @property {4} type Discord component type for a text input.
 * @property {string} custom_id Component custom id.
 * @property {1 | 2} style Discord text input style.
 * @property {number} [min_length] Minimum input length.
 * @property {number} [max_length] Maximum input length.
 * @property {boolean} [required] Whether the input is required.
 * @property {string} [value] Prefilled value.
 * @property {string} [placeholder] Placeholder text.
 */
/**
 * Lightweight wrapper around a Discord-compatible text input payload.
 *
 * @example
 * const textInput = new TextInput({
 *   custom_id: "nickname",
 *   style: "Short",
 *   placeholder: "Enter your nickname",
 *   required: true,
 * });
 *
 * @example
 * const paragraphInput = new TextInput({
 *   custom_id: "bio",
 *   style: "Paragraph",
 *   min_length: 10,
 *   max_length: 500,
 * });
 */
declare class TextInput {
    /**
     * Creates a new text input instance from raw options.
     *
     * @param {TextInputOptions} options Raw text input options.
     * @returns {TextInput} A new text input instance.
     *
     * @example
     * const textInput = TextInput.from({
     *   custom_id: "feedback",
     *   style: "Paragraph",
     *   placeholder: "Share your feedback",
     *   max_length: 1000,
     * });
     */
    static from(options: TextInputOptions): TextInput;
    /**
     * Creates a new text input.
     *
     * @param {TextInputOptions} options Text input options.
     * @throws {TypeError} Throws if the provided text input options are invalid.
     *
     * @example
     * const textInput = new TextInput({
     *   custom_id: "nickname",
     *   style: "Short",
     *   placeholder: "Enter your nickname",
     *   required: true,
     * });
     *
     * @example
     * const paragraphInput = new TextInput({
     *   custom_id: "bio",
     *   style: "Paragraph",
     *   min_length: 10,
     *   max_length: 500,
     * });
     */
    constructor(options: TextInputOptions);
    /**
     * Returns the custom id.
     *
     * @returns {string} The custom id.
     */
    getCustomId(): string;
    /**
     * Returns the style id.
     *
     * @returns {1 | 2} The style id.
     */
    getStyle(): 1 | 2;
    /**
     * Returns the minimum length.
     *
     * @returns {number|undefined} The minimum length.
     */
    getMinLength(): number | undefined;
    /**
     * Returns the maximum length.
     *
     * @returns {number|undefined} The maximum length.
     */
    getMaxLength(): number | undefined;
    /**
     * Returns whether the text input is required.
     *
     * @returns {boolean} `true` if required, otherwise `false`.
     */
    isRequired(): boolean;
    /**
     * Returns the prefilled value.
     *
     * @returns {string|undefined} The prefilled value.
     */
    getValue(): string | undefined;
    /**
     * Returns the placeholder.
     *
     * @returns {string|undefined} The placeholder text.
     */
    getPlaceholder(): string | undefined;
    /**
     * Sets the custom id.
     *
     * @param {string} customId New custom id.
     * @returns {this} The current text input instance.
     */
    setCustomId(customId: string): this;
    /**
     * Sets the text input style.
     *
     * @param {TextInputStyleName} style New style.
     * @returns {this} The current text input instance.
     *
     * @example
     * textInput.setStyle("Paragraph");
     */
    setStyle(style: TextInputStyleName): this;
    /**
     * Sets the minimum allowed length.
     *
     * @param {number} minLength Minimum input length.
     * @returns {this} The current text input instance.
     *
     * @example
     * paragraphInput.setMinLength(20);
     */
    setMinLength(minLength: number): this;
    /**
     * Sets the maximum allowed length.
     *
     * @param {number} maxLength Maximum input length.
     * @returns {this} The current text input instance.
     *
     * @example
     * paragraphInput.setMaxLength(300);
     */
    setMaxLength(maxLength: number): this;
    /**
     * Sets whether the text input is required.
     *
     * @param {boolean} [required=true] Whether the input is required.
     * @returns {this} The current text input instance.
     *
     * @example
     * textInput.setRequired(false);
     */
    setRequired(required?: boolean): this;
    /**
     * Sets the prefilled value.
     *
     * @param {string} value Prefilled value.
     * @returns {this} The current text input instance.
     *
     * @example
     * textInput.setValue("Alice");
     */
    setValue(value: string): this;
    /**
     * Clears the prefilled value.
     *
     * @returns {this} The current text input instance.
     *
     * @example
     * textInput.clearValue();
     */
    clearValue(): this;
    /**
     * Sets the placeholder text.
     *
     * @param {string} placeholder Placeholder text.
     * @returns {this} The current text input instance.
     *
     * @example
     * textInput.setPlaceholder("Type your answer");
     */
    setPlaceholder(placeholder: string): this;
    /**
     * Clears the placeholder text.
     *
     * @returns {this} The current text input instance.
     *
     * @example
     * textInput.clearPlaceholder();
     */
    clearPlaceholder(): this;
    /**
     * Returns the text input as a Discord-compatible JSON object.
     *
     * @returns {TextInputData} The raw text input payload.
     *
     * @example
     * const payload = textInput.toJSON();
     *
     * console.log(payload);
     * // {
     * //   type: 4,
     * //   custom_id: "nickname",
     * //   style: 1,
     * //   required: true,
     * //   placeholder: "Enter your nickname"
     * // }
     */
    toJSON(): TextInputData;
    #private;
}
declare namespace TextInput {
    export { TextInputStyleName, TextInputOptions, TextInputData };
}
/**
 * Text input styles supported by this wrapper.
 */
type TextInputStyleName = "Short" | "Paragraph";
/**
 * Raw options used to create a {@link TextInput} instance.
 */
type TextInputOptions = {
    /**
     * Component custom id.
     */
    custom_id: string;
    /**
     * Text input style.
     */
    style: TextInputStyleName;
    /**
     * Minimum input length.
     */
    min_length?: number | undefined;
    /**
     * Maximum input length.
     */
    max_length?: number | undefined;
    /**
     * Whether the input is required.
     */
    required?: boolean | undefined;
    /**
     * Prefilled value.
     */
    value?: string | undefined;
    /**
     * Placeholder text.
     */
    placeholder?: string | undefined;
};
/**
 * Discord-compatible text input payload.
 */
type TextInputData = {
    /**
     * Discord component type for a text input.
     */
    type: 4;
    /**
     * Component custom id.
     */
    custom_id: string;
    /**
     * Discord text input style.
     */
    style: 1 | 2;
    /**
     * Minimum input length.
     */
    min_length?: number | undefined;
    /**
     * Maximum input length.
     */
    max_length?: number | undefined;
    /**
     * Whether the input is required.
     */
    required?: boolean | undefined;
    /**
     * Prefilled value.
     */
    value?: string | undefined;
    /**
     * Placeholder text.
     */
    placeholder?: string | undefined;
};
//# sourceMappingURL=TextInput.d.ts.map