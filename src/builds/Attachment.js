// @ts-check

const nodeComfort = require("@ix-xs/node-comfort");
const { extname, basename } = require("node:path");
const { AttachmentBuilder } = require("discord.js");

/**
 * Supported attachment file inputs.
 *
 * Discord accepts either a buffer, a string (path or URL), or a Node.js stream
 * as attachment sources.
 *
 * @typedef {Buffer | string | import("node:stream").Stream} AttachmentFile
 */

/**
 * Options used to create an {@link Attachment} instance.
 *
 * @typedef {Object} AttachmentOptions
 * @property {string} [name] Custom file name for the attachment. If omitted, a name is generated automatically.
 * @property {string | null} [description] Optional attachment description.
 * @property {boolean} [spoiler=false] Whether the attachment should be marked as a spoiler.
 */

const IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".bmp",
  ".tiff",
  ".svg",
]);

/**
 * Runtime type guard to detect Node.js streams.
 *
 * @param {unknown} value
 * @returns {value is import("node:stream").Stream}
 */
function isReadableStream(value) {
  return (
    !!value &&
    typeof value === "object" &&
    "pipe" in value &&
    typeof /** @type {any} */ (value).pipe === "function"
  );
}

/**
 * Lightweight wrapper around Discord's {@link AttachmentBuilder}.
 *
 * This class provides:
 * - automatic file name generation when no name is provided,
 * - helper factories for text, JSON, HTML, and CSV content,
 * - a ready-to-use `attachment://...` URL for embeds.
 *
 * @example
 * const Attachment = require("./Attachment");
 *
 * const file = new Attachment(buffer, { name: "image.png" });
 *
 * await message.channel.send({
 *   embeds: [{ image: { url: file.toURL() } }],
 *   files: [file.toFile()],
 * });
 */
class Attachment {
  /** @type {AttachmentBuilder} */
  #builder;

  /** @type {string} */
  #embedURL;

  /**
   * Creates a new attachment wrapper.
   *
   * @param {AttachmentFile} file A file buffer, readable stream, or file path.
   * @param {AttachmentOptions} [options={}] Additional attachment options.
   * @throws {TypeError} Throws if the provided file type is not supported.
   *
   * @example
   * const file = new Attachment("./assets/logo.png", {
   *   name: "logo.png",
   *   description: "Project logo",
   * });
   *
   * await channel.send({
   *   files: [file.toFile()],
   * });
   */
  constructor(file, options = {}) {
    if (!Buffer.isBuffer(file) && typeof file !== "string" && !isReadableStream(file)) {
      throw new TypeError("Attachment: 'file' must be a Buffer, a readable Stream, or a file path string.");
    }

    const { name, description = null, spoiler = false } = options;

    if (name !== undefined && typeof name !== "string") {
      throw new TypeError("Attachment: 'name' must be a string when provided.");
    }

    if (description !== null && description !== undefined && typeof description !== "string") {
      throw new TypeError("Attachment: 'description' must be a string or null.");
    }

    if (typeof spoiler !== "boolean") {
      throw new TypeError("Attachment: 'spoiler' must be a boolean.");
    }

    const resolvedName = name ?? this.#resolveName(file);
    const builder = new AttachmentBuilder(file).setName(resolvedName);

    if (description !== null) {
      builder.setDescription(description);
    }

    if (spoiler) {
      builder.setSpoiler(true);
    }

    this.#builder = builder;
    this.#embedURL = `attachment://${resolvedName}`;
  }

  /**
   * Resolves a default file name from the provided file input.
   *
   * Rules:
   * - File paths preserve their base name when possible.
   * - Buffers try to infer an extension from their binary signature.
   * - Stream-like objects fall back to `data.bin`.
   *
   * @param {AttachmentFile} file The provided file input.
   * @returns {string} The generated file name.
   */
  #resolveName(file) {
    if (typeof file === "string") {
      const fileName = basename(file);
      return fileName && fileName !== "." ? fileName : `data${extname(file).toLowerCase() || ".bin"}`;
    }

