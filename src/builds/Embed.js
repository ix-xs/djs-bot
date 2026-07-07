// @ts-check

const { Colors } = require("discord.js");

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
class Embed {
  /** @type {InternalEmbedData} */
  #data;

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
  constructor(embed = {}) {
    this.#data = {
      type: "rich",
      title: typeof embed.title === "string" ? embed.title : undefined,
      description: typeof embed.description === "string" ? embed.description : undefined,
      url: typeof embed.url === "string" ? embed.url : undefined,
      timestamp: embed.timestamp ? this.#parseTimestamp(embed.timestamp) : undefined,
      color: embed.color !== undefined ? this.#parseColor(embed.color) : undefined,
      footer: embed.footer ? this.#parseFooter(embed.footer) : undefined,
      image: embed.image ? this.#parseImage(embed.image) : undefined,
      thumbnail: embed.thumbnail ? this.#parseThumbnail(embed.thumbnail) : undefined,
      author: embed.author ? this.#parseAuthor(embed.author) : undefined,
      fields: embed.fields ? this.#parseFields(embed.fields) : undefined,
    };
  }

  /**
   * Parses a timestamp input into an ISO 8601 string.
   *
   * @param {"now"|Date|string} timestamp Timestamp input.
   * @returns {string|undefined} The parsed ISO timestamp, or `undefined` if invalid.
   */
  #parseTimestamp(timestamp) {
    if (timestamp === "now") {
      return new Date().toISOString();
    }

    if (timestamp instanceof Date) {
      return Number.isNaN(timestamp.getTime()) ? undefined : timestamp.toISOString();
    }

    if (typeof timestamp === "string") {
      const date = new Date(timestamp);

      if (!Number.isNaN(date.getTime())) {
        return date.toISOString();
      }
    }

    return undefined;
  }

  /**
   * Parses a Discord color input into a decimal color number.
   *
   * Supports:
   * - Discord named colors from `Colors`,
   * - 6-digit HEX,
   * - 3-digit HEX,
   * - `rgb(...)` / `rgba(...)`,
   * - RGB arrays,
   * - raw decimal numbers.
   *
   * @param {import("discord.js").ColorResolvable} color Color input.
   * @returns {number|undefined} Parsed decimal color, or `undefined` if invalid.
   */
  #parseColor(color) {
    if (typeof color === "string" && color in Colors) {
      return Colors[/** @type {keyof typeof Colors} */ (color)];
    }

    if (typeof color === "string") {
      const raw = color.trim();

      if (raw.startsWith("rgb(") || raw.startsWith("rgba(")) {
        const match = raw.match(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);

        if (match) {
          const [, rText, gText, bText] = match;
          const r = Number.parseInt(rText, 10);
          const g = Number.parseInt(gText, 10);
          const b = Number.parseInt(bText, 10);

          if ([r, g, b].every((value) => Number.isInteger(value) && value >= 0 && value <= 255)) {
            return (r << 16) + (g << 8) + b;
          }
        }
      }

      let hex = raw;

      if (hex.startsWith("#")) {
        hex = hex.slice(1);
      }

      if (/^[0-9A-Fa-f]{6}$/.test(hex)) {
        return Number.parseInt(hex, 16);
      }

      if (/^[0-9A-Fa-f]{3}$/.test(hex)) {
        const expanded = hex
          .split("")
          .map((char) => char + char)
          .join("");

        return Number.parseInt(expanded, 16);
      }
    }

    if (Array.isArray(color) && color.length >= 3) {
      const [r, g, b] = color;

      if (
        typeof r === "number" &&
        typeof g === "number" &&
        typeof b === "number" &&
        [r, g, b].every((value) => Number.isInteger(value) && value >= 0 && value <= 255)
      ) {
        return (r << 16) + (g << 8) + b;
      }
    }

    if (typeof color === "number" && Number.isInteger(color) && color >= 0) {
      return color;
    }

    return undefined;
  }

  /**
   * Parses footer data.
   *
   * @param {EmbedFooterData} footer Footer data.
   * @returns {EmbedFooterData|undefined} Normalized footer data.
   */
  #parseFooter(footer) {
    if (!footer || typeof footer.text !== "string" || footer.text.length === 0) {
      return undefined;
    }

    return {
      text: footer.text,
      icon_url: typeof footer.icon_url === "string" ? footer.icon_url : undefined,
    };
  }

  /**
   * Parses image data.
   *
   * @param {EmbedImageData} image Image data.
   * @returns {EmbedImageData|undefined} Normalized image data.
   */
  #parseImage(image) {
    if (!image || typeof image.url !== "string" || image.url.length === 0) {
      return undefined;
    }

    return {
      url: image.url,
      width: typeof image.width === "number" ? image.width : undefined,
      height: typeof image.height === "number" ? image.height : undefined,
    };
  }

  /**
   * Parses thumbnail data.
   *
   * @param {EmbedThumbnailData} thumbnail Thumbnail data.
   * @returns {EmbedThumbnailData|undefined} Normalized thumbnail data.
   */
  #parseThumbnail(thumbnail) {
    if (!thumbnail || typeof thumbnail.url !== "string" || thumbnail.url.length === 0) {
      return undefined;
    }

    return {
      url: thumbnail.url,
      width: typeof thumbnail.width === "number" ? thumbnail.width : undefined,
      height: typeof thumbnail.height === "number" ? thumbnail.height : undefined,
    };
  }

  /**
   * Parses author data.
   *
   * @param {EmbedAuthorData} author Author data.
   * @returns {EmbedAuthorData|undefined} Normalized author data.
   */
  #parseAuthor(author) {
    if (!author || typeof author.name !== "string" || author.name.length === 0) {
      return undefined;
    }

    return {
      name: author.name,
      url: typeof author.url === "string" ? author.url : undefined,
      icon_url: typeof author.icon_url === "string" ? author.icon_url : undefined,
    };
  }

  /**
   * Parses field data.
   *
   * @param {EmbedFieldData[]} fields Embed fields.
   * @returns {EmbedFieldData[]|undefined} Normalized fields.
   */
  #parseFields(fields) {
    if (!Array.isArray(fields) || fields.length === 0) {
      return undefined;
    }

    const parsed = fields
      .filter(
        (field) =>
          !!field &&
          typeof field.name === "string" &&
          field.name.length > 0 &&
          typeof field.value === "string" &&
          field.value.length > 0,
      )
      .map((field) => ({
        name: field.name,
        value: field.value,
        inline: field.inline ?? false,
      }));

    return parsed.length > 0 ? parsed : undefined;
  }

  /**
   * Sets the embed title.
   *
   * @param {string} title Embed title.
   * @returns {this} The current embed instance.
   */
  setTitle(title) {
    this.#data.title = title;
    return this;
  }

  /**
   * Sets the embed description.
   *
   * @param {string} description Embed description.
   * @returns {this} The current embed instance.
   */
  setDescription(description) {
    this.#data.description = description;
    return this;
  }

  /**
   * Sets the embed URL.
   *
   * @param {string} url Embed URL.
   * @returns {this} The current embed instance.
   */
  setURL(url) {
    this.#data.url = url;
    return this;
  }

  /**
   * Sets the embed timestamp.
   *
   * @param {"now"|Date|string} [timestamp="now"] Timestamp value.
   * @returns {this} The current embed instance.
   */
  setTimestamp(timestamp = "now") {
    this.#data.timestamp = this.#parseTimestamp(timestamp);
    return this;
  }

  /**
   * Sets the embed color.
   *
   * @param {import("discord.js").ColorResolvable} color Embed color.
   * @returns {this} The current embed instance.
   */
  setColor(color) {
    this.#data.color = this.#parseColor(color);
    return this;
  }

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
  setFooter(text, icon_url = undefined) {
    this.#data.footer = this.#parseFooter({ text, icon_url });
    return this;
  }

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
  setImage(url, width = undefined, height = undefined) {
    this.#data.image = this.#parseImage({ url, width, height });
    return this;
  }

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
  setThumbnail(url, width = undefined, height = undefined) {
    this.#data.thumbnail = this.#parseThumbnail({ url, width, height });
    return this;
  }

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
  setAuthor(name, icon_url = undefined, url = undefined) {
    this.#data.author = this.#parseAuthor({ name, url, icon_url });
    return this;
  }

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
  addField(name, value, inline = false) {
    if (!this.#data.fields) {
      this.#data.fields = [];
    }

    this.#data.fields.push({ name, value, inline });
    return this;
  }

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
  addFields(fields) {
    const parsedFields = this.#parseFields(fields);

    if (!parsedFields) {
      return this;
    }

    if (!this.#data.fields) {
      this.#data.fields = [];
    }

    this.#data.fields.push(...parsedFields);
    return this;
  }

  /**
   * Replaces all embed fields.
   *
   * @param {EmbedFieldData[]} fields New fields.
   * @returns {this} The current embed instance.
   */
  setFields(fields) {
    this.#data.fields = this.#parseFields(fields);
    return this;
  }

  /**
   * Clears the embed title.
   *
   * @returns {this} The current embed instance.
   */
  clearTitle() {
    delete this.#data.title;
    return this;
  }

  /**
   * Clears the embed description.
   *
   * @returns {this} The current embed instance.
   */
  clearDescription() {
    delete this.#data.description;
    return this;
  }

  /**
   * Clears the embed URL.
   *
   * @returns {this} The current embed instance.
   */
  clearURL() {
    delete this.#data.url;
    return this;
  }

  /**
   * Clears the embed timestamp.
   *
   * @returns {this} The current embed instance.
   */
  clearTimestamp() {
    delete this.#data.timestamp;
    return this;
  }

  /**
   * Clears the embed color.
   *
   * @returns {this} The current embed instance.
   */
  clearColor() {
    delete this.#data.color;
    return this;
  }

  /**
   * Clears the embed footer.
   *
   * @returns {this} The current embed instance.
   */
  clearFooter() {
    delete this.#data.footer;
    return this;
  }

  /**
   * Clears the embed image.
   *
   * @returns {this} The current embed instance.
   */
  clearImage() {
    delete this.#data.image;
    return this;
  }

  /**
   * Clears the embed thumbnail.
   *
   * @returns {this} The current embed instance.
   */
  clearThumbnail() {
    delete this.#data.thumbnail;
    return this;
  }

  /**
   * Clears the embed author.
   *
   * @returns {this} The current embed instance.
   */
  clearAuthor() {
    delete this.#data.author;
    return this;
  }

  /**
   * Clears all embed fields.
   *
   * @returns {this} The current embed instance.
   */
  clearFields() {
    delete this.#data.fields;
    return this;
  }

  /**
   * Removes a field by index.
   *
   * @param {number} index Field index.
   * @returns {this} The current embed instance.
   */
  removeField(index) {
    if (this.#data.fields && index >= 0 && index < this.#data.fields.length) {
      this.#data.fields.splice(index, 1);

      if (this.#data.fields.length === 0) {
        delete this.#data.fields;
      }
    }

    return this;
  }

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
  toJSON() {
    return /** @type {InternalEmbedData} */ ({
      ...Object.fromEntries(
        Object.entries(this.#data).filter(([, value]) => value !== undefined),
      ),
      type: "rich",
    });
  }

  /**
   * Returns the embed title.
   *
   * @returns {string|undefined} The embed title.
   */
  getTitle() {
    return this.#data.title;
  }

  /**
   * Returns the embed description.
   *
   * @returns {string|undefined} The embed description.
   */
  getDescription() {
    return this.#data.description;
  }

  /**
   * Returns the embed URL.
   *
   * @returns {string|undefined} The embed URL.
   */
  getURL() {
    return this.#data.url;
  }

  /**
   * Returns the embed timestamp.
   *
   * @returns {string|undefined} The embed timestamp in ISO format.
   */
  getTimestamp() {
    return this.#data.timestamp;
  }

  /**
   * Returns the embed color.
   *
   * @returns {number|undefined} The embed color as a decimal number.
   */
  getColor() {
    return this.#data.color;
  }

  /**
   * Returns the embed footer.
   *
   * @returns {EmbedFooterData|undefined} The embed footer.
   */
  getFooter() {
    return this.#data.footer;
  }

  /**
   * Returns the embed image.
   *
   * @returns {EmbedImageData|undefined} The embed image.
   */
  getImage() {
    return this.#data.image;
  }

  /**
   * Returns the embed thumbnail.
   *
   * @returns {EmbedThumbnailData|undefined} The embed thumbnail.
   */
  getThumbnail() {
    return this.#data.thumbnail;
  }

  /**
   * Returns the embed author.
   *
   * @returns {EmbedAuthorData|undefined} The embed author.
   */
  getAuthor() {
    return this.#data.author;
  }

  /**
   * Returns the embed fields.
   *
   * @returns {EmbedFieldData[]|undefined} The embed fields.
   */
  getFields() {
    return this.#data.fields;
  }

  /**
   * Returns whether the embed has a title.
   *
   * @returns {boolean} `true` if the embed has a title, otherwise `false`.
   */
  hasTitle() {
    return Boolean(this.#data.title);
  }

  /**
   * Returns whether the embed has a description.
   *
   * @returns {boolean} `true` if the embed has a description, otherwise `false`.
   */
  hasDescription() {
    return Boolean(this.#data.description);
  }

  /**
   * Returns whether the embed contains at least one field.
   *
   * @returns {boolean} `true` if the embed contains at least one field, otherwise `false`.
   */
  hasFields() {
    return Boolean(this.#data.fields && this.#data.fields.length > 0);
  }

  /**
   * Returns the number of fields.
   *
   * @returns {number} The number of fields.
   */
  getFieldCount() {
    return this.#data.fields?.length ?? 0;
  }

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
  static from(data) {
    return new Embed(data);
  }
}

module.exports = Embed;