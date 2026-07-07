export = Attachment;
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
declare class Attachment {
    /**
     * Creates an attachment from a buffer.
     *
     * @param {Buffer} buffer The file buffer.
     * @param {AttachmentOptions} [options={}] Additional attachment options.
     * @returns {Attachment} A new attachment instance.
     */
    static fromBuffer(buffer: Buffer, options?: AttachmentOptions): Attachment;
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
    static fromText(text: string, options?: AttachmentOptions): Attachment;
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
    static fromJSON(data: any, options?: AttachmentOptions): Attachment;
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
    static fromHTML(html: string, options?: AttachmentOptions): Attachment;
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
    static fromCSV(rows: Array<Array<any>>, options?: AttachmentOptions): Attachment;
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
    constructor(file: AttachmentFile, options?: AttachmentOptions);
    /**
     * Replaces the attachment file.
     *
     * If the attachment does not already have a name, a new one is generated.
     *
     * @param {AttachmentFile} file The new file source.
     * @returns {this} The current attachment instance.
     * @throws {TypeError} Throws if the provided file type is not supported.
     */
    setFile(file: AttachmentFile): this;
    /**
     * Sets the attachment file name.
     *
     * This also updates the embed-ready `attachment://...` URL.
     *
     * @param {string} name The new file name.
     * @returns {this} The current attachment instance.
     * @throws {TypeError} Throws if `name` is not a string.
     */
    setName(name: string): this;
    /**
     * Sets the attachment description.
     *
     * @param {string} description The attachment description.
     * @returns {this} The current attachment instance.
     * @throws {TypeError} Throws if `description` is not a string.
     */
    setDescription(description: string): this;
    /**
     * Marks the attachment as spoiler or non-spoiler.
     *
     * @param {boolean} [spoiler=true] Whether the attachment should be marked as a spoiler.
     * @returns {this} The current attachment instance.
     */
    setSpoiler(spoiler?: boolean): this;
    /**
     * Returns the underlying Discord attachment builder.
     *
     * @returns {AttachmentBuilder} The wrapped attachment builder.
     */
    toFile(): AttachmentBuilder;
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
    toURL(): string;
    /**
     * Returns whether the attachment file name points to an image extension.
     *
     * @returns {boolean} `true` if the attachment appears to be an image file, otherwise `false`.
     */
    isImage(): boolean;
    #private;
}
declare namespace Attachment {
    export { AttachmentFile, AttachmentOptions };
}
import { AttachmentBuilder } from "discord.js";
/**
 * Supported attachment file inputs.
 *
 * Discord accepts either a buffer, a string (path or URL), or a Node.js stream
 * as attachment sources.
 */
type AttachmentFile = Buffer | string | import("node:stream").Stream;
/**
 * Options used to create an {@link Attachment} instance.
 */
type AttachmentOptions = {
    /**
     * Custom file name for the attachment. If omitted, a name is generated automatically.
     */
    name?: string | undefined;
    /**
     * Optional attachment description.
     */
    description?: string | null | undefined;
    /**
     * Whether the attachment should be marked as a spoiler.
     */
    spoiler?: boolean | undefined;
};
//# sourceMappingURL=Attachment.d.ts.map