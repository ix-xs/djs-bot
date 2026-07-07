// @ts-check

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
class TextInput {
  /**
   * Text input payload in Discord-compatible format.
   *
   * @type {TextInputData}
   */
  #textInput;

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
  constructor(options) {
    if (!options || typeof options !== "object" || Array.isArray(options)) {
      throw new TypeError("TextInput: 'options' must be an object.");
    }

    const {
      custom_id,
      style,
      min_length,
      max_length,
      required = true,
      value,
      placeholder,
    } = options;

    if (typeof custom_id !== "string" || custom_id.length === 0) {
      throw new TypeError("TextInput: 'custom_id' must be a non-empty string.");
    }

    if (custom_id.length > 100) {
      throw new TypeError("TextInput: 'custom_id' must not exceed 100 characters.");
    }

    const resolvedStyle = this.#resolveStyle(style);

    if (resolvedStyle === undefined) {
      throw new TypeError("TextInput: 'style' must be 'Short' or 'Paragraph'.");
    }

    if (min_length !== undefined && (!Number.isInteger(min_length) || min_length < 0 || min_length > 4000)) {
      throw new TypeError("TextInput: 'min_length' must be an integer between 0 and 4000.");
    }

    if (max_length !== undefined && (!Number.isInteger(max_length) || max_length < 1 || max_length > 4000)) {
      throw new TypeError("TextInput: 'max_length' must be an integer between 1 and 4000.");
    }

    if (
      min_length !== undefined &&
      max_length !== undefined &&
      min_length > max_length
    ) {
      throw new TypeError("TextInput: 'min_length' cannot be greater than 'max_length'.");
    }

    if (typeof required !== "boolean") {
      throw new TypeError("TextInput: 'required' must be a boolean.");
    }

    if (value !== undefined && (typeof value !== "string" || value.length > 4000)) {
      throw new TypeError("TextInput: 'value' must be a string with a maximum length of 4000 characters.");
    }

    if (placeholder !== undefined && (typeof placeholder !== "string" || placeholder.length > 100)) {
      throw new TypeError("TextInput: 'placeholder' must be a string with a maximum length of 100 characters.");
    }

    if (value !== undefined && max_length !== undefined && value.length > max_length) {
      throw new TypeError("TextInput: 'value' length cannot exceed 'max_length'.");
    }

    if (value !== undefined && min_length !== undefined && value.length < min_length) {
      throw new TypeError("TextInput: 'value' length cannot be lower than 'min_length'.");
    }

    this.#textInput = {
      type: 4,
      custom_id,
      style: resolvedStyle,
      min_length: min_length ?? undefined,
      max_length: max_length ?? undefined,
      required,
      value: value ?? undefined,
      placeholder: placeholder ?? undefined,
    };
  }

  /**
   * Resolves a wrapper text input style to a Discord style id.
   *
   * @param {TextInputStyleName} style Wrapper style.
   * @returns {1 | 2 | undefined} Discord text input style id.
   */
  #resolveStyle(style) {
    return style === "Paragraph"
      ? 2
      : style === "Short"
        ? 1
        : undefined;
  }

  /**
   * Returns the custom id.
   *
   * @returns {string} The custom id.
   */
  getCustomId() {
    return this.#textInput.custom_id;
  }

  /**
   * Returns the style id.
   *
   * @returns {1 | 2} The style id.
   */
  getStyle() {
    return this.#textInput.style;
  }

  /**
   * Returns the minimum length.
   *
   * @returns {number|undefined} The minimum length.
   */
  getMinLength() {
    return this.#textInput.min_length;
  }

  /**
   * Returns the maximum length.
   *
   * @returns {number|undefined} The maximum length.
   */
  getMaxLength() {
    return this.#textInput.max_length;
  }

  /**
   * Returns whether the text input is required.
   *
   * @returns {boolean} `true` if required, otherwise `false`.
   */
  isRequired() {
    return Boolean(this.#textInput.required);
  }

  /**
   * Returns the prefilled value.
   *
   * @returns {string|undefined} The prefilled value.
   */
  getValue() {
    return this.#textInput.value;
  }

  /**
   * Returns the placeholder.
   *
   * @returns {string|undefined} The placeholder text.
   */
  getPlaceholder() {
    return this.#textInput.placeholder;
  }

  /**
   * Sets the custom id.
   *
   * @param {string} customId New custom id.
   * @returns {this} The current text input instance.
   */
  setCustomId(customId) {
    if (typeof customId !== "string" || customId.length === 0) {
      throw new TypeError("TextInput.setCustomId(): 'customId' must be a non-empty string.");
    }

    if (customId.length > 100) {
      throw new TypeError("TextInput.setCustomId(): 'customId' must not exceed 100 characters.");
    }

    this.#textInput.custom_id = customId;
    return this;
  }

  /**
   * Sets the text input style.
   *
   * @param {TextInputStyleName} style New style.
   * @returns {this} The current text input instance.
   *
   * @example
   * textInput.setStyle("Paragraph");
   */
  setStyle(style) {
    const resolvedStyle = this.#resolveStyle(style);

    if (resolvedStyle === undefined) {
      throw new TypeError("TextInput.setStyle(): 'style' must be 'Short' or 'Paragraph'.");
    }

    this.#textInput.style = resolvedStyle;
    return this;
  }

  /**
   * Sets the minimum allowed length.
   *
   * @param {number} minLength Minimum input length.
   * @returns {this} The current text input instance.
   *
   * @example
   * paragraphInput.setMinLength(20);
   */
  setMinLength(minLength) {
    if (!Number.isInteger(minLength) || minLength < 0 || minLength > 4000) {
      throw new TypeError("TextInput.setMinLength(): 'minLength' must be an integer between 0 and 4000.");
    }

    if (
      this.#textInput.max_length !== undefined &&
      minLength > this.#textInput.max_length
    ) {
      throw new TypeError("TextInput.setMinLength(): 'minLength' cannot be greater than 'max_length'.");
    }

    if (
      this.#textInput.value !== undefined &&
      this.#textInput.value.length < minLength
    ) {
      throw new TypeError("TextInput.setMinLength(): the current 'value' length cannot be lower than 'minLength'.");
    }

    this.#textInput.min_length = minLength;
    return this;
  }

  /**
   * Sets the maximum allowed length.
   *
   * @param {number} maxLength Maximum input length.
   * @returns {this} The current text input instance.
   *
   * @example
   * paragraphInput.setMaxLength(300);
   */
  setMaxLength(maxLength) {
    if (!Number.isInteger(maxLength) || maxLength < 1 || maxLength > 4000) {
      throw new TypeError("TextInput.setMaxLength(): 'maxLength' must be an integer between 1 and 4000.");
    }

    if (
      this.#textInput.min_length !== undefined &&
      maxLength < this.#textInput.min_length
    ) {
      throw new TypeError("TextInput.setMaxLength(): 'maxLength' cannot be lower than 'min_length'.");
    }

    if (
      this.#textInput.value !== undefined &&
      this.#textInput.value.length > maxLength
    ) {
      throw new TypeError("TextInput.setMaxLength(): the current 'value' length cannot exceed 'maxLength'.");
    }

    this.#textInput.max_length = maxLength;
    return this;
  }

  /**
   * Sets whether the text input is required.
   *
   * @param {boolean} [required=true] Whether the input is required.
   * @returns {this} The current text input instance.
   *
   * @example
   * textInput.setRequired(false);
   */
  setRequired(required = true) {
    if (typeof required !== "boolean") {
      throw new TypeError("TextInput.setRequired(): 'required' must be a boolean.");
    }

    this.#textInput.required = required;
    return this;
  }

  /**
   * Sets the prefilled value.
   *
   * @param {string} value Prefilled value.
   * @returns {this} The current text input instance.
   *
   * @example
   * textInput.setValue("Alice");
   */
  setValue(value) {
    if (typeof value !== "string" || value.length > 4000) {
      throw new TypeError("TextInput.setValue(): 'value' must be a string with a maximum length of 4000 characters.");
    }

    if (
      this.#textInput.max_length !== undefined &&
      value.length > this.#textInput.max_length
    ) {
      throw new TypeError("TextInput.setValue(): 'value' length cannot exceed 'max_length'.");
    }

    if (
      this.#textInput.min_length !== undefined &&
      value.length < this.#textInput.min_length
    ) {
      throw new TypeError("TextInput.setValue(): 'value' length cannot be lower than 'min_length'.");
    }

    this.#textInput.value = value;
    return this;
  }

  /**
   * Clears the prefilled value.
   *
   * @returns {this} The current text input instance.
   *
   * @example
   * textInput.clearValue();
   */
  clearValue() {
    delete this.#textInput.value;
    return this;
  }

  /**
   * Sets the placeholder text.
   *
   * @param {string} placeholder Placeholder text.
   * @returns {this} The current text input instance.
   *
   * @example
   * textInput.setPlaceholder("Type your answer");
   */
  setPlaceholder(placeholder) {
    if (typeof placeholder !== "string" || placeholder.length > 100) {
      throw new TypeError("TextInput.setPlaceholder(): 'placeholder' must be a string with a maximum length of 100 characters.");
    }

    this.#textInput.placeholder = placeholder;
    return this;
  }

  /**
   * Clears the placeholder text.
   *
   * @returns {this} The current text input instance.
   *
   * @example
   * textInput.clearPlaceholder();
   */
  clearPlaceholder() {
    delete this.#textInput.placeholder;
    return this;
  }

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
  toJSON() {
    return {
      ...this.#textInput,
    };
  }

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
  static from(options) {
    return new TextInput(options);
  }
}

module.exports = TextInput;