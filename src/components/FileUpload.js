// @ts-check

/**
 * Raw options used to create a {@link FileUpload} instance.
 *
 * @typedef {Object} FileUploadOptions
 * @property {string} custom_id Component custom id.
 * @property {number} [min_values] Minimum number of uploaded files.
 * @property {number} [max_values] Maximum number of uploaded files.
 * @property {boolean} [required] Whether the file upload is required.
 */

/**
 * Discord-compatible file upload payload.
 *
 * @typedef {Object} FileUploadData
 * @property {19} type Discord component type for a file upload.
 * @property {string} custom_id Component custom id.
 * @property {number} [min_values] Minimum number of uploaded files.
 * @property {number} [max_values] Maximum number of uploaded files.
 * @property {boolean} [required] Whether the file upload is required.
 */

/**
 * Lightweight wrapper around a Discord-compatible file upload payload.
 *
 * @example
 * const fileUpload = new FileUpload({
 *   custom_id: "resume",
 *   min_values: 1,
 *   max_values: 3,
 *   required: true,
 * });
 */
class FileUpload {
  /**
   * File upload payload in Discord-compatible format.
   *
   * @type {FileUploadData}
   */
  #fileUpload;

  /**
   * Creates a new file upload component.
   *
   * @param {FileUploadOptions} options File upload options.
   * @throws {TypeError} Throws if the provided file upload options are invalid.
   *
   * @example
   * const fileUpload = new FileUpload({
   *   custom_id: "resume",
   *   min_values: 1,
   *   max_values: 3,
   *   required: true,
   * });
   */
  constructor(options) {
    if (!options || typeof options !== "object" || Array.isArray(options)) {
      throw new TypeError("FileUpload: 'options' must be an object.");
    }

    const {
      custom_id,
      min_values,
      max_values,
      required,
    } = options;

    if (typeof custom_id !== "string" || custom_id.length === 0) {
      throw new TypeError("FileUpload: 'custom_id' must be a non-empty string.");
    }

    if (custom_id.length > 100) {
      throw new TypeError("FileUpload: 'custom_id' must not exceed 100 characters.");
    }

    if (min_values !== undefined && (!Number.isInteger(min_values) || min_values < 0 || min_values > 10)) {
      throw new TypeError("FileUpload: 'min_values' must be an integer between 0 and 10.");
    }

    if (max_values !== undefined && (!Number.isInteger(max_values) || max_values < 1 || max_values > 10)) {
      throw new TypeError("FileUpload: 'max_values' must be an integer between 1 and 10.");
    }

    if (
      min_values !== undefined &&
      max_values !== undefined &&
      min_values > max_values
    ) {
      throw new TypeError("FileUpload: 'min_values' cannot be greater than 'max_values'.");
    }

    if (required !== undefined && typeof required !== "boolean") {
      throw new TypeError("FileUpload: 'required' must be a boolean when provided.");
    }

    this.#fileUpload = {
      type: 19,
      custom_id,
      min_values: min_values ?? undefined,
      max_values: max_values ?? undefined,
      required: required ?? undefined,
    };
  }

  /**
   * Returns the file upload custom id.
   *
   * @returns {string} The custom id.
   */
  getCustomId() {
    return this.#fileUpload.custom_id;
  }

  /**
   * Returns the minimum number of uploaded files.
   *
   * @returns {number|undefined} The minimum file count.
   */
  getMinValues() {
    return this.#fileUpload.min_values;
  }

  /**
   * Returns the maximum number of uploaded files.
   *
   * @returns {number|undefined} The maximum file count.
   */
  getMaxValues() {
    return this.#fileUpload.max_values;
  }

  /**
   * Returns whether the file upload is required.
   *
   * @returns {boolean} `true` if required, otherwise `false`.
   */
  isRequired() {
    return Boolean(this.#fileUpload.required);
  }

  /**
   * Sets the file upload custom id.
   *
   * @param {string} customId New custom id.
   * @returns {this} The current file upload instance.
   */
  setCustomId(customId) {
    if (typeof customId !== "string" || customId.length === 0) {
      throw new TypeError("FileUpload.setCustomId(): 'customId' must be a non-empty string.");
    }

    if (customId.length > 100) {
      throw new TypeError("FileUpload.setCustomId(): 'customId' must not exceed 100 characters.");
    }

    this.#fileUpload.custom_id = customId;
    return this;
  }

  /**
   * Sets the minimum number of uploaded files.
   *
   * @param {number} minValues Minimum file count.
   * @returns {this} The current file upload instance.
   *
   * @example
   * fileUpload.setMinValues(1);
   */
  setMinValues(minValues) {
    if (!Number.isInteger(minValues) || minValues < 0 || minValues > 10) {
      throw new TypeError("FileUpload.setMinValues(): 'minValues' must be an integer between 0 and 10.");
    }

    if (
      this.#fileUpload.max_values !== undefined &&
      minValues > this.#fileUpload.max_values
    ) {
      throw new TypeError("FileUpload.setMinValues(): 'minValues' cannot be greater than 'max_values'.");
    }

    this.#fileUpload.min_values = minValues;
    return this;
  }

  /**
   * Sets the maximum number of uploaded files.
   *
   * @param {number} maxValues Maximum file count.
   * @returns {this} The current file upload instance.
   *
   * @example
   * fileUpload.setMaxValues(5);
   */
  setMaxValues(maxValues) {
    if (!Number.isInteger(maxValues) || maxValues < 1 || maxValues > 10) {
      throw new TypeError("FileUpload.setMaxValues(): 'maxValues' must be an integer between 1 and 10.");
    }

    if (
      this.#fileUpload.min_values !== undefined &&
      maxValues < this.#fileUpload.min_values
    ) {
      throw new TypeError("FileUpload.setMaxValues(): 'maxValues' cannot be lower than 'min_values'.");
    }

    this.#fileUpload.max_values = maxValues;
    return this;
  }

  /**
   * Sets whether the file upload is required.
   *
   * @param {boolean} [required=true] Whether the file upload is required.
   * @returns {this} The current file upload instance.
   *
   * @example
   * fileUpload.setRequired(true);
   */
  setRequired(required = true) {
    if (typeof required !== "boolean") {
      throw new TypeError("FileUpload.setRequired(): 'required' must be a boolean.");
    }

    this.#fileUpload.required = required;
    return this;
  }

  /**
   * Returns the file upload as a Discord-compatible JSON object.
   *
   * @returns {FileUploadData} The raw file upload payload.
   *
   * @example
   * const payload = fileUpload.toJSON();
   *
   * console.log(payload);
   * // {
   * //   type: 19,
   * //   custom_id: "resume",
   * //   min_values: 1,
   * //   max_values: 3,
   * //   required: true
   * // }
   */
  toJSON() {
    return {
      ...this.#fileUpload,
    };
  }

  /**
   * Creates a new file upload instance from raw options.
   *
   * @param {FileUploadOptions} options Raw file upload options.
   * @returns {FileUpload} A new file upload instance.
   *
   * @example
   * const fileUpload = FileUpload.from({
   *   custom_id: "attachments",
   *   min_values: 0,
   *   max_values: 2,
   * });
   */
  static from(options) {
    return new FileUpload(options);
  }
}

module.exports = FileUpload;