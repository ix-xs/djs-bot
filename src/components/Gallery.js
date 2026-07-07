// @ts-check

/**
 * A single gallery item input.
 *
 * @typedef {Object} GalleryItemInput
 * @property {string} url Media URL or attachment reference.
 * @property {string} [description] Optional media description.
 * @property {boolean} [spoiler] Whether the media item is marked as spoiler.
 */

/**
 * Discord-compatible gallery media reference.
 *
 * @typedef {Object} GalleryMediaData
 * @property {string} url Media URL or attachment reference.
 */

/**
 * Discord-compatible gallery item.
 *
 * @typedef {Object} GalleryItemData
 * @property {GalleryMediaData} media Media reference.
 * @property {string} [description] Optional media description.
 * @property {boolean} [spoiler] Whether the media item is marked as spoiler.
 */

/**
 * Discord-compatible media gallery payload.
 *
 * @typedef {Object} GalleryData
 * @property {12} type Discord component type for a media gallery.
 * @property {GalleryItemData[]} items Gallery items.
 */

/**
 * Lightweight wrapper around a Discord-compatible media gallery payload.
 *
 * @example
 * const gallery = new Gallery([
 *   { url: "https://example.com/image-1.png", description: "First image" },
 *   { url: "attachment://preview.png", spoiler: true },
 * ]);
 */
class Gallery {
  /**
   * Media gallery payload in Discord-compatible format.
   *
   * @type {GalleryData}
   */
  #gallery;

  /**
   * Creates a new media gallery.
   *
   * @param {GalleryItemInput[]} items Gallery items.
   * @throws {TypeError} Throws if the provided gallery items are invalid.
   *
   * @example
   * const gallery = new Gallery([
   *   {
   *     url: "https://example.com/image-1.png",
   *     description: "First image",
   *   },
   *   {
   *     url: "attachment://preview.png",
   *     spoiler: true,
   *   },
   * ]);
   */
  constructor(items) {
    const normalizedItems = this.#normalizeItems(items);

    if (normalizedItems.length === 0) {
      throw new TypeError("Gallery: a media gallery must contain at least one item.");
    }

    this.#gallery = {
      type: 12,
      items: normalizedItems,
    };
  }

  /**
   * Normalizes gallery items into API-compatible objects.
   *
   * @param {GalleryItemInput[]} items Raw gallery items.
   * @returns {GalleryItemData[]} Normalized gallery items.
   * @throws {TypeError} Throws if gallery items are invalid.
   */
  #normalizeItems(items) {
    if (!Array.isArray(items)) {
      throw new TypeError("Gallery: 'items' must be an array.");
    }

    if (items.length > 10) {
      throw new TypeError("Gallery: a media gallery cannot contain more than 10 items.");
    }

    return items.map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        throw new TypeError("Gallery: each item must be an object.");
      }

      if (typeof item.url !== "string" || item.url.length === 0) {
        throw new TypeError("Gallery: each item must define a non-empty 'url'.");
      }

      if (!this.#isValidMediaURL(item.url)) {
        throw new TypeError("Gallery: each item 'url' must be a valid http(s) URL or an 'attachment://' reference.");
      }

      if (
        item.description !== undefined &&
        (typeof item.description !== "string" || item.description.length === 0)
      ) {
        throw new TypeError("Gallery: each item 'description' must be a non-empty string when provided.");
      }

      if (item.description !== undefined && item.description.length > 1024) {
        throw new TypeError("Gallery: each item description must not exceed 1024 characters.");
      }

      if (item.spoiler !== undefined && typeof item.spoiler !== "boolean") {
        throw new TypeError("Gallery: each item 'spoiler' must be a boolean when provided.");
      }

      return {
        media: { url: item.url },
        description: item.description ?? undefined,
        spoiler: item.spoiler ?? undefined,
      };
    });
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
    }
    catch {
      return false;
    }
  }

  /**
   * Returns the gallery items.
   *
   * @returns {GalleryItemData[]} The gallery items.
   */
  getItems() {
    return this.#gallery.items.map((item) => ({
      ...item,
      media: { ...item.media },
    }));
  }

  /**
   * Replaces all gallery items.
   *
   * @param {GalleryItemInput[]} items New gallery items.
   * @returns {this} The current gallery instance.
   *
   * @example
   * gallery.setItems([
   *   { url: "https://example.com/banner.png", description: "Banner" },
   *   { url: "https://example.com/thumbnail.png", description: "Thumbnail" },
   * ]);
   */
  setItems(items) {
    const normalizedItems = this.#normalizeItems(items);

    if (normalizedItems.length === 0) {
      throw new TypeError("Gallery.setItems(): a media gallery must contain at least one item.");
    }

    this.#gallery.items = normalizedItems;
    return this;
  }

  /**
   * Adds one item to the gallery.
   *
   * @param {GalleryItemInput} item Item to add.
   * @returns {this} The current gallery instance.
   *
   * @example
   * gallery.addItem({
   *   url: "attachment://extra-preview.png",
   *   description: "Additional preview",
   * });
   */
  addItem(item) {
    const normalizedItems = this.#normalizeItems([
      ...this.#gallery.items.map((galleryItem) => ({
        url: galleryItem.media.url,
        description: galleryItem.description,
        spoiler: galleryItem.spoiler,
      })),
      item,
    ]);

    this.#gallery.items = normalizedItems;
    return this;
  }

  /**
   * Clears all gallery items.
   *
   * @returns {this} The current gallery instance.
   */
  clearItems() {
    this.#gallery.items = [];
    return this;
  }

  /**
   * Returns the media gallery as a Discord-compatible JSON object.
   *
   * @returns {GalleryData} The raw gallery payload.
   *
   * @example
   * const payload = gallery.toJSON();
   *
   * console.log(payload);
   * // {
   * //   type: 12,
   * //   items: [
   * //     {
   * //       media: { url: "https://example.com/image-1.png" },
   * //       description: "First image"
   * //     },
   * //     {
   * //       media: { url: "attachment://preview.png" },
   * //       spoiler: true
   * //     }
   * //   ]
   * // }
   */
  toJSON() {
    return {
      ...this.#gallery,
      items: this.#gallery.items.map((item) => ({
        ...item,
        media: { ...item.media },
      })),
    };
  }

  /**
   * Creates a new gallery instance from raw items.
   *
   * @param {GalleryItemInput[]} items Raw gallery items.
   * @returns {Gallery} A new gallery instance.
   *
   * @example
   * const gallery = Gallery.from([
   *   { url: "https://example.com/screenshot-1.png" },
   *   { url: "https://example.com/screenshot-2.png", description: "Second screenshot" },
   * ]);
   */
  static from(items) {
    return new Gallery(items);
  }
}

module.exports = Gallery;