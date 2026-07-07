export = Embed;
/**
 * Footer object used in a Discord embed.
 *
 * @typedef {Object} EmbedFooterData
 * @property {string} text Footer text.
 * @property {string} [icon_url] Footer icon URL.
 */
/**
 * Image object used in a Discord embed.
 *
 * @typedef {Object} EmbedImageData
 * @property {string} url Image URL.
 * @property {number} [width] Image width.
 * @property {number} [height] Image height.
 */
/**
 * Thumbnail object used in a Discord embed.
 *
 * @typedef {Object} EmbedThumbnailData
 * @property {string} url Thumbnail URL.
 * @property {number} [width] Thumbnail width.
 * @property {number} [height] Thumbnail height.
 */
/**
 * Author object used in a Discord embed.
 *
 * @typedef {Object} EmbedAuthorData
 * @property {string} name Author name.
 * @property {string} [url] Author URL.
 * @property {string} [icon_url] Author icon URL.
 */
/**
 * Field object used in a Discord embed.
 *
 * @typedef {Object} EmbedFieldData
 * @property {string} name Field name.
 * @property {string} value Field value.
 * @property {boolean} [inline=false] Whether the field should be inline.
 */
/**
 * User-facing embed input data.
 *
 * @typedef {Object} EmbedInputData
 * @property {string} [title] Embed title.
 * @property {string} [description] Embed description.
 * @property {string} [url] Embed URL.
 * @property {"now"|Date} [timestamp] Embed timestamp.
 * @property {import("discord.js").ColorResolvable} [color] Embed color.
 * @property {EmbedFooterData} [footer] Embed footer.
 * @property {EmbedImageData} [image] Embed image.
 * @property {EmbedThumbnailData} [thumbnail] Embed thumbnail.
 * @property {EmbedAuthorData} [author] Embed author.
 * @property {EmbedFieldData[]} [fields] Embed fields.
 */
/**
 * Internal normalized embed data ready for Discord JSON payloads.
 *
 * @typedef {Object} InternalEmbedData
 * @property {"rich"} type
 * @property {string} [title]
 * @property {string} [description]
 * @property {string} [url]
 * @property {string} [timestamp]
 * @property {number} [color]
 * @property {EmbedFooterData} [footer]
 * @property {EmbedImageData} [image]
 * @property {EmbedThumbnailData} [thumbnail]
 * @property {EmbedAuthorData} [author]
 * @property {EmbedFieldData[]} [fields]
 */
/**
 * Lightweight wrapper for Discord embed-compatible JSON objects.
 *
 * Features:
 * - fluent setters and clear methods,
 * - color parsing from named colors, HEX, RGB, arrays, and numbers,
 * - timestamp normalization to ISO strings,
 * - JSON output ready for discord.js or raw REST payloads.
 *
 * @example
 * const embed = new Embed({
 *   title: "Hello",
 *   description: "World",
 *   color: "Blue",
 *   timestamp: "now",
 * });
 *
 * await message.channel.send({
 *   embeds: [embed.toJSON()],
 * });
 */
