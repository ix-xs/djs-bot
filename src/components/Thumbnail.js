// @ts-check

/**
 * Raw options used to create a {@link Thumbnail} instance.
 *
 * @typedef {Object} ThumbnailOptions
 * @property {string} url Media URL or attachment reference.
 * @property {string} [description] Optional thumbnail description.
 * @property {boolean} [spoiler] Whether the thumbnail is marked as spoiler.
 */

/**
 * Discord-compatible thumbnail media reference.
 *
 * @typedef {Object} ThumbnailMediaData
 * @property {string} url Media URL or attachment reference.
 */

/**
 * Discord-compatible thumbnail payload.
 *
 * @typedef {Object} ThumbnailData
 * @property {11} type Discord component type for a thumbnail.
 * @property {ThumbnailMediaData} media Thumbnail media reference.
 * @property {string} [description] Optional thumbnail description.
 * @property {boolean} [spoiler] Whether the thumbnail is marked as spoiler.
 */

/**
 * Lightweight wrapper around a Discord-compatible thumbnail payload.
 *
 * @example
 * const thumbnail = new Thumbnail({
 *   url: "https://example.com/image.png",
 *   description: "Preview of the visual",
 * });
 *
 * @example
 * const attachedThumbnail = new Thumbnail({
 *   url: "attachment://preview.png",
 *   spoiler: true,
 * });
 */
class Thumbnail {
  /**
   * Thumbnail payload in Discord-compatible format.
   *
   * @type {ThumbnailData}
   */
  #thumbnail;

  /**
   * Creates a new thumbnail.
   *
   * @param {ThumbnailOptions} options Thumbnail options.
   * @throws {TypeError} Throws if the provided thumbnail options are invalid.
   *
   * @example
   * const thumbnail = new Thumbnail({
   *   url: "https://example.com/image.png",
   *   description: "Preview of the visual",
   * });
   *
   * @example
   * const attachedThumbnail = new Thumbnail({
   *   url: "attachment://preview.png",
   *   spoiler: true,
   * });
   */
  constructor(options) {
    if (!options || typeof options !== "object" || Array.isArray(options)) {
      throw new TypeError("Thumbnail: 'options' must be an object.");
    }

    const {
      url,
      description,
      spoiler,
    } = options;

    if (typeof url !== "string" || url.length === 0) {
      throw new TypeError("Thumbnail: 'url' must be a non-empty string.");
    }

    if (!this.#isValidMediaURL(url)) {
      throw new TypeError("Thumbnail: 'url' must be a valid http(s) URL or an 'attachment://' reference.");
    }

    if (
      description !== undefined &&
      (typeof description !== "string" || description.length === 0)
    ) {
      throw new TypeError("Thumbnail: 'description' must be a non-empty string when provided.");
    }

    if (description !== undefined && description.length > 1024) {
      throw new TypeError("Thumbnail: 'description' must not exceed 1024 characters.");
    }

    if (spoiler !== undefined && typeof spoiler !== "boolean") {
      throw new TypeError("Thumbnail: 'spoiler' must be a boolean when provided.");
    }

    this.#thumbnail = {
      type: 11,
      media: { url },
      description: description ?? undefined,
      spoiler: spoiler ?? undefined,
    };
  }

  /**
   * Validates whether a media URL is supported.
   *
   * @param {string} url Media URL.
   * @returns {boolean} `true` if valid, otherwise `false`.
   */
  #isValidMediaURL(url) {
    if (url.startsWith("attachment://")) {
      return url.length > "attachment://".length;
    }

    try {
      const parsed = new URL(url);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }

  /**
   * Returns the thumbnail URL.
   *
   * @returns {string} The media URL.
   */
  getURL() {
    return this.#thumbnail.media.url;
  }

  /**
   * Returns the thumbnail description.
   *
   * @returns {string|undefined} The description text.
   */
  getDescription() {
    return this.#thumbnail.description;
  }

  /**
   * Returns whether the thumbnail is spoilered.
   *
   * @returns {boolean} `true` if spoilered, otherwise `false`.
   */
  isSpoiler() {
    return Boolean(this.#thumbnail.spoiler);
  }

  /**
   * Sets the thumbnail URL.
   *
   * @param {string} url New media URL.
   * @returns {this} The current thumbnail instance.
   *
   * @example
   * thumbnail.setURL("https://example.com/updated-image.png");
   *
   * @example
   * attachedThumbnail.setURL("attachment://updated-preview.png");
   */
  setURL(url) {
    if (typeof url !== "string" || url.length === 0) {
      throw new TypeError("Thumbnail.setURL(): 'url' must be a non-empty string.");
    }

    if (!this.#isValidMediaURL(url)) {
      throw new TypeError("Thumbnail.setURL(): 'url' must be a valid http(s) URL or an 'attachment://' reference.");
    }

    this.#thumbnail.media.url = url;
    return this;
  }

  /**
   * Sets the thumbnail description.
   *
   * @param {string} description New description text.
   * @returns {this} The current thumbnail instance.
   *
   * @example
   * thumbnail.setDescription("Updated preview of the resource");
   */
  setDescription(description) {
    if (typeof description !== "string" || description.length === 0) {
      throw new TypeError("Thumbnail.setDescription(): 'description' must be a non-empty string.");
    }

    if (description.length > 1024) {
      throw new TypeError("Thumbnail.setDescription(): 'description' must not exceed 1024 characters.");
    }

    this.#thumbnail.description = description;
    return this;
  }

  /**
   * Clears the thumbnail description.
   *
   * @returns {this} The current thumbnail instance.
   *
   * @example
   * thumbnail.clearDescription();
   */
  clearDescription() {
    delete this.#thumbnail.description;
    return this;
  }

  /**
   * Sets the spoiler state.
   *
   * @param {boolean} [spoiler=true] Whether the thumbnail should be spoilered.
   * @returns {this} The current thumbnail instance.
   *
   * @example
   * thumbnail.setSpoiler(true);
   */
  setSpoiler(spoiler = true) {
    if (typeof spoiler !== "boolean") {
      throw new TypeError("Thumbnail.setSpoiler(): 'spoiler' must be a boolean.");
    }

    this.#thumbnail.spoiler = spoiler;
    return this;
  }

  /**
   * Returns the thumbnail as a Discord-compatible JSON object.
   *
   * @returns {ThumbnailData} The raw thumbnail payload.
   *
   * @example
   * const payload = thumbnail.toJSON();
   *
   * console.log(payload);
   * // {
   * //   type: 11,
   * //   media: { url: "https://example.com/image.png" },
   * //   description: "Preview of the visual"
   * // }
   */
  toJSON() {
    return {
      ...this.#thumbnail,
      media: { ...this.#thumbnail.media },
    };
  }

  /**
   * Creates a new thumbnail instance from raw options.
   *
   * @param {ThumbnailOptions} options Raw thumbnail options.
   * @returns {Thumbnail} A new thumbnail instance.
   *
   * @example
   * const thumbnail = Thumbnail.from({
   *   url: "attachment://cover.png",
   *   description: "Local thumbnail",
   * });
   */
  static from(options) {
    return new Thumbnail(options);
  }
}

module.exports = Thumbnail;