    if (Buffer.isBuffer(file)) {
      return `data.${this.#detectBufferExtension(file)}`;
    }

    return "data.bin";
  }

  /**
   * Attempts to detect a file extension from a buffer signature.
   *
   * Supported signatures include PNG, JPG, GIF, PDF, BMP, WEBP, JSON, and HTML.
   *
   * @param {Buffer} buffer The file buffer.
   * @returns {string} The detected extension without a leading dot.
   */
  #detectBufferExtension(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length < 4) {
      return "bin";
    }

    // PNG
    if (
      buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    ) {
      return "png";
    }

    // JPEG
    if (buffer.length >= 3 && buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) {
      return "jpg";
    }

    // GIF
    if (
      buffer.length >= 6 &&
      (buffer.subarray(0, 6).toString() === "GIF87a" || buffer.subarray(0, 6).toString() === "GIF89a")
    ) {
      return "gif";
    }

    // PDF
    if (buffer.length >= 4 && buffer.subarray(0, 4).toString() === "%PDF") {
      return "pdf";
    }

    // BMP
    if (buffer.length >= 2 && buffer.subarray(0, 2).toString() === "BM") {
      return "bmp";
    }

    // WEBP
    if (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString() === "RIFF" &&
      buffer.subarray(8, 12).toString() === "WEBP"
    ) {
      return "webp";
    }

    const textStart = buffer.subarray(0, 80).toString("utf8").trimStart();

    if (textStart.startsWith("{") || textStart.startsWith("[")) {
      return "json";
    }

    if (textStart.startsWith("<svg")) {
      return "svg";
    }

    if (textStart.startsWith("<!DOCTYPE html") || textStart.startsWith("<html")) {
      return "html";
    }

    return "bin";
  }

  /**
   * Replaces the attachment file.
   *
   * If the attachment does not already have a name, a new one is generated.
   *
   * @param {AttachmentFile} file The new file source.
   * @returns {this} The current attachment instance.
   * @throws {TypeError} Throws if the provided file type is not supported.
   */
  setFile(file) {
    if (!Buffer.isBuffer(file) && typeof file !== "string" && !isReadableStream(file)) {
      throw new TypeError("Attachment.setFile(): 'file' must be a Buffer, a readable Stream, or a file path string.");
    }

    const currentName = this.#builder.name || this.#resolveName(file);
    this.#builder.setFile(file, currentName);
    this.#embedURL = `attachment://${currentName}`;

    return this;
  }

  /**
   * Sets the attachment file name.
   *
   * This also updates the embed-ready `attachment://...` URL.
   *
   * @param {string} name The new file name.
   * @returns {this} The current attachment instance.
   * @throws {TypeError} Throws if `name` is not a string.
   */
  setName(name) {
    if (typeof name !== "string" || name.length === 0) {
      throw new TypeError("Attachment.setName(): 'name' must be a non-empty string.");
    }

    this.#builder.setName(name);
    this.#embedURL = `attachment://${name}`;

    return this;
  }

  /**
   * Sets the attachment description.
   *
   * @param {string} description The attachment description.
   * @returns {this} The current attachment instance.
   * @throws {TypeError} Throws if `description` is not a string.
   */
  setDescription(description) {
    if (typeof description !== "string") {
      throw new TypeError("Attachment.setDescription(): 'description' must be a string.");
    }

    this.#builder.setDescription(description);
    return this;
  }

  /**
   * Marks the attachment as spoiler or non-spoiler.
   *
   * @param {boolean} [spoiler=true] Whether the attachment should be marked as a spoiler.
   * @returns {this} The current attachment instance.
   */
  setSpoiler(spoiler = true) {
    this.#builder.setSpoiler(Boolean(spoiler));
    return this;
  }

  /**
   * Returns the underlying Discord attachment builder.
   *
   * @returns {AttachmentBuilder} The wrapped attachment builder.
   */
  toFile() {
    return this.#builder;
  }

  /**
   * Returns the embed-ready `attachment://...` URL.
   *
   * This URL can be used in embed image or thumbnail fields.
   *
   * @returns {string} The embed-ready attachment URL.
   *
   * @example
   * const embed = {
   *   image: {
   *     url: file.toURL(),
   *   },
   * };
   */
  toURL() {
    return this.#embedURL;
  }

  /**
   * Returns whether the attachment file name points to an image extension.
   *
   * @returns {boolean} `true` if the attachment appears to be an image file, otherwise `false`.
   */
  isImage() {
    return IMAGE_EXTENSIONS.has(extname(this.#builder.name || "").toLowerCase());
  }

  /**
   * Creates an attachment from a buffer.
   *
   * @param {Buffer} buffer The file buffer.
   * @param {AttachmentOptions} [options={}] Additional attachment options.
   * @returns {Attachment} A new attachment instance.
   */
  static fromBuffer(buffer, options = {}) {
    return new Attachment(buffer, options);
  }

  /**
   * Creates a text file attachment from a string.
   *
   * @param {string} text The text content.
   * @param {AttachmentOptions} [options={}] Additional attachment options.
   * @returns {Attachment} A new text attachment.
   *
   * @example
   * const file = Attachment.fromText("Hello world", {
   *   name: "hello.txt",
   * });
   */
  static fromText(text, options = {}) {
    return new Attachment(Buffer.from(text, "utf8"), {
      name: options.name ?? "file.txt",
      description: options.description ?? null,
      spoiler: options.spoiler ?? false,
    });
  }

  /**
   * Creates a JSON file attachment from any serializable value.
   *
   * @param {*} data A JSON-serializable value.
   * @param {AttachmentOptions} [options={}] Additional attachment options.
   * @returns {Attachment} A new JSON attachment.
   *
   * @example
   * const file = Attachment.fromJSON({
   *   id: 42,
   *   username: "ix-xs",
   * }, {
   *   name: "user.json",
   * });
   */
  static fromJSON(data, options = {}) {
    const json = typeof nodeComfort.JSONString === "function"
      ? nodeComfort.JSONString(data)
      : JSON.stringify(data, null, 2);

    return Attachment.fromText(json, {
      name: options.name ?? "data.json",
      description: options.description ?? null,
      spoiler: options.spoiler ?? false,
    });
  }

  /**
   * Creates an HTML file attachment from a string.
   *
   * @param {string} html The HTML content.
   * @param {AttachmentOptions} [options={}] Additional attachment options.
   * @returns {Attachment} A new HTML attachment.
   *
   * @example
   * const file = Attachment.fromHTML("<h1>Hello</h1>", {
   *   name: "page.html",
   * });
   */
  static fromHTML(html, options = {}) {
    return Attachment.fromText(html, {
      name: options.name ?? "page.html",
      description: options.description ?? null,
      spoiler: options.spoiler ?? false,
    });
  }

  /**
   * Creates a CSV file attachment from a two-dimensional array.
   *
   * @param {Array<Array<*>>} rows The CSV rows.
   * @param {AttachmentOptions} [options={}] Additional attachment options.
   * @returns {Attachment} A new CSV attachment.
   *
   * @example
   * const file = Attachment.fromCSV([
   *   ["id", "name"],
   *   [1, "John"],
   *   [2, "Bob"],
   * ], {
   *   name: "users.csv",
   * });
   */
  static fromCSV(rows, options = {}) {
    const csv = rows
      .map((row) =>
        row
          .map((cell) => {
            const value = String(cell ?? "");

            if (value.includes("\"") || value.includes(",") || value.includes("\n")) {
              return `"${value.replace(/"/g, "\"\"")}"`;
            }

            return value;
          })
          .join(","),
      )
      .join("\n");

    return Attachment.fromText(csv, {
      name: options.name ?? "data.csv",
      description: options.description ?? null,
      spoiler: options.spoiler ?? false,
    });
  }
}

module.exports = Attachment;