declare class Embed {
    /**
    * Creates a new embed instance from raw input data.
    *
    * @param {EmbedInputData} data Raw embed data.
    * @returns {Embed} A new embed instance.
    *
    * @example
    * const embed = Embed.from({
    *   title: "Hello",
    *   description: "Created from raw data",
    *   color: "#5865F2",
    * });
    */
    static from(data: EmbedInputData): Embed;
    /**
    * Creates a new embed wrapper.
    *
    * @param {EmbedInputData} [embed={}] Initial embed data.
    *
    * @example
    * const embed = new Embed({
    *   title: "Build status",
    *   description: "Deployment completed successfully.",
    *   color: "Green",
    *   timestamp: "now",
    *   footer: {
    *     text: "CI pipeline",
    *   },
    * });
    *
    * await channel.send({
    *   embeds: [embed.toJSON()],
    * });
    */
    constructor(embed?: EmbedInputData);
    /**
     * Sets the embed title.
     *
     * @param {string} title Embed title.
     * @returns {this} The current embed instance.
     */
    setTitle(title: string): this;
    /**
     * Sets the embed description.
     *
     * @param {string} description Embed description.
     * @returns {this} The current embed instance.
     */
    setDescription(description: string): this;
    /**
     * Sets the embed URL.
     *
     * @param {string} url Embed URL.
     * @returns {this} The current embed instance.
     */
    setURL(url: string): this;
    /**
     * Sets the embed timestamp.
     *
     * @param {"now"|Date|string} [timestamp="now"] Timestamp value.
     * @returns {this} The current embed instance.
     */
    setTimestamp(timestamp?: "now" | Date | string): this;
    /**
     * Sets the embed color.
     *
     * @param {import("discord.js").ColorResolvable} color Embed color.
     * @returns {this} The current embed instance.
     */
    setColor(color: import("discord.js").ColorResolvable): this;
    /**
    * Sets the embed footer.
    *
    * @param {string} text Footer text.
    * @param {string} [icon_url] Footer icon URL.
    * @returns {this} The current embed instance.
    *
    * @example
    * embed.setFooter(
    *   "Generated automatically",
    *   "https://example.com/footer-icon.png",
    * );
    */
    setFooter(text: string, icon_url?: string): this;
    /**
    * Sets the embed image.
    *
    * @param {string} url Image URL.
    * @param {number} [width] Image width.
    * @param {number} [height] Image height.
    * @returns {this} The current embed instance.
    *
    * @example
    * embed.setImage("attachment://banner.png");
    */
    setImage(url: string, width?: number, height?: number): this;
    /**
    * Sets the embed thumbnail.
    *
    * @param {string} url Thumbnail URL.
    * @param {number} [width] Thumbnail width.
    * @param {number} [height] Thumbnail height.
    * @returns {this} The current embed instance.
    *
    * @example
    * embed.setThumbnail("https://example.com/thumb.png");
    */
    setThumbnail(url: string, width?: number, height?: number): this;
    /**
    * Sets the embed author.
    *
    * @param {string} name Author name.
    * @param {string} [icon_url] Author icon URL.
    * @param {string} [url] Author URL.
    * @returns {this} The current embed instance.
    *
    * @example
    * embed.setAuthor(
    *   "ix-xs",
    *   "https://example.com/avatar.png",
    *   "https://example.com",
    * );
    */
    setAuthor(name: string, icon_url?: string, url?: string): this;
    /**
    * Adds a single field to the embed.
    *
    * @param {string} name Field name.
    * @param {string} value Field value.
    * @param {boolean} [inline=false] Whether the field should be inline.
    * @returns {this} The current embed instance.
    *
    * @example
    * embed.addField("Status", "Online", true);
    */
    addField(name: string, value: string, inline?: boolean): this;
    /**
    * Adds multiple fields to the embed.
    *
    * @param {EmbedFieldData[]} fields Fields to add.
    * @returns {this} The current embed instance.
    *
    * @example
    * embed.addFields([
    *   { name: "CPU", value: "23%", inline: true },
    *   { name: "RAM", value: "1.8 GB", inline: true },
    *   { name: "Uptime", value: "4h 12m", inline: true },
    * ]);
    */
    addFields(fields: EmbedFieldData[]): this;
    /**
     * Replaces all embed fields.
     *
     * @param {EmbedFieldData[]} fields New fields.
     * @returns {this} The current embed instance.
     */
    setFields(fields: EmbedFieldData[]): this;
    /**
     * Clears the embed title.
     *
     * @returns {this} The current embed instance.
     */
    clearTitle(): this;
    /**
     * Clears the embed description.
     *
     * @returns {this} The current embed instance.
     */
    clearDescription(): this;
    /**
     * Clears the embed URL.
     *
     * @returns {this} The current embed instance.
     */
    clearURL(): this;
    /**
     * Clears the embed timestamp.
     *
     * @returns {this} The current embed instance.
     */
    clearTimestamp(): this;
    /**
     * Clears the embed color.
     *
     * @returns {this} The current embed instance.
     */
    clearColor(): this;
    /**
     * Clears the embed footer.
     *
     * @returns {this} The current embed instance.
     */
    clearFooter(): this;
    /**
     * Clears the embed image.
     *
     * @returns {this} The current embed instance.
     */
    clearImage(): this;
    /**
     * Clears the embed thumbnail.
     *
     * @returns {this} The current embed instance.
     */
    clearThumbnail(): this;
    /**
     * Clears the embed author.
     *
     * @returns {this} The current embed instance.
     */
    clearAuthor(): this;
    /**
     * Clears all embed fields.
     *
     * @returns {this} The current embed instance.
     */
    clearFields(): this;
    /**
     * Removes a field by index.
     *
     * @param {number} index Field index.
     * @returns {this} The current embed instance.
     */
    removeField(index: number): this;
    /**
    * Returns the embed as a Discord-compatible JSON object.
    *
    * @returns {InternalEmbedData} The embed JSON object.
    *
    * @example
    * const payload = embed.toJSON();
    *
    * await interaction.reply({
    *   embeds: [payload],
    * });
    */
    toJSON(): InternalEmbedData;
    /**
     * Returns the embed title.
     *
     * @returns {string|undefined} The embed title.
     */
    getTitle(): string | undefined;
    /**
     * Returns the embed description.
     *
     * @returns {string|undefined} The embed description.
     */
    getDescription(): string | undefined;
    /**
     * Returns the embed URL.
     *
     * @returns {string|undefined} The embed URL.
     */
    getURL(): string | undefined;
    /**
     * Returns the embed timestamp.
     *
     * @returns {string|undefined} The embed timestamp in ISO format.
     */
    getTimestamp(): string | undefined;
    /**
     * Returns the embed color.
     *
     * @returns {number|undefined} The embed color as a decimal number.
     */
    getColor(): number | undefined;
    /**
     * Returns the embed footer.
     *
     * @returns {EmbedFooterData|undefined} The embed footer.
     */
    getFooter(): EmbedFooterData | undefined;
    /**
     * Returns the embed image.
     *
     * @returns {EmbedImageData|undefined} The embed image.
     */
    getImage(): EmbedImageData | undefined;
    /**
     * Returns the embed thumbnail.
     *
     * @returns {EmbedThumbnailData|undefined} The embed thumbnail.
     */
    getThumbnail(): EmbedThumbnailData | undefined;
    /**
     * Returns the embed author.
     *
     * @returns {EmbedAuthorData|undefined} The embed author.
     */
    getAuthor(): EmbedAuthorData | undefined;
    /**
     * Returns the embed fields.
     *
     * @returns {EmbedFieldData[]|undefined} The embed fields.
     */
    getFields(): EmbedFieldData[] | undefined;
    /**
     * Returns whether the embed has a title.
     *
     * @returns {boolean} `true` if the embed has a title, otherwise `false`.
     */
    hasTitle(): boolean;
    /**
     * Returns whether the embed has a description.
     *
     * @returns {boolean} `true` if the embed has a description, otherwise `false`.
     */
    hasDescription(): boolean;
    /**
     * Returns whether the embed contains at least one field.
     *
     * @returns {boolean} `true` if the embed contains at least one field, otherwise `false`.
     */
    hasFields(): boolean;
    /**
     * Returns the number of fields.
     *
     * @returns {number} The number of fields.
     */
    getFieldCount(): number;
    #private;
}
declare namespace Embed {
    export { EmbedFooterData, EmbedImageData, EmbedThumbnailData, EmbedAuthorData, EmbedFieldData, EmbedInputData, InternalEmbedData };
}
/**
 * Footer object used in a Discord embed.
 */
type EmbedFooterData = {
    /**
     * Footer text.
     */
    text: string;
    /**
     * Footer icon URL.
     */
    icon_url?: string | undefined;
};
/**
 * Image object used in a Discord embed.
 */
type EmbedImageData = {
    /**
     * Image URL.
     */
    url: string;
    /**
     * Image width.
     */
    width?: number | undefined;
    /**
     * Image height.
     */
    height?: number | undefined;
};
/**
 * Thumbnail object used in a Discord embed.
 */
type EmbedThumbnailData = {
    /**
     * Thumbnail URL.
     */
    url: string;
    /**
     * Thumbnail width.
     */
    width?: number | undefined;
    /**
     * Thumbnail height.
     */
    height?: number | undefined;
};
/**
 * Author object used in a Discord embed.
 */
type EmbedAuthorData = {
    /**
     * Author name.
     */
    name: string;
    /**
     * Author URL.
     */
    url?: string | undefined;
    /**
     * Author icon URL.
     */
    icon_url?: string | undefined;
};
/**
 * Field object used in a Discord embed.
 */
type EmbedFieldData = {
    /**
     * Field name.
     */
    name: string;
    /**
     * Field value.
     */
    value: string;
    /**
     * Whether the field should be inline.
     */
    inline?: boolean | undefined;
};
/**
 * User-facing embed input data.
 */
type EmbedInputData = {
    /**
     * Embed title.
     */
    title?: string | undefined;
    /**
     * Embed description.
     */
    description?: string | undefined;
    /**
     * Embed URL.
     */
    url?: string | undefined;
    /**
     * Embed timestamp.
     */
    timestamp?: Date | "now" | undefined;
    /**
     * Embed color.
     */
    color?: import("discord.js").ColorResolvable | undefined;
    /**
     * Embed footer.
     */
    footer?: EmbedFooterData | undefined;
    /**
     * Embed image.
     */
    image?: EmbedImageData | undefined;
    /**
     * Embed thumbnail.
     */
    thumbnail?: EmbedThumbnailData | undefined;
    /**
     * Embed author.
     */
    author?: EmbedAuthorData | undefined;
    /**
     * Embed fields.
     */
    fields?: EmbedFieldData[] | undefined;
};
/**
 * Internal normalized embed data ready for Discord JSON payloads.
 */
type InternalEmbedData = {
    type: "rich";
    title?: string | undefined;
    description?: string | undefined;
    url?: string | undefined;
    timestamp?: string | undefined;
    color?: number | undefined;
    footer?: EmbedFooterData | undefined;
    image?: EmbedImageData | undefined;
    thumbnail?: EmbedThumbnailData | undefined;
    author?: EmbedAuthorData | undefined;
    fields?: EmbedFieldData[] | undefined;
};
//# sourceMappingURL=Embed.d.ts.map