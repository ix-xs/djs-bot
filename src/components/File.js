// @ts-check

/**
 * Raw options used to create a {@link File} instance.
 *
 * @typedef {Object} FileOptions
 * @property {string} url File URL or attachment reference.
 * @property {string} [name] File display name.
 * @property {boolean} [spoiler] Whether the file should be marked as spoiler.
 */

/**
 * Discord-compatible file reference.
 *
 * @typedef {Object} FileReferenceData
 * @property {string} url File URL or attachment reference.
 */

/**
 * Discord-compatible file payload.
 *
 * @typedef {Object} FileData
 * @property {13} type Discord component type for a file component.
 * @property {FileReferenceData} file File reference object.
 * @property {string} [name] File display name.
 * @property {boolean} [spoiler] Whether the file is marked as spoiler.
 */

/**
 * Lightweight wrapper around a Discord-compatible file payload.
 *
 * A File component visually references a file in Components V2 messages.
 *
 * @example
 * const file = new File({
 *   url: "attachment://report.pdf",
 *   name: "report.pdf",
 * });
 *
 * @example
 * const remoteFile = new File({
 *   url: "https://example.com/report.pdf",
 *   name: "report.pdf",
 * });
 */
class File {
  /**
   * File payload in Discord-compatible format.
   *
   * @type {FileData}
   */
  #file;

  /**
   * Creates a new file component.
   *
   * @param {FileOptions} options File options.
   * @throws {TypeError} Throws if the provided file options are invalid.
   *
   * @example
   * const file = new File({
   *   url: "attachment://report.pdf",
   *   name: "report.pdf",
   * });
   *
   * @example
   * const remoteFile = new File({
   *   url: "https://example.com/report.pdf",
   *   name: "report.pdf",
   *   spoiler: false,
   * });
   */
  constructor(options) {
    if (!options || typeof options !== "object" || Array.isArray(options)) {
      throw new TypeError("File: 'options' must be an object.");
    }

    const { url, name, spoiler } = options;

    if (typeof url !== "string" || url.length === 0) {
      throw new TypeError("File: 'url' must be a non-empty string.");
    }

    if (name !== undefined && (typeof name !== "string" || name.length === 0)) {
      throw new TypeError("File: 'name' must be a non-empty string when provided.");
    }

    if (spoiler !== undefined && typeof spoiler !== "boolean") {
      throw new TypeError("File: 'spoiler' must be a boolean when provided.");
    }

    if (!this.#isValidFileURL(url)) {
      throw new TypeError("File: 'url' must be a valid http(s) URL or an 'attachment://' reference.");
    }

    this.#file = {
      type: 13,
      file: { url },
      name: name ?? undefined,
      spoiler: spoiler ?? undefined,
    };
  }

  /**
   * Validates whether a file URL is a supported remote or attachment reference.
   *
   * @param {string} url File URL.
   * @returns {boolean} `true` if the URL is valid, otherwise `false`.
   */
  #isValidFileURL(url) {
    if (url.startsWith("attachment://")) {
      return url.length > "attachment://".length;
    }

    try {
      const parsed = new URL(url);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    }
    catch {
      return false;
    }
  }

  /**
   * Returns the file URL.
   *
   * @returns {string} The file URL.
   */
  getURL() {
    return this.#file.file.url;
  }

  /**
   * Returns the file name.
   *
   * @returns {string|undefined} The file name.
   */
  getName() {
    return this.#file.name;
  }

  /**
   * Returns whether the file is spoilered.
   *
   * @returns {boolean} `true` if spoilered, otherwise `false`.
   */
  isSpoiler() {
    return Boolean(this.#file.spoiler);
  }

  /**
   * Sets the file URL.
   *
   * @param {string} url New file URL.
   * @returns {this} The current file instance.
   *
   * @example
   * file.setURL("attachment://updated-report.pdf");
   *
   * @example
   * remoteFile.setURL("https://example.com/files/final-report.pdf");
   */
  setURL(url) {
    if (typeof url !== "string" || url.length === 0) {
      throw new TypeError("File.setURL(): 'url' must be a non-empty string.");
    }

    if (!this.#isValidFileURL(url)) {
      throw new TypeError("File.setURL(): 'url' must be a valid http(s) URL or an 'attachment://' reference.");
    }

    this.#file.file.url = url;
    return this;
  }

  /**
   * Sets the file name.
   *
   * @param {string} name New file name.
   * @returns {this} The current file instance.
   *
   * @example
   * file.setName("final-report.pdf");
   */
  setName(name) {
    if (typeof name !== "string" || name.length === 0) {
      throw new TypeError("File.setName(): 'name' must be a non-empty string.");
    }

    this.#file.name = name;
    return this;
  }

  /**
   * Clears the file name.
   *
   * @returns {this} The current file instance.
   */
  clearName() {
    delete this.#file.name;
    return this;
  }

  /**
   * Sets the spoiler state.
   *
   * @param {boolean} [spoiler=true] Whether the file should be spoilered.
   * @returns {this} The current file instance.
   *
   * @example
   * file.setSpoiler(true);
   */
  setSpoiler(spoiler = true) {
    if (typeof spoiler !== "boolean") {
      throw new TypeError("File.setSpoiler(): 'spoiler' must be a boolean.");
    }

    this.#file.spoiler = spoiler;
    return this;
  }

  /**
   * Returns the file component as a Discord-compatible JSON object.
   *
   * @returns {FileData} The raw file payload.
   *
   * @example
   * const payload = file.toJSON();
   *
   * console.log(payload);
   * // {
   * //   type: 13,
   * //   file: { url: "attachment://report.pdf" },
   * //   name: "report.pdf"
   * // }
   */
  toJSON() {
    return {
      ...this.#file,
      file: { ...this.#file.file },
    };
  }

  /**
   * Creates a new file instance from raw options.
   *
   * @param {FileOptions} options Raw file options.
   * @returns {File} A new file instance.
   *
   * @example
   * const file = File.from({
   *   url: "attachment://invoice.pdf",
   *   name: "invoice.pdf",
   *   spoiler: true,
   * });
   */
  static from(options) {
    return new File(options);
  }
}

module.exports = File;