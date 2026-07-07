export = Gallery;
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
declare class Gallery {
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
    static from(items: GalleryItemInput[]): Gallery;
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
    constructor(items: GalleryItemInput[]);
    /**
     * Returns the gallery items.
     *
     * @returns {GalleryItemData[]} The gallery items.
     */
    getItems(): GalleryItemData[];
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
    setItems(items: GalleryItemInput[]): this;
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
    addItem(item: GalleryItemInput): this;
    /**
     * Clears all gallery items.
     *
     * @returns {this} The current gallery instance.
     */
    clearItems(): this;
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
    toJSON(): GalleryData;
    #private;
}
declare namespace Gallery {
    export { GalleryItemInput, GalleryMediaData, GalleryItemData, GalleryData };
}
/**
 * A single gallery item input.
 */
type GalleryItemInput = {
    /**
     * Media URL or attachment reference.
     */
    url: string;
    /**
     * Optional media description.
     */
    description?: string | undefined;
    /**
     * Whether the media item is marked as spoiler.
     */
    spoiler?: boolean | undefined;
};
/**
 * Discord-compatible gallery media reference.
 */
type GalleryMediaData = {
    /**
     * Media URL or attachment reference.
     */
    url: string;
};
/**
 * Discord-compatible gallery item.
 */
type GalleryItemData = {
    /**
     * Media reference.
     */
    media: GalleryMediaData;
    /**
     * Optional media description.
     */
    description?: string | undefined;
    /**
     * Whether the media item is marked as spoiler.
     */
    spoiler?: boolean | undefined;
};
/**
 * Discord-compatible media gallery payload.
 */
type GalleryData = {
    /**
     * Discord component type for a media gallery.
     */
    type: 12;
    /**
     * Gallery items.
     */
    items: GalleryItemData[];
};
//# sourceMappingURL=Gallery.d.ts.map