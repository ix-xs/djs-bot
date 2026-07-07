export = File;
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
declare class File {
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
    static from(options: FileOptions): File;
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
    constructor(options: FileOptions);
    /**
     * Returns the file URL.
     *
     * @returns {string} The file URL.
     */
    getURL(): string;
    /**
     * Returns the file name.
     *
     * @returns {string|undefined} The file name.
     */
    getName(): string | undefined;
    /**
     * Returns whether the file is spoilered.
     *
     * @returns {boolean} `true` if spoilered, otherwise `false`.
     */
    isSpoiler(): boolean;
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
    setURL(url: string): this;
    /**
     * Sets the file name.
     *
     * @param {string} name New file name.
     * @returns {this} The current file instance.
     *
     * @example
     * file.setName("final-report.pdf");
     */
    setName(name: string): this;
    /**
     * Clears the file name.
     *
     * @returns {this} The current file instance.
     */
    clearName(): this;
    /**
     * Sets the spoiler state.
     *
     * @param {boolean} [spoiler=true] Whether the file should be spoilered.
     * @returns {this} The current file instance.
     *
     * @example
     * file.setSpoiler(true);
     */
    setSpoiler(spoiler?: boolean): this;
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
    toJSON(): FileData;
    #private;
}
declare namespace File {
    export { FileOptions, FileReferenceData, FileData };
}
/**
 * Raw options used to create a {@link File} instance.
 */
type FileOptions = {
    /**
     * File URL or attachment reference.
     */
    url: string;
    /**
     * File display name.
     */
    name?: string | undefined;
    /**
     * Whether the file should be marked as spoiler.
     */
    spoiler?: boolean | undefined;
};
/**
 * Discord-compatible file reference.
 */
type FileReferenceData = {
    /**
     * File URL or attachment reference.
     */
    url: string;
};
/**
 * Discord-compatible file payload.
 */
type FileData = {
    /**
     * Discord component type for a file component.
     */
    type: 13;
    /**
     * File reference object.
     */
    file: FileReferenceData;
    /**
     * File display name.
     */
    name?: string | undefined;
    /**
     * Whether the file is marked as spoiler.
     */
    spoiler?: boolean | undefined;
};
//# sourceMappingURL=File.d.ts.map