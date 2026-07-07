export = Thumbnail;
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
declare class Thumbnail {
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
    static from(options: ThumbnailOptions): Thumbnail;
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
    constructor(options: ThumbnailOptions);
    /**
     * Returns the thumbnail URL.
     *
     * @returns {string} The media URL.
     */
    getURL(): string;
    /**
     * Returns the thumbnail description.
     *
     * @returns {string|undefined} The description text.
     */
    getDescription(): string | undefined;
    /**
     * Returns whether the thumbnail is spoilered.
     *
     * @returns {boolean} `true` if spoilered, otherwise `false`.
     */
    isSpoiler(): boolean;
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
    setURL(url: string): this;
    /**
     * Sets the thumbnail description.
     *
     * @param {string} description New description text.
     * @returns {this} The current thumbnail instance.
     *
     * @example
     * thumbnail.setDescription("Updated preview of the resource");
     */
    setDescription(description: string): this;
    /**
     * Clears the thumbnail description.
     *
     * @returns {this} The current thumbnail instance.
     *
     * @example
     * thumbnail.clearDescription();
     */
    clearDescription(): this;
    /**
     * Sets the spoiler state.
     *
     * @param {boolean} [spoiler=true] Whether the thumbnail should be spoilered.
     * @returns {this} The current thumbnail instance.
     *
     * @example
     * thumbnail.setSpoiler(true);
     */
    setSpoiler(spoiler?: boolean): this;
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
    toJSON(): ThumbnailData;
    #private;
}
declare namespace Thumbnail {
    export { ThumbnailOptions, ThumbnailMediaData, ThumbnailData };
}
/**
 * Raw options used to create a {@link Thumbnail} instance.
 */
type ThumbnailOptions = {
    /**
     * Media URL or attachment reference.
     */
    url: string;
    /**
     * Optional thumbnail description.
     */
    description?: string | undefined;
    /**
     * Whether the thumbnail is marked as spoiler.
     */
    spoiler?: boolean | undefined;
};
/**
 * Discord-compatible thumbnail media reference.
 */
type ThumbnailMediaData = {
    /**
     * Media URL or attachment reference.
     */
    url: string;
};
/**
 * Discord-compatible thumbnail payload.
 */
type ThumbnailData = {
    /**
     * Discord component type for a thumbnail.
     */
    type: 11;
    /**
     * Thumbnail media reference.
     */
    media: ThumbnailMediaData;
    /**
     * Optional thumbnail description.
     */
    description?: string | undefined;
    /**
     * Whether the thumbnail is marked as spoiler.
     */
    spoiler?: boolean | undefined;
};
//# sourceMappingURL=Thumbnail.d.ts